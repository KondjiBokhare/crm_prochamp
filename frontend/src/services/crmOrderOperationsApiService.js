const SHIPMENTS_PATH = "/api/crm/shipments/";
const RETURNS_PATH = "/api/crm/returns/";
const ACTIVITY_PATH = "/api/crm/order-activity/";

function requireRequest(authenticatedRequest) {
  if (typeof authenticatedRequest !== "function") {
    throw new Error("Order operations require an authenticated Django staff session. Please sign in again.");
  }
  return authenticatedRequest;
}

function asCollection(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "All") query.set(key, String(value));
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

const mapShipment = (row = {}) => ({
  id: row.id,
  orderId: row.order,
  orderNumber: row.order_number || `Order ${row.order}`,
  customerName: row.customer_name || "Customer unavailable",
  carrier: row.carrier || "",
  trackingNumber: row.tracking_number || "",
  trackingUrl: row.tracking_url || "",
  status: row.status || "PREPARING",
  shippedAt: row.shipped_at || null,
  estimatedDelivery: row.estimated_delivery || "",
  deliveredAt: row.delivered_at || null,
  createdByEmail: row.created_by_email || "—",
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const mapReturn = (row = {}) => ({
  id: row.id,
  orderId: row.order,
  orderNumber: row.order_number || `Order ${row.order}`,
  customerName: row.customer_name || "Customer unavailable",
  reason: row.reason || "OTHER",
  description: row.description || "",
  status: row.status || "REQUESTED",
  resolutionNote: row.resolution_note || "",
  requestedByEmail: row.requested_by_email || "—",
  reviewedByEmail: row.reviewed_by_email || "—",
  createdAt: row.created_at || null,
  updatedAt: row.updated_at || null,
});

const mapActivity = (row = {}) => ({
  id: row.id,
  orderId: row.order,
  orderNumber: row.order_number || `Order ${row.order}`,
  eventType: row.event_type || "NOTE",
  message: row.message || "",
  metadata: row.metadata || {},
  actorEmail: row.actor_email || "System",
  createdAt: row.created_at || null,
});

export async function getOrderShipments(params = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = await request(`${SHIPMENTS_PATH}${queryString({ order_id: params.orderId, status: params.status, search: params.search })}`, { method: "GET" });
  return asCollection(payload).map(mapShipment);
}

export async function createOrderShipment(input, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = await request(SHIPMENTS_PATH, {
    method: "POST",
    body: {
      order: Number(input.orderId),
      carrier: String(input.carrier || "").trim(),
      tracking_number: String(input.trackingNumber || "").trim(),
      tracking_url: String(input.trackingUrl || "").trim(),
      estimated_delivery: input.estimatedDelivery || null,
    },
  });
  return mapShipment(payload);
}

export async function updateOrderShipment(id, input, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const body = {};
  if (input.status) body.status = input.status;
  if (input.carrier !== undefined) body.carrier = input.carrier;
  if (input.trackingNumber !== undefined) body.tracking_number = input.trackingNumber;
  if (input.trackingUrl !== undefined) body.tracking_url = input.trackingUrl;
  if (input.estimatedDelivery !== undefined) body.estimated_delivery = input.estimatedDelivery || null;
  const payload = await request(`${SHIPMENTS_PATH}${encodeURIComponent(id)}/`, { method: "PATCH", body });
  return mapShipment(payload);
}

export async function getOrderReturns(params = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = await request(`${RETURNS_PATH}${queryString({ order_id: params.orderId, status: params.status, search: params.search })}`, { method: "GET" });
  return asCollection(payload).map(mapReturn);
}

export async function createOrderReturn(input, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = await request(RETURNS_PATH, {
    method: "POST",
    body: { order: Number(input.orderId), reason: input.reason, description: String(input.description || "").trim() },
  });
  return mapReturn(payload);
}

export async function updateOrderReturnStatus(id, input, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = await request(`${RETURNS_PATH}${encodeURIComponent(id)}/status/`, {
    method: "PATCH",
    body: { status: input.status, resolution_note: input.resolutionNote || "" },
  });
  return mapReturn(payload);
}

export async function getOrderActivity(params = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = await request(`${ACTIVITY_PATH}${queryString({ order_id: params.orderId, event_type: params.eventType })}`, { method: "GET" });
  return asCollection(payload).map(mapActivity);
}

export async function createOrderActivity(input, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = await request(ACTIVITY_PATH, {
    method: "POST",
    body: { order: Number(input.orderId), event_type: input.eventType || "NOTE", message: String(input.message || "").trim(), metadata: {} },
  });
  return mapActivity(payload);
}
