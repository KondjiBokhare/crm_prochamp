import { calculateCartTotals, getItemQuantity, getUnitMrp, getUnitPrice } from "../utils/pricing";
import { createNotificationRecord } from "./notificationCenterService";

const ORDERS_KEY = "techgear_demo_orders_v1";
const ADDRESS_KEY = "techgear_checkout_address_v1";

function readOrders() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ORDERS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getSavedCheckoutAddress() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ADDRESS_KEY) || "null");
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveCheckoutAddress(address) {
  try { localStorage.setItem(ADDRESS_KEY, JSON.stringify(address)); } catch { /* optional demo convenience */ }
}

export function createDemoOrder({ items, address, paymentMethod, customerEmail = "", appliedCoupon = null }) {
  if (!Array.isArray(items) || items.length === 0) throw new Error("Your cart is empty.");
  const id = `TG-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  const savedItems = items.map((item) => ({
    id: item.id,
    sku: item.sku || "",
    name: item.name || "Product",
    specs: item.specs || item.shortDescription || "",
    image: item.images?.[0] || item.image || "",
    price: getUnitPrice(item),
    mrp: getUnitMrp(item),
    quantity: getItemQuantity(item),
  }));
  // Always calculate the stored totals from the same saved line items shown
  // on the confirmation page. Avoid trusting independently passed/static amounts.
  const couponDiscountRequested = appliedCoupon?.discountAmount || 0;
  const totals = calculateCartTotals(savedItems, couponDiscountRequested);
  const order = {
    id,
    createdAt: new Date().toISOString(),
    paymentMethod,
    customerEmail: String(customerEmail || address?.email || "").trim().toLowerCase(),
    paymentStatus: paymentMethod === "Cash on Delivery" ? "Pay on delivery" : "Demo only — no payment processed",
    fulfillmentStatus: "Processing (demo)",
    address: { ...address },
    items: savedItems,
    subtotal: totals.subtotal,
    discount: totals.discount,
    couponDiscount: totals.couponDiscount,
    couponCode: appliedCoupon?.code || "",
    delivery: totals.delivery,
    total: totals.total,
    demoOnly: true,
  };
  const orders = readOrders();
  orders.unshift(order);
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders.slice(0, 100)));
    saveCheckoutAddress(address);
    if (typeof window !== "undefined") window.dispatchEvent(new Event("techgear:demo-orders-updated"));
    if (order.customerEmail) createNotificationRecord({ title: `Order placed: ${order.id}`, message: `Your demo order has been received. Total: ₹${order.total.toLocaleString("en-IN")}. No payment was processed.`, type: "order", recipientEmail: order.customerEmail, link: "/orders", source: "order-created", metadata: { orderId: order.id, total: order.total } });
  } catch {
    throw new Error("Could not save the demo order in browser storage. Try a smaller product image or clear old demo data.");
  }
  return order;
}

export function getDemoOrders() {
  return readOrders();
}

export function getDemoOrderById(id) {
  if (!id) return null;
  return readOrders().find((order) => String(order.id) === String(id)) || null;
}

export function getLatestDemoOrder() {
  return readOrders()[0] || null;
}


// CRM demo order management helpers. These update only this browser's demo data;
// replace with Django APIs when the backend contract is implemented.
export function updateDemoOrder(orderId, patch = {}) {
  const orders = readOrders();
  const index = orders.findIndex((order) => String(order.id) === String(orderId));
  if (index < 0) throw new Error("Order was not found in browser demo orders.");
  const current = orders[index];
  const now = new Date().toISOString();
  const next = {
    ...current,
    ...patch,
    statusHistory: Array.isArray(patch.statusHistory) ? patch.statusHistory : (current.statusHistory || []),
    updatedAt: now,
  };
  orders[index] = next;
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders.slice(0, 100)));
    if (typeof window !== "undefined") window.dispatchEvent(new Event("techgear:demo-orders-updated"));
  } catch {
    throw new Error("Could not update the order in browser storage.");
  }
  return next;
}
