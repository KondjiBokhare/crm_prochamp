 
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

export async function validateStorefrontCoupon(
  code,
  cartItems = [],
  authenticatedRequest
) {
  if (!storefrontCouponsApiEnabled) {
    throw new Error("Storefront coupon API mode is not enabled.");
  }

  if (typeof authenticatedRequest !== "function") {
    throw new Error("Please sign in to apply a coupon.");
  }

  await saveStorefrontCart(cartItems, authenticatedRequest);

  const result = await authenticatedRequest(
    "/api/storefront/coupons/validate/",
    {
      method: "POST",
      body: {
        code: String(code || "").trim().toUpperCase(),
        visitor_id: getStorefrontVisitorId(),
      },
    }
  );

  if (!result?.valid) {
    throw new Error(
      result?.detail ||
      "This coupon cannot be applied to the current cart."
    );
  }

  return {
    code: String(result.code || ""),
    name: String(result.name || ""),
    discountType: String(result.discountType || "PERCENT"),
    value: Number(result.value) || 0,
    discountAmount: Math.max(
      0,
      Number(result.discountAmount) || 0
    ),
    subtotal: Math.max(0, Number(result.subtotal) || 0),
    note: String(result.note || ""),
  };
}

export async function validateDirectCheckoutCoupon(
  code,
  items = [],
  authenticatedRequest
) {
  if (!storefrontCouponsApiEnabled) {
    throw new Error("Coupon API mode is not enabled.");
  }

  if (typeof authenticatedRequest !== "function") {
    throw new Error("Please sign in to apply a coupon.");
  }

  const normalizedCode = String(code || "")
    .trim()
    .toUpperCase();

  if (!normalizedCode) {
    throw new Error("Enter a coupon code.");
  }

  if (!Array.isArray(items) || items.length !== 1) {
    throw new Error("Select a valid product first.");
  }

  const productId = Number(items[0].id);
  const quantity = Number(items[0].quantity);

  if (
    !Number.isSafeInteger(productId) ||
    productId < 1 ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > 100
  ) {
    throw new Error("Invalid product or quantity.");
  }

  const result = await authenticatedRequest(
    "/api/storefront/coupons/validate/",
    {
      method: "POST",
      body: {
        code: normalizedCode,
        checkout_mode: "buy_now",
        items: [
          {
            id: productId,
            quantity,
          },
        ],
      },
    }
  );

  if (!result?.valid) {
    throw new Error(
      result?.detail ||
      "This coupon cannot be applied to this product."
    );
  }

  return {
    code: String(result.code || ""),
    name: String(result.name || ""),
    discountType: String(
      result.discountType || "PERCENT"
    ),
    value: Number(result.value) || 0,
    discountAmount: Math.max(
      0,
      Number(result.discountAmount) || 0
    ),
    subtotal: Math.max(
      0,
      Number(result.subtotal) || 0
    ),
    cartSignature: getCartSignature(items),
    note: String(result.note || ""),
  };
}