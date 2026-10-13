import { authJsonRequest } from "./authApi";

const isApiMode = (value) => String(value || "mock").trim().toLowerCase() === "api";
export const storefrontCartApiEnabled = isApiMode(import.meta.env.VITE_STOREFRONT_CART_MODE);
export const storefrontWishlistApiEnabled = isApiMode(import.meta.env.VITE_STOREFRONT_WISHLIST_MODE);
export const storefrontReviewsApiEnabled = isApiMode(import.meta.env.VITE_STOREFRONT_REVIEWS_MODE);

const VISITOR_KEY = "techgear_anonymous_visitor_v1";

function createId(prefix) {
  const value = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `${prefix}-${value}`;
}

export function getStorefrontVisitorId() {
  if (typeof window === "undefined") return "visitor-server-side";
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id || !/^[A-Za-z0-9_-]{1,100}$/.test(id)) {
      id = createId("visitor");
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return createId("visitor");
  }
}

function normaliseProduct(product = {}) {
  const price = Number(product.price) || 0;
  const rawMrp = product.mrp;
  const mrp = rawMrp == null || rawMrp === "" ? null : Number(rawMrp);
  const images = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
  const image = String(product.image || images[0] || "");
  return {
    ...product,
    id: Number(product.id) || product.id,
    name: String(product.name || "Product"),
    brand: String(product.brand || "TechGear"),
    category: String(product.category || "Other"),
    price,
    mrp,
    discount: Number(product.discount) || (mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0),
    stock: Math.max(0, Number.parseInt(product.stock, 10) || 0),
    image,
    images: images.length ? images : image ? [image] : [],
    shortDescription: String(product.shortDescription || product.specs || ""),
    rating: Number(product.rating) || 0,
    reviews: String(product.reviews ?? "0"),
    status: String(product.status || "Active"),
  };
}

function mapCartResponse(response) {
  const rows = Array.isArray(response?.items) ? response.items : [];
  return rows
    .filter((row) => row?.product && Number(row.quantity) > 0)
    .map((row) => ({ ...normaliseProduct(row.product), quantity: Number(row.quantity) || 1 }));
}

export async function getStorefrontCart() {
  const visitorId = getStorefrontVisitorId();
  const response = await authJsonRequest(`/api/storefront/cart/?visitor_id=${encodeURIComponent(visitorId)}`);
  return mapCartResponse(response);
}

export async function saveStorefrontCart(items = []) {
  const visitorId = getStorefrontVisitorId();
  const safeItems = (Array.isArray(items) ? items : []).map((item) => ({
    product_id: Number(item.id),
    quantity: Math.min(100, Math.max(1, Number.parseInt(item.quantity, 10) || 1)),
  })).filter((item) => Number.isInteger(item.product_id) && item.product_id > 0).slice(0, 50);
  const response = await authJsonRequest("/api/storefront/cart/", {
    method: "PUT",
    body: { visitor_id: visitorId, items: safeItems },
  });
  return mapCartResponse(response);
}

export async function getStorefrontWishlist() {
  const visitorId = getStorefrontVisitorId();
  const response = await authJsonRequest(`/api/storefront/wishlist/?visitor_id=${encodeURIComponent(visitorId)}`);
  return Array.isArray(response?.productIds) ? response.productIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0) : [];
}

export async function saveStorefrontWishlist(productIds = []) {
  const visitorId = getStorefrontVisitorId();
  const ids = [...new Set((Array.isArray(productIds) ? productIds : []).map(Number).filter((id) => Number.isInteger(id) && id > 0))].slice(0, 100);
  const response = await authJsonRequest("/api/storefront/wishlist/", {
    method: "PUT",
    body: { visitor_id: visitorId, product_ids: ids },
  });
  return Array.isArray(response?.productIds) ? response.productIds.map(Number).filter((id) => Number.isInteger(id) && id > 0) : ids;
}

export async function getStorefrontProductReviews(productId) {
  const response = await authJsonRequest(`/api/storefront/products/${encodeURIComponent(productId)}/reviews/`);
  return {
    items: Array.isArray(response?.items) ? response.items : [],
    summary: {
      rating: Number(response?.summary?.rating) || 0,
      count: Math.max(0, Number(response?.summary?.count) || 0),
    },
  };
}

export async function submitStorefrontProductReview(productId, input) {
  return authJsonRequest(`/api/storefront/products/${encodeURIComponent(productId)}/reviews/`, {
    method: "POST",
    body: {
      visitor_id: getStorefrontVisitorId(),
      reviewer_name: String(input?.reviewerName || "").trim(),
      rating: Math.min(5, Math.max(1, Number(input?.rating) || 5)),
      title: String(input?.title || "").trim(),
      comment: String(input?.comment || "").trim(),
    },
  });
}

export async function getCrmProductReviews(authenticatedRequest, { status = "PENDING", search = "" } = {}) {
  if (typeof authenticatedRequest !== "function") throw new Error("Sign in with a Django staff account to moderate product reviews.");
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (search.trim()) params.set("search", search.trim());
  const result = await authenticatedRequest(`/api/crm/product-reviews/?${params.toString()}`, { method: "GET" });
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.results)) return result.results;
  return [];
}

export async function setCrmProductReviewStatus(authenticatedRequest, reviewId, status) {
  if (typeof authenticatedRequest !== "function") throw new Error("Sign in with a Django staff account to moderate product reviews.");
  return authenticatedRequest(`/api/crm/product-reviews/${encodeURIComponent(reviewId)}/status/`, {
    method: "PATCH",
    body: { status },
  });
}
