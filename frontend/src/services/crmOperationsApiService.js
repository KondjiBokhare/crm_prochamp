import { ROLE_LABELS } from "../auth/roles";
import { mapBackendRole } from "./authApi";

 

const IS_PRODUCTION = Boolean(import.meta.env.PROD);

const configuredCommunicationsMode = String(
  import.meta.env.VITE_CRM_COMMUNICATIONS_MODE || "mock"
).trim().toLowerCase();

export const crmCommunicationsMode =
  IS_PRODUCTION || configuredCommunicationsMode === "api"
    ? "api"
    : "mock";

const configuredStaffUsersMode = String(
  import.meta.env.VITE_CRM_STAFF_USERS_MODE || "mock"
).trim().toLowerCase();

export const staffUsersApiMode =
  IS_PRODUCTION || configuredStaffUsersMode === "api";

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

export async function getApiNotificationsForUser(
  user = {},
  authenticatedRequest
) {
  assertAuthenticatedRequest(authenticatedRequest);

  const isCustomer =
    String(user?.role || "").toUpperCase() === "CUSTOMER";

  const endpoint = isCustomer
    ? "/api/storefront/account/notifications/"
    : "/api/crm/notifications/";

  const payload = await authenticatedRequest(endpoint);

  return unwrapList(payload);
}


export async function markApiNotificationRead(
  id,
  user = {},
  authenticatedRequest
) {
  assertAuthenticatedRequest(authenticatedRequest);

  const isCustomer =
    String(user?.role || "").toUpperCase() === "CUSTOMER";

  const endpoint = isCustomer
    ? `/api/storefront/account/notifications/${encodeURIComponent(id)}/read/`
    : `/api/crm/notifications/${encodeURIComponent(id)}/read/`;

  const result = await authenticatedRequest(endpoint, {
    method: "POST",
    body: {},
  });

  emitNotificationsChanged();

  return result;
}


export async function markApiAllNotificationsRead(
  user = {},
  authenticatedRequest
) {
  assertAuthenticatedRequest(authenticatedRequest);

  const isCustomer =
    String(user?.role || "").toUpperCase() === "CUSTOMER";

  const endpoint = isCustomer
    ? "/api/storefront/account/notifications/read-all/"
    : "/api/crm/notifications/read-all/";

  const result = await authenticatedRequest(endpoint, {
    method: "POST",
    body: {},
  });

  emitNotificationsChanged();

  return result;
}

// ---------------------------- Staff accounts -----------------------------
const FRONTEND_TO_BACKEND_ROLE = {
  ADMIN: "ADMIN",
  SALES: "SALES",
  SUPPORT: "SUPPORT",
  MARKETING: "MARKETING",
  ANALYST: "ANALYST",
  MANAGEMENT: "MANAGEMENT",
  OPERATIONS: "OPERATIONS",
  CRM_MANAGER: "SALES",
  SUPPORT_AGENT: "SUPPORT",
  MARKETING_MANAGER: "MARKETING",
  ANALYST_LEGACY: "ANALYST",
};

function mapStaffUser(record = {}) {
  const backendRole = String(record.role || "").toUpperCase();

  const role =
    mapBackendRole(record.role) || mapBackendRole(backendRole) || backendRole;

  const name = String(
    record.name ||
    [record.first_name, record.last_name]
      .filter(Boolean)
      .join(" ") ||
    record.email ||
    "Staff member"
  ).trim();

  return {
    id: String(record.id),
    name,
    email: String(record.email || ""),

    role,
    backendRole,

    roleLabel:
      ROLE_LABELS[role] ||
      ROLE_LABELS[backendRole] ||
      role,

    active: record.is_active !== false,

    // Use actual permissions saved in PostgreSQL.
    permissions: Array.isArray(record.permissions)
      ? record.permissions.filter(
          (permission) => typeof permission === "string"
        )
      : [],

    isSuperAdmin: record.is_superuser === true,
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

export async function listApiOrganizations(authenticatedRequest) {
  assertAuthenticatedRequest(authenticatedRequest);

  const response = await authenticatedRequest(
    "/api/auth/organizations/"
  );

  return unwrapList(response).map((organization) => ({
    id: String(organization.id),
    name: String(organization.name || ""),
  }));
}

export async function createApiStaffUser(
  input = {},
  authenticatedRequest
) {
  assertAuthenticatedRequest(authenticatedRequest);

  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  const organization = Number(input.organizationId);

  const role =
    FRONTEND_TO_BACKEND_ROLE[
      String(input.role || "").toUpperCase()
    ];

  if (!name) {
    throw new Error("Staff name is required.");
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }

  if (password.length < 8) {
    throw new Error("Password must contain at least 8 characters.");
  }

  if (!role) {
    throw new Error("Choose a valid staff role.");
  }

  if (!Number.isInteger(organization) || organization < 1) {
    throw new Error("Select a valid organization.");
  }

  const permissions = Array.isArray(input.permissions)
    ? [...new Set(input.permissions.filter(
        (item) => typeof item === "string"
      ))]
    : [];

  const created = await authenticatedRequest(
    "/api/auth/staff/",
    {
      method: "POST",
      body: {
        name,
        email,
        password,
        role,
        organization,
        permissions,
      },
    }
  );

  return mapStaffUser(created);
}

export async function updateApiStaffUser(
  id,
  input = {},
  authenticatedRequest
) {
  assertAuthenticatedRequest(authenticatedRequest);

  if (!Array.isArray(input.permissions)) {
    throw new Error("A permissions array is required.");
  }

  const permissions = [...new Set(
    input.permissions.filter(
      (item) => typeof item === "string"
    )
  )];

  const updated = await authenticatedRequest(
    `/api/auth/staff/${encodeURIComponent(id)}/`,
    {
      method: "PATCH",
      body: { permissions },
    }
  );

  return mapStaffUser(updated);
}