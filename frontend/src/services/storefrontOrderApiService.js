import { getDemoOrders } from "./demoOrderService";

const configuredOrdersMode = String(import.meta.env.VITE_STOREFRONT_ORDERS_MODE || "").trim().toLowerCase();
const storefrontAccountApiEnabled = String(import.meta.env.VITE_STOREFRONT_ACCOUNT_MODE || "").trim().toLowerCase() === "api";
export const storefrontOrdersApiEnabled = configuredOrdersMode
  ? configuredOrdersMode === "api"
  : storefrontAccountApiEnabled;
const ORDERS_PATH = "/api/storefront/account/orders/";
const LEGACY_IMPORT_PATH = `${ORDERS_PATH}import-legacy/`;

function requireRequest(authenticatedRequest) {
  if (!storefrontOrdersApiEnabled) throw new Error("Storefront Orders API mode is disabled. Set VITE_STOREFRONT_ORDERS_MODE=api and restart Vite.");
  if (typeof authenticatedRequest !== "function") throw new Error("Sign in with your registered customer account before placing or viewing orders.");
  return authenticatedRequest;
}

function listPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function statusLabel(value) {
  const key = String(value || "PROCESSING").toUpperCase();
  return ({ PENDING: "Pending", CONFIRMED: "Confirmed", PROCESSING: "Processing", SHIPPED: "Shipped", DELIVERED: "Delivered", CANCELLED: "Cancelled", REFUNDED: "Refunded" })[key] || "Processing";
}

export function mapStorefrontOrder(raw = {}) {
  const details = raw.storefront_data && typeof raw.storefront_data === "object" ? raw.storefront_data : {};
  const amount = Number(raw.amount ?? details.total ?? 0);
  return {
    id: String(raw.order_number || raw.id || ""),
    apiId: raw.id,
    orderNumber: String(raw.order_number || ""),
    customerId: raw.customer ?? null,
    customerName: raw.customer_name || "Customer",
    customerEmail: raw.customer_email || "",
    createdAt: raw.order_date || raw.created_at || "",
    date: raw.order_date || raw.created_at || "",
    total: Number.isFinite(amount) ? amount : 0,
    fulfillmentStatus: statusLabel(raw.status),
    backendStatus: String(raw.status || "PROCESSING").toUpperCase(),
    paymentMethod: details.paymentMethod || "—",
    paymentStatus: details.paymentStatus || "Not processed — no payment gateway connected",
    address: details.address && typeof details.address === "object" ? details.address : {},
    items: Array.isArray(details.items) ? details.items : [],
    subtotal: Number(details.subtotal ?? amount) || 0,
    discount: Number(details.discount) || 0,
    couponDiscount: Number(details.couponDiscount) || 0,
    couponCode: details.couponCode || "",
    delivery: Number(details.delivery) || 0,
    demoOnly: Boolean(details.demoOnly),
    legacyImported: Boolean(details.legacyImported),
    deliveryMessage: details.demoOnly ? "Imported browser demo order — no payment or shipment was processed." : "Order recorded in CRM. Payment and shipment are not connected yet.",
    statusHistory: Array.isArray(details.statusHistory) ? details.statusHistory : [],
    source: "django-api",
    updatedAt: raw.updated_at || null,
  };
}

export async function getStorefrontOrders(authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  return listPayload(await request(ORDERS_PATH, { method: "GET" })).map(mapStorefrontOrder);
}

export async function getStorefrontOrderById(orderNumber, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  if (!orderNumber) return null;
  const raw = await request(`${ORDERS_PATH}${encodeURIComponent(orderNumber)}/`, { method: "GET" });
  return raw ? mapStorefrontOrder(raw) : null;
}

export async function createStorefrontOrder({ items = [], address = {}, paymentMethod = "Unknown", customerEmail = "", appliedCoupon = null }, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = await request(ORDERS_PATH, {
    method: "POST",
    body: {
      items: (Array.isArray(items) ? items : []).map((item) => ({ id: Number(item.id), quantity: Number(item.quantity) || 1 })),
      address: { ...address, email: customerEmail },
      payment_method: String(paymentMethod || "Unknown"),
      coupon_code: String(appliedCoupon?.code || ""),
    },
  });
  return mapStorefrontOrder(payload);
}

export async function importLegacyDemoOrders(authenticatedRequest, email = "") {
  const request = requireRequest(authenticatedRequest);
  const targetEmail = String(email || "").trim().toLowerCase();
  if (!targetEmail) return { created: 0, duplicates: 0, skipped: 0 };
  // Only migrate local orders explicitly attached to the currently authenticated account.
  const legacy = getDemoOrders().filter((order) => String(order.customerEmail || "").trim().toLowerCase() === targetEmail);
  if (!legacy.length) return { created: 0, duplicates: 0, skipped: 0 };
  return request(LEGACY_IMPORT_PATH, { method: "POST", body: { orders: legacy } });
}
