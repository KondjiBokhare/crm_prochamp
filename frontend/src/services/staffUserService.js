import { CRM_ROLES, PAGE_ROLES, ROLE_LABELS } from "../auth/roles";

// Frontend demo only: staff accounts, demo permission overrides, and passwords
// are stored in localStorage. Replace these functions with authenticated Django
// endpoints before production; never store real staff passwords in the browser.
const MANAGED_USERS_KEY = "techgear_managed_staff_users_v1";
const DEMO_OVERRIDES_KEY = "techgear_demo_staff_overrides_v1";
const USERS_EVENT = "techgear:staff-users-updated";

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
};

const ADMIN_ONLY_PAGES = new Set(["userManagement", "storefrontSettings"]);
const normaliseRole = (role) => String(role || "").trim().toUpperCase();
const normaliseEmail = (email) => String(email || "").trim().toLowerCase();

function readArray(key) {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function readObject(key) {
  if (typeof window === "undefined") return {};
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function writeJson(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    throw new Error("Browser storage could not save this change. Try removing large demo image uploads or clearing old demo data.");
  }
  window.dispatchEvent(new Event(USERS_EVENT));
}

export function defaultPermissionsForRole(role) {
  const key = normaliseRole(role);
  return Object.entries(PAGE_ROLES)
    .filter(([, roles]) => roles.includes(key))
    .map(([pageKey]) => pageKey);
}

function normalisePermissions(permissions, role) {
  const allowedKeys = new Set(Object.keys(PAGE_ROLES));
  const source = Array.isArray(permissions) ? permissions : defaultPermissionsForRole(role);
  const next = [...new Set(source.filter((key) => allowedKeys.has(key)))];
  if (normaliseRole(role) !== "ADMIN") {
    return next.filter((key) => !ADMIN_ONLY_PAGES.has(key));
  }
  // Admin-only pages stay available to Admins and are not individually toggled.
  return [...new Set([...next, ...ADMIN_ONLY_PAGES])];
}

function safeUser(record, extra = {}) {
  const role = normaliseRole(record.role);
  return {
    id: String(record.id),
    name: String(record.name || "Staff member"),
    email: String(record.email || ""),
    role,
    roleLabel: ROLE_LABELS[role] || role,
    active: record.active !== false,
    permissions: normalisePermissions(record.permissions, role),
    isDemo: Boolean(record.isDemo),
    hasCustomPassword: Boolean(record.hasCustomPassword),
    createdAt: record.createdAt || null,
    updatedAt: record.updatedAt || null,
    ...extra,
  };
}

export function listStaffUsers(demoUsers = []) {
  const overrides = readObject(DEMO_OVERRIDES_KEY);
  const managed = readArray(MANAGED_USERS_KEY);
  const demoRecords = demoUsers.map((base) => {
    const override = overrides[String(base.id)] || {};
    const merged = { ...base, ...override, id: base.id };
    return safeUser(merged, { isDemo: true, hasCustomPassword: Boolean(override.password) });
  });
  const managedRecords = managed.map((record) => safeUser(record, { isDemo: false, hasCustomPassword: true }));
  return [...demoRecords, ...managedRecords].filter((user) => CRM_ROLES.includes(user.role));
}

export function getStaffUserById(userId, demoUsers = []) {
  return listStaffUsers(demoUsers).find((user) => String(user.id) === String(userId)) || null;
}

function emailExists(email, exceptId, demoUsers) {
  return listStaffUsers(demoUsers).some((user) => String(user.id) !== String(exceptId || "") && normaliseEmail(user.email) === normaliseEmail(email));
}

export function createStaffUser(input, demoUsers = []) {
  const name = String(input?.name || "").trim();
  const email = normaliseEmail(input?.email);
  const role = normaliseRole(input?.role);
  const password = String(input?.password || "");
  if (!name) throw new Error("Staff name is required.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid work email address.");
  if (!CRM_ROLES.includes(role)) throw new Error("Choose a valid CRM role.");
  if (password.length < 8) throw new Error("Demo password must be at least 8 characters.");
  if (emailExists(email, null, demoUsers)) throw new Error("A staff account with this email already exists.");

  const users = readArray(MANAGED_USERS_KEY);
  const id = `staff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const record = {
    id, name, email, password, role,
    active: true,
    permissions: normalisePermissions(input.permissions, role),
    createdAt: now,
    updatedAt: now,
  };
  users.push(record);
  writeJson(MANAGED_USERS_KEY, users);
  return safeUser(record, { isDemo: false, hasCustomPassword: true });
}

export function updateStaffUser(userId, input, demoUsers = [], actorId = null) {
  const id = String(userId);
  const current = getStaffUserById(id, demoUsers);
  if (!current) throw new Error("Staff account not found.");
  if (String(actorId || "") === id && (input.active === false || (input.role && normaliseRole(input.role) !== current.role))) {
    throw new Error("For safety, you cannot deactivate or change the role of your own signed-in account.");
  }

  const name = String(input.name ?? current.name).trim();
  const email = normaliseEmail(input.email ?? current.email);
  const role = normaliseRole(input.role ?? current.role);
  const active = input.active === undefined ? current.active : Boolean(input.active);
  if (!name) throw new Error("Staff name is required.");
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Enter a valid work email address.");
  if (!CRM_ROLES.includes(role)) throw new Error("Choose a valid CRM role.");
  if (emailExists(email, id, demoUsers)) throw new Error("A staff account with this email already exists.");

  const overrides = readObject(DEMO_OVERRIDES_KEY);
  const managed = readArray(MANAGED_USERS_KEY);
  const existingManaged = managed.find((user) => String(user.id) === id);
  const baseUser = demoUsers.find((user) => String(user.id) === id);
  if (!existingManaged && !baseUser) throw new Error("Staff account not found.");
  if (current.role === "ADMIN" && (role !== "ADMIN" || !active)) {
    const activeAdmins = listStaffUsers(demoUsers).filter((record) => record.role === "ADMIN" && record.active);
    if (activeAdmins.length <= 1) throw new Error("At least one active Admin must remain.");
  }

  const newPermissions = normalisePermissions(input.permissions ?? current.permissions, role);
  const patch = { name, email, role, active, permissions: newPermissions, updatedAt: new Date().toISOString() };
  const newPassword = String(input.password || "");
  if (newPassword) {
    if (newPassword.length < 8) throw new Error("A reset password must be at least 8 characters.");
    patch.password = newPassword;
  }

  if (existingManaged) {
    const updated = managed.map((user) => String(user.id) === id ? { ...user, ...patch } : user);
    writeJson(MANAGED_USERS_KEY, updated);
    const result = updated.find((user) => String(user.id) === id);
    return safeUser(result, { isDemo: false, hasCustomPassword: true });
  }

  const oldOverride = overrides[id] || {};
  overrides[id] = { ...oldOverride, ...patch, ...(patch.password ? { password: patch.password } : {}) };
  writeJson(DEMO_OVERRIDES_KEY, overrides);
  return safeUser({ ...baseUser, ...overrides[id] }, { isDemo: true, hasCustomPassword: Boolean(overrides[id].password) });
}

export function authenticateStaffUser(email, password, demoUsers = []) {
  const target = normaliseEmail(email);
  const overrides = readObject(DEMO_OVERRIDES_KEY);
  const managed = readArray(MANAGED_USERS_KEY);
  const demoRecords = demoUsers.map((base) => {
    const override = overrides[String(base.id)] || {};
    return { ...base, ...override, id: base.id, password: override.password || base.password, isDemo: true };
  });
  const record = [...demoRecords, ...managed].find((user) => normaliseEmail(user.email) === target);
  if (!record || record.active === false || record.password !== String(password || "")) return null;
  const { password: ignoredPassword, ...publicRecord } = record;
  return safeUser(publicRecord, { isDemo: Boolean(record.isDemo), hasCustomPassword: Boolean(record.isDemo ? overrides[String(record.id)]?.password : true) });
}

export function canUserAccessPage(user, pageKey) {
  if (!user?.role || !PAGE_ROLES[pageKey]) return false;
  const role = normaliseRole(user.role);
  if (ADMIN_ONLY_PAGES.has(pageKey)) return role === "ADMIN";
  const permissions = Array.isArray(user.permissions) ? user.permissions : defaultPermissionsForRole(role);
  return permissions.includes(pageKey);
}

export function clearManagedStaffDemoData() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(MANAGED_USERS_KEY);
    window.localStorage.removeItem(DEMO_OVERRIDES_KEY);
    window.dispatchEvent(new Event(USERS_EVENT));
  }
}

export { USERS_EVENT as staffUsersChangedEvent };
