// Real API adapters for Interactions, Customer Segments and Campaigns.
// These adapters intentionally match the Django routes/models in the supplied backend.

const INTERACTIONS_PATH = "/api/crm/interactions/";
const SEGMENTS_PATH = "/api/crm/segments/";
const CAMPAIGNS_PATH = "/api/crm/campaigns/";

function requireRequest(authenticatedRequest, label) {
  if (typeof authenticatedRequest !== "function") {
    throw new Error(`${label} API mode requires an active Django session. Please sign in again.`);
  }
  return authenticatedRequest;
}

function collection(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function dateOnly(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value).slice(0, 10) : date.toISOString().slice(0, 10);
}

// function dateTimeForInput(value) {
//   if (!value) return "";
//   const date = new Date(value);
//   if (Number.isNaN(date.getTime())) return "";
//   const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
//   return local.toISOString().slice(0, 16);
// }

const INTERACTION_TYPE_TO_LABEL = {
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  WHATSAPP: "WhatsApp",
  NOTE: "Note",
  FOLLOW_UP: "Follow-up",
};
const INTERACTION_LABEL_TO_TYPE = Object.fromEntries(
  Object.entries(INTERACTION_TYPE_TO_LABEL).map(([value, label]) => [label, value]),
);

export function mapApiInteraction(raw = {}) {
  const rawType = String(raw.interaction_type || "NOTE").toUpperCase();
  return {
    id: String(raw.id ?? ""),
    apiId: raw.id,
    customerId: raw.customer,
    customerName: raw.customer_name || `Customer ${raw.customer ?? ""}`.trim(),
    type: INTERACTION_TYPE_TO_LABEL[rawType] || rawType,
    subject: raw.subject || "(No subject)",
    description: raw.description || "",
    date: dateOnly(raw.interaction_date || raw.created_at),
    dateTime: raw.interaction_date || raw.created_at || "",
    owner: raw.created_by_email || "Current staff",
    status: "Recorded", // The supplied Interaction model has no status field.
    source: "django-api",
    createdAt: raw.created_at || null,
  };
}

export async function getApiInteractions({ search = "", type = "All" } = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest, "Interactions");
  const raw = collection(await request(INTERACTIONS_PATH, { method: "GET" }));
  const query = String(search || "").trim().toLowerCase();
  return raw.map(mapApiInteraction).filter((item) => {
    const matchSearch = !query || [item.customerName, item.subject, item.owner, item.description, item.id]
      .some((value) => String(value || "").toLowerCase().includes(query));
    return matchSearch && (type === "All" || item.type === type);
  });
}

export async function createApiInteraction(input, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest, "Interactions");
  const customerId = Number(input.customerId ?? input.customer);
  if (!Number.isInteger(customerId) || customerId <= 0) throw new Error("Choose a valid customer.");
  const subject = String(input.subject || "").trim();
  if (!subject) throw new Error("Interaction subject is required.");
  const type = INTERACTION_LABEL_TO_TYPE[input.type] || String(input.type || "NOTE").toUpperCase();
  if (!Object.prototype.hasOwnProperty.call(INTERACTION_TYPE_TO_LABEL, type)) throw new Error("Choose a supported interaction type.");
  const rawDate = input.dateTime || input.interaction_date;
  const parsed = new Date(rawDate);
  if (!rawDate || Number.isNaN(parsed.getTime())) throw new Error("Choose a valid interaction date and time.");

  const saved = await request(INTERACTIONS_PATH, {
    method: "POST",
    body: {
      customer: customerId,
      interaction_type: type,
      subject,
      description: String(input.description || "").trim(),
      interaction_date: parsed.toISOString(),
    },
  });
  return mapApiInteraction(saved);
}

