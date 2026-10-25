import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { DEMO_USERS } from "../auth/demoUsers";
import { getStaffUserById } from "../services/staffUserService";
import {
  API_ACCESS_TOKEN_KEY,
  API_REFRESH_TOKEN_KEY,
  clearApiTokens,
  getDjangoCurrentUser,
  isApiAuthEnabled,
  loginWithDjango,
  normaliseBackendUser,
  refreshDjangoToken,
  safelyReadSessionStorage,
  safelyWriteSessionStorage,
  authJsonRequest,
  authBlobRequest,
} from "../services/authApi";

const AuthContext = createContext(null);
const DEMO_SESSION_KEY = "techgear_demo_session_v1";
const isStorefrontAuthEnabled = String(import.meta.env.VITE_STOREFRONT_AUTH_MODE || "demo").trim().toLowerCase() === "api";

function readSavedDemoUser() {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.id || !parsed.role) {
      localStorage.removeItem(DEMO_SESSION_KEY);
      return null;
    }

    const role = String(parsed.role).toUpperCase();
    if (role !== "CUSTOMER") {
      const staffAccount = getStaffUserById(parsed.id, DEMO_USERS);
      if (!staffAccount || !staffAccount.active) {
        localStorage.removeItem(DEMO_SESSION_KEY);
        return null;
      }
      return { ...parsed, ...staffAccount, role: staffAccount.role };
    }
    return { ...parsed, role };
  } catch {
    return null;
  }
}

function readSavedCustomerUser() {
  const user = readSavedDemoUser();
  if (user?.role === "CUSTOMER") return user;
  try {
    // Do not restore a local demo staff session while real Django auth is enabled.
    localStorage.removeItem(DEMO_SESSION_KEY);
  } catch {
    // Ignore unavailable storage.
  }
  return null;
}

function readInitialUser() {
  if (!isApiAuthEnabled) return readSavedDemoUser();
  const storedRefresh = safelyReadSessionStorage(API_REFRESH_TOKEN_KEY);
  const storedAccess = safelyReadSessionStorage(API_ACCESS_TOKEN_KEY);
  if (storedRefresh || storedAccess) return null;
  return readSavedCustomerUser();
}

