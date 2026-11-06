
import { PAGE_PERMISSION_REGISTRY, ROLE_LABELS } from "../auth/roles.js";

export const PAGE_PERMISSION_LABELS = Object.fromEntries(
  Object.entries(PAGE_PERMISSION_REGISTRY).map(([key, page]) => [
    key,
    page.label,
  ])
);

export function defaultPermissionsForRole() {
  return [];
}


export function canUserAccessPage(user, pageKey) {
  if (
    !user ||
    user.isAuthenticated !== true ||
    user.active !== true ||
    user.role === "CUSTOMER" ||
    !PAGE_PERMISSION_REGISTRY[pageKey]
  ) {
    return false;
  }

  const permissions = Array.isArray(user.permissions)
    ? user.permissions
    : [];

  if (pageKey === "userManagement") {
    if (user.isSuperAdmin === true) return true;

    return (
      user.role === "ADMIN" &&
      Boolean(user.organizationId) &&
      permissions.includes("userManagement")
    );
  }

  if (!user.organizationId) return false;

  return permissions.includes(pageKey);
}


/**
 * Match static and parameterized routes from the central registry.
 */
function routeMatches(pattern, pathname) {
  const patternParts = pattern.split("/").filter(Boolean);
  const pathParts = pathname.split("/").filter(Boolean);

  if (patternParts.length !== pathParts.length) {
    return false;
  }

  return patternParts.every((part, index) =>
    part.startsWith(":") || part === pathParts[index]
  );
}

/**
 * Resolve the requested CRM path only when the user can access it.
 * Otherwise, use the first assigned CRM module.
 */
export function getPermittedCrmPath(user, requestedPath = "") {
  if (
    !user ||
    user.isAuthenticated !== true ||
    user.active !== true ||
    user.role === "CUSTOMER"
  ) {
    return "/unauthorized";
  }

  const requested = String(requestedPath || "");
  const requestedPathOnly = requested.split(/[?#]/)[0].replace(/\/+$/, "") || "/crm";

  if (requestedPathOnly.startsWith("/crm")) {
    const matchingPage = Object.entries(PAGE_PERMISSION_REGISTRY).find(
      ([, page]) => routeMatches(page.route, requestedPathOnly)
    );

    if (
      matchingPage &&
      canUserAccessPage(user, matchingPage[0])
    ) {
      return requested;
    }
  }

  // Prefer Dashboard when it is explicitly assigned.
  if (canUserAccessPage(user, "dashboard")) {
    return PAGE_PERMISSION_REGISTRY.dashboard.route;
  }

  // Otherwise find the first assigned page available in the sidebar.
  const firstAllowedPage = Object.entries(PAGE_PERMISSION_REGISTRY).find(
    ([pageKey, page]) =>
      Boolean(page.sidebar) && canUserAccessPage(user, pageKey)
  );

  return firstAllowedPage?.[1]?.route || "/unauthorized";
}

export const canAccessPage = canUserAccessPage;

// Legacy functions remain exported so old imports do not break.
export function listStaffUsers() {
  return [];
}

export function getStaffUserById() {
  return null;
}

export function createStaffUser() {
  throw new Error(
    "Local staff creation is disabled. Use the authenticated Django API."
  );
}

export function updateStaffUser() {
  throw new Error(
    "Local staff updates are disabled. Use the authenticated Django API."
  );
}

export function authenticateStaffUser() {
  return null;
}

export function clearManagedStaffDemoData() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem("techgear_managed_staff_users_v1");
    window.localStorage.removeItem("techgear_demo_staff_overrides_v1");

    window.dispatchEvent(
      new Event("techgear:staff-users-updated")
    );
  } catch {
    // Ignore unavailable browser storage.
  }
}

export const staffUsersChangedEvent = "techgear:staff-users-updated";

export { ROLE_LABELS };
