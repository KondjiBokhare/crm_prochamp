import { useEffect, useState } from "react";
import seedProducts from "../data/products";
import { authJsonRequest } from "./authApi";
import { getCategories } from "./siteSettingsService";

// Product catalogue with separate backend mode. Public storefront reads are active-only;
// CRM writes require the JWT-aware request supplied by AuthContext.
const STORAGE_KEY = "techgear_product_catalog_v1";
const CHANGE_EVENT = "techgear:product-catalog-updated";
const mode = String(import.meta.env.VITE_CRM_PRODUCTS_MODE || "mock").trim().toLowerCase();
const useApi = mode === "api";
const clone = (value) => JSON.parse(JSON.stringify(value));

function normaliseSeed(product, index = 0) {
  const price = Number(product.price) || 0;
  const mrp = product.mrp == null || product.mrp === "" ? null : Number(product.mrp);
  const id = Number(product.id) || index + 1;
  const dateOnly = (value, fallback = "2026-01-01") => {
    const text = String(value || fallback);
    return text.length >= 10 ? text.slice(0, 10) : text;
  };
  return {
    ...product,
    id,
    sku: String(product.sku || `TG-${String(id).padStart(5, "0")}`),
    name: String(product.name || "Unnamed product"),
    brand: String(product.brand || "TechGear"),
    category: String(product.category || "Other"),
    subcategory: String(product.subcategory || product.category || "Other"),
    price,
    mrp,
    discount: mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : Number(product.discount) || 0,
    stock: Math.max(0, Number.parseInt(product.stock, 10) || 0),
    image: String(product.image || product.images?.[0] || ""),
    images: Array.isArray(product.images) && product.images.length ? product.images : product.image ? [product.image] : [],
    specs: String(product.specs || product.shortDescription || ""),
    shortDescription: String(product.shortDescription || product.specs || ""),
    highlights: Array.isArray(product.highlights) ? product.highlights : [],
    specifications: Array.isArray(product.specifications) ? product.specifications : [],
    tags: Array.isArray(product.tags) ? product.tags : [],
    rating: Number(product.rating) || 0,
    reviews: String(product.reviews ?? "0"),
    status: ["Active", "Draft", "Inactive"].includes(product.status) ? product.status : "Active",
    createdAt: dateOnly(product.createdAt),
    updatedAt: dateOnly(product.updatedAt, product.createdAt || "2026-01-01"),
  };
}

function getSeedCatalog() {
  return seedProducts.map((product, index) => normaliseSeed(product, index));
}

function getMockStorefrontCatalog() {
  const activeCategoryNames = new Set(getCategories().map((item) => String(item.name).toLowerCase()));
  return readStoredCatalog().filter((product) => product.status === "Active" && activeCategoryNames.has(String(product.category || "").toLowerCase())).map((product) => clone(product));
}

function readStoredCatalog() {
  if (typeof window === "undefined") return getSeedCatalog();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getSeedCatalog();
    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return getSeedCatalog();
    return saved.map((product, index) => normaliseSeed(product, index));
  } catch {
    return getSeedCatalog();
  }
}

function emitChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function writeCatalog(products) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(products));
    } catch {
      throw new Error("The browser could not save the product catalogue. Check available local storage.");
    }
  }
  emitChange();
}

function nextProductId(products) {
  return Math.max(0, ...products.map((product) => Number(product.id) || 0)) + 1;
}

function safeImageUrl(value) {
  const url = String(value || "").trim();
  if (!url) return "";
  // Demo-uploaded images are compressed raster data URLs. SVG is intentionally
  // not allowed as a data URL to avoid embedding active markup.
  if (/^data:image\/(webp|jpeg|png);base64,[a-z0-9+/=]+$/i.test(url)) return url;
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/\\")) return url;
  try {
    const parsed = new URL(url);
    if (["http:", "https:"].includes(parsed.protocol)) return parsed.href;
  } catch {
    // Convert invalid links to a consistent field validation error below.
  }
  throw new Error("Image must be a valid uploaded JPG/PNG/WebP image, relative site path, or http/https URL.");
}

