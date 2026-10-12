import { useEffect, useState } from "react";
import { crmHomepagePromotionsMode } from "./crmService";
import {
  getApiHomepagePromotionSettings,
  getPublicHomepagePromotionSettings,
  saveApiHomepagePromotionSettings,
  mapHomepagePromotionSettings,
} from "./crmLeadBannerApiService";

const STORAGE_KEY = "techgear_homepage_promotions_v1";
const CHANGE_EVENT = "techgear:homepage-promotions-updated";
export const homepagePromotionsApiMode = crmHomepagePromotionsMode === "api";
const DEFAULTS = {
  enabled: true,
  selectionMode: "AUTO",
  featuredProductIds: [],
  sectionTitle: "Featured products",
  subtitle: "Picked by our marketing team for your setup.",
  updatedAt: null,
  updatedBy: null,
};

function emitChange() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CHANGE_EVENT));
}

function safeRead() {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return saved && typeof saved === "object" ? { ...DEFAULTS, ...saved } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function normalise(input = {}) {
  return {
    ...DEFAULTS,
    ...input,
    enabled: input.enabled !== false,
    selectionMode: input.selectionMode === "MANUAL" ? "MANUAL" : "AUTO",
    featuredProductIds: Array.isArray(input.featuredProductIds) ? input.featuredProductIds.map(String).slice(0, 2) : [],
    sectionTitle: String(input.sectionTitle || DEFAULTS.sectionTitle).trim(),
    subtitle: String(input.subtitle || "").trim(),
  };
}

export function getHomepagePromotionSettings() {
  return normalise(safeRead());
}

export async function loadHomepagePromotionSettings(authenticatedRequest) {
  if (homepagePromotionsApiMode) return mapHomepagePromotionSettings(await getApiHomepagePromotionSettings(authenticatedRequest));
  return getHomepagePromotionSettings();
}

export async function loadPublicHomepagePromotionSettings() {
  if (homepagePromotionsApiMode) return mapHomepagePromotionSettings(await getPublicHomepagePromotionSettings());
  return getHomepagePromotionSettings();
}

export async function saveHomepagePromotionSettings(input, actor = null, authenticatedRequest) {
  const current = homepagePromotionsApiMode ? DEFAULTS : getHomepagePromotionSettings();
  const selectionMode = input.selectionMode === "MANUAL" ? "MANUAL" : "AUTO";
  const ids = [...new Set((Array.isArray(input.featuredProductIds) ? input.featuredProductIds : []).map(String))];
  if (ids.length > 2) throw new Error("Select up to two featured products for the homepage hero.");
  const enabled = input.enabled === undefined ? current.enabled : Boolean(input.enabled);
  if (enabled && selectionMode === "MANUAL" && ids.length === 0) throw new Error("Choose at least one featured product, or switch to automatic selection.");
  const sectionTitle = String(input.sectionTitle ?? current.sectionTitle).trim();
  const subtitle = String(input.subtitle ?? current.subtitle).trim();
  if (!sectionTitle) throw new Error("Promotion section title is required.");

  const next = {
    ...current,
    ...input,
    enabled,
    selectionMode,
    featuredProductIds: ids,
    sectionTitle: sectionTitle.slice(0, 100),
    subtitle: subtitle.slice(0, 180),
    updatedAt: new Date().toISOString(),
    updatedBy: actor?.name || actor?.email || "Marketing team",
  };

  if (homepagePromotionsApiMode) {
    const saved = await saveApiHomepagePromotionSettings(next, authenticatedRequest);
    emitChange();
    return saved;
  }

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw new Error("Could not save homepage promotion settings in browser storage.");
    }
    emitChange();
  }
  return next;
}

export function useHomepagePromotionSettings() {
  const [settings, setSettings] = useState(() => getHomepagePromotionSettings());
  useEffect(() => {
    let active = true;
    const refresh = () => {
      loadPublicHomepagePromotionSettings()
        .then((next) => { if (active) setSettings(next); })
        .catch(() => { if (active && !homepagePromotionsApiMode) setSettings(getHomepagePromotionSettings()); });
    };
    refresh();
    window.addEventListener(CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      active = false;
      window.removeEventListener(CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);
  return settings;
}

export { STORAGE_KEY as homepagePromotionsStorageKey, CHANGE_EVENT as homepagePromotionsChangedEvent };
