const rawBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
export const API_BASE_URL = rawBaseUrl.replace(/\/+$/, "");
export const AUTH_MODE = String(import.meta.env.VITE_AUTH_MODE || "demo").trim().toLowerCase();
export const isApiAuthEnabled = AUTH_MODE === "api";

export const API_ACCESS_TOKEN_KEY = "techgear_api_access_v1";
export const API_REFRESH_TOKEN_KEY = "techgear_api_refresh_v1";

let refreshInFlight = null;

function apiUrl(path) {
  const normalisedPath = String(path || "").startsWith("/") ? String(path) : `/${path}`;
  return `${API_BASE_URL}${normalisedPath}`;
}

async function parseResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

function messageFromPayload(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload.detail === "string") return payload.detail;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error === "string") return payload.error;

  const firstField = Object.entries(payload).find(([, value]) => Array.isArray(value) && value.length);
  if (firstField) return `${firstField[0]}: ${firstField[1][0]}`;

  const firstString = Object.entries(payload).find(([, value]) => typeof value === "string");
  if (firstString) return firstString[1];
  return fallback;
}

export async function authJsonRequest(path, { method = "GET", body, accessToken, signal } = {}) {
  const headers = { Accept: "application/json" };
  const isMultipart = typeof FormData !== "undefined" && body instanceof FormData;
  // Let the browser set multipart boundaries for image uploads; JSON remains the default.
  if (body !== undefined && !isMultipart) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let response;
  try {
    response = await fetch(apiUrl(path), {
      method,
      headers,
      body: body === undefined ? undefined : (isMultipart ? body : JSON.stringify(body)),
      signal,
    });
  } catch (error) {
    const networkError = new Error(
      "Could not connect to Django. Confirm the backend is running at the configured API URL."
    );
    networkError.cause = error;
    networkError.status = 0;
    throw networkError;
  }

  const payload = await parseResponse(response);
  if (!response.ok) {
    const error = new Error(messageFromPayload(payload, `Request failed (${response.status}).`));
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function authBlobRequest(path, { accessToken, signal } = {}) {
  const headers = { Accept: "image/*" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let response;
  try {
    response = await fetch(apiUrl(path), { method: "GET", headers, signal });
  } catch (error) {
    const networkError = new Error("Could not connect to Django to load the protected profile image.");
    networkError.cause = error;
    networkError.status = 0;
    throw networkError;
  }
  if (!response.ok) {
    let payload = null;
    try { payload = await response.clone().json(); } catch { /* the image endpoint may return a plain-text error */ }
    const detail = messageFromPayload(payload, response.status === 404 ? "No profile image has been uploaded." : `Request failed (${response.status}).`);
    const error = new Error(detail);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return response.blob();
}

export async function loginWithDjango(email, password) {
  const payload = await authJsonRequest("/api/auth/login/", {
    method: "POST",
    body: { email: String(email || "").trim().toLowerCase(), password },
  });

  if (!payload?.access || !payload?.refresh) {
    throw new Error("Django login succeeded but did not return both access and refresh tokens.");
  }
  return payload;
}

export async function getDjangoCurrentUser(accessToken) {
  return authJsonRequest("/api/auth/me/", { accessToken });
}

export function refreshDjangoToken(refreshToken) {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = authJsonRequest("/api/auth/refresh/", {
    method: "POST",
    body: { refresh: refreshToken },
  }).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

// Translate backend role codes to the existing frontend navigation roles.
// Django remains authoritative for API authorization; this mapping only controls UI routing.
export function mapBackendRole(role) {
  const key = String(role || "").trim().toUpperCase();
  const mapping = {
    ADMIN: "ADMIN",
    CUSTOMER: "CUSTOMER",
    SALES: "CRM_MANAGER",
    MARKETING: "MARKETING_MANAGER",
    SUPPORT: "SUPPORT_AGENT",
    MANAGEMENT: "ANALYST",
    OPERATIONS: "OPERATIONS",
  };
  return mapping[key] || null;
}

export function normaliseBackendUser(rawUser) {
  if (!rawUser || rawUser.id === undefined || !rawUser.email) {
    throw new Error("The current-user API returned an unexpected user response.");
  }
  if (rawUser.is_active === false) {
    throw new Error("This account is inactive. Contact your administrator.");
  }

  const frontendRole = mapBackendRole(rawUser.role);
  if (!frontendRole) {
    throw new Error(`The backend role '${rawUser.role || "unknown"}' has not been mapped to a CRM UI role.`);
  }

  const email = String(rawUser.email);
  const namePart = [rawUser.first_name, rawUser.last_name].filter(Boolean).join(" ").trim() || email.split("@")[0].replace(/[._-]+/g, " ").trim();
  return {
    id: String(rawUser.id),
    email,
    name: namePart ? namePart.replace(/\b\w/g, (letter) => letter.toUpperCase()) : email,
    role: frontendRole,
    backendRole: String(rawUser.role || "").toUpperCase(),
    active: rawUser.is_active !== false,
    isDemo: false,
    authProvider: "django",
    dateJoined: rawUser.date_joined || null,
  };
}

export function safelyReadSessionStorage(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safelyWriteSessionStorage(key, value) {
  try {
    if (value) window.sessionStorage.setItem(key, value);
    else window.sessionStorage.removeItem(key);
  } catch {
    throw new Error("Browser session storage is unavailable. Enable site storage and try again.");
  }
}

export function clearApiTokens() {
  try {
    window.sessionStorage.removeItem(API_ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(API_REFRESH_TOKEN_KEY);
  } catch {
    // The in-memory React state will still be cleared by AuthContext.
  }
}
