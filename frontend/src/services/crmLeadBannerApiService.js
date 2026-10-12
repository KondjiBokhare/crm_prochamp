import { authJsonRequest } from "./authApi";

function queryString(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "All") query.set(key, String(value));
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

function unwrapList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function mapLead(item = {}) {
  return {
    ...item,
    id: String(item.id ?? item.lead_code ?? ""),
    phone: item.phone || "",
    company: item.company || "Independent",
    city: item.city || "",
    assignedTo: item.assignedTo || item.assigned_to || "Unassigned",
    score: Number(item.score ?? 50),
    estimatedValue: Number(item.estimatedValue ?? item.estimated_value ?? 0),
    nextFollowUpAt: item.nextFollowUpAt || item.next_follow_up_at || "",
    notes: item.notes || "",
    followUps: Array.isArray(item.followUps) ? item.followUps : Array.isArray(item.follow_ups) ? item.follow_ups : [],
    statusHistory: Array.isArray(item.statusHistory) ? item.statusHistory : Array.isArray(item.status_history) ? item.status_history : [],
    convertedCustomerId: item.convertedCustomerId ?? item.converted_customer_id ?? null,
    convertedAt: item.convertedAt ?? item.converted_at ?? null,
    createdAt: String(item.createdAt || item.created_at || "").slice(0, 10),
    updatedAt: item.updatedAt || item.updated_at || "",
  };
}

function requireRequest(authenticatedRequest) {
  if (typeof authenticatedRequest !== "function") throw new Error("This API action requires an authenticated Django staff session. Sign in again and retry.");
  return authenticatedRequest;
}

export async function getApiLeads(filters = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = await request(`/api/crm/leads/${queryString({
    search: filters.search, status: filters.status, source: filters.source,
    assignedTo: filters.assignedTo, from: filters.from, to: filters.to,
  })}`);
  return unwrapList(payload).map(mapLead);
}

export async function createApiLead(input = {}, _actor, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const body = {
    ...input,
    score: Number(input.score ?? 50),
    estimatedValue: Number(input.estimatedValue ?? 0),
    nextFollowUpAt: input.nextFollowUpAt || null,
  };
  return mapLead(await request("/api/crm/leads/", { method: "POST", body }));
}

export async function updateApiLead(id, input = {}, _actor, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const body = {
    ...input,
    score: Number(input.score ?? 50),
    estimatedValue: Number(input.estimatedValue ?? 0),
    nextFollowUpAt: input.nextFollowUpAt || null,
  };
  return mapLead(await request(`/api/crm/leads/${encodeURIComponent(id)}/`, { method: "PATCH", body }));
}

export async function updateApiLeadStatus(id, status, _actor, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  return mapLead(await request(`/api/crm/leads/${encodeURIComponent(id)}/`, { method: "PATCH", body: { status } }));
}

export async function assignApiLead(id, assignedTo, _actor, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  return mapLead(await request(`/api/crm/leads/${encodeURIComponent(id)}/`, { method: "PATCH", body: { assignedTo } }));
}

export async function addApiLeadFollowUp(id, input = {}, _actor, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = await request(`/api/crm/leads/${encodeURIComponent(id)}/follow-ups/`, {
    method: "POST",
    body: { ...input, nextFollowUpAt: input.nextFollowUpAt || null },
  });
  return { ...payload, lead: payload?.lead ? mapLead(payload.lead) : payload?.lead };
}

export async function convertApiLead(id, _actor, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = await request(`/api/crm/leads/${encodeURIComponent(id)}/convert/`, { method: "POST", body: {} });
  return { ...payload, lead: payload?.lead ? mapLead(payload.lead) : payload?.lead };
}

function mapBanner(item = {}) {
  return {
    ...item,
    id: item.id,
    name: item.name || "",
    eyebrow: item.eyebrow || "",
    title: item.title || "",
    subtitle: item.subtitle || "",
    buttonText: item.buttonText || "Shop Now",
    targetUrl: item.targetUrl || "/products",
    imageUrl: item.imageUrl || "",
    placement: item.placement || "HERO",
    backgroundColor: item.backgroundColor || "#061a3c",
    textColor: item.textColor || "#ffffff",
    status: item.status || "Draft",
    startDate: item.startDate || "",
    endDate: item.endDate || "",
    impressions: Number(item.impressions || 0),
    clicks: Number(item.clicks || 0),
    createdAt: item.createdAt || "",
    updatedAt: item.updatedAt || "",
  };
}

export async function getApiBanners(filters = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const payload = await request(`/api/crm/banners/${queryString({ search: filters.search, placement: filters.placement, status: filters.status })}`);
  return unwrapList(payload).map(mapBanner);
}

export async function createApiBanner(input = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  return mapBanner(await request("/api/crm/banners/", { method: "POST", body: input }));
}

export async function updateApiBanner(id, input = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  return mapBanner(await request(`/api/crm/banners/${encodeURIComponent(id)}/`, { method: "PATCH", body: input }));
}

export async function setApiBannerStatus(id, status, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  return mapBanner(await request(`/api/crm/banners/${encodeURIComponent(id)}/status/`, { method: "PATCH", body: { status } }));
}

export async function getApiStorefrontBanners({ placement = "All" } = {}) {
  const payload = await authJsonRequest(`/api/storefront/banners/${queryString({ placement })}`);
  return unwrapList(payload).map(mapBanner);
}

export async function recordApiBannerMetric(id, metric) {
  if (!new Set(["impression", "click"]).has(metric)) return null;
  return authJsonRequest(`/api/storefront/banners/${encodeURIComponent(id)}/${metric}/`, { method: "POST", body: {} });
}

export function mapHomepagePromotionSettings(item = {}) {
  return {
    enabled: item.enabled !== false,
    selectionMode: item.selectionMode === "MANUAL" || item.selection_mode === "MANUAL" ? "MANUAL" : "AUTO",
    featuredProductIds: Array.isArray(item.featuredProductIds) ? item.featuredProductIds.map(String).slice(0, 2)
      : Array.isArray(item.featured_product_ids) ? item.featured_product_ids.map(String).slice(0, 2) : [],
    sectionTitle: item.sectionTitle || item.section_title || "Featured products",
    subtitle: item.subtitle || "Picked by our marketing team for your setup.",
    updatedAt: item.updatedAt || item.updated_at || null,
    updatedBy: item.updatedBy || item.updated_by || null,
  };
}

export async function getApiHomepagePromotionSettings(authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  return mapHomepagePromotionSettings(await request("/api/crm/homepage-promotions/"));
}

export async function saveApiHomepagePromotionSettings(input = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const body = {
    enabled: input.enabled !== false,
    selectionMode: input.selectionMode === "MANUAL" ? "MANUAL" : "AUTO",
    featuredProductIds: [...new Set((Array.isArray(input.featuredProductIds) ? input.featuredProductIds : []).map(String))].slice(0, 2),
    sectionTitle: String(input.sectionTitle || "Featured products").trim(),
    subtitle: String(input.subtitle || "").trim(),
  };
  if (body.enabled && body.selectionMode === "MANUAL" && body.featuredProductIds.length === 0) {
    throw new Error("Choose at least one featured product, or switch to automatic selection.");
  }
  return mapHomepagePromotionSettings(await request("/api/crm/homepage-promotions/", { method: "PUT", body }));
}

export async function getPublicHomepagePromotionSettings() {
  return mapHomepagePromotionSettings(await authJsonRequest("/api/storefront/homepage-promotions/"));
}
