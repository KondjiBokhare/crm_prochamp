// Real Customer Management adapter for the supplied Django backend.
// Uses AuthContext.authenticatedRequest so JWT refresh behaviour stays centralized.
// Current backend Customer fields: first_name, last_name, email, phone,
// lifecycle_stage, is_active, organization, created_at, updated_at.

const CUSTOMERS_PATH = "/api/crm/customers/";
const ORDERS_PATH = "/api/crm/orders/";
const DIRECTORY_CACHE_MS = 5000;
let directoryCache = { loadedAt: 0, customers: null, orders: null, ordersAvailable: false };

function requireRequest(authenticatedRequest) {
  if (typeof authenticatedRequest !== "function") {
    throw new Error("Customer API mode requires an authenticated Django session. Please sign in again.");
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

function toISODate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

function relatedOrdersFor(customerId, orders) {
  if (!Array.isArray(orders)) return null;
  return orders.filter((order) => String(order.customer) === String(customerId));
}

function summarizeOrders(customerId, orders) {
  const related = relatedOrdersFor(customerId, orders);
  if (related === null) return { totalOrders: null, totalSpend: null, lastOrderDate: "" };
  const eligible = related.filter((order) => !["CANCELLED", "REFUNDED"].includes(String(order.status || "").toUpperCase()));
  const delivered = related.filter((order) => String(order.status || "").toUpperCase() === "DELIVERED");
  const latest = related
    .map((order) => order.order_date || order.created_at)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0];
  return {
    totalOrders: eligible.length,
    // The supplied backend tracks a generic order status, not payment status.
    // Only delivered order amounts are represented as realized customer spend.
    totalSpend: delivered.reduce((total, order) => total + Number(order.amount || 0), 0),
    lastOrderDate: toISODate(latest),
  };
}

export function mapDjangoCustomer(raw, orders = null) {
  const name = [raw?.first_name, raw?.last_name].map((part) => String(part || "").trim()).filter(Boolean).join(" ");
  const storefront = raw?.storefront_profile && typeof raw.storefront_profile === "object"
    ? raw.storefront_profile
    : null;
  const storefrontProfile = storefront ? {
    phone: String(storefront.phone || raw?.phone || ""),
    dateOfBirth: storefront.date_of_birth || "",
    gender: storefront.gender || "UNSPECIFIED",
    emailUpdates: storefront.email_updates !== false,
    smsUpdates: Boolean(storefront.sms_updates),
    whatsappUpdates: Boolean(storefront.whatsapp_updates),
    addresses: Array.isArray(storefront.addresses) ? storefront.addresses : [],
  } : null;
  return {
    id: raw?.id,
    name: name || raw?.email || `Customer ${raw?.id ?? ""}`.trim(),
    firstName: raw?.first_name || "",
    lastName: raw?.last_name || "",
    email: raw?.email || "",
    phone: raw?.phone || storefrontProfile?.phone || "",
    dateOfBirth: storefrontProfile?.dateOfBirth || "",
    gender: storefrontProfile?.gender || "",
    communicationPreferences: storefrontProfile ? [
      storefrontProfile.emailUpdates && "Email",
      storefrontProfile.smsUpdates && "SMS",
      storefrontProfile.whatsappUpdates && "WhatsApp",
    ].filter(Boolean) : [],
    storefrontProfile,
    city: raw?.city || "",
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
    status: raw?.is_active === false ? "Inactive" : "Active",
    isActive: raw?.is_active !== false,
    lifecycleStage: raw?.lifecycle_stage || "LEAD",
    joinedAt: toISODate(raw?.created_at),
    updatedAt: raw?.updated_at || null,
    ...summarizeOrders(raw?.id, orders),
  };
}

async function loadDirectory(authenticatedRequest, { force = false } = {}) {
  const request = requireRequest(authenticatedRequest);
  const fresh = Date.now() - directoryCache.loadedAt < DIRECTORY_CACHE_MS;
  if (!force && fresh && Array.isArray(directoryCache.customers)) return directoryCache;

  const rawCustomersPromise = request(CUSTOMERS_PATH, { method: "GET" });
  const rawOrdersPromise = request(ORDERS_PATH, { method: "GET" })
    .then(asCollection)
    .then((orders) => ({ orders, available: true }))
    .catch(() => ({ orders: null, available: false }));

  const [customersPayload, orderResult] = await Promise.all([rawCustomersPromise, rawOrdersPromise]);
  directoryCache = {
    loadedAt: Date.now(),
    customers: asCollection(customersPayload),
    orders: orderResult.orders,
    ordersAvailable: orderResult.available,
  };
  return directoryCache;
}

function filterCustomers(customers, { search = "", status = "All", city = "All" } = {}) {
  const query = String(search || "").trim().toLowerCase();
  return customers.filter((customer) => {
    const matchesSearch = !query || [customer.name, customer.email, customer.phone, String(customer.id)]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = status === "All" || customer.status === status;
    // City isn't present on the supplied Django Customer model; don't falsely filter it.
    const matchesCity = city === "All" || !customer.city || customer.city === city;
    return matchesSearch && matchesStatus && matchesCity;
  });
}

export async function getCustomers(params = {}, authenticatedRequest) {
  const directory = await loadDirectory(authenticatedRequest);
  const customers = directory.customers.map((raw) => mapDjangoCustomer(raw, directory.orders));
  return filterCustomers(customers, params);
}

function splitName(value) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  return { first_name: parts[0] || "", last_name: parts.slice(1).join(" ") };
}

