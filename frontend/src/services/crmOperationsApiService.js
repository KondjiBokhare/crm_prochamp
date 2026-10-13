import { defaultPermissionsForRole } from "./staffUserService";
import { mapBackendRole } from "./authApi";

const configuredCommunicationsMode = String(import.meta.env.VITE_CRM_COMMUNICATIONS_MODE || "mock").trim().toLowerCase();
export const crmCommunicationsMode = configuredCommunicationsMode === "api" ? "api" : "mock";
const configuredStaffUsersMode = String(import.meta.env.VITE_CRM_STAFF_USERS_MODE || "mock").trim().toLowerCase();
export const staffUsersApiMode = configuredStaffUsersMode === "api";

function assertAuthenticatedRequest(authenticatedRequest) {
  if (typeof authenticatedRequest !== "function") {
    throw new Error("This API requires an authenticated Django staff session. Sign in to CRM and retry.");
  }
}

function queryString(values = {}) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "" && value !== "All") query.set(key, String(value));
  });
  const result = query.toString();
  return result ? `?${result}` : "";
}

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function emitNotificationsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("techgear:notifications-updated"));
}

// -------------------------- Storefront settings --------------------------
export async function loadApiStorefrontSettings(authenticatedRequest) {
  assertAuthenticatedRequest(authenticatedRequest);
  const payload = await authenticatedRequest("/api/crm/storefront-settings/");
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
}

export async function saveApiStorefrontSettings(settings, authenticatedRequest) {
  assertAuthenticatedRequest(authenticatedRequest);
  const payload = await authenticatedRequest("/api/crm/storefront-settings/", {
    method: "PUT",
    body: settings,
  });
  return payload && typeof payload === "object" && !Array.isArray(payload) ? payload : settings;
}

// --------------------------- Communications -----------------------------
export async function getApiCommunicationTemplates(params = {}, authenticatedRequest) {
  assertAuthenticatedRequest(authenticatedRequest);
  return unwrapList(await authenticatedRequest(`/api/crm/communication-templates/${queryString(params)}`));
}

export function createApiCommunicationTemplate(input, authenticatedRequest) {
  assertAuthenticatedRequest(authenticatedRequest);
  return authenticatedRequest("/api/crm/communication-templates/", { method: "POST", body: input });
}

export function updateApiCommunicationTemplate(id, input, authenticatedRequest) {
  assertAuthenticatedRequest(authenticatedRequest);
  return authenticatedRequest(`/api/crm/communication-templates/${encodeURIComponent(id)}/`, { method: "PATCH", body: input });
}

export function deleteApiCommunicationTemplate(id, authenticatedRequest) {
  assertAuthenticatedRequest(authenticatedRequest);
  return authenticatedRequest(`/api/crm/communication-templates/${encodeURIComponent(id)}/`, { method: "DELETE" });
}

export async function getApiCommunicationHistory(params = {}, authenticatedRequest) {
  assertAuthenticatedRequest(authenticatedRequest);
  return unwrapList(await authenticatedRequest(`/api/crm/communications/history/${queryString(params)}`));
}

export async function dispatchApiCommunication(input = {}, actor = "CRM Staff", authenticatedRequest) {
  assertAuthenticatedRequest(authenticatedRequest);
  let scheduledAt = String(input.scheduledAt || "").trim();
  if (scheduledAt) {
    const parsed = new Date(scheduledAt);
    if (!Number.isFinite(parsed.getTime())) throw new Error("Choose a valid schedule date and time.");
    scheduledAt = parsed.toISOString();
  }
  const result = await authenticatedRequest("/api/crm/communications/dispatch/", {
    method: "POST",
    body: { ...input, actor, scheduledAt },
  });
  return result;
}

// ----------------------------- Notifications -----------------------------
export async function getApiNotificationsForUser(user = {}, authenticatedRequest) {
  if (String(user?.role || "").toUpperCase() === "CUSTOMER") {
    const { getNotificationsForUser } = await import("./notificationCenterService");
    return getNotificationsForUser(user);
  }
  assertAuthenticatedRequest(authenticatedRequest);
  return unwrapList(await authenticatedRequest("/api/crm/notifications/"));
}

