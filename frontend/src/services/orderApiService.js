
const ORDERS_PATH = "/api/crm/orders/";

const STATUS_LABELS = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

const LABEL_TO_STATUS = Object.fromEntries(
  Object.entries(STATUS_LABELS).map(([apiValue, label]) => [
    label,
    apiValue,
  ])
);

const API_TRANSITIONS = {
  Pending: ["Confirmed", "Processing", "Cancelled"],
  Confirmed: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: [],
  Cancelled: [],
  Refunded: [],
};

function requireRequest(authenticatedRequest) {
  if (typeof authenticatedRequest !== "function") {
    throw new Error(
      "Order API mode requires a valid Django login. Please sign in again."
    );
  }

  return authenticatedRequest;
}

function asCollection(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;

  return [];
}

function asDate(value) {
  if (!value) return "";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 10)
    : date.toISOString().slice(0, 10);
}

function getOrderDetails(raw) {
  if (
    raw?.crm_data &&
    typeof raw.crm_data === "object" &&
    !Array.isArray(raw.crm_data)
  ) {
    return raw.crm_data;
  }

  // Backward compatibility with older API responses.
  if (
    raw?.storefront_data &&
    typeof raw.storefront_data === "object" &&
    !Array.isArray(raw.storefront_data)
  ) {
    return raw.storefront_data;
  }

  return {};
}

function getAddress(details) {
  const address = details?.address;

  return address &&
    typeof address === "object" &&
    !Array.isArray(address)
    ? address
    : null;
}

function getCustomerPhone(raw, address) {
  return String(
    raw?.customer_phone ||
      address?.phone ||
      address?.phone_number ||
      address?.mobile ||
      ""
  );
}

export function mapDjangoOrder(raw = {}) {
  const apiStatus = String(raw.status || "PENDING").toUpperCase();

  const statusLabel =
    STATUS_LABELS[apiStatus] ||
    apiStatus.toLowerCase().replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );

  const amount = Number(raw.amount ?? 0);
  const details = getOrderDetails(raw);

  const items = Array.isArray(details.items)
    ? details.items
    : [];

  const address = getAddress(details);

  return {
    // Human-readable order number is used for display.
    id: String(raw.order_number || `ORDER-${raw.id ?? ""}`),
    apiId: raw.id,
    orderNumber: String(raw.order_number || ""),

    customerId: raw.customer ?? null,
    customerName:
      raw.customer_name ||
      (raw.customer != null
        ? `Customer ${raw.customer}`
        : "Customer unavailable"),

    customerEmail: String(raw.customer_email || ""),
    customerPhone: getCustomerPhone(raw, address),

    date: asDate(raw.order_date || raw.created_at),

    total: Number.isFinite(amount) ? amount : 0,

    fulfillmentStatus: statusLabel,
    backendStatus: apiStatus,

    paymentStatus: String(
      details.paymentStatus || "Not tracked by backend"
    ),

    paymentMethod: String(details.paymentMethod || ""),

    // Product information comes from Order.crm_data.
    items,

    itemCount: items.reduce(
      (count, item) =>
        count + Math.max(0, Number(item.quantity) || 0),
      0
    ),

    // Complete saved delivery address.
    address,

    subtotal: Number(details.subtotal ?? amount) || 0,
    discount: Number(details.discount) || 0,
    couponDiscount: Number(details.couponDiscount) || 0,
    couponCode: String(details.couponCode || ""),
    delivery: Number(details.delivery) || 0,

    // Internal metadata retained for compatibility.
    legacyImported: Boolean(details.legacyImported),
    demoOnly: Boolean(details.demoOnly),

    internalNotes: [],
    statusHistory: [],

    source: "django-api",

    deliveryMessage: details.legacyImported
      ? "Imported order record. Original payment and shipment details may not be available."
      : details.source === "storefront-api"
        ? "Order received from the storefront. Payment and shipment processing are not connected."
        : "Order information is available in the CRM.",

    updatedAt: raw.updated_at || null,
  };
}

export async function getOrderManagementOrders(
  _params = {},
  authenticatedRequest
) {
  void _params;

  const request = requireRequest(authenticatedRequest);

  const payload = await request(ORDERS_PATH, {
    method: "GET",
  });

  return asCollection(payload).map(mapDjangoOrder);
}

export async function getManagedOrderById(
  id,
  authenticatedRequest
) {
  const request = requireRequest(authenticatedRequest);

  const raw = await request(
    `${ORDERS_PATH}${encodeURIComponent(id)}/`,
    {
      method: "GET",
    }
  );

  return raw ? mapDjangoOrder(raw) : null;
}

export async function updateOrderStatus(
  id,
  nextStatus,
  _actor = "CRM Staff",
  authenticatedRequest
) {
  void _actor;

  const request = requireRequest(authenticatedRequest);

  const apiStatus = LABEL_TO_STATUS[String(nextStatus || "")];

  if (!apiStatus) {
    throw new Error(
      "That order status is not supported by the Django order API."
    );
  }

  const current = await getManagedOrderById(id, request);

  if (!current) {
    throw new Error("Order was not found in Django.");
  }

  const allowed =
    API_TRANSITIONS[current.fulfillmentStatus] || [];

  if (!allowed.includes(nextStatus)) {
    throw new Error(
      `The backend order cannot move from ${current.fulfillmentStatus} to ${nextStatus}.`
    );
  }

  const updated = await request(
    `${ORDERS_PATH}${encodeURIComponent(id)}/`,
    {
      method: "PATCH",
      body: {
        status: apiStatus,
      },
    }
  );

  return mapDjangoOrder(updated);
}

export function getSupportedOrderTransitions(status) {
  return [...(API_TRANSITIONS[status] || [])];
}

export async function updateOrderPaymentStatus() {
  throw new Error(
    "The current Django Order model has no separate payment-status field."
  );
}

export async function addOrderInternalNote() {
  throw new Error(
    "The current Django backend has no order internal-notes endpoint."
  );
}
