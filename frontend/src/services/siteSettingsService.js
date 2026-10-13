import { useEffect, useState } from "react";
import seedProducts from "../data/products";
import { authJsonRequest } from "./authApi";

const SETTINGS_KEY = "techgear_site_settings_v1";
const CATEGORY_KEY = "techgear_categories_v1";
const SETTINGS_EVENT = "techgear:site-settings-updated";
const CATEGORIES_EVENT = "techgear:categories-updated";
const categoriesApiMode = String(import.meta.env.VITE_CRM_CATEGORIES_MODE || "mock").trim().toLowerCase() === "api";
export const siteSettingsApiMode = String(import.meta.env.VITE_CRM_STOREFRONT_SETTINGS_MODE || "mock").trim().toLowerCase() === "api";
let apiSettingsCache = null;
let publicSettingsRequest = null;

export const DEFAULT_FOOTER_LINKS = [
  { label: "About Us", path: "/about" },
  { label: "Contact Us", path: "/contact" },
  { label: "FAQs", path: "/faq" },
  { label: "Shipping Information", path: "/shipping" },
  { label: "Returns & Refunds", path: "/returns" },
  { label: "Privacy Policy", path: "/privacy" },
  { label: "Terms & Conditions", path: "/terms" },
];

export const DEFAULT_CATEGORIES = [
  { name: "Laptops", iconKey: "laptop" },
  { name: "Desktops", iconKey: "monitor" },
  { name: "Graphics Cards", iconKey: "gamepad" },
  { name: "CPUs", iconKey: "cpu" },
  { name: "Motherboards", iconKey: "circuit" },
  { name: "RAM", iconKey: "memory" },
  { name: "SSDs", iconKey: "drive" },
  { name: "HDDs", iconKey: "drive" },
  { name: "Monitors", iconKey: "monitor" },
  { name: "Cooling", iconKey: "fan" },
  { name: "PSUs", iconKey: "zap" },
  { name: "Cabinets", iconKey: "package" },
  { name: "Keyboards", iconKey: "keyboard" },
  { name: "Mouse", iconKey: "mouse" },
  { name: "Networking", iconKey: "wifi" },
  { name: "Printers", iconKey: "printer" },
];

const DEFAULT_SETTINGS = {
  brand: {
    name: "TechGear",
    tagline: "YOUR HARDWARE STORE",
    logoMark: "TG",
    logoImage: "",
  },
  topBar: {
    message: "🇮🇳 India's Trusted Computer Hardware Store",
    helpLabel: "Help Center",
    trackLabel: "Track Order",
  },
  contact: {
    email: "support@example.com",
    phone: "",
    address: "",
    hours: "Monday–Saturday, 10:00 AM–6:00 PM",
  },
  footer: {
    description: "Hardware and technology products for work, study, gaming and creativity.",
    links: DEFAULT_FOOTER_LINKS,
  },
  homepage: {
    sections: {
      hero: { enabled: true },
      promos: { enabled: true },
      bestSelling: { enabled: true, title: "Best Selling Products", subtitle: "Popular picks from our catalogue." },
      deals: { enabled: true, title: "Deals of the Day", subtitle: "Explore current price drops and product offers." },
      buildPc: {
        enabled: true,
        eyebrow: "PC BUILDER",
        titleFirst: "Build Your",
        titleHighlight: "Dream PC",
        description: "Choose the right components for gaming, work, editing and everything in between.",
        buttonText: "Explore Components",
        buttonUrl: "/products?category=CPUs",
      },
      purposes: { enabled: true, title: "Shop by Purpose", subtitle: "Find hardware built for what you do." },
      brands: { enabled: true, title: "Featured Brands", subtitle: "Shop brands available in our catalogue." },
      benefits: { enabled: true, title: "Why Choose Us?", subtitle: "A reliable experience at every step." },
    },
    purposes: [
      { id: "purpose-gaming", title: "Gaming", description: "High-performance PCs, GPUs and monitors", category: "Graphics Cards", icon: "gamepad" },
      { id: "purpose-business", title: "Office & Business", description: "Reliable systems for everyday productivity", category: "Laptops", icon: "briefcase" },
      { id: "purpose-creator", title: "Content Creation", description: "Powerful hardware for editing and design", category: "Monitors", icon: "video" },
      { id: "purpose-student", title: "Students", description: "Affordable laptops and accessories", category: "Laptops", icon: "education" },
      { id: "purpose-home", title: "Home & Entertainment", description: "Devices for work, media and everyday use", category: "Monitors", icon: "tv" },
    ],
    benefits: [
      { id: "benefit-authentic", title: "Genuine Products", description: "Authentic hardware from trusted brands.", icon: "shield" },
      { id: "benefit-delivery", title: "Reliable Delivery", description: "Clear delivery information for every order.", icon: "truck" },
      { id: "benefit-payment", title: "Payment Options", description: "Choose from supported checkout payment methods.", icon: "credit-card" },
      { id: "benefit-returns", title: "Return Support", description: "Find help for eligible product returns.", icon: "return" },
      { id: "benefit-support", title: "Customer Support", description: "Get help with product selection and orders.", icon: "support" },
    ],
    heroBenefits: ["Top Brands", "Best Prices", "Genuine Products", "Fast Delivery", "Expert Support"],
  },
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function mergeDeep(base, override) {
  if (!isObject(base) || !isObject(override)) return override === undefined ? base : override;
  const merged = { ...base };
  Object.keys(override).forEach((key) => {
    merged[key] = key in base ? mergeDeep(base[key], override[key]) : override[key];
  });
  return merged;
}

function safeRead(key) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function emit(name) {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(name));
}