function buildPayload(input, { partial = false } = {}) {
  const payload = {};
  if (!partial || Object.prototype.hasOwnProperty.call(input, "name")) {
    const names = splitName(input.name);
    if (!names.first_name) throw new Error("Customer first name is required.");
    payload.first_name = names.first_name;
    payload.last_name = names.last_name;
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, "email")) {
    const email = String(input.email || "").trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid customer email address.");
    payload.email = email;
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, "phone")) payload.phone = String(input.phone || "").trim();
  if (!partial || Object.prototype.hasOwnProperty.call(input, "lifecycleStage")) {
    payload.lifecycle_stage = String(input.lifecycleStage || "CUSTOMER").toUpperCase();
  }
  if (!partial || Object.prototype.hasOwnProperty.call(input, "status")) payload.is_active = input.status !== "Inactive";
  return payload;
}

export async function createCustomer(input, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = buildPayload(input);
  const directory = await loadDirectory(request);
  const duplicate = directory.customers.some((customer) => String(customer.email || "").trim().toLowerCase() === payload.email);
  if (duplicate) throw new Error("A customer with this email already exists in the current organization.");
  const raw = await request(CUSTOMERS_PATH, { method: "POST", body: payload });
  directoryCache.loadedAt = 0;
  return mapDjangoCustomer(raw, []);
}

export async function updateCustomer(id, input, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = buildPayload(input, { partial: true });
  if (payload.email) {
    const directory = await loadDirectory(request);
    const duplicate = directory.customers.some((customer) => String(customer.id) !== String(id) && String(customer.email || "").trim().toLowerCase() === payload.email);
    if (duplicate) throw new Error("Another customer with this email already exists in the current organization.");
  }
  const raw = await request(`${CUSTOMERS_PATH}${encodeURIComponent(id)}/`, { method: "PATCH", body: payload });
  directoryCache.loadedAt = 0;
  return mapDjangoCustomer(raw, directoryCache.orders);
}

export async function getCustomerById(id, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  try {
    const raw = await request(`${CUSTOMERS_PATH}${encodeURIComponent(id)}/`, { method: "GET" });
    const orderResult = await request(ORDERS_PATH, { method: "GET" }).then(asCollection).catch(() => null);
    return mapDjangoCustomer(raw, orderResult);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

export async function getCustomerOrders(customerId, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const rawOrders = asCollection(await request(ORDERS_PATH, { method: "GET" }));
  return rawOrders
    .filter((order) => String(order.customer) === String(customerId))
    .map((order) => ({
      id: order.order_number || order.id,
      date: order.order_date || order.created_at || "",
      total: Number(order.amount || 0),
      status: String(order.status || "PENDING").toUpperCase(),
      backendId: order.id,
    }));
}

export function invalidateCustomerApiCache() {
  directoryCache = { loadedAt: 0, customers: null, orders: null, ordersAvailable: false };
}
