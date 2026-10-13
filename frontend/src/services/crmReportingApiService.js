// Read-only reporting adapters for the actual Django endpoints in the supplied backend.
// Routes are mounted under /api/crm/ and use AuthContext.authenticatedRequest for JWT refresh.

const ANALYTICS_PATH = "/api/crm/analytics/";
const CAMPAIGN_RESPONSES_PATH = "/api/crm/campaign-responses/";
const AUDIT_LOGS_PATH = "/api/crm/audit-logs/";

function requireRequest(authenticatedRequest, label) {
  if (typeof authenticatedRequest !== "function") {
    throw new Error(`${label} requires an authenticated Django session. Please sign in again.`);
  }
  return authenticatedRequest;
}

function asCollection(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function queryPath(path, params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "All") query.set(key, String(value));
  });
  const encoded = query.toString();
  return encoded ? `${path}?${encoded}` : path;
}

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function getApiAnalytics({ from = "", to = "" } = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest, "Analytics");
  const payload = await request(queryPath(ANALYTICS_PATH, {
    start_date: from,
    end_date: to,
  }), { method: "GET" });

  // The current Django serializer returns aggregate metrics only (no time-series arrays).
  // Keep the backend field names/scopes explicit instead of inventing trend values.
  return {
    totalCustomers: num(payload?.total_customers),
    activeCustomers: num(payload?.active_customers),
    newCustomers: num(payload?.new_customers),
    repeatCustomers: num(payload?.repeat_customers),
    loyalCustomers: num(payload?.loyal_customers),
    totalOrders: num(payload?.total_orders),
    deliveredOrders: num(payload?.delivered_orders),
    cancelledOrders: num(payload?.cancelled_orders),
    totalRevenue: num(payload?.total_revenue),
    averageOrderValue: num(payload?.average_order_value),
    totalCampaigns: num(payload?.total_campaigns),
    completedCampaigns: num(payload?.completed_campaigns),
    totalCampaignResponses: num(payload?.total_campaign_responses),
    convertedResponses: num(payload?.converted_responses),
    campaignResponseRate: num(payload?.campaign_response_rate),
    startDate: from,
    endDate: to,
    source: "django-api",
  };
}

const responseStatusLabel = (value) => String(value || "UNKNOWN").toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export function mapApiCampaignResponse(raw = {}) {
  return {
    id: String(raw.id ?? ""),
    apiId: raw.id,
    campaignId: raw.campaign,
    campaignName: raw.campaign_name || `Campaign ${raw.campaign ?? ""}`.trim(),
    customerId: raw.customer,
    customerName: raw.customer_name || `Customer ${raw.customer ?? ""}`.trim(),
    statusCode: String(raw.status || "UNKNOWN").toUpperCase(),
    status: responseStatusLabel(raw.status),
    responseDate: raw.response_date || raw.created_at || "",
    metadata: raw.metadata && typeof raw.metadata === "object" ? raw.metadata : {},
    source: "django-api",
  };
}

export async function getApiCampaignResponses({ search = "", status = "All", campaignId = "All" } = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest, "Campaign responses");
  const payload = await request(CAMPAIGN_RESPONSES_PATH, { method: "GET" });
  const query = String(search || "").trim().toLowerCase();
  return asCollection(payload).map(mapApiCampaignResponse).filter((item) => {
    const matchesSearch = !query || [item.campaignName, item.customerName, item.id, item.status, JSON.stringify(item.metadata)]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = status === "All" || item.statusCode === String(status).toUpperCase();
    const matchesCampaign = campaignId === "All" || String(item.campaignId) === String(campaignId);
    return matchesSearch && matchesStatus && matchesCampaign;
  });
}

function mapApiAuditLog(raw = {}) {
  return {
    id: String(raw.id ?? ""),
    userId: raw.user ?? null,
    userEmail: raw.user_email || "System / deleted user",
    action: String(raw.action || "UNKNOWN").toUpperCase(),
    entityType: raw.entity_type || "—",
    entityId: raw.entity_id || "—",
    description: raw.description || "—",
    ipAddress: raw.ip_address || "—",
    createdAt: raw.created_at || "",
    source: "django-api",
  };
}

export async function getApiAuditLogs({ action = "All", entityType = "", startDate = "", endDate = "", search = "" } = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest, "Audit logs");
  const path = queryPath(AUDIT_LOGS_PATH, {
    action,
    entity_type: entityType,
    start_date: startDate,
    end_date: endDate,
  });
  const payload = await request(path, { method: "GET" });
  const query = String(search || "").trim().toLowerCase();
  return asCollection(payload).map(mapApiAuditLog).filter((item) => !query || [
    item.userEmail, item.action, item.entityType, item.entityId, item.description, item.ipAddress,
  ].some((value) => String(value || "").toLowerCase().includes(query)));
}
