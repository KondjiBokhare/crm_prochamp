import {
  createNotificationRecord,
  getAllNotificationRecords,
  markNotificationReadForUser,
} from "./notificationCenterService";

const REVIEWED_STORAGE_KEY = "techgear_customer_product_reviews_v1";

function getUserIdentity(user = {}) {
  const email = String(user.email || "").trim().toLowerCase();
  if (email) return `email:${email}`;
  const id = String(user.id || "").trim();
  return id ? `id:${id}` : "anonymous";
}

function readReviewedReviews() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(REVIEWED_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function productIdValue(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : null;
}

export function getReviewProductId(item = {}) {
  return productIdValue(
    item.productId ?? item.product_id ?? item.catalogProductId ?? item.product?.id ?? item.id,
  );
}

export function isProductReviewSubmitted(user = {}, productId) {
  const id = productIdValue(productId);
  if (!id) return false;
  const identity = getUserIdentity(user);
  return readReviewedReviews().some(
    (item) => item.userIdentity === identity && String(item.productId) === id,
  );
}

export function markProductReviewSubmitted(user = {}, productId, orderId = "") {
  const id = productIdValue(productId);
  if (!id || typeof window === "undefined") return;
  const identity = getUserIdentity(user);
  const existing = readReviewedReviews();
  const next = existing.filter(
    (item) => !(item.userIdentity === identity && String(item.productId) === id),
  );
  next.unshift({
    userIdentity: identity,
    productId: id,
    orderId: String(orderId || ""),
    submittedAt: new Date().toISOString(),
  });
  try {
    window.localStorage.setItem(REVIEWED_STORAGE_KEY, JSON.stringify(next.slice(0, 500)));
  } catch {
    // The successful API response remains the source of truth for this session.
  }
  window.dispatchEvent(new Event("techgear:customer-reviews-updated"));
}

function normalisedStatus(order = {}) {
  return String(order.fulfillmentStatus || order.status || order.backendStatus || "")
    .trim()
    .toLowerCase();
}

function isReviewEligibleOrder(order = {}) {
  const status = normalisedStatus(order);
  return status.includes("ship") || status.includes("deliver");
}

function getOrderIdentifier(order = {}) {
  return String(order.orderNumber || order.order_number || order.id || "").trim();
}

export function makeReviewReminderId(user = {}, orderId, productId) {
  const email = String(user.email || user.id || "customer").trim().toLowerCase();
  return `review-reminder:${encodeURIComponent(email)}:${encodeURIComponent(String(orderId || "order"))}:${encodeURIComponent(String(productId || "product"))}`;
}

export function markReviewReminderRead(user = {}, orderId, productId) {
  const reminderId = makeReviewReminderId(user, orderId, productId);
  markNotificationReadForUser(reminderId, user);
}

/**
 * Creates browser-local reminder records for eligible orders. This is a frontend
 * bridge until the backend team supplies persisted order-review eligibility and
 * notification contracts. It deliberately does not make or change API requests.
 */
export function syncReviewReminderNotifications(orders = [], user = {}) {
  if (typeof window === "undefined" || !Array.isArray(orders) || !user.email) return 0;

  const existing = new Set(getAllNotificationRecords().map((item) => String(item.id)));
  let created = 0;

  orders.forEach((order) => {
    if (!isReviewEligibleOrder(order)) return;
    const orderId = getOrderIdentifier(order);
    if (!orderId) return;
    const status = normalisedStatus(order);
    const statusWord = status.includes("deliver") ? "delivered" : "shipped";

    (Array.isArray(order.items) ? order.items : []).forEach((item) => {
      const productId = getReviewProductId(item);
      if (!productId || isProductReviewSubmitted(user, productId)) return;
      const notificationId = makeReviewReminderId(user, orderId, productId);
      if (existing.has(notificationId)) return;

      const itemName = String(item.name || item.productName || "your product");
      createNotificationRecord({
        id: notificationId,
        title: "Your product is ready for review",
        message: `Your ${itemName} has ${statusWord}. Share your experience with other customers.`,
        type: "review",
        audience: "customer",
        recipientEmail: user.email,
        link: `/orders?reviewOrder=${encodeURIComponent(orderId)}&productId=${encodeURIComponent(productId)}`,
        source: "review-reminder",
        metadata: { orderId, productId, productName: itemName, orderStatus: statusWord },
      });
      existing.add(notificationId);
      created += 1;
    });
  });

  return created;
}