function normaliseInput(input, existing, products) {
  const name = String(input.name ?? existing?.name ?? "").trim();
  const sku = String(input.sku ?? existing?.sku ?? "").trim().toUpperCase();
  const brand = String(input.brand ?? existing?.brand ?? "").trim();
  const category = String(input.category ?? existing?.category ?? "").trim();
  const price = Number(input.price ?? existing?.price);
  const rawMrp = input.mrp ?? existing?.mrp;
  const mrp = rawMrp === "" || rawMrp == null ? null : Number(rawMrp);
  const stock = Number(input.stock ?? existing?.stock ?? 0);
  const status = String(input.status ?? existing?.status ?? "Draft");

  if (!name) throw new Error("Product name is required.");
  if (!sku) throw new Error("SKU is required.");
  if (!brand) throw new Error("Brand is required.");
  if (!category) throw new Error("Choose a product category.");
  const categoryRecord = getCategories({ includeInactive: true }).find((item) => item.name.toLowerCase() === category.toLowerCase());
  if (!categoryRecord) throw new Error("Choose a category that exists in CRM → Categories.");
  if (!categoryRecord.active && status === "Active" && String(existing?.category || "").toLowerCase() !== category.toLowerCase()) {
    throw new Error("This category is inactive. Activate it in Category Management before publishing new products.");
  }
  if (!Number.isFinite(price) || price <= 0) throw new Error("Price must be greater than zero.");
  if (mrp !== null && (!Number.isFinite(mrp) || mrp < price)) throw new Error("MRP must be greater than or equal to the selling price.");
  if (!Number.isInteger(stock) || stock < 0) throw new Error("Stock must be a whole number zero or greater.");
  if (!["Active", "Draft", "Inactive"].includes(status)) throw new Error("Choose a valid product status.");
  if (products.some((product) => product.sku.toLowerCase() === sku.toLowerCase() && String(product.id) !== String(existing?.id))) {
    throw new Error("A product with this SKU already exists.");
  }

  const id = existing?.id ?? nextProductId(products);
  const hasImagesArray = Array.isArray(input.images);
  const rawImages = hasImagesArray
    ? input.images
    : (input.image != null ? [input.image] : (existing?.images || (existing?.image ? [existing.image] : [])));
  if (rawImages.length > 5) throw new Error("A product can have up to 5 images in this demo.");
  const images = rawImages.map(safeImageUrl).filter(Boolean);
  const image = images[0] || (hasImagesArray ? "" : safeImageUrl(input.image ?? existing?.image ?? ""));
  const discount = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const parseLines = (value, fallback = []) => {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value ?? "").split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
  };
  const shortDescription = String(input.shortDescription ?? existing?.shortDescription ?? "").trim();
  const specs = String(input.specs ?? existing?.specs ?? shortDescription).trim();
  const today = new Date().toISOString().slice(0, 10);
  const highlights = parseLines(input.highlights ?? existing?.highlights ?? []);
  const tags = parseLines(input.tags ?? existing?.tags ?? []);
  const specifications = Array.isArray(existing?.specifications) ? existing.specifications : [];

  return normaliseSeed({
    ...existing,
    id,
    sku,
    name,
    brand,
    category,
    subcategory: String(input.subcategory ?? existing?.subcategory ?? category).trim() || category,
    price,
    mrp,
    discount,
    stock,
    status,
    image,
    images,
    specs,
    shortDescription,
    highlights,
    tags,
    specifications,
    rating: existing?.rating ?? 0,
    reviews: existing?.reviews ?? "0",
    badge: String(input.badge ?? existing?.badge ?? "").trim() || null,
    createdAt: existing?.createdAt || today,
    updatedAt: today,
  });
}

function unwrapList(response) {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.results)) return response.results;
  return [];
}

function requireAuthenticatedRequest(authenticatedRequest) {
  if (typeof authenticatedRequest !== "function") {
    throw new Error("Product API mode requires an authenticated Django staff session.");
  }
  return authenticatedRequest;
}

function toApiProductPayload(input = {}) {
  const splitLines = (value) => {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value ?? "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
  };
  const rawMrp = input.mrp;
  return {
    name: String(input.name || "").trim(),
    sku: String(input.sku || "").trim().toUpperCase(),
    brand: String(input.brand || "").trim(),
    category_name: String(input.category || "").trim(),
    subcategory: String(input.subcategory || input.category || "").trim(),
    price: Number(input.price),
    mrp: rawMrp === "" || rawMrp === null || rawMrp === undefined ? null : Number(rawMrp),
    stock: Number(input.stock ?? 0),
    status: ["Active", "Draft", "Inactive"].includes(input.status) ? input.status : "Draft",
    images: Array.isArray(input.images) ? input.images : (input.image ? [input.image] : []),
    shortDescription: String(input.shortDescription || ""),
    specs: String(input.specs || ""),
    highlights: splitLines(input.highlights),
    tags: splitLines(input.tags),
    specifications: Array.isArray(input.specifications) ? input.specifications : [],
    badge: String(input.badge || ""),
  };
}

async function getPublicProductList(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "All") params.set(key, String(value));
  });
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const raw = await authJsonRequest(`/api/storefront/products/${suffix}`, { method: "GET" });
  return unwrapList(raw).map((product, index) => normaliseSeed(product, index)).filter((product) => product.status === "Active");
}

