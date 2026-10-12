// Phase 26 CRM APIs: inventory movements, discount coupon administration, and abandoned carts.
function requireStaffRequest(authenticatedRequest, label) {
  if (typeof authenticatedRequest !== "function") {
    throw new Error(`${label} requires an authenticated Django staff session. Please sign in to CRM again.`);
  }
}

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function queryString(values = {}) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "" && value !== "All") query.set(key, String(value));
  });
  const result = query.toString();
  return result ? `?${result}` : "";
}

const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;

function mapMovement(raw = {}) {
  return {
    id: raw.id,
    productId: raw.product,
    productName: raw.product_name || "Product",
    sku: raw.sku || "—",
    actorEmail: raw.actor_email || "—",
    movementType: raw.movement_type || "ADJUSTMENT",
    quantityDelta: n(raw.quantity_delta),
    stockBefore: n(raw.stock_before),
    stockAfter: n(raw.stock_after),
    reason: raw.reason || "—",
    createdAt: raw.created_at || "",
  };
}

export async function getInventoryMovements(params = {}, authenticatedRequest) {
  requireStaffRequest(authenticatedRequest, "Inventory management");
  const rows = await authenticatedRequest(`/api/crm/inventory/movements/${queryString({
    search: params.search,
    product_id: params.productId,
    movement_type: params.movementType,
  })}`, { method: "GET" });
  return unwrapList(rows).map(mapMovement);
}

export async function createInventoryAdjustment(input = {}, authenticatedRequest) {
  requireStaffRequest(authenticatedRequest, "Inventory adjustment");
  const result = await authenticatedRequest("/api/crm/inventory/movements/", {
    method: "POST",
    body: {
      product_id: Number(input.productId),
      direction: input.direction,
      quantity: Number(input.quantity),
      movement_type: input.movementType || "ADJUSTMENT",
      reason: String(input.reason || "").trim(),
    },
  });
  return mapMovement(result);
}

function mapCoupon(raw = {}) {
  return {
    id: raw.id,
    code: String(raw.code || ""),
    name: String(raw.name || ""),
    discountType: raw.discount_type || "PERCENT",
    value: n(raw.value),
    minOrderValue: n(raw.min_order_value),
    maxDiscount: raw.max_discount == null ? null : n(raw.max_discount),
    startsAt: raw.starts_at || "",
    endsAt: raw.ends_at || "",
    usageLimit: raw.usage_limit == null ? null : n(raw.usage_limit),
    usedCount: n(raw.used_count),
    isActive: Boolean(raw.is_active),
    createdAt: raw.created_at || "",
    updatedAt: raw.updated_at || "",
    createdByEmail: raw.created_by_email || "",
  };
}

function couponToApi(input = {}) {
  const asDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new Error("Enter a valid coupon start/end date and time.");
    return date.toISOString();
  };
  const limit = input.usageLimit === "" || input.usageLimit == null ? null : Number(input.usageLimit);
  return {
    code: String(input.code || "").trim().toUpperCase(),
    name: String(input.name || "").trim(),
    discount_type: input.discountType || "PERCENT",
    value: Number(input.value),
    min_order_value: Number(input.minOrderValue || 0),
    max_discount: input.maxDiscount === "" || input.maxDiscount == null ? null : Number(input.maxDiscount),
    starts_at: asDate(input.startsAt),
    ends_at: asDate(input.endsAt),
    usage_limit: limit,
    is_active: input.isActive !== false,
  };
}

export async function getDiscountCoupons(params = {}, authenticatedRequest) {
  requireStaffRequest(authenticatedRequest, "Coupon management");
  const rows = await authenticatedRequest(`/api/crm/coupons/${queryString({ search: params.search, active: params.active })}`, { method: "GET" });
  return unwrapList(rows).map(mapCoupon);
}

export async function createDiscountCoupon(input = {}, authenticatedRequest) {
  requireStaffRequest(authenticatedRequest, "Coupon management");
  const result = await authenticatedRequest("/api/crm/coupons/", { method: "POST", body: couponToApi(input) });
  return mapCoupon(result);
}

export async function updateDiscountCoupon(id, patch = {}, authenticatedRequest) {
  requireStaffRequest(authenticatedRequest, "Coupon management");
  const body = {};
  const keys = [
    ["code", "code", (value) => String(value || "").trim().toUpperCase()],
    ["name", "name", (value) => String(value || "").trim()],
    ["discountType", "discount_type", (value) => value],
    ["value", "value", Number],
    ["minOrderValue", "min_order_value", Number],
    ["maxDiscount", "max_discount", (value) => value === "" || value == null ? null : Number(value)],
    ["startsAt", "starts_at", (value) => { if (!value) return null; const date = new Date(value); if (!Number.isFinite(date.getTime())) throw new Error("Enter a valid coupon start date/time."); return date.toISOString(); }],
    ["endsAt", "ends_at", (value) => { if (!value) return null; const date = new Date(value); if (!Number.isFinite(date.getTime())) throw new Error("Enter a valid coupon end date/time."); return date.toISOString(); }],
    ["usageLimit", "usage_limit", (value) => value === "" || value == null ? null : Number(value)],
    ["isActive", "is_active", Boolean],
  ];
  keys.forEach(([frontendKey, apiKey, transform]) => { if (Object.prototype.hasOwnProperty.call(patch, frontendKey)) body[apiKey] = transform(patch[frontendKey]); });
  const result = await authenticatedRequest(`/api/crm/coupons/${encodeURIComponent(id)}/`, { method: "PATCH", body });
  return mapCoupon(result);
}

export async function deleteDiscountCoupon(id, authenticatedRequest) {
  requireStaffRequest(authenticatedRequest, "Coupon management");
  return authenticatedRequest(`/api/crm/coupons/${encodeURIComponent(id)}/`, { method: "DELETE" });
}

export async function getAbandonedCarts(params = {}, authenticatedRequest) {
  requireStaffRequest(authenticatedRequest, "Abandoned cart reporting");
  const payload = await authenticatedRequest(`/api/crm/abandoned-carts/${queryString({
    min_age_hours: params.minAgeHours ?? 24,
    search: params.search,
  })}`, { method: "GET" });
  return {
    minAgeHours: n(payload?.minAgeHours) || 24,
    count: n(payload?.count),
    deliveryConfigured: Boolean(payload?.deliveryConfigured),
    items: unwrapList(payload).map((row) => ({
      id: row.id,
      visitorHint: row.visitorHint || "—",
      itemCount: n(row.itemCount),
      quantityCount: n(row.quantityCount),
      productNames: Array.isArray(row.productNames) ? row.productNames : [],
      subtotal: n(row.subtotal),
      updatedAt: row.updatedAt || "",
      ageHours: n(row.ageHours),
    })),
  };
}
