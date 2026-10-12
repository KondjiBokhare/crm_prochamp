// Django adapter for the CRM staff support desk. Storefront customer tickets use
// storefrontSupportApiService but persist to the same Django SupportTicket tables.
const TICKETS_PATH = "/api/crm/support-tickets/";

function emitNotificationsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("techgear:notifications-updated"));
}

function requireRequest(authenticatedRequest) {
  if (typeof authenticatedRequest !== "function") {
    throw new Error("Support API mode requires an authenticated Django staff session.");
  }
  return authenticatedRequest;
}

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function mapMessage(raw = {}) {
  return {
    id: raw.id,
    author: raw.author || raw.author_name || "Support Team",
    text: String(raw.text || ""),
    createdAt: raw.createdAt || raw.created_at || "",
    isInternal: Boolean(raw.isInternal ?? raw.is_internal),
    isInitialRequest: Boolean(raw.isInitialRequest ?? raw.is_initial_request),
  };
}

export function mapApiSupportTicket(raw = {}) {
  const messages = Array.isArray(raw.messages) ? raw.messages.map(mapMessage) : [];
  const internalNotes = Array.isArray(raw.internalNotes)
    ? raw.internalNotes.map(mapMessage)
    : messages.filter((message) => message.isInternal);
  return {
    id: String(raw.id ?? raw.ticket_code ?? ""),
    customerId: raw.customer ?? null,
    customerName: raw.customerName || raw.customer_name || "Customer",
    customerEmail: raw.customerEmail || raw.customer_email || "",
    subject: raw.subject || "Untitled support request",
    category: raw.category || "Other",
    orderId: raw.orderId || raw.order_id || "",
    description: raw.description || "",
    priority: raw.priority || "Medium",
    status: raw.status || "Open",
    assignedTo: raw.assignedTo || raw.assigned_to || "Unassigned",
    createdAt: raw.createdAt || raw.created_at || "",
    updatedAt: raw.updatedAt || raw.updated_at || raw.createdAt || "",
    messages,
    internalNotes,
    statusHistory: Array.isArray(raw.statusHistory) ? raw.statusHistory : (Array.isArray(raw.status_history) ? raw.status_history : []),
  };
}

function queryString(params = {}) {
  const values = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "All") values.set(key, String(value));
  });
  const encoded = values.toString();
  return encoded ? `?${encoded}` : "";
}


export async function createApiSupportTicket(input = {}, authenticatedRequest) {
  const payload = {
    customerName: String(input.customerName || "").trim(),
    customerEmail: String(input.customerEmail || "").trim().toLowerCase(),
    subject: String(input.subject || "").trim(),
    category: String(input.category || "Other"),
    orderId: String(input.orderId || "").trim(),
    description: String(input.description || input.message || "").trim(),
    priority: ["Low", "Medium", "High", "Urgent"].includes(input.priority) ? input.priority : "Medium",
    status: "Open",
    assignedTo: "Unassigned",
  };
  const result = await requireRequest(authenticatedRequest)(TICKETS_PATH, { method: "POST", body: payload });
  emitNotificationsChanged();
  return mapApiSupportTicket(result);
}

export async function getApiSupportTickets(params = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const query = {
    search: params.search,
    status: params.status,
    priority: params.priority,
    category: params.category,
    assignedTo: params.assignedTo,
  };
  const payload = await request(`${TICKETS_PATH}${queryString(query)}`, { method: "GET" });
  return unwrapList(payload).map(mapApiSupportTicket);
}

export async function getApiSupportTicketById(id, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  try {
    const payload = await request(`${TICKETS_PATH}${encodeURIComponent(id)}/`, { method: "GET" });
    return payload ? mapApiSupportTicket(payload) : null;
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

export async function updateApiSupportTicketStatus(id, nextStatus, _actor, authenticatedRequest) {
  const payload = await requireRequest(authenticatedRequest)(`${TICKETS_PATH}${encodeURIComponent(id)}/`, {
    method: "PATCH", body: { status: nextStatus },
  });
  emitNotificationsChanged();
  return mapApiSupportTicket(payload);
}

export async function updateApiSupportTicketPriority(id, nextPriority, _actor, authenticatedRequest) {
  const payload = await requireRequest(authenticatedRequest)(`${TICKETS_PATH}${encodeURIComponent(id)}/`, {
    method: "PATCH", body: { priority: nextPriority },
  });
  emitNotificationsChanged();
  return mapApiSupportTicket(payload);
}

export async function assignApiSupportTicket(id, assignedTo, _actor, authenticatedRequest) {
  const payload = await requireRequest(authenticatedRequest)(`${TICKETS_PATH}${encodeURIComponent(id)}/`, {
    method: "PATCH", body: { assignedTo },
  });
  emitNotificationsChanged();
  return mapApiSupportTicket(payload);
}

export async function addApiSupportTicketMessage(id, text, _author, isInternal = false, authenticatedRequest) {
  const payload = await requireRequest(authenticatedRequest)(`${TICKETS_PATH}${encodeURIComponent(id)}/messages/`, {
    method: "POST", body: { text: String(text || "").trim(), is_internal: Boolean(isInternal) },
  });
  emitNotificationsChanged();
  return mapApiSupportTicket(payload);
}