const UI_RULES = {
  all: { field: "is_active", operator: "equals", value: true },
  "high-value": { field: "total_spent", operator: "gte", value: 50000 },
  repeat: { field: "total_orders", operator: "gte", value: 2 },
  inactive: { field: "is_active", operator: "equals", value: false },
  new: { field: "lifecycle_stage", operator: "equals", value: "LEAD" },
};

const RULE_LABELS = {
  all: "Active customers",
  "high-value": "Lifetime spend ≥ ₹50,000",
  repeat: "At least two eligible orders",
  inactive: "Inactive customers",
  new: "Customers at the Lead lifecycle stage",
};

function ruleToUi(rules = {}) {
  const condition = Array.isArray(rules.conditions) ? rules.conditions[0] : null;
  if (!condition) return "all";
  if (condition.field === "total_spent" && condition.operator === "gte" && Number(condition.value) >= 50000) return "high-value";
  if (condition.field === "total_orders" && condition.operator === "gte" && Number(condition.value) >= 2) return "repeat";
  if (condition.field === "is_active" && condition.value === false) return "inactive";
  if (condition.field === "lifecycle_stage" && condition.value === "LEAD") return "new";
  return "custom";
}

function mapApiSegment(raw = {}, previewCount = null) {
  const rule = ruleToUi(raw.rules || {});
  return {
    id: String(raw.id ?? ""),
    apiId: raw.id,
    name: raw.name || "Untitled segment",
    description: raw.description || RULE_LABELS[rule] || "Custom segment rule",
    rule,
    rules: raw.rules || {},
    segmentType: raw.segment_type || "MANUAL",
    customers: Number.isFinite(Number(previewCount)) ? Number(previewCount) : Number(raw.customer_count || 0),
    updatedAt: dateOnly(raw.updated_at || raw.created_at),
    status: raw.is_active ? "Active" : "Inactive",
    source: "django-api",
  };
}

async function mapSegmentWithPreview(raw, request) {
  let count = Number(raw.customer_count || 0);
  if (String(raw.segment_type || "").toUpperCase() === "DYNAMIC" && raw.id != null) {
    try {
      const preview = await request(`${SEGMENTS_PATH}${encodeURIComponent(raw.id)}/preview/`, { method: "GET" });
      if (Number.isFinite(Number(preview?.matching_customer_count))) count = Number(preview.matching_customer_count);
    } catch {
      // Do not fail the entire list if a saved legacy segment cannot be previewed.
    }
  }
  return mapApiSegment(raw, count);
}

export async function getApiSegments(authenticatedRequest) {
  const request = requireRequest(authenticatedRequest, "Customer Segments");
  const raw = collection(await request(SEGMENTS_PATH, { method: "GET" }));
  return Promise.all(raw.map((segment) => mapSegmentWithPreview(segment, request)));
}

export async function createApiSegment(input, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest, "Customer Segments");
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Segment name is required.");
  const ruleKey = UI_RULES[input.rule] ? input.rule : "all";
  const rules = { match: "all", conditions: [UI_RULES[ruleKey]] };
  const description = String(input.description || "").trim() || RULE_LABELS[ruleKey];
  const raw = await request(SEGMENTS_PATH, {
    method: "POST",
    body: {
      name,
      description,
      segment_type: "DYNAMIC",
      is_active: input.status === "Active",
      rules,
    },
  });
  return mapSegmentWithPreview(raw, request);
}

const CAMPAIGN_TYPES = {
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  PUSH: "Push notification",
};
const CAMPAIGN_TYPE_CODES = Object.fromEntries(Object.entries(CAMPAIGN_TYPES).map(([code, label]) => [label, code]));
const CAMPAIGN_STATUSES = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  RUNNING: "Active",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export function mapApiCampaign(raw = {}) {
  return {
    id: String(raw.id ?? ""),
    apiId: raw.id,
    name: raw.name || "Untitled campaign",
    channel: CAMPAIGN_TYPES[String(raw.campaign_type || "EMAIL").toUpperCase()] || raw.campaign_type || "Email",
    audience: Number(raw.customer_count || 0),
    sent: null,
    conversions: null,
    revenue: null,
    status: CAMPAIGN_STATUSES[String(raw.status || "DRAFT").toUpperCase()] || raw.status || "Draft",
    date: dateOnly(raw.scheduled_at || raw.created_at),
    segmentId: String(raw.segment ?? ""),
    segmentName: raw.segment_name || "",
    subject: raw.subject || "",
    message: raw.message || "",
    description: raw.description || "",
    scheduledAt: raw.scheduled_at || null,
    source: "django-api",
    deliveryTrackingAvailable: false,
  };
}