export function getSiteSettings() {
  if (siteSettingsApiMode && apiSettingsCache) return mergeDeep(DEFAULT_SETTINGS, apiSettingsCache);
  return mergeDeep(DEFAULT_SETTINGS, safeRead(SETTINGS_KEY) || {});
}

async function fetchPublicApiSettings() {
  if (publicSettingsRequest) return publicSettingsRequest;
  publicSettingsRequest = authJsonRequest("/api/storefront/settings/")
    .then((payload) => {
      const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
      apiSettingsCache = mergeDeep(DEFAULT_SETTINGS, data);
      emit(SETTINGS_EVENT);
      return apiSettingsCache;
    })
    .finally(() => { publicSettingsRequest = null; });
  return publicSettingsRequest;
}

export async function loadSiteSettings(authenticatedRequest) {
  if (!siteSettingsApiMode) return getSiteSettings();
  if (typeof authenticatedRequest !== "function") throw new Error("Storefront settings API requires an authenticated Django staff session.");
  const payload = await authenticatedRequest("/api/crm/storefront-settings/");
  const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  apiSettingsCache = mergeDeep(DEFAULT_SETTINGS, data);
  emit(SETTINGS_EVENT);
  return apiSettingsCache;
}

export async function saveSiteSettings(settings, authenticatedRequest) {
  const merged = mergeDeep(DEFAULT_SETTINGS, settings || {});
  if (siteSettingsApiMode) {
    if (typeof authenticatedRequest !== "function") throw new Error("Storefront settings API requires an authenticated Django staff session.");
    const payload = await authenticatedRequest("/api/crm/storefront-settings/", { method: "PUT", body: merged });
    const data = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : merged;
    apiSettingsCache = mergeDeep(DEFAULT_SETTINGS, data);
    emit(SETTINGS_EVENT);
    return apiSettingsCache;
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    } catch {
      throw new Error("Could not save store settings. The logo may be too large for browser demo storage.");
    }
  }
  emit(SETTINGS_EVENT);
  return merged;
}