function saveApiTokens(tokens) {
  if (!tokens?.access || !tokens?.refresh) {
    throw new Error("The authentication API did not return a complete token pair.");
  }
  safelyWriteSessionStorage(API_ACCESS_TOKEN_KEY, tokens.access);
  safelyWriteSessionStorage(API_REFRESH_TOKEN_KEY, tokens.refresh);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readInitialUser);
  const [accessToken, setAccessToken] = useState(() =>
    isApiAuthEnabled ? safelyReadSessionStorage(API_ACCESS_TOKEN_KEY) : null
  );
  const [isInitializing, setIsInitializing] = useState(() =>
    Boolean(isApiAuthEnabled && (safelyReadSessionStorage(API_ACCESS_TOKEN_KEY) || safelyReadSessionStorage(API_REFRESH_TOKEN_KEY)))
  );
  const [authError, setAuthError] = useState("");

  // Restore a real Django CRM session after browser refresh. Customer storefront demo
  // login remains separate until the backend provides a dedicated customer role/flow.
  useEffect(() => {
    if (!isApiAuthEnabled) {
      setIsInitializing(false);
      return undefined;
    }

    const storedAccess = safelyReadSessionStorage(API_ACCESS_TOKEN_KEY);
    const storedRefresh = safelyReadSessionStorage(API_REFRESH_TOKEN_KEY);
    if (!storedAccess && !storedRefresh) {
      setIsInitializing(false);
      return undefined;
    }

    let cancelled = false;
    const restoreSession = async () => {
      try {
        let access = storedAccess;
        let rawUser = null;

        if (access) {
          try {
            rawUser = await getDjangoCurrentUser(access);
          } catch (error) {
            if (error.status !== 401) throw error;
            access = null;
          }
        }

        if (!access) {
          if (!storedRefresh) throw new Error("Your session expired. Please sign in again.");
          const refreshed = await refreshDjangoToken(storedRefresh);
          access = refreshed?.access;
          const newRefresh = refreshed?.refresh || storedRefresh;
          if (!access) throw new Error("The refresh endpoint did not return an access token.");
          safelyWriteSessionStorage(API_ACCESS_TOKEN_KEY, access);
          safelyWriteSessionStorage(API_REFRESH_TOKEN_KEY, newRefresh);
          rawUser = await getDjangoCurrentUser(access);
        }

        const normalised = normaliseBackendUser(rawUser);
        if (!cancelled) {
          setAccessToken(access);
          setUser(normalised);
          setAuthError("");
        }
      } catch (error) {
        if (!cancelled) {
          setAccessToken(null);
          setUser(readSavedCustomerUser());
          setAuthError(error.status === 0
            ? "Could not reconnect to Django to restore your session. Please sign in again when the backend is available."
            : "Your session could not be restored. Please sign in again.");
        }
        clearApiTokens();
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    };

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  // Demo login is retained for the customer storefront. Real staff login must use loginWithBackend.
  const login = useCallback((userData) => {
    const role = String(userData?.role || "CUSTOMER").toUpperCase();
    if (isApiAuthEnabled && role !== "CUSTOMER") {
      throw new Error("Demo staff login is disabled in API authentication mode.");
    }

    clearApiTokens();
    setAccessToken(null);
    const nextUser = { ...userData, role };
    setUser(nextUser);
    setAuthError("");
    try {
      localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(nextUser));
    } catch (error) {
      console.warn("Could not persist demo session:", error);
    }
    return nextUser;
  }, []);

  const loginWithBackend = useCallback(async (email, password) => {
    if (!isApiAuthEnabled) {
      throw new Error("Real Django authentication is disabled. Set VITE_AUTH_MODE=api and restart Vite.");
    }
    setAuthError("");
    const tokens = await loginWithDjango(email, password);
    saveApiTokens(tokens);

    try {
      const rawUser = await getDjangoCurrentUser(tokens.access);
     const normalised = normaliseBackendUser(rawUser);

// Shared login supports both customers and CRM staff.
// The login page redirects users according to their role.
try {
  localStorage.removeItem(DEMO_SESSION_KEY);
} catch {
  // Ignore unavailable storage.
}
      setAccessToken(tokens.access);
      setUser(normalised);
      setAuthError("");
      return normalised;
    } catch (error) {
      clearApiTokens();
      setAccessToken(null);
      setUser(null);
      throw error;
    }
  }, []);

  const loginWithCustomerBackend = useCallback(async (email, password) => {
    if (!isApiAuthEnabled || !isStorefrontAuthEnabled) {
      throw new Error("Storefront API login is disabled. Set VITE_STOREFRONT_AUTH_MODE=api and VITE_AUTH_MODE=api, then restart Vite.");
    }
    setAuthError("");
    const tokens = await loginWithDjango(email, password);
    saveApiTokens(tokens);
    try {
      const rawUser = await getDjangoCurrentUser(tokens.access);
      const normalised = normaliseBackendUser(rawUser);
      if (normalised.role !== "CUSTOMER") {
        throw new Error("This account is for CRM staff. Please use the CRM sign-in page.");
      }
      try { localStorage.removeItem(DEMO_SESSION_KEY); } catch { /* ignore */ }
      setAccessToken(tokens.access);
      setUser(normalised);
      setAuthError("");
      return normalised;
    } catch (error) {
      clearApiTokens();
      setAccessToken(null);
      setUser(null);
      throw error;
    }
  }, []);

  const registerCustomerWithBackend = useCallback(async ({ firstName, lastName, email, password }) => {
    if (!isApiAuthEnabled || !isStorefrontAuthEnabled) {
      throw new Error("Storefront API registration is disabled. Set VITE_STOREFRONT_AUTH_MODE=api and VITE_AUTH_MODE=api, then restart Vite.");
    }
    await authJsonRequest("/api/auth/register/", {
  method: "POST",
  body: {
    first_name: String(firstName || "").trim(),
    last_name: String(lastName || "").trim(),
    email: String(email || "").trim().toLowerCase(),
    password,
  },
});
    return loginWithCustomerBackend(email, password);
  }, [loginWithCustomerBackend]);

  const refreshCurrentUser = useCallback(async () => {
    if (!isApiAuthEnabled) return user;
    const token = accessToken || safelyReadSessionStorage(API_ACCESS_TOKEN_KEY);
    if (!token) return user;
    const rawUser = await getDjangoCurrentUser(token);
    const normalised = normaliseBackendUser(rawUser);
    setUser(normalised);
    return normalised;
  }, [accessToken, user]);

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setAuthError("");
    clearApiTokens();
    try {
      localStorage.removeItem(DEMO_SESSION_KEY);
    } catch (error) {
      console.warn("Could not clear demo session:", error);
    }
    // The supplied Django backend does not expose a refresh-token blacklist/logout endpoint yet.
    // This clears this browser session; server-side token revocation remains a backend task.
  }, []);

  const hasRole = useCallback((allowedRoles) => {
    if (!user?.role) return false;
    if (!allowedRoles || allowedRoles.length === 0) return true;
    return allowedRoles.map((role) => String(role).toUpperCase()).includes(user.role);
  }, [user]);

  const authenticatedRequest = useCallback(async (path, options = {}) => {
    if (!isApiAuthEnabled) throw new Error("Authenticated API requests require VITE_AUTH_MODE=api.");

    let token = accessToken || safelyReadSessionStorage(API_ACCESS_TOKEN_KEY);
    if (!token) throw new Error("Please sign in before requesting this protected API.");

    const requestOnce = (currentToken) => authJsonRequest(path, { ...options, accessToken: currentToken });
    try {
      return await requestOnce(token);
    } catch (error) {
      if (error.status !== 401) throw error;
      const refresh = safelyReadSessionStorage(API_REFRESH_TOKEN_KEY);
      if (!refresh) {
        logout();
        throw new Error(
          "Your session expired. Please sign in again.",
          { cause: error }
        );
      }

      try {
        const refreshed = await refreshDjangoToken(refresh);
        if (!refreshed?.access) {
          throw new Error(
            "The refresh endpoint did not return an access token.",
            { cause: error }
          );
        }
        token = refreshed.access;
        safelyWriteSessionStorage(API_ACCESS_TOKEN_KEY, token);
        safelyWriteSessionStorage(API_REFRESH_TOKEN_KEY, refreshed.refresh || refresh);
        setAccessToken(token);
        const result = await requestOnce(token);
        return result;
      } catch (refreshError) {
        logout();
        throw refreshError;
      }
    }
  }, [accessToken, logout]);

  const authenticatedBlobRequest = useCallback(async (path, options = {}) => {
    if (!isApiAuthEnabled) throw new Error("Protected image requests require VITE_AUTH_MODE=api.");
    let token = accessToken || safelyReadSessionStorage(API_ACCESS_TOKEN_KEY);
    if (!token) throw new Error("Please sign in before requesting this protected image.");
    try {
      return await authBlobRequest(path, { ...options, accessToken: token });
    } catch (error) {
      if (error.status !== 401) throw error;
      const refresh = safelyReadSessionStorage(API_REFRESH_TOKEN_KEY);
      if (!refresh) {
        logout();
        throw new Error(
            "Your session expired. Please sign in again.",
            { cause: error }
          );
      }
      try {
        const refreshed = await refreshDjangoToken(refresh);
        if (!refreshed?.access) {
          if (!refreshed?.access) {
              throw new Error(
                "The refresh endpoint did not return an access token.",
                { cause: error }
              );
            }
        }
        token = refreshed.access;
        safelyWriteSessionStorage(API_ACCESS_TOKEN_KEY, token);
        safelyWriteSessionStorage(API_REFRESH_TOKEN_KEY, refreshed.refresh || refresh);
        setAccessToken(token);
        return await authBlobRequest(path, { ...options, accessToken: token });
      } catch (refreshError) {
        logout();
        throw refreshError;
      }
    }
  }, [accessToken, logout]);

  const value = useMemo(
    () => ({
      user,
      login,
      loginWithBackend,
      loginWithCustomerBackend,
      registerCustomerWithBackend,
      refreshCurrentUser,
      logout,
      hasRole,
      isAuthenticated: Boolean(user),
      isCrmUser: Boolean(user && user.role !== "CUSTOMER"),
      isInitializing,
      authError,
      accessToken,
      authenticatedRequest,
      authenticatedBlobRequest,
      isApiAuthEnabled,
      isStorefrontAuthEnabled,
    }),
    [user, login, loginWithBackend, loginWithCustomerBackend, registerCustomerWithBackend, refreshCurrentUser, logout, hasRole, isInitializing, authError, accessToken, authenticatedRequest, authenticatedBlobRequest, isStorefrontAuthEnabled],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}

export { DEMO_SESSION_KEY };