export async function getApiCampaigns({ search = "", channel = "All", status = "All" } = {}, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest, "Campaigns");
  const [rawCampaigns, rawSegments] = await Promise.all([
    request(CAMPAIGNS_PATH, { method: "GET" }).then(collection),
    request(SEGMENTS_PATH, { method: "GET" }).then(collection),
  ]);
  const segmentAudience = new Map();
  await Promise.all(rawSegments.map(async (segment) => {
    let count = Number(segment.customer_count || 0);
    if (String(segment.segment_type || "").toUpperCase() === "DYNAMIC" && segment.id != null) {
      try {
        const preview = await request(`${SEGMENTS_PATH}${encodeURIComponent(segment.id)}/preview/`, { method: "GET" });
        if (Number.isFinite(Number(preview?.matching_customer_count))) count = Number(preview.matching_customer_count);
      } catch {
        // Fall back to the count supplied by the serializer for legacy/unpreviewable segments.
      }
    }
    segmentAudience.set(String(segment.id), count);
  }));

  const query = String(search || "").trim().toLowerCase();
  return rawCampaigns.map((raw) => {
    const campaign = mapApiCampaign(raw);
    if (segmentAudience.has(String(raw.segment))) campaign.audience = segmentAudience.get(String(raw.segment));
    return campaign;
  }).filter((campaign) => {
    const matchSearch = !query || [campaign.name, campaign.id, campaign.segmentName].some((value) => String(value || "").toLowerCase().includes(query));
    return matchSearch && (channel === "All" || campaign.channel === channel) && (status === "All" || campaign.status === status);
  });
}

export async function createApiCampaign(input, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest, "Campaigns");
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Campaign name is required.");
  const segmentId = Number(input.segmentId);
  if (!Number.isInteger(segmentId) || segmentId <= 0) throw new Error("Select a saved customer segment. The backend requires a segment for every campaign.");
  const type = CAMPAIGN_TYPE_CODES[input.channel] || "EMAIL";
  const date = String(input.date || "").trim();
  if (!date) throw new Error("Campaign date is required.");
  const scheduledAt = new Date(`${date}T09:00:00`).toISOString();
  const subject = String(input.subject || name).trim();
  const message = String(input.message || "").trim();
  if (!message) throw new Error("Campaign message is required by the Django API.");

  const raw = await request(CAMPAIGNS_PATH, {
    method: "POST",
    body: {
      name,
      description: String(input.description || "").trim(),
      campaign_type: type,
      status: "SCHEDULED",
      segment: segmentId,
      subject,
      message,
      scheduled_at: scheduledAt,
    },
  });
  return mapApiCampaign(raw);
}

export async function setApiCampaignRunning(id, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest, "Campaigns");
  const campaign = await request(`${CAMPAIGNS_PATH}${encodeURIComponent(id)}/`, { method: "GET" });
  if (String(campaign.status).toUpperCase() === "COMPLETED" || String(campaign.status).toUpperCase() === "CANCELLED") {
    throw new Error("Completed or cancelled campaigns cannot be moved to Running.");
  }
  const updated = await request(`${CAMPAIGNS_PATH}${encodeURIComponent(id)}/`, {
    method: "PATCH",
    body: { status: "RUNNING" },
  });
  return mapApiCampaign(updated);
}
