import { authJsonRequest } from "./authApi";

const mode = (value) => String(value || "mock").trim().toLowerCase() === "api";
export const behaviorEventsApiEnabled = mode(import.meta.env.VITE_CRM_BEHAVIOR_EVENTS_MODE);
export const behaviorAnalyticsApiEnabled = mode(import.meta.env.VITE_CRM_BEHAVIOR_ANALYTICS_MODE);
export const recommendationsApiEnabled = mode(import.meta.env.VITE_CRM_RECOMMENDATIONS_MODE);

function toEventPayload(event = {}) {
  return {
    event_id: String(event.eventId || "").slice(0, 100),
    visitor_id: String(event.visitorId || "").slice(0, 100),
    session_id: String(event.sessionId || "").slice(0, 100),
    event_type: String(event.eventType || ""),
    path: String(event.path || "").slice(0, 200),
    previous_viewed_product_id: event.previousViewedProductId == null ? "" : String(event.previousViewedProductId).slice(0, 80),
    previous_viewed_product_name: String(event.previousViewedProductName || "").slice(0, 160),
    product_id: event.productId == null ? "" : String(event.productId).slice(0, 80),
    product_name: String(event.productName || "").slice(0, 200),
    product_category: String(event.productCategory || "").slice(0, 80),
    product_brand: String(event.productBrand || "").slice(0, 80),
    unit_price: Math.max(0, Number(event.unitPrice) || 0),
    query: String(event.query || "").slice(0, 120),
    search_category: String(event.searchCategory || "").slice(0, 80),
    result_count: Math.max(0, Number.parseInt(event.resultCount, 10) || 0),
    matched_product_ids: Array.isArray(event.matchedProductIds) ? event.matchedProductIds.slice(0, 20).map((id) => String(id).slice(0, 80)) : [],
    quantity: Math.min(1000, Math.max(1, Number.parseInt(event.quantity, 10) || 1)),
    item_count: event.itemCount == null ? null : Math.min(1000, Math.max(0, Number.parseInt(event.itemCount, 10) || 0)),
    order_id: String(event.orderId || "").slice(0, 80),
    line_total: Math.max(0, Number(event.lineTotal) || 0),
    order_total: Math.max(0, Number(event.orderTotal) || 0),
  };
}

export async function sendBehaviorEvent(event) {
  if (!behaviorEventsApiEnabled) return null;
  return authJsonRequest("/api/storefront/behavior-events/", {
    method: "POST",
    body: toEventPayload(event),
  });
}

export async function getBehaviorAnalytics(authenticatedRequest, days = 30) {
  if (typeof authenticatedRequest !== "function") {
    throw new Error("Sign in with a CRM staff account to view persisted behaviour analytics.");
  }
  const safeDays = Math.min(90, Math.max(1, Number.parseInt(days, 10) || 30));
  return authenticatedRequest(`/api/crm/behavior-analytics/?days=${safeDays}`, { method: "GET" });
}

function normaliseProduct(product = {}) {
  const price = Number(product.price) || 0;
  const rawMrp = product.mrp;
  const mrp = rawMrp == null || rawMrp === "" ? null : Number(rawMrp);
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const image = String(product.image || images[0] || "");
  return {
    ...product,
    id: product.id,
    name: String(product.name || "Product"),
    brand: String(product.brand || "TechGear"),
    category: String(product.category || "Other"),
    price,
    mrp,
    discount: Number(product.discount) || (mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0),
    stock: Math.max(0, Number.parseInt(product.stock, 10) || 0),
    status: String(product.status || "Active"),
    image,
    images: images.length ? images : image ? [image] : [],
    specs: String(product.specs || product.shortDescription || ""),
    shortDescription: String(product.shortDescription || product.specs || ""),
    rating: Number(product.rating) || 0,
    reviews: String(product.reviews ?? "0"),
  };
}

export async function getStorefrontRecommendations(limit = 8) {
  const safeLimit = Math.min(12, Math.max(1, Number.parseInt(limit, 10) || 8));
  const response = await authJsonRequest(`/api/storefront/recommendations/?limit=${safeLimit}`, { method: "GET" });
  return {
    ...response,
    items: (Array.isArray(response?.items) ? response.items : []).map(normaliseProduct),
  };
}
