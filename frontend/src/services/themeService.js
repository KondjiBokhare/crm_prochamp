const THEME_STORAGE_KEY = "techgear_theme";
const THEME_EVENT = "techgear:theme-change";
const VALID_THEMES = new Set(["light", "dark", "system"]);

let systemMediaQuery = null;
let systemThemeListener = null;
let storageListenerAttached = false;

function normalizeTheme(value) {
  return VALID_THEMES.has(value) ? value : "light";
}

export function getThemePreference() {
  try {
    return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "light";
  }
}

export function getResolvedTheme(preference = getThemePreference()) {
  if (preference === "system") {
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } catch {
      return "light";
    }
  }

  return preference === "dark" ? "dark" : "light";
}

export function getThemeState() {
  const preference = getThemePreference();
  return {
    preference,
    resolvedTheme: getResolvedTheme(preference),
  };
}

function notifyThemeChange(preference) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(THEME_EVENT, {
      detail: {
        preference,
        resolvedTheme: getResolvedTheme(preference),
      },
    })
  );
}

function applyThemeToDocument(preference) {
  if (typeof document === "undefined") return getResolvedTheme(preference);

  const resolvedTheme = getResolvedTheme(preference);
  const root = document.documentElement;
  root.setAttribute("data-theme", resolvedTheme);
  root.setAttribute("data-theme-preference", preference);
  root.style.colorScheme = resolvedTheme;
  return resolvedTheme;
}

function removeSystemThemeListener() {
  if (systemMediaQuery && systemThemeListener) {
    if (typeof systemMediaQuery.removeEventListener === "function") {
      systemMediaQuery.removeEventListener("change", systemThemeListener);
    } else if (typeof systemMediaQuery.removeListener === "function") {
      systemMediaQuery.removeListener(systemThemeListener);
    }
  }

  systemMediaQuery = null;
  systemThemeListener = null;
}

function configureSystemThemeListener(preference) {
  removeSystemThemeListener();
  if (preference !== "system" || typeof window === "undefined" || !window.matchMedia) {
    return;
  }

  systemMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  systemThemeListener = () => {
    applyThemeToDocument("system");
    notifyThemeChange("system");
  };

  if (typeof systemMediaQuery.addEventListener === "function") {
    systemMediaQuery.addEventListener("change", systemThemeListener);
  } else if (typeof systemMediaQuery.addListener === "function") {
    systemMediaQuery.addListener(systemThemeListener);
  }
}

function handleStorageChange(event) {
  if (event.key !== THEME_STORAGE_KEY) return;

  const preference = normalizeTheme(event.newValue);
  applyThemeToDocument(preference);
  configureSystemThemeListener(preference);
  notifyThemeChange(preference);
}

export function initializeTheme() {
  const preference = getThemePreference();
  applyThemeToDocument(preference);
  configureSystemThemeListener(preference);

  if (typeof window !== "undefined" && !storageListenerAttached) {
    window.addEventListener("storage", handleStorageChange);
    storageListenerAttached = true;
  }
}

export function setThemePreference(value) {
  const preference = normalizeTheme(value);

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The theme still works for the current session if storage is unavailable.
  }

  applyThemeToDocument(preference);
  configureSystemThemeListener(preference);

  if (typeof window !== "undefined" && !storageListenerAttached) {
    window.addEventListener("storage", handleStorageChange);
    storageListenerAttached = true;
  }

  notifyThemeChange(preference);
}

export function toggleThemePreference() {
  const currentTheme = getResolvedTheme();
  setThemePreference(currentTheme === "dark" ? "light" : "dark");
}

export function subscribeToThemeChanges(callback) {
  if (typeof window === "undefined") return () => {};

  const handleThemeChange = (event) => {
    callback({
      preference: normalizeTheme(event.detail?.preference || getThemePreference()),
      resolvedTheme: event.detail?.resolvedTheme || getResolvedTheme(),
    });
  };

  window.addEventListener(THEME_EVENT, handleThemeChange);
  return () => window.removeEventListener(THEME_EVENT, handleThemeChange);
}
