function moneyNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

export function getItemQuantity(item) {
  const quantity = Number.parseInt(item?.quantity, 10);
  return Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
}

export function getUnitPrice(item) {
  return moneyNumber(item?.price);
}

export function getUnitMrp(item) {
  return Math.max(moneyNumber(item?.mrp), getUnitPrice(item));
}

/**
 * One source of truth for cart, checkout and the saved order snapshot.
 * Subtotal is MRP/list-price total; discount is subtracted once; delivery is
 * free at an item-payable total of ₹500 or above, otherwise ₹99 for non-empty carts.
 */
export function calculateCartTotals(items = [], couponDiscount = 0) {
  const safeItems = Array.isArray(items) ? items : [];
  const subtotal = roundMoney(safeItems.reduce((sum, item) => sum + getUnitMrp(item) * getItemQuantity(item), 0));
  const itemPayable = roundMoney(safeItems.reduce((sum, item) => sum + getUnitPrice(item) * getItemQuantity(item), 0));
  const discount = roundMoney(Math.max(0, subtotal - itemPayable));
  const couponSavings = roundMoney(Math.min(itemPayable, moneyNumber(couponDiscount)));
  const delivery = safeItems.length === 0 ? 0 : itemPayable >= 500 ? 0 : 99;
  return { subtotal, discount, couponDiscount: couponSavings, itemPayable, delivery, total: roundMoney(itemPayable + delivery - couponSavings) };
}

export function formatINR(value) {
  return `₹${roundMoney(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
