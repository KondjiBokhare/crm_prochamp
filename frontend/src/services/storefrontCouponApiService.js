import { authJsonRequest } from "./authApi";
import { getStorefrontVisitorId, saveStorefrontCart } from "./storefrontCommerceApiService";

const APPLIED_COUPON_KEY = "techgear_applied_coupon_phase26_v1";
export const storefrontCouponsApiEnabled = String(import.meta.env.VITE_STOREFRONT_COUPONS_MODE || "mock").trim().toLowerCase() === "api";

export function getAppliedStorefrontCoupon() {
  try {
    const result = JSON.parse(window.localStorage.getItem(APPLIED_COUPON_KEY) || "null");
    return result && typeof result === "object" && result.code ? result : null;
  } catch {
    return null;
  }
}

export function saveAppliedStorefrontCoupon(coupon) {
  if (!coupon || !coupon.code) return clearAppliedStorefrontCoupon();
  try { window.localStorage.setItem(APPLIED_COUPON_KEY, JSON.stringify(coupon)); }
  catch { throw new Error("Could not save the applied coupon in browser storage."); }
}

export function clearAppliedStorefrontCoupon() {
  try { window.localStorage.removeItem(APPLIED_COUPON_KEY); } catch { /* best-effort cleanup */ }
}

export function getCartSignature(items = []) {
  return (Array.isArray(items) ? items : [])
    .map((item) => `${String(item.id)}:${Math.max(1, Number.parseInt(item.quantity, 10) || 1)}`)
    .sort()
    .join("|");
}

export async function validateStorefrontCoupon(code, cartItems = []) {
  if (!storefrontCouponsApiEnabled) throw new Error("Storefront coupon API mode is not enabled. Add VITE_STOREFRONT_COUPONS_MODE=api and restart Vite.");
  // Save the latest cart snapshot first so the backend validates server-side prices and quantities.
  await saveStorefrontCart(cartItems);
  const result = await authJsonRequest("/api/storefront/coupons/validate/", {
    method: "POST",
    body: { code: String(code || "").trim().toUpperCase(), visitor_id: getStorefrontVisitorId() },
  });
  if (!result?.valid) throw new Error(result?.detail || "This coupon cannot be applied to the current cart.");
  return {
    code: String(result.code || ""),
    name: String(result.name || ""),
    discountType: String(result.discountType || "PERCENT"),
    value: Number(result.value) || 0,
    discountAmount: Math.max(0, Number(result.discountAmount) || 0),
    subtotal: Math.max(0, Number(result.subtotal) || 0),
    note: String(result.note || ""),
  };
}