export function useSiteSettings() {
  const [settings, setSettings] = useState(() => getSiteSettings());
  useEffect(() => {
    let active = true;
    const refresh = () => setSettings(getSiteSettings());
    window.addEventListener(SETTINGS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    if (siteSettingsApiMode) {
      fetchPublicApiSettings().then((value) => { if (active) setSettings(value); }).catch((error) => {
        console.warn("Could not load public storefront settings:", error?.message || error);
      });
    }
    return () => {
      active = false;
      window.removeEventListener(SETTINGS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return settings;
}

function slugify(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function seedCategoryRecords() {
  const names = new Set(DEFAULT_CATEGORIES.map((item) => item.name.toLowerCase()));
  const records = DEFAULT_CATEGORIES.map((item) => ({ ...item, id: slugify(item.name), active: true }));
  seedProducts.forEach((product) => {
    const name = String(product.category || "").trim();
    if (name && !names.has(name.toLowerCase())) {
      names.add(name.toLowerCase());
      records.push({ id: slugify(name), name, iconKey: "package", active: true });
    }
  });
  return records;
}

function readStoredCategories() {
  const saved = safeRead(CATEGORY_KEY);
  if (!Array.isArray(saved)) return seedCategoryRecords();
  const categories = saved.map((item) => ({
    id: String(item.id || slugify(item.name)),
    name: String(item.name || "").trim(),
    iconKey: String(item.iconKey || "package"),
    active: item.active !== false,
    createdAt: item.createdAt || new Date().toISOString(),
  })).filter((item) => item.name);
  const seen = new Set(categories.map((item) => item.name.toLowerCase()));
  seedCategoryRecords().forEach((item) => {
    if (!seen.has(item.name.toLowerCase())) categories.push(item);
  });
  return categories;
}

function writeCategories(categories) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(CATEGORY_KEY, JSON.stringify(categories));
    } catch {
      throw new Error("Could not save categories in browser storage.");
    }
  }
  emit(CATEGORIES_EVENT);
}

export function getCategories({ includeInactive = false } = {}) {
  const categories = readStoredCategories();
  return categories.filter((item) => includeInactive || item.active).sort((a, b) => a.name.localeCompare(b.name));
}

function mapApiCategory(item) {
  return {
    id: item?.id ?? slugify(item?.name),
    name: String(item?.name || "").trim(),
    iconKey: String(item?.iconKey || item?.icon_key || "package"),
    active: item?.active !== undefined ? Boolean(item.active) : item?.is_active !== false,
    createdAt: item?.createdAt || item?.created_at || new Date().toISOString(),
  };
}

function unwrapCategoryList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function emitCategoriesChanged() { emit(CATEGORIES_EVENT); }

export async function createCategory(input, authenticatedRequest) {
  const name = String(input?.name || "").trim().replace(/\s+/g, " ");
  if (!name) throw new Error("Category name is required.");
  if (name.length > 60) throw new Error("Category name must be 60 characters or fewer.");
  if (categoriesApiMode) {
    if (typeof authenticatedRequest !== "function") throw new Error("Category API mode requires an authenticated Django staff session.");
    const created = await authenticatedRequest("/api/crm/categories/", { method: "POST", body: { name, iconKey: String(input.iconKey || "package"), active: true } });
    emitCategoriesChanged();
    return mapApiCategory(created);
  }
  const categories = readStoredCategories();
  if (categories.some((item) => item.name.toLowerCase() === name.toLowerCase())) throw new Error("A category with this name already exists.");
  const next = { id: `${slugify(name)}-${Date.now().toString(36)}`, name, iconKey: String(input.iconKey || "package"), active: true, createdAt: new Date().toISOString() };
  categories.push(next);
  writeCategories(categories);
  return next;
}

export async function setCategoryStatus(id, active, authenticatedRequest) {
  if (categoriesApiMode) {
    if (typeof authenticatedRequest !== "function") throw new Error("Category API mode requires an authenticated Django staff session.");
    const saved = await authenticatedRequest(`/api/crm/categories/${encodeURIComponent(id)}/status/`, { method: "PATCH", body: { active: Boolean(active) } });
    emitCategoriesChanged();
    return mapApiCategory(saved);
  }
  const categories = readStoredCategories();
  const category = categories.find((item) => String(item.id) === String(id));
  if (!category) throw new Error("Category not found.");
  category.active = Boolean(active);
  writeCategories(categories);
  return category;
}

export function useCategories({ includeInactive = false, authenticatedRequest } = {}) {
  const [categories, setCategories] = useState(() => categoriesApiMode ? [] : getCategories({ includeInactive }));
  useEffect(() => {
    let active = true;
    const refresh = () => setCategories(getCategories({ includeInactive }));
    const load = async () => {
      if (!categoriesApiMode) { refresh(); return; }
      try {
        const request = includeInactive && typeof authenticatedRequest === "function"
          ? authenticatedRequest
          : (path, options) => authJsonRequest(path, options);
        const path = includeInactive && typeof authenticatedRequest === "function"
          ? "/api/crm/categories/?includeInactive=true"
          : "/api/storefront/categories/";
        const payload = await request(path, { method: "GET" });
        if (active) setCategories(unwrapCategoryList(payload).map(mapApiCategory).filter((item) => includeInactive || item.active));
      } catch {
        // Keep current in-memory seed data visible and let mutating actions show detailed errors.
      }
    };
    load();
    window.addEventListener(CATEGORIES_EVENT, load);
    window.addEventListener("storage", refresh);
    return () => {
      active = false;
      window.removeEventListener(CATEGORIES_EVENT, load);
      window.removeEventListener("storage", refresh);
    };
  }, [includeInactive, authenticatedRequest]);
  return categories;
}

export const siteSettingsStorageKey = SETTINGS_KEY;
export const categoriesStorageKey = CATEGORY_KEY;