export async function getProductCatalog({ includeInactive = false, search = "", category = "All", status = "All" } = {}, authenticatedRequest) {
  if (useApi) {
    const request = requireAuthenticatedRequest(authenticatedRequest);
    const params = new URLSearchParams();
    if (includeInactive) params.set("includeInactive", "true");
    if (search) params.set("search", search);
    if (category !== "All") params.set("category", category);
    if (status !== "All") params.set("status", status);
    const suffix = params.toString() ? `?${params.toString()}` : "";
    const result = await request(`/api/crm/products/${suffix}`, { method: "GET" });
    return unwrapList(result).map((product, index) => normaliseSeed(product, index));
  }
  const query = String(search || "").trim().toLowerCase();
  const activeCategoryNames = new Set(getCategories().map((item) => item.name.toLowerCase()));
  return readStoredCatalog().filter((product) => {
    const categoryIsActive = activeCategoryNames.has(String(product.category || "").toLowerCase());
    const isVisible = includeInactive || (product.status === "Active" && categoryIsActive);
    const matchesQuery = !query || [product.name, product.sku, product.brand, product.category].some((value) => String(value || "").toLowerCase().includes(query));
    return isVisible && matchesQuery && (category === "All" || product.category === category) && (status === "All" || product.status === status);
  }).sort((a, b) => String(a.name).localeCompare(String(b.name))).map((product) => clone(product));
}

export async function getProductCatalogById(id, { includeInactive = false, authenticatedRequest } = {}) {
  if (useApi) {
    if (typeof authenticatedRequest === "function") {
      try {
        const result = await authenticatedRequest(`/api/crm/products/${encodeURIComponent(id)}/`, { method: "GET" });
        return result ? normaliseSeed(result) : null;
      } catch (error) {
        if (error.status === 404) return null;
        throw error;
      }
    }
    const products = await getPublicProductList();
    return products.find((item) => String(item.id) === String(id)) || null;
  }
  const product = readStoredCatalog().find((item) => String(item.id) === String(id));
  if (!product) return null;
  if (!includeInactive) {
    const activeCategoryNames = new Set(getCategories().map((item) => item.name.toLowerCase()));
    if (product.status !== "Active" || !activeCategoryNames.has(String(product.category || "").toLowerCase())) return null;
  }
  return clone(product);
}

export async function createCatalogProduct(input, authenticatedRequest) {
  if (useApi) {
    const saved = normaliseSeed(await requireAuthenticatedRequest(authenticatedRequest)("/api/crm/products/", { method: "POST", body: toApiProductPayload(input) }));
    emitChange();
    return saved;
  }
  const products = readStoredCatalog();
  const product = normaliseInput(input, null, products);
  products.unshift(product);
  writeCatalog(products);
  return clone(product);
}

export async function updateCatalogProduct(id, input, authenticatedRequest) {
  if (useApi) {
    const raw = await requireAuthenticatedRequest(authenticatedRequest)(`/api/crm/products/${encodeURIComponent(id)}/`, { method: "PATCH", body: toApiProductPayload(input) });
    const saved = normaliseSeed(raw);
    emitChange();
    return saved;
  }
  const products = readStoredCatalog();
  const index = products.findIndex((product) => String(product.id) === String(id));
  if (index < 0) throw new Error("Product not found.");
  products[index] = normaliseInput(input, products[index], products);
  writeCatalog(products);
  return clone(products[index]);
}

export async function setCatalogProductStatus(id, status, authenticatedRequest) {
  if (useApi) {
    const raw = await requireAuthenticatedRequest(authenticatedRequest)(`/api/crm/products/${encodeURIComponent(id)}/status/`, { method: "PATCH", body: { status } });
    const saved = normaliseSeed(raw);
    emitChange();
    return saved;
  }
  if (!["Active", "Draft", "Inactive"].includes(status)) throw new Error("Choose a valid product status.");
  const products = readStoredCatalog();
  const product = products.find((item) => String(item.id) === String(id));
  if (!product) throw new Error("Product not found.");
  product.status = status;
  product.updatedAt = new Date().toISOString().slice(0, 10);
  writeCatalog(products);
  return clone(product);
}

export async function getStorefrontProductCatalog() {
  if (useApi) return getPublicProductList();
  return getMockStorefrontCatalog();
}

// Subscribe-aware hook makes products created/updated in CRM appear on storefront
// pages immediately without a reload in mock mode.
export function useProductCatalog({ includeInactive = false } = {}) {
  const [products, setProducts] = useState(() => useApi ? [] : includeInactive ? readStoredCatalog() : getMockStorefrontCatalog());

  useEffect(() => {
    let active = true;
    const refresh = () => {
      const fetchProducts = useApi
        ? (includeInactive ? getProductCatalog({ includeInactive: true }) : getStorefrontProductCatalog())
        : Promise.resolve(includeInactive ? readStoredCatalog().map((product) => clone(product)) : getMockStorefrontCatalog());
      fetchProducts.then((next) => { if (active) setProducts(next); }).catch(() => {});
    };
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("techgear:categories-updated", refresh);
    window.addEventListener("storage", refresh);
    refresh();
    return () => {
      active = false;
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("techgear:categories-updated", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [includeInactive]);

  return products;
}