export async function markApiNotificationRead(id, user = {}, authenticatedRequest) {
  if (String(user?.role || "").toUpperCase() === "CUSTOMER") {
    const { markNotificationReadForUser } = await import("./notificationCenterService");
    return markNotificationReadForUser(id, user);
  }
  assertAuthenticatedRequest(authenticatedRequest);
  const result = await authenticatedRequest(`/api/crm/notifications/${encodeURIComponent(id)}/read/`, { method: "POST", body: {} });
  emitNotificationsChanged();
  return result;
}

export async function markApiAllNotificationsRead(user = {}, authenticatedRequest) {
  if (String(user?.role || "").toUpperCase() === "CUSTOMER") {
    const { markAllNotificationsReadForUser } = await import("./notificationCenterService");
    return markAllNotificationsReadForUser(user);
  }
  assertAuthenticatedRequest(authenticatedRequest);
  const result = await authenticatedRequest("/api/crm/notifications/read-all/", { method: "POST", body: {} });
  emitNotificationsChanged();
  return result;
}

// ---------------------------- Staff accounts -----------------------------
const FRONTEND_TO_BACKEND_ROLE = {
  ADMIN: "ADMIN",
  CRM_MANAGER: "SALES",
  SUPPORT_AGENT: "SUPPORT",
  MARKETING_MANAGER: "MARKETING",
  ANALYST: "MANAGEMENT",
  OPERATIONS: "OPERATIONS",
};

function mapStaffUser(record = {}) {
  const role = mapBackendRole(record.role) || String(record.role || "").toUpperCase();
  const name = String(record.name || [record.first_name, record.last_name].filter(Boolean).join(" ") || record.email || "Staff member").trim();
  return {
    id: String(record.id),
    name,
    email: String(record.email || ""),
    role,
    roleLabel: role,
    active: record.is_active !== false,
    permissions: defaultPermissionsForRole(role),
    isDemo: false,
    hasCustomPassword: false,
    createdAt: record.date_joined || null,
    updatedAt: record.updated_at || null,
  };
}

export async function listApiStaffUsers(authenticatedRequest) {
  assertAuthenticatedRequest(authenticatedRequest);
  return unwrapList(await authenticatedRequest("/api/auth/staff/")).map(mapStaffUser);
}

export async function createApiStaffUser(input = {}, authenticatedRequest) {
  assertAuthenticatedRequest(authenticatedRequest);
  const password = String(input.password || "");
  if (password.length < 8) throw new Error("Set an initial password of at least 8 characters.");
  const role = FRONTEND_TO_BACKEND_ROLE[String(input.role || "CRM_MANAGER").toUpperCase()];
  if (!role) throw new Error("Choose a valid CRM staff role.");
  const created = await authenticatedRequest("/api/auth/staff/", {
    method: "POST",
    body: { name: input.name, email: String(input.email || "").trim().toLowerCase(), role, password, active: input.active !== false },
  });
  return mapStaffUser(created);
}

export async function updateApiStaffUser(id, input = {}, authenticatedRequest) {
  assertAuthenticatedRequest(authenticatedRequest);
  const body = {};
  for (const key of ["name", "email", "active"]) {
    if (Object.prototype.hasOwnProperty.call(input, key)) body[key] = input[key];
  }
  if (input.role !== undefined) {
    const role = FRONTEND_TO_BACKEND_ROLE[String(input.role).toUpperCase()];
    if (!role) throw new Error("Choose a valid CRM staff role.");
    body.role = role;
  }
  if (String(input.password || "")) {
    if (String(input.password).length < 8) throw new Error("A reset password must contain at least 8 characters.");
    body.password = String(input.password);
  }
  const updated = await authenticatedRequest(`/api/auth/staff/${encodeURIComponent(id)}/`, { method: "PATCH", body });
  return mapStaffUser(updated);
}
