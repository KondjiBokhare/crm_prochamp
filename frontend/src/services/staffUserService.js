import { PAGE_ROLES, ROLE_LABELS } from "../auth/roles";

export const PAGE_PERMISSION_LABELS = {
  dashboard: "Dashboard",
  customers: "Customers",
  leads: "Leads",
  orders: "Orders",
  support: "Support tickets",
  customerDetails: "Customer details",
  interactions: "Interactions",
  segments: "Customer segments",
  campaigns: "Campaigns",
  communications: "Communications",
  analytics: "Analytics and reports",
  banners: "Banner management",
  products: "Product management",
  categories: "Category management",
  storefrontSettings: "Global storefront settings",
  homepagePromotions: "Homepage promotions",
  userManagement: "User and permissions management",
  inventory: "Inventory and stock movements",
  coupons: "Coupons and discounts",
  abandonedCarts: "Abandoned cart reporting",
  shipments: "Shipments",
  returns: "Returns",
  orderActivity: "Order activity",
  productReviews: "Product reviews",
  auditLogs: "Audit logs",
};

const ADMIN_ONLY_PAGES = new Set([
  "userManagement",
  "storefrontSettings",
]);

const normaliseRole = (role) =>
  String(role || "").trim().toUpperCase();

export function defaultPermissionsForRole(role) {
  const key = normaliseRole(role);

  return Object.entries(PAGE_ROLES)
    .filter(([, roles]) => roles.includes(key))
    .map(([pageKey]) => pageKey);
}

export function canUserAccessPage(user, pageKey) {
  if (!user || !PAGE_ROLES[pageKey]) {
    return false;
  }

  // Super Admin always has global CRM access.
  if (
    user.isSuperAdmin === true ||
    user.is_super_admin === true
  ) {
    return true;
  }

  const role = normaliseRole(
    user.backendRole || user.role
  );

  // Sensitive administrative pages remain restricted.
  if (ADMIN_ONLY_PAGES.has(pageKey) && role !== "ADMIN") {
    return false;
  }

  // No role-based fallback.
  // Only permissions explicitly assigned to this employee count.
  const permissions = Array.isArray(user.permissions)
    ? user.permissions
    : [];

  return permissions.includes(pageKey);
}

// Legacy functions remain exported so old imports do not break.
// They never read or write demo users or passwords.
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
    window.localStorage.removeItem(
      "techgear_managed_staff_users_v1"
    );
    window.localStorage.removeItem(
      "techgear_demo_staff_overrides_v1"
    );

    window.dispatchEvent(
      new Event("techgear:staff-users-updated")
    );
  } catch {
    // Ignore unavailable browser storage.
  }
}

export const staffUsersChangedEvent =
  "techgear:staff-users-updated";

export { ROLE_LABELS };