// First-party, pseudonymous behaviour tracking for the project demo.
// This stores no names, emails, phone numbers, or payment credentials.
// In production, disclose analytics tracking in the privacy notice. API mode persists
// scrubbed pseudonymous events in Django for shared organization-level insights.
import { behaviorEventsApiEnabled, sendBehaviorEvent } from "./behaviorApiService";

export const CUSTOMER_BEHAVIOR_CHANGE_EVENT = "techgear:customer-behavior-updated";
const EVENTS_KEY = "techgear_customer_behavior_events_v1";
const VISITOR_KEY = "techgear_anonymous_visitor_v1";
const SESSION_KEY = "techgear_analytics_session_v1";
const MAX_EVENTS = 2000;
const RECENT_VIEW_DEDUPE_MS = 15_000;

function makeId(prefix) {
  const random = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${random}`;
}

function getVisitorId() {
  if (typeof window === "undefined") return "server-side";
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = makeId("visitor");
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "visitor-session-only";
  }
}

function getSessionId() {
  if (typeof window === "undefined") return "server-side";
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = makeId("session");
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "session-unavailable";
  }
}

function readEvents() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(EVENTS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function notifyChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CUSTOMER_BEHAVIOR_CHANGE_EVENT));
  }
}

function cleanSearchQuery(value) {
  return String(value || "")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, "[redacted-number]")
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, 120);
}

function lastViewedForVisitor(events, visitorId, sessionId = getSessionId()) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.visitorId === visitorId && event.sessionId === sessionId && event.eventType === "product_view" && event.productId != null) {
      return { productId: event.productId, productName: event.productName || "" };
    }
  }
  return null;
}

function saveEvent(event, { dedupeProductView = false } = {}) {
  if (typeof window === "undefined") return null;
  const events = readEvents();
  const visitorId = getVisitorId();
  const currentTime = Date.now();

  if (dedupeProductView && event.eventType === "product_view") {
    const last = [...events].reverse().find((item) =>
      item.visitorId === visitorId && item.sessionId === getSessionId() &&
      item.eventType === "product_view" && String(item.productId) === String(event.productId));
    if (last && currentTime - new Date(last.timestamp).getTime() < RECENT_VIEW_DEDUPE_MS) return last;
  }

  const sessionId = getSessionId();
  const previousViewed = lastViewedForVisitor(events, visitorId, sessionId);
  const record = {
    eventId: makeId("event"),
    visitorId,
    sessionId,
    timestamp: new Date(currentTime).toISOString(),
    path: String(window.location.pathname || "").slice(0, 200),
    previousViewedProductId: previousViewed?.productId ?? null,
    previousViewedProductName: previousViewed?.productName ?? "",
    ...event,
  };

  try {
    const next = [...events, record].slice(-MAX_EVENTS);
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify(next));
    notifyChanged();
    if (behaviorEventsApiEnabled) {
      sendBehaviorEvent(record).catch((error) => {
        // Analytics must never block storefront actions when the API is unavailable.
        console.debug("Behaviour event remains browser-local because the API did not accept it.", error?.message || error);
      });
    }
    return record;
  } catch (error) {
    // Tracking must never block a storefront action if storage is full/disabled.
    console.warn("Customer behaviour event was not persisted in demo mode.", error);
    return null;
  }
}

function productFields(product) {
  return {
    productId: product?.id == null ? null : String(product.id),
    productName: String(product?.name || "").slice(0, 160),
    productCategory: String(product?.category || "").slice(0, 80),
    productBrand: String(product?.brand || "").slice(0, 80),
    unitPrice: Number(product?.price) || 0,
  };
}

export function recordProductView(product) {
  if (!product?.id) return null;
  return saveEvent({ eventType: "product_view", ...productFields(product) }, { dedupeProductView: true });
}

export function recordProductSearch(query, { resultCount = 0, category = "", matchedProductIds = [] } = {}) {
  const safeQuery = cleanSearchQuery(query);
  if (!safeQuery) return null;
  return saveEvent({
    eventType: "search",
    query: safeQuery,
    resultCount: Math.max(0, Number(resultCount) || 0),
    searchCategory: String(category || "").slice(0, 80),
    matchedProductIds: Array.isArray(matchedProductIds) ? matchedProductIds.slice(0, 20).map(String) : [],
  });
}

export function recordAddToCart(product, quantity = 1) {
  if (!product?.id) return null;
  return saveEvent({ eventType: "add_to_cart", ...productFields(product), quantity: Math.max(1, Number(quantity) || 1) });
}

export function recordWishlistChange(product, added) {
  if (!product?.id) return null;
  return saveEvent({ eventType: added ? "wishlist_add" : "wishlist_remove", ...productFields(product) });
}

export function recordCheckoutStarted(items = []) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return saveEvent({
    eventType: "checkout_started",
    itemCount: items.reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0),
    productIds: items.slice(0, 30).map((item) => String(item.id)),
  });
}

export function recordDemoPurchase(items = [], total = 0, orderId = makeId("demo-order")) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const events = readEvents();
  if (events.some((event) => event.eventType === "purchase" && event.orderId === orderId)) return null;
  const visitorId = getVisitorId();
  const sessionId = getSessionId();
  const timestamp = new Date().toISOString();
  const records = items.map((item) => ({
    eventId: makeId("event"),
    visitorId,
    sessionId,
    timestamp,
    path: typeof window === "undefined" ? "" : String(window.location.pathname || "").slice(0, 200),
    previousViewedProductId: lastViewedForVisitor(events, visitorId, sessionId)?.productId ?? null,
    previousViewedProductName: lastViewedForVisitor(events, visitorId, sessionId)?.productName ?? "",
    eventType: "purchase",
    ...productFields(item),
    quantity: Math.max(1, Number(item.quantity) || 1),
    lineTotal: (Number(item.price) || 0) * Math.max(1, Number(item.quantity) || 1),
    orderId,
    demoOnly: true,
    orderTotal: Number(total) || 0,
  }));
  try {
    window.localStorage.setItem(EVENTS_KEY, JSON.stringify([...events, ...records].slice(-MAX_EVENTS)));
    notifyChanged();
    if (behaviorEventsApiEnabled) {
      records.forEach((record) => sendBehaviorEvent(record).catch((error) => {
        console.debug("Demo purchase event could not be synced to the behaviour API.", error?.message || error);
      }));
    }
    return orderId;
  } catch (error) {
    console.warn("Demo purchase analytics could not be saved.", error);
    return null;
  }
}

function summariseProducts(events, eventType, metric = "events") {
  const byProduct = new Map();
  events.filter((event) => event.eventType === eventType && event.productId != null).forEach((event) => {
    const key = String(event.productId);
    const current = byProduct.get(key) || {
      productId: key,
      productName: event.productName || "Unknown product",
      category: event.productCategory || "Other",
      brand: event.productBrand || "",
      views: 0,
      cartAdds: 0,
      purchasedQuantity: 0,
      totalRevenue: 0,
      eventCount: 0,
    };
    current.eventCount += 1;
    current[metric] = (Number(current[metric]) || 0) + (metric === "purchasedQuantity" || metric === "cartAdds" ? Math.max(1, Number(event.quantity) || 1) : 1);
    if (event.eventType === "purchase") current.totalRevenue += Number(event.lineTotal) || 0;
    byProduct.set(key, current);
  });
  return [...byProduct.values()].sort((a, b) => Number(b[metric]) - Number(a[metric]));
}

export function getCustomerBehaviorSummary({ days = 30 } = {}) {
  const cutoff = Date.now() - Math.max(1, Number(days) || 30) * 24 * 60 * 60 * 1000;
  const events = readEvents().filter((event) => Number.isFinite(Date.parse(event.timestamp)) && Date.parse(event.timestamp) >= cutoff);
  const views = summariseProducts(events, "product_view", "views");
  const carts = summariseProducts(events, "add_to_cart", "cartAdds");
  const purchases = summariseProducts(events, "purchase", "purchasedQuantity");

  const searchMap = new Map();
  events.filter((event) => event.eventType === "search" && event.query).forEach((event) => {
    const key = String(event.query).toLowerCase();
    const item = searchMap.get(key) || { query: event.query, searches: 0, zeroResultSearches: 0, linkedToProduct: 0 };
    item.searches += 1;
    if (Number(event.resultCount) === 0) item.zeroResultSearches += 1;
    if (event.previousViewedProductId != null) item.linkedToProduct += 1;
    searchMap.set(key, item);
  });
  const popularSearches = [...searchMap.values()].sort((a, b) => b.searches - a.searches).slice(0, 8);

  const journeyMap = new Map();
  events.filter((event) => event.eventType === "search" && event.previousViewedProductId != null && event.query).forEach((event) => {
    const key = `${event.previousViewedProductId}::${String(event.query).toLowerCase()}`;
    const item = journeyMap.get(key) || {
      previousViewedProductId: String(event.previousViewedProductId),
      previousViewedProductName: event.previousViewedProductName || `Product ${event.previousViewedProductId}`,
      query: event.query,
      occurrences: 0,
      zeroResultSearches: 0,
    };
    item.occurrences += 1;
    if (Number(event.resultCount) === 0) item.zeroResultSearches += 1;
    journeyMap.set(key, item);
  });
  const searchAfterViews = [...journeyMap.values()].sort((a, b) => b.occurrences - a.occurrences).slice(0, 8);

  const allProducts = new Map();
  events.filter((event) => ["product_view", "add_to_cart", "purchase"].includes(event.eventType) && event.productId != null).forEach((event) => {
    const key = String(event.productId);
    const item = allProducts.get(key) || {
      productId: key,
      productName: event.productName || "Unknown product",
      category: event.productCategory || "Other",
      brand: event.productBrand || "",
      views: 0,
      cartAdds: 0,
      purchasedQuantity: 0,
      totalRevenue: 0,
    };
    if (event.eventType === "product_view") item.views += 1;
    if (event.eventType === "add_to_cart") item.cartAdds += Math.max(1, Number(event.quantity) || 1);
    if (event.eventType === "purchase") {
      item.purchasedQuantity += Math.max(1, Number(event.quantity) || 1);
      item.totalRevenue += Number(event.lineTotal) || 0;
    }
    allProducts.set(key, item);
  });
  const adoptionProducts = [...allProducts.values()].map((item) => ({
    ...item,
    adoptionScore: item.views + item.cartAdds * 3 + item.purchasedQuantity * 6,
  })).sort((a, b) => b.adoptionScore - a.adoptionScore).slice(0, 8);

  const uniqueVisitors = (type) => new Set(events.filter((event) => event.eventType === type).map((event) => event.visitorId)).size;
  const uniquePurchasers = new Set(events.filter((event) => event.eventType === "purchase").map((event) => event.visitorId)).size;
  const checkoutVisitors = new Set(events.filter((event) => event.eventType === "checkout_started").map((event) => event.visitorId)).size;
  const totalViews = events.filter((event) => event.eventType === "product_view").length;
  const totalSearches = events.filter((event) => event.eventType === "search").length;
  const totalCartAdds = events.filter((event) => event.eventType === "add_to_cart").length;
  const totalPurchaseUnits = events.filter((event) => event.eventType === "purchase").reduce((total, event) => total + Math.max(1, Number(event.quantity) || 1), 0);

  return {
    periodDays: Math.max(1, Number(days) || 30),
    eventCount: events.length,
    totalViews,
    totalSearches,
    totalCartAdds,
    totalPurchaseUnits,
    uniqueViewers: uniqueVisitors("product_view"),
    uniqueCartVisitors: uniqueVisitors("add_to_cart"),
    checkoutVisitors,
    uniquePurchasers,
    viewsToCartRate: uniqueVisitors("product_view") ? Math.round(uniqueVisitors("add_to_cart") / uniqueVisitors("product_view") * 1000) / 10 : 0,
    checkoutToPurchaseRate: checkoutVisitors ? Math.round(uniquePurchasers / checkoutVisitors * 1000) / 10 : 0,
    mostViewed: views.slice(0, 8),
    mostAddedToCart: carts.slice(0, 8),
    mostPurchased: purchases.slice(0, 8),
    popularSearches,
    searchAfterViews,
    adoptionProducts,
    recentEvents: [...events].reverse().slice(0, 10),
  };
}

export function clearCustomerBehaviorDemoData() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(EVENTS_KEY); } catch { /* ignore unavailable storage */ }
  notifyChanged();
}
