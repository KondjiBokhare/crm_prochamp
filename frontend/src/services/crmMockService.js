import { getDemoOrderById, getDemoOrders, updateDemoOrder } from "./demoOrderService";
import {
  crmAnalytics,
  crmBanners,
  crmCampaigns,
  crmCustomers,
  crmInteractions,
  crmLeads,
  crmOrders,
  crmSegments,
} from "../data/crmMockData";
import { crmSupportTickets } from "../data/crmSupportTickets";
import { crmCommunicationTemplates } from "../data/crmCommunicationData";
import { createNotificationRecord, getNotificationsForUser as getLocalNotificationsForUser, markNotificationReadForUser as markLocalNotificationRead, markAllNotificationsReadForUser as markAllLocalNotificationsRead, getNotificationPreferences } from "./notificationCenterService";

// UI-facing data-access layer. The current implementation is intentionally
// mock-only. Replace these functions with Django/FastAPI calls at integration.
const STORAGE_KEY = "techgear_crm_mock_data_v1";
const clone = (value) => JSON.parse(JSON.stringify(value));
const seedStore = () => ({
  customers: clone(crmCustomers),
  orders: clone(crmOrders),
  interactions: clone(crmInteractions),
  leads: clone(crmLeads),
  segments: clone(crmSegments),
  campaigns: clone(crmCampaigns),
  banners: clone(crmBanners),
  supportTickets: clone(crmSupportTickets),
  communicationTemplates: clone(crmCommunicationTemplates),
  communicationHistory: [],
});

function readStore() {
  if (typeof window === "undefined") return seedStore();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedStore();
    const saved = JSON.parse(raw);
    const seed = seedStore();
    return {
      customers: Array.isArray(saved.customers) ? saved.customers : seed.customers,
      orders: Array.isArray(saved.orders) ? saved.orders : seed.orders,
      interactions: Array.isArray(saved.interactions) ? saved.interactions : seed.interactions,
      leads: Array.isArray(saved.leads) ? saved.leads : seed.leads,
      segments: Array.isArray(saved.segments) ? saved.segments : seed.segments,
      campaigns: Array.isArray(saved.campaigns) ? saved.campaigns : seed.campaigns,
      // Migrate local demo records created before Banner Management existed.
      banners: Array.isArray(saved.banners) ? saved.banners : seed.banners,
      supportTickets: Array.isArray(saved.supportTickets) ? saved.supportTickets : seed.supportTickets,
      communicationTemplates: Array.isArray(saved.communicationTemplates) ? saved.communicationTemplates : seed.communicationTemplates,
      communicationHistory: Array.isArray(saved.communicationHistory) ? saved.communicationHistory : seed.communicationHistory,
    };
  } catch {
    return seedStore();
  }
}

let store = readStore();

// In mock mode, multiple tabs share localStorage but each tab has its own
// in-memory store. Refresh only the support-ticket collection before reads /
// writes so customer and CRM-agent conversations stay in sync across tabs.
function syncSupportTicketsFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved?.supportTickets)) store.supportTickets = saved.supportTickets;
  } catch {
    // Keep the current in-memory collection if local storage is unavailable.
  }
}

function syncLeadsFromStorage() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (Array.isArray(saved?.leads)) store.leads = saved.leads;
  } catch {
    // Keep current in-memory data if storage is unavailable.
  }
}

function saveStore() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Mock data still works in memory if browser storage is disabled/full.
  }
}
function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function nextNumericId(items, fallback = 1000) {
  return Math.max(fallback, ...items.map((item) => Number(item.id) || 0)) + 1;
}

export async function getCustomers({ search = "", status = "All", city = "All" } = {}) {
  const query = search.trim().toLowerCase();
  return clone(store.customers).filter((customer) => {
    const matchesSearch = !query ||
      customer.name.toLowerCase().includes(query) ||
      customer.email.toLowerCase().includes(query) ||
      String(customer.id).includes(query) ||
      String(customer.city || "").toLowerCase().includes(query);
    const matchesStatus = status === "All" || customer.status === status;
    const matchesCity = city === "All" || customer.city === city;
    return matchesSearch && matchesStatus && matchesCity;
  });
}

export async function createCustomer(input) {
  const email = String(input.email || "").trim().toLowerCase();
  if (!String(input.name || "").trim()) throw new Error("Customer name is required.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (store.customers.some((customer) => customer.email.toLowerCase() === email)) {
    throw new Error("A customer with this email already exists.");
  }
  const joinedAt = todayISO();
  const customer = {
    id: nextNumericId(store.customers, 1000),
    name: String(input.name).trim(),
    email,
    phone: String(input.phone || "").trim(),
    city: String(input.city || "").trim() || "Not specified",
    status: input.status === "Inactive" ? "Inactive" : "Active",
    joinedAt,
    totalOrders: 0,
    totalSpend: 0,
    lastOrderDate: "",
    tags: String(input.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean),
  };
  store.customers.unshift(customer);
  saveStore();
  return clone(customer);
}

export async function updateCustomer(id, input) {
  const index = store.customers.findIndex((customer) => String(customer.id) === String(id));
  if (index < 0) throw new Error("Customer was not found.");
  const existing = store.customers[index];
  const nextEmail = String(input.email ?? existing.email).trim().toLowerCase();
  if (!nextEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) throw new Error("Enter a valid email address.");
  if (store.customers.some((customer, otherIndex) => otherIndex !== index && customer.email.toLowerCase() === nextEmail)) {
    throw new Error("A customer with this email already exists.");
  }
  const updated = {
    ...existing,
    ...input,
    name: String(input.name ?? existing.name).trim(),
    email: nextEmail,
    phone: String(input.phone ?? existing.phone ?? "").trim(),
    city: String(input.city ?? existing.city ?? "").trim() || "Not specified",
    status: input.status === "Inactive" ? "Inactive" : (input.status || existing.status),
    lifecycleStage: input.lifecycleStage || existing.lifecycleStage || "CUSTOMER",
    tags: Array.isArray(input.tags) ? input.tags : String(input.tags ?? (existing.tags || []).join(", ")).split(",").map((tag) => tag.trim()).filter(Boolean),
  };
  store.customers[index] = updated;
  saveStore();
  return clone(updated);
}

export async function getCustomerById(id) {
  const customer = store.customers.find((item) => String(item.id) === String(id));
  return customer ? clone(customer) : null;
}

export async function getCustomerOrders(customerId) {
  return clone(store.orders).filter((order) => String(order.customerId) === String(customerId));
}

export async function getDashboardData() {
  const paidOrders = store.orders.filter((order) => order.paymentStatus === "Paid");
  const activeCustomers = store.customers.filter((customer) => customer.status === "Active");
  const repeatCustomers = store.customers.filter((customer) => customer.totalOrders > 1);
  const openInteractions = store.interactions.filter((item) => item.status === "Pending");
  return {
    totalCustomers: store.customers.length,
    activeCustomers: activeCustomers.length,
    totalPaidRevenue: paidOrders.reduce((total, order) => total + order.total, 0),
    paidOrders: paidOrders.length,
    repeatCustomerRate: store.customers.length ? Math.round((repeatCustomers.length / store.customers.length) * 100) : 0,
    pendingInteractions: openInteractions.length,
    recentOrders: clone(store.orders.slice(0, 5)),
    recentCustomers: clone([...store.customers].sort((a, b) => (b.joinedAt || "").localeCompare(a.joinedAt || "")).slice(0, 5)),
  };
}

export async function getInteractions({ search = "", type = "All", status = "All" } = {}) {
  const query = search.trim().toLowerCase();
  return clone(store.interactions).filter((item) => {
    const matchesQuery = !query || [item.customerName, item.subject, item.owner, item.id].some((value) => String(value || "").toLowerCase().includes(query));
    return matchesQuery && (type === "All" || item.type === type) && (status === "All" || item.status === status);
  });
}

export async function createInteraction(input) {
  const customerId = input.customerId ?? input.customer;
  const customer = store.customers.find((item) => String(item.id) === String(customerId));
  if (!customer) throw new Error("Choose a customer from the available list.");
  const subject = String(input.subject || "").trim();
  if (!subject) throw new Error("Interaction subject is required.");
  const interaction = {
    id: `INT-${String(Date.now()).slice(-6)}`,
    customerId: customer.id,
    customerName: customer.name,
    type: String(input.type || "Note"),
    subject,
    description: String(input.description || "").trim(),
    date: String(input.dateTime || input.date || todayISO()).slice(0, 10),
    owner: "Current staff",
    status: "Pending",
  };
  store.interactions.unshift(interaction);
  saveStore();
  return clone(interaction);
}

export async function updateInteractionStatus(id, status) {
  const interaction = store.interactions.find((item) => item.id === id);
  if (!interaction) throw new Error("Interaction was not found.");
  if (!["Pending", "Completed"].includes(status)) throw new Error("Unsupported interaction status.");
  interaction.status = status;
  saveStore();
  return clone(interaction);
}

function segmentCount(rule) {
  switch (rule) {
    case "high-value": return store.customers.filter((customer) => customer.totalSpend >= 50000).length;
    case "repeat": return store.customers.filter((customer) => customer.totalOrders >= 2).length;
    case "inactive": return store.customers.filter((customer) => customer.status === "Inactive").length;
    case "new": return store.customers.filter((customer) => customer.tags?.includes("New customer")).length;
    default: return store.customers.length;
  }
}

export async function getSegments() {
  return clone(store.segments);
}

export async function createSegment(input) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Segment name is required.");
  if (store.segments.some((segment) => segment.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("A segment with this name already exists.");
  }
  const rules = {
    "high-value": "Lifetime spend of at least ₹50,000",
    repeat: "At least two orders",
    inactive: "Customer status is inactive",
    new: "Tagged as a new customer",
    all: "All customers in the mock dataset",
  };
  const segment = {
    id: `SEG-${String(Date.now()).slice(-6)}`,
    name,
    description: String(input.description || "").trim() || rules[input.rule] || rules.all,
    rule: input.rule || "all",
    customers: segmentCount(input.rule || "all"),
    updatedAt: todayISO(),
    status: input.status === "Active" ? "Active" : "Draft",
  };
  store.segments.unshift(segment);
  saveStore();
  return clone(segment);
}

export async function getCampaigns({ search = "", channel = "All", status = "All" } = {}) {
  const query = search.trim().toLowerCase();
  return clone(store.campaigns).filter((campaign) => {
    const matchesSearch = !query || campaign.name.toLowerCase().includes(query) || campaign.id.toLowerCase().includes(query);
    return matchesSearch && (channel === "All" || campaign.channel === channel) && (status === "All" || campaign.status === status);
  });
}

export async function createCampaign(input) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Campaign name is required.");
  const selectedSegment = store.segments.find((segment) => segment.id === input.segmentId);
  const audience = selectedSegment ? selectedSegment.customers : store.customers.length;
  const campaign = {
    id: `CMP-${String(Date.now()).slice(-6)}`,
    name,
    channel: ["Email", "SMS", "In-app"].includes(input.channel) ? input.channel : "Email",
    audience,
    sent: 0,
    conversions: 0,
    revenue: 0,
    status: "Scheduled",
    date: input.date || todayISO(),
    segmentId: selectedSegment?.id || "",
  };
  store.campaigns.unshift(campaign);
  saveStore();
  return clone(campaign);
}

export async function simulateCampaignLaunch(id) {
  const campaign = store.campaigns.find((item) => item.id === id);
  if (!campaign) throw new Error("Campaign was not found.");
  if (campaign.status === "Completed") throw new Error("Completed campaigns cannot be launched again.");
  campaign.status = "Active";
  campaign.sent = campaign.audience;
  saveStore();
  return clone(campaign);
}

export async function getAnalyticsData({ from = "", to = "" } = {}) {
  const inRange = (date) => (!from || date >= from) && (!to || date <= to);
  const reportOrders = store.orders.filter((order) => inRange(order.date));
  const paidOrders = reportOrders.filter((order) => order.paymentStatus === "Paid");
  const refundedOrders = reportOrders.filter((order) => order.paymentStatus === "Refunded");
  const grossPaidRevenue = paidOrders.reduce((total, order) => total + order.total, 0);
  const refundedOrderValue = refundedOrders.reduce((total, order) => total + order.total, 0);
  const repeatCustomers = store.customers.filter((customer) => customer.totalOrders > 1);
  const reportCampaigns = store.campaigns.filter((campaign) => inRange(campaign.date));
  const eligibleCampaigns = reportCampaigns.filter((campaign) => campaign.sent > 0);
  const deliveredMessages = eligibleCampaigns.reduce((total, campaign) => total + campaign.sent, 0);
  const conversions = eligibleCampaigns.reduce((total, campaign) => total + campaign.conversions, 0);
  const revenueTrend = crmAnalytics.revenueTrend.filter((point) => inRange(point.date));

  return {
    revenue: grossPaidRevenue,
    paidOrders: paidOrders.length,
    averageOrderValue: paidOrders.length ? Math.round(grossPaidRevenue / paidOrders.length) : 0,
    repeatPurchaseRate: store.customers.length ? Math.round((repeatCustomers.length / store.customers.length) * 100) : 0,
    cancellationRate: reportOrders.length ? Number(((reportOrders.filter((order) => order.fulfillmentStatus === "Cancelled").length / reportOrders.length) * 100).toFixed(1)) : 0,
    refundRate: grossPaidRevenue + refundedOrderValue ? Number(((refundedOrderValue / (grossPaidRevenue + refundedOrderValue)) * 100).toFixed(1)) : 0,
    campaignConversionRate: deliveredMessages ? Number(((conversions / deliveredMessages) * 100).toFixed(1)) : 0,
    customerCount: store.customers.length,
    revenueTrend: clone(revenueTrend),
    campaigns: clone(reportCampaigns),
    reportOrders: clone(reportOrders),
    reportPeriod: { from, to },
  };
}


function validBannerUrl(value, { optional = false } = {}) {
  const input = String(value || "").trim();
  if (!input && optional) return "";
  if (!input) throw new Error("Destination URL is required.");
  if (input.startsWith("/") && !input.startsWith("//") && !input.startsWith("/\\")) return input;
  try {
    const parsed = new URL(input);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    return parsed.href;
  } catch {
    throw new Error("Use a relative site path (for example /products) or a valid http/https URL.");
  }
}

function normaliseBannerInput(input, existing = {}) {
  const name = String(input.name ?? existing.name ?? "").trim();
  const title = String(input.title ?? existing.title ?? "").trim();
  const startDate = String(input.startDate ?? existing.startDate ?? todayISO());
  const endDate = String(input.endDate ?? existing.endDate ?? "2027-12-31");
  if (!name) throw new Error("Internal banner name is required.");
  if (!title) throw new Error("Banner headline is required.");
  if (!startDate || !endDate) throw new Error("Start and end dates are required.");
  if (endDate < startDate) throw new Error("End date must be on or after the start date.");
  const placement = input.placement ?? existing.placement ?? "PROMO";
  if (!["HERO", "PROMO"].includes(placement)) throw new Error("Choose a valid banner placement.");
  const status = input.status ?? existing.status ?? "Draft";
  if (!["Draft", "Active", "Paused"].includes(status)) throw new Error("Choose a valid banner status.");
  const backgroundColor = String(input.backgroundColor ?? existing.backgroundColor ?? "#061a3c");
  const textColor = String(input.textColor ?? existing.textColor ?? "#ffffff");
  if (!/^#[0-9a-fA-F]{6}$/.test(backgroundColor) || !/^#[0-9a-fA-F]{6}$/.test(textColor)) {
    throw new Error("Choose valid six-digit hex colors.");
  }
  let imageUrl = String(input.imageUrl ?? existing.imageUrl ?? "").trim();
  if (imageUrl) imageUrl = validBannerUrl(imageUrl);
  return {
    ...existing,
    name,
    eyebrow: String(input.eyebrow ?? existing.eyebrow ?? "").trim(),
    title,
    subtitle: String(input.subtitle ?? existing.subtitle ?? "").trim(),
    buttonText: String(input.buttonText ?? existing.buttonText ?? "Shop Now").trim() || "Shop Now",
    targetUrl: validBannerUrl(input.targetUrl ?? existing.targetUrl ?? "/products"),
    imageUrl,
    placement,
    backgroundColor,
    textColor,
    status,
    startDate,
    endDate,
  };
}

export async function getBanners({ search = "", placement = "All", status = "All" } = {}) {
  const query = String(search).trim().toLowerCase();
  return clone(store.banners).filter((banner) => {
    const searchable = [banner.name, banner.title, banner.eyebrow, banner.id].some((value) => String(value || "").toLowerCase().includes(query));
    return (!query || searchable) && (placement === "All" || banner.placement === placement) && (status === "All" || banner.status === status);
  }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function createBanner(input) {
  const normalised = normaliseBannerInput(input);
  const banner = {
    ...normalised,
    id: `BN-${String(Date.now()).slice(-7)}`,
    impressions: 0,
    clicks: 0,
    createdAt: todayISO(),
  };
  store.banners.unshift(banner);
  saveStore();
  return clone(banner);
}

export async function updateBanner(id, input) {
  const index = store.banners.findIndex((banner) => String(banner.id) === String(id));
  if (index < 0) throw new Error("Banner was not found.");
  store.banners[index] = normaliseBannerInput(input, store.banners[index]);
  saveStore();
  return clone(store.banners[index]);
}

export async function setBannerStatus(id, status) {
  if (!["Draft", "Active", "Paused"].includes(status)) throw new Error("Unsupported banner status.");
  const banner = store.banners.find((item) => String(item.id) === String(id));
  if (!banner) throw new Error("Banner was not found.");
  banner.status = status;
  saveStore();
  return clone(banner);
}

export async function getStorefrontBanners({ placement = "All" } = {}) {
  const today = todayISO();
  return clone(store.banners).filter((banner) =>
    banner.status === "Active" &&
    banner.startDate <= today &&
    banner.endDate >= today &&
    (placement === "All" || banner.placement === placement)
  ).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

async function recordBannerMetric(id, field) {
  const banner = store.banners.find((item) => String(item.id) === String(id));
  if (!banner) return null;
  banner[field] = (Number(banner[field]) || 0) + 1;
  saveStore();
  return clone(banner);
}

export function recordBannerImpression(id) {
  return recordBannerMetric(id, "impressions");
}

export function recordBannerClick(id) {
  return recordBannerMetric(id, "clicks");
}


// ---------------------------------------------------------------------------
// Customer Support (mock mode)
// Shared customer-facing and CRM ticket records for local demo workflows.
// ---------------------------------------------------------------------------
const SUPPORT_STATUSES = ["Open", "In Progress", "Waiting on Customer", "Resolved", "Closed"];
const SUPPORT_PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const SUPPORT_CATEGORIES = ["Order", "Delivery", "Payment", "Product", "Warranty", "Returns & Refunds", "Account", "Other"];
const SUPPORT_ASSIGNEES = ["Unassigned", "Sam Support", "Neha Patel", "Amit Kumar", "Maya Manager"];

function normaliseSupportTicket(ticket) {
  const customerName = String(ticket.customerName || "Customer");
  const description = String(ticket.description || "").trim();
  const storedMessages = Array.isArray(ticket.messages) ? ticket.messages : [];
  const initialAlreadyInThread = storedMessages.some((message) =>
    message?.isInitialRequest || (String(message?.author || "").trim() === customerName && String(message?.text || "").trim() === description)
  );
  // Migrate older demo tickets, whose original customer description was saved
  // only on the ticket record and was therefore missing from the conversation.
  const initialRequest = description && !initialAlreadyInThread ? [{
    id: `${ticket.id}-INITIAL`,
    author: customerName,
    text: description,
    createdAt: ticket.createdAt,
    isInternal: false,
    isInitialRequest: true,
  }] : [];
  const messages = [...initialRequest, ...storedMessages].map((message) => ({
    ...message,
    isInternal: Boolean(message?.isInternal),
  }));

  return {
    ...ticket,
    id: String(ticket.id),
    customerName,
    customerEmail: String(ticket.customerEmail || ""),
    subject: String(ticket.subject || "Untitled support request"),
    category: SUPPORT_CATEGORIES.includes(ticket.category) ? ticket.category : "Other",
    priority: SUPPORT_PRIORITIES.includes(ticket.priority) ? ticket.priority : "Medium",
    status: SUPPORT_STATUSES.includes(ticket.status) ? ticket.status : "Open",
    assignedTo: SUPPORT_ASSIGNEES.includes(ticket.assignedTo) ? ticket.assignedTo : "Unassigned",
    messages,
    internalNotes: Array.isArray(ticket.internalNotes) ? ticket.internalNotes : [],
    statusHistory: Array.isArray(ticket.statusHistory) ? ticket.statusHistory : [],
  };
}

export async function getSupportTickets({ search = "", status = "All", priority = "All", category = "All", assignedTo = "All", customerEmail = "" } = {}) {
  syncSupportTicketsFromStorage();
  const query = String(search || "").trim().toLowerCase();
  const emailFilter = String(customerEmail || "").trim().toLowerCase();
  return clone(store.supportTickets.map(normaliseSupportTicket).filter((ticket) => {
    const searchable = [ticket.id, ticket.customerName, ticket.customerEmail, ticket.subject, ticket.category, ticket.orderId, ticket.description]
      .some((value) => String(value || "").toLowerCase().includes(query));
    return (!query || searchable)
      && (status === "All" || ticket.status === status)
      && (priority === "All" || ticket.priority === priority)
      && (category === "All" || ticket.category === category)
      && (assignedTo === "All" || ticket.assignedTo === assignedTo)
      && (!emailFilter || ticket.customerEmail.toLowerCase() === emailFilter);
  }).sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt))));
}

export async function getSupportTicketById(id) {
  syncSupportTicketsFromStorage();
  const ticket = store.supportTickets.find((item) => String(item.id) === String(id));
  return ticket ? clone(normaliseSupportTicket(ticket)) : null;
}

function customerSafeSupportTicket(ticket) {
  if (!ticket) return null;
  const safe = clone(normaliseSupportTicket(ticket));
  safe.internalNotes = [];
  safe.messages = safe.messages.filter((message) => !message.isInternal);
  safe.statusHistory = safe.statusHistory.filter((event) => event.type !== "Internal note");
  return safe;
}

export async function getMySupportTickets(customerEmail) {
  const results = await getSupportTickets({ customerEmail });
  return results.map(customerSafeSupportTicket);
}

export async function getMySupportTicketById(id, customerEmail) {
  syncSupportTicketsFromStorage();
  const ticket = store.supportTickets.find((item) => String(item.id) === String(id));
  if (!ticket || String(ticket.customerEmail || "").toLowerCase() !== String(customerEmail || "").trim().toLowerCase()) return null;
  return customerSafeSupportTicket(ticket);
}

export async function createSupportTicket(input = {}) {
  syncSupportTicketsFromStorage();
  const subject = String(input.subject || "").trim();
  const description = String(input.description || input.message || "").trim();
  const customerEmail = String(input.customerEmail || "").trim().toLowerCase();
  const customerName = String(input.customerName || "").trim();
  if (!customerName) throw new Error("Customer name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) throw new Error("A valid customer email is required.");
  if (subject.length < 4 || subject.length > 160) throw new Error("Subject must be between 4 and 160 characters.");
  if (description.length < 10 || description.length > 2000) throw new Error("Description must be between 10 and 2,000 characters.");
  const category = SUPPORT_CATEGORIES.includes(input.category) ? input.category : "Other";
  const now = new Date().toISOString();
  const numericPart = Math.max(10259, ...store.supportTickets.map((ticket) => Number(String(ticket.id).replace(/\D/g, "")) || 0)) + 1;
  const id = `TG-${numericPart}`;
  const ticket = {
    id,
    customerId: input.customerId ?? null,
    customerName,
    customerEmail,
    subject,
    category,
    orderId: String(input.orderId || "").trim(),
    description,
    priority: SUPPORT_PRIORITIES.includes(input.priority) ? input.priority : "Medium",
    status: "Open",
    assignedTo: "Unassigned",
    createdAt: now,
    updatedAt: now,
    // The initial customer request is the first public message in the thread.
    // Keep description separately as a summary/search field for the ticket card.
    messages: [{
      id: `${id}-INITIAL`,
      author: customerName,
      text: description,
      createdAt: now,
      isInternal: false,
      isInitialRequest: true,
    }],
    internalNotes: [],
    statusHistory: [{ id: `${id}-H1`, type: "Created", from: "", to: "Open", by: customerName, at: now }],
  };
  store.supportTickets.unshift(ticket);
  saveStore();
  createNotificationRecord({ title: `New support ticket: ${ticket.id}`, message: `${ticket.customerName} submitted “${ticket.subject}”.`, type: "support", recipientRoles: ["ADMIN", "CRM_MANAGER", "SUPPORT_AGENT"], link: "/crm/support", source: "support-ticket", metadata: { ticketId: ticket.id } });
  if (typeof window !== "undefined") window.dispatchEvent(new Event("techgear:support-tickets-updated"));
  return clone(ticket);
}

export async function createMySupportTicket(input = {}, customer = {}) {
  return createSupportTicket({
    ...input,
    customerId: customer.id ?? null,
    customerName: customer.name || customer.fullName || "Customer",
    customerEmail: customer.email || "",
  });
}

export async function addMySupportTicketReply(id, text, customer = {}) {
  const ticket = await getSupportTicketById(id);
  const email = String(customer.email || "").trim().toLowerCase();
  if (!ticket || !email || ticket.customerEmail.toLowerCase() !== email) {
    throw new Error("Support ticket was not found for this customer.");
  }
  if (["Closed"].includes(ticket.status)) {
    throw new Error("This ticket is closed. Create a new ticket if you still need help.");
  }
  await addSupportTicketMessage(id, text, customer.name || "Customer", false, "customer");
  return getMySupportTicketById(id, email);
}

const SUPPORT_TRANSITIONS = {
  Open: ["In Progress", "Waiting on Customer", "Resolved", "Closed"],
  "In Progress": ["Open", "Waiting on Customer", "Resolved", "Closed"],
  "Waiting on Customer": ["Open", "In Progress", "Resolved", "Closed"],
  Resolved: ["Open", "Closed"],
  Closed: ["Open"],
};

async function mutateSupportTicket(id, actor, type, from, to, patch = {}) {
  syncSupportTicketsFromStorage();
  const ticket = store.supportTickets.find((item) => String(item.id) === String(id));
  if (!ticket) throw new Error("Support ticket was not found.");
  const now = new Date().toISOString();
  Object.assign(ticket, patch, { updatedAt: now });
  ticket.statusHistory = [...(ticket.statusHistory || []), { id: `${ticket.id}-H${Date.now()}`, type, from, to, by: actor || "CRM Staff", at: now }];
  saveStore();
  if (typeof window !== "undefined") window.dispatchEvent(new Event("techgear:support-tickets-updated"));
  return clone(normaliseSupportTicket(ticket));
}

export async function updateSupportTicketStatus(id, status, actor = "CRM Staff") {
  if (!SUPPORT_STATUSES.includes(status)) throw new Error("Choose a valid ticket status.");
  const ticket = await getSupportTicketById(id);
  if (!ticket) throw new Error("Support ticket was not found.");
  if (ticket.status === status) return ticket;
  if (!(SUPPORT_TRANSITIONS[ticket.status] || []).includes(status)) throw new Error(`Cannot move a ticket from ${ticket.status} to ${status}.`);
  const updated = await mutateSupportTicket(id, actor, "Status", ticket.status, status, { status });
  if (ticket.customerEmail) createNotificationRecord({ title: `Ticket ${ticket.id} updated`, message: `Your support ticket status is now ${status}.`, type: "support", recipientEmail: ticket.customerEmail, link: "/support", source: "support-status", metadata: { ticketId: ticket.id, status } });
  return updated;
}

export async function updateSupportTicketPriority(id, priority, actor = "CRM Staff") {
  if (!SUPPORT_PRIORITIES.includes(priority)) throw new Error("Choose a valid ticket priority.");
  const ticket = await getSupportTicketById(id);
  if (!ticket) throw new Error("Support ticket was not found.");
  if (ticket.priority === priority) return ticket;
  return mutateSupportTicket(id, actor, "Priority", ticket.priority, priority, { priority });
}

export async function assignSupportTicket(id, assignedTo, actor = "CRM Manager") {
  if (!SUPPORT_ASSIGNEES.includes(assignedTo)) throw new Error("Choose a valid support assignee.");
  const ticket = await getSupportTicketById(id);
  if (!ticket) throw new Error("Support ticket was not found.");
  if (ticket.assignedTo === assignedTo) return ticket;
  return mutateSupportTicket(id, actor, "Assignment", ticket.assignedTo, assignedTo, { assignedTo });
}

export async function addSupportTicketMessage(id, text, author = "CRM Staff", isInternal = false, sourceRole = "staff") {
  syncSupportTicketsFromStorage();
  const messageText = String(text || "").trim();
  if (!messageText) throw new Error("Write a message before submitting.");
  if (messageText.length > 2000) throw new Error("Messages must be 2,000 characters or fewer.");
  const ticket = store.supportTickets.find((item) => String(item.id) === String(id));
  if (!ticket) throw new Error("Support ticket was not found.");
  const now = new Date().toISOString();
  const entry = {
    id: `MSG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    author: String(author || "CRM Staff"),
    text: messageText,
    createdAt: now,
    isInternal: Boolean(isInternal),
    isInitialRequest: false,
  };
  if (isInternal) {
    ticket.internalNotes = [...(ticket.internalNotes || []), entry];
  } else {
    ticket.messages = [...(ticket.messages || []), entry];
  }
  ticket.updatedAt = now;
  ticket.statusHistory = [...(ticket.statusHistory || []), { id: `${ticket.id}-H${Date.now()}`, type: isInternal ? "Internal note" : "Reply", from: "", to: isInternal ? "Staff only" : "Customer visible", by: entry.author, at: now }];
  saveStore();
  if (!isInternal) {
    if (sourceRole === "customer") {
      createNotificationRecord({ title: `Customer replied to ${ticket.id}`, message: `${ticket.customerName} replied to “${ticket.subject}”.`, type: "support", recipientRoles: ["ADMIN", "CRM_MANAGER", "SUPPORT_AGENT"], link: "/crm/support", source: "support-reply", metadata: { ticketId: ticket.id } });
    } else if (ticket.customerEmail) {
      createNotificationRecord({ title: `Support replied to ${ticket.id}`, message: `Our support team replied to “${ticket.subject}”. Open your support tickets to read the message.`, type: "support", recipientEmail: ticket.customerEmail, link: "/support", source: "support-reply", metadata: { ticketId: ticket.id } });
    }
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("techgear:support-tickets-updated"));
  return clone(normaliseSupportTicket(ticket));
}

// ---------------------------------------------------------------------------
// Order Management (mock mode)
// Combines the seeded CRM order summaries with real checkout orders saved in
// this browser. Only demo/localStorage data is changed; Django remains the
// source of truth once API mode is enabled.
// ---------------------------------------------------------------------------
const FULFILLMENT_STATUSES = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled", "Return Requested", "Returned"];
const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded", "Pay on delivery", "Not Processed"];

function displayFulfillmentStatus(value) {
  const status = String(value || "Pending").trim();
  if (/processing/i.test(status)) return "Processing";
  if (/cancel/i.test(status)) return "Cancelled";
  if (/return requested/i.test(status)) return "Return Requested";
  if (/return/i.test(status)) return "Returned";
  if (/deliver/i.test(status)) return "Delivered";
  if (/ship/i.test(status)) return "Shipped";
  if (/pending/i.test(status)) return "Pending";
  return status;
}

function displayPaymentStatus(value) {
  const status = String(value || "Pending").trim();
  if (/demo only|not processed/i.test(status)) return "Not Processed";
  if (/pay on delivery|cash on delivery/i.test(status)) return "Pay on delivery";
  return status;
}

function normaliseManagedOrder(order, source = "crm") {
  const customer = store.customers.find((item) => String(item.id) === String(order.customerId));
  const createdAt = order.createdAt || (order.date ? `${order.date}T12:00:00.000Z` : new Date().toISOString());
  const date = String(order.date || createdAt.slice(0, 10)).slice(0, 10);
  const items = Array.isArray(order.items) ? order.items.map((item, index) => ({
    ...item,
    id: item.id ?? `${order.id}-item-${index + 1}`,
    name: item.name || item.productName || "Product",
    quantity: Math.max(1, Number(item.quantity) || 1),
    price: Math.max(0, Number(item.price ?? item.unitPrice) || 0),
    image: item.image || item.images?.[0] || "",
  })) : [];
  return {
    ...order,
    id: String(order.id),
    customerId: order.customerId ?? null,
    customerName: order.customerName || order.address?.name || customer?.name || "Guest customer",
    customerEmail: order.customerEmail || order.address?.email || customer?.email || "",
    customerPhone: order.customerPhone || order.address?.phone || customer?.phone || "",
    date,
    createdAt,
    total: Math.max(0, Number(order.total) || 0),
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    paymentStatus: displayPaymentStatus(order.paymentStatus),
    fulfillmentStatus: displayFulfillmentStatus(order.fulfillmentStatus || order.status),
    address: order.address || null,
    internalNotes: Array.isArray(order.internalNotes) ? order.internalNotes : [],
    statusHistory: Array.isArray(order.statusHistory) ? order.statusHistory : [],
    source: order.demoOnly ? "checkout-demo" : source,
  };
}

function getCombinedOrders() {
  const seeded = store.orders.map((order) => normaliseManagedOrder(order, "crm-seed"));
  const checkout = getDemoOrders().map((order) => normaliseManagedOrder(order, "checkout-demo"));
  const checkoutIds = new Set(checkout.map((order) => order.id));
  return [...checkout, ...seeded.filter((order) => !checkoutIds.has(order.id))]
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function getOrderManagementOrders({ search = "", fulfillmentStatus = "All", paymentStatus = "All", from = "", to = "" } = {}) {
  const query = String(search || "").trim().toLowerCase();
  return clone(getCombinedOrders().filter((order) => {
    const searchable = [order.id, order.customerName, order.customerEmail, order.customerPhone, ...order.items.map((item) => item.name)]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesFulfillment = fulfillmentStatus === "All" || order.fulfillmentStatus === fulfillmentStatus;
    const matchesPayment = paymentStatus === "All" || order.paymentStatus === paymentStatus;
    const matchesFrom = !from || order.date >= from;
    const matchesTo = !to || order.date <= to;
    return (!query || searchable) && matchesFulfillment && matchesPayment && matchesFrom && matchesTo;
  }));
}

export async function getManagedOrderById(id) {
  const order = getCombinedOrders().find((item) => item.id === String(id));
  return order ? clone(order) : null;
}

const FULFILLMENT_TRANSITIONS = {
  Pending: ["Processing", "Cancelled"],
  Processing: ["Shipped", "Cancelled"],
  Shipped: ["Delivered"],
  Delivered: ["Return Requested"],
  "Return Requested": ["Returned"],
  Cancelled: [],
  Returned: [],
};

function persistManagedOrderUpdate(id, patch) {
  const seededIndex = store.orders.findIndex((item) => String(item.id) === String(id));
  if (seededIndex >= 0) {
    store.orders[seededIndex] = { ...store.orders[seededIndex], ...patch };
    saveStore();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("techgear:crm-orders-updated"));
    return clone(store.orders[seededIndex]);
  }
  const demoOrder = getDemoOrderById(id);
  if (demoOrder) {
    // updateDemoOrder broadcasts techgear:demo-orders-updated for the order screen and My Orders page.
    return updateDemoOrder(id, patch);
  }
  throw new Error("Order was not found.");
}

export async function updateOrderFulfillmentStatus(id, nextStatus, actor = "CRM Manager") {
  if (!FULFILLMENT_STATUSES.includes(nextStatus)) throw new Error("Choose a valid fulfillment status.");
  const current = await getManagedOrderById(id);
  if (!current) throw new Error("Order was not found.");
  if (!(FULFILLMENT_TRANSITIONS[current.fulfillmentStatus] || []).includes(nextStatus)) {
    throw new Error(`Cannot move an order from ${current.fulfillmentStatus} to ${nextStatus}.`);
  }
  const now = new Date().toISOString();
  const history = [...current.statusHistory, { type: "fulfillment", from: current.fulfillmentStatus, to: nextStatus, at: now, by: actor }];
  const rawStatus = current.source === "checkout-demo" && nextStatus === "Processing" ? "Processing (demo)" : nextStatus;
  persistManagedOrderUpdate(id, { fulfillmentStatus: rawStatus, statusHistory: history, updatedAt: now });
  if (current.customerEmail) createNotificationRecord({ title: `Order ${current.id} status updated`, message: `Your order status is now ${nextStatus}.`, type: "order", recipientEmail: current.customerEmail, link: "/orders", source: "order-status", metadata: { orderId: current.id, status: nextStatus } });
  return getManagedOrderById(id);
}

export async function updateOrderPaymentStatus(id, nextStatus, actor = "CRM Manager") {
  if (!PAYMENT_STATUSES.includes(nextStatus)) throw new Error("Choose a valid payment status.");
  const current = await getManagedOrderById(id);
  if (!current) throw new Error("Order was not found.");
  if (current.paymentStatus === nextStatus) return current;
  const now = new Date().toISOString();
  const history = [...current.statusHistory, { type: "payment", from: current.paymentStatus, to: nextStatus, at: now, by: actor }];
  const rawStatus = nextStatus === "Not Processed" ? "Demo only — no payment processed" : nextStatus;
  persistManagedOrderUpdate(id, { paymentStatus: rawStatus, statusHistory: history, updatedAt: now });
  if (current.customerEmail) createNotificationRecord({ title: `Payment status updated for ${current.id}`, message: `Your order payment status is now ${nextStatus}.`, type: "payment", recipientEmail: current.customerEmail, link: "/orders", source: "payment-status", metadata: { orderId: current.id, status: nextStatus } });
  return getManagedOrderById(id);
}

export async function addOrderInternalNote(id, text, author = "CRM Staff") {
  const noteText = String(text || "").trim();
  if (!noteText) throw new Error("Enter a note before saving.");
  if (noteText.length > 1000) throw new Error("Notes must be 1,000 characters or fewer.");
  const current = await getManagedOrderById(id);
  if (!current) throw new Error("Order was not found.");
  const notes = [...current.internalNotes, { id: `NOTE-${Date.now()}`, text: noteText, author, createdAt: new Date().toISOString() }];
  persistManagedOrderUpdate(id, { internalNotes: notes, updatedAt: new Date().toISOString() });
  return getManagedOrderById(id);
}


// Lead Management demo service. API mode exposes the same contract through crmApiService.js.
const LEAD_SOURCES = ["Website", "Product Enquiry", "Campaign", "Referral", "Social Media", "Phone", "Email", "Event", "Other"];
const LEAD_STATUSES = ["New", "Contacted", "Qualified", "Proposal", "Lost"];
const LEAD_ASSIGNEES = ["Unassigned", "Mira Marketing", "Maya Manager", "Aarav Admin"];

function normaliseLeadInput(input = {}, existing = {}) {
  const email = String(input.email ?? existing.email ?? "").trim().toLowerCase();
  const name = String(input.name ?? existing.name ?? "").trim();
  const source = String(input.source ?? existing.source ?? "Website").trim();
  const status = String(input.status ?? existing.status ?? "New").trim();
  const assignedTo = String(input.assignedTo ?? existing.assignedTo ?? "Unassigned").trim();
  const score = Number(input.score ?? existing.score ?? 0);
  const estimatedValue = Number(input.estimatedValue ?? existing.estimatedValue ?? 0);
  if (!name) throw new Error("Lead name is required.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (!LEAD_SOURCES.includes(source)) throw new Error("Choose a valid lead source.");
  if (!LEAD_STATUSES.includes(status) && status !== "Converted") throw new Error("Choose a valid lead status.");
  if (!LEAD_ASSIGNEES.includes(assignedTo)) throw new Error("Choose a valid assignee.");
  if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error("Lead score must be between 0 and 100.");
  if (!Number.isFinite(estimatedValue) || estimatedValue < 0) throw new Error("Estimated value cannot be negative.");
  return {
    ...existing,
    name, email, source, status, assignedTo, score, estimatedValue,
    phone: String(input.phone ?? existing.phone ?? "").trim(),
    company: String(input.company ?? existing.company ?? "").trim() || "Independent",
    city: String(input.city ?? existing.city ?? "").trim(),
    nextFollowUpAt: String(input.nextFollowUpAt ?? existing.nextFollowUpAt ?? "").trim(),
    notes: String(input.notes ?? existing.notes ?? "").trim(),
  };
}

function withLeadDefaults(lead) {
  return {
    ...lead,
    followUps: Array.isArray(lead.followUps) ? lead.followUps : [],
    statusHistory: Array.isArray(lead.statusHistory)
      ? lead.statusHistory
      : [],
  };
}

export async function getLeads({ search = "", status = "All", source = "All", assignedTo = "All", from = "", to = "" } = {}) {
  syncLeadsFromStorage();
  const query = String(search || "").trim().toLowerCase();
  return clone(store.leads.map(withLeadDefaults).filter((lead) => {
    const haystack = [lead.id, lead.name, lead.email, lead.phone, lead.company, lead.city].join(" ").toLowerCase();
    return (!query || haystack.includes(query))
      && (status === "All" || lead.status === status)
      && (source === "All" || lead.source === source)
      && (assignedTo === "All" || lead.assignedTo === assignedTo)
      && (!from || lead.createdAt >= from)
      && (!to || lead.createdAt <= to);
  }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))));
}

export async function createLead(input = {}, actor = "CRM Staff") {
  syncLeadsFromStorage();
  const lead = normaliseLeadInput(input);
  const dupe = store.leads.find((item) => item.email?.toLowerCase() === lead.email && item.status !== "Converted" && item.status !== "Lost");
  if (dupe) throw new Error(`An open lead already exists for ${lead.email} (${dupe.id}).`);
  const now = new Date().toISOString();
  const created = withLeadDefaults({
    id: `LEAD-${String(nextNumericId(store.leads.map((item) => ({ id: String(item.id).replace(/^\D+/, "") })), 1000)).padStart(4, "0")}`,
    ...lead, createdAt: todayISO(), updatedAt: now, convertedCustomerId: null, convertedAt: null,
    followUps: [], statusHistory: [{ status: lead.status, at: now, by: actor }],
  });
  store.leads.unshift(created);
  saveStore();
  return clone(created);
}

export async function updateLead(id, input = {}, actor = "CRM Staff") {
  syncLeadsFromStorage();
  const index = store.leads.findIndex((item) => String(item.id) === String(id));
  if (index < 0) throw new Error("Lead was not found.");
  const current = withLeadDefaults(store.leads[index]);
  if (current.status === "Converted") throw new Error("Converted leads cannot be edited. Update the linked customer instead.");
  const next = normaliseLeadInput(input, current);
  const dupe = store.leads.find((item) => String(item.id) !== String(id) && item.email?.toLowerCase() === next.email && !["Converted", "Lost"].includes(item.status));
  if (dupe) throw new Error(`An open lead already exists for ${next.email} (${dupe.id}).`);
  const updated = { ...current, ...next, updatedAt: new Date().toISOString() };
  if (next.status !== current.status) updated.statusHistory = [...current.statusHistory, { status: next.status, at: updated.updatedAt, by: actor }];
  store.leads[index] = updated;
  saveStore();
  return clone(updated);
}

export async function updateLeadStatus(id, status, actor = "CRM Staff") {
  syncLeadsFromStorage();
  const current = store.leads.find((item) => String(item.id) === String(id));
  if (!current) throw new Error("Lead was not found.");
  if (status === "Converted") throw new Error("Use Convert lead so customer conversion is recorded.");
  if (!LEAD_STATUSES.includes(status)) throw new Error("Choose a valid lead status.");
  if (current.status === "Converted") throw new Error("Converted leads cannot change status.");
  if (current.status === status) return clone(current);
  const now = new Date().toISOString();
  Object.assign(current, { status, updatedAt: now, statusHistory: [...(current.statusHistory || []), { status, at: now, by: actor }] });
  store.leads = store.leads.map((item) => String(item.id) === String(id) ? current : item);
  saveStore();
  return clone(current);
}

export async function assignLead(id, assignedTo, actor = "CRM Manager") {
  syncLeadsFromStorage();
  if (!LEAD_ASSIGNEES.includes(assignedTo)) throw new Error("Choose a valid assignee.");
  const current = store.leads.find((item) => String(item.id) === String(id));
  if (!current) throw new Error("Lead was not found.");
  const from = current.assignedTo || "Unassigned";
  const now = new Date().toISOString();
  current.assignedTo = assignedTo;
  current.updatedAt = now;
  current.followUps = Array.isArray(current.followUps) ? current.followUps : [];
  current.statusHistory = [...(current.statusHistory || []), { status: current.status, event: "Assignment", from, to: assignedTo, at: now, by: actor }];
  store.leads = store.leads.map((item) => String(item.id) === String(id) ? current : item);
  saveStore();
  return clone(current);
}

export async function addLeadFollowUp(id, input = {}, actor = "CRM Staff") {
  syncLeadsFromStorage();
  const current = store.leads.find((item) => String(item.id) === String(id));
  if (!current) throw new Error("Lead was not found.");
  if (current.status === "Converted") throw new Error("Converted leads are read-only.");
  const summary = String(input.summary || "").trim();
  const type = String(input.type || "Note").trim();
  const nextFollowUpAt = String(input.nextFollowUpAt || "").trim();
  if (!summary) throw new Error("Enter a follow-up summary.");
  if (summary.length > 1000) throw new Error("Follow-up summary must be 1,000 characters or fewer.");
  if (!["Call", "Email", "Meeting", "Note"].includes(type)) throw new Error("Choose a valid follow-up type.");
  const now = new Date().toISOString();
  const followUp = { id: `LFU-${Date.now()}`, type, summary, at: now, nextFollowUpAt, by: actor };
  current.followUps = [...(current.followUps || []), followUp];
  current.nextFollowUpAt = nextFollowUpAt;
  current.updatedAt = now;
  if (current.status === "New" && type !== "Note") {
    current.status = "Contacted";
    current.statusHistory = [...(current.statusHistory || []), { status: "Contacted", at: now, by: actor }];
  }
  store.leads = store.leads.map((item) => String(item.id) === String(id) ? current : item);
  saveStore();
  return clone({ lead: current, followUp });
}

export async function convertLead(id, actor = "CRM Manager") {
  syncLeadsFromStorage();
  const current = store.leads.find((item) => String(item.id) === String(id));
  if (!current) throw new Error("Lead was not found.");
  if (current.status === "Converted" && current.convertedCustomerId) return clone({ lead: current, customer: store.customers.find((item) => String(item.id) === String(current.convertedCustomerId)) || null, alreadyConverted: true });
  if (["Lost"].includes(current.status)) throw new Error("A lost lead cannot be converted. Reopen it before conversion.");
  let customer = store.customers.find((item) => item.email?.toLowerCase() === current.email.toLowerCase());
  if (!customer) {
    customer = {
      id: nextNumericId(store.customers, 1000), name: current.name, email: current.email.toLowerCase(), phone: current.phone || "", city: current.city || "Not specified", status: "Active", joinedAt: todayISO(), totalOrders: 0, totalSpend: 0, lastOrderDate: "", tags: ["Lead conversion", current.source].filter(Boolean),
    };
    store.customers.unshift(customer);
  }
  const now = new Date().toISOString();
  current.status = "Converted";
  current.convertedCustomerId = customer.id;
  current.convertedAt = now;
  current.updatedAt = now;
  current.statusHistory = [...(current.statusHistory || []), { status: "Converted", at: now, by: actor }];
  store.leads = store.leads.map((item) => String(item.id) === String(id) ? current : item);
  saveStore();
  return clone({ lead: current, customer, alreadyConverted: false });
}


// ---------------------------------------------------------------------------
// Communications, reusable templates and notification center (mock mode).
// Email/SMS never leave the browser in demo mode; only In-app messages create
// customer-visible notifications. Scheduled messages are logged, not executed.
// ---------------------------------------------------------------------------
const COMMUNICATION_CHANNELS = ["Email", "SMS", "In-app"];
const COMMUNICATION_TEMPLATE_STATUSES = ["Active", "Draft", "Archived"];

export async function getCommunicationTemplates({ search = "", channel = "All", status = "All" } = {}) {
  const query = String(search || "").trim().toLowerCase();
  return clone(store.communicationTemplates || []).filter((item) => {
    const matchesSearch = !query || [item.id, item.name, item.subject, item.body, item.category].some((value) => String(value || "").toLowerCase().includes(query));
    return matchesSearch && (channel === "All" || item.channel === channel) && (status === "All" || item.status === status);
  }).sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
}

function normaliseCommunicationTemplate(input = {}, existing = {}) {
  const name = String(input.name ?? existing.name ?? "").trim();
  const channel = String(input.channel ?? existing.channel ?? "In-app");
  const subject = String(input.subject ?? existing.subject ?? "").trim();
  const body = String(input.body ?? existing.body ?? "").trim();
  const category = String(input.category ?? existing.category ?? "General").trim();
  const status = String(input.status ?? existing.status ?? "Draft");
  if (name.length < 3 || name.length > 100) throw new Error("Template name must be between 3 and 100 characters.");
  if (!COMMUNICATION_CHANNELS.includes(channel)) throw new Error("Choose a valid communication channel.");
  if (subject.length > 160) throw new Error("Subject must be 160 characters or fewer.");
  if (body.length < 5 || body.length > 3000) throw new Error("Message body must be between 5 and 3,000 characters.");
  if (!COMMUNICATION_TEMPLATE_STATUSES.includes(status)) throw new Error("Choose a valid template status.");
  return { ...existing, name, channel, subject, body, category: category || "General", status, updatedAt: todayISO() };
}

export async function createCommunicationTemplate(input = {}) {
  const normalised = normaliseCommunicationTemplate(input);
  if ((store.communicationTemplates || []).some((item) => item.name.toLowerCase() === normalised.name.toLowerCase())) throw new Error("A template with this name already exists.");
  const template = { id: `TPL-${Date.now().toString().slice(-8)}`, ...normalised };
  store.communicationTemplates.unshift(template);
  saveStore();
  return clone(template);
}

export async function updateCommunicationTemplate(id, input = {}) {
  const index = (store.communicationTemplates || []).findIndex((item) => String(item.id) === String(id));
  if (index < 0) throw new Error("Communication template was not found.");
  const next = normaliseCommunicationTemplate(input, store.communicationTemplates[index]);
  if (store.communicationTemplates.some((item, i) => i !== index && item.name.toLowerCase() === next.name.toLowerCase())) throw new Error("A template with this name already exists.");
  store.communicationTemplates[index] = { ...store.communicationTemplates[index], ...next };
  saveStore();
  return clone(store.communicationTemplates[index]);
}

export async function deleteCommunicationTemplate(id) {
  const before = store.communicationTemplates.length;
  store.communicationTemplates = store.communicationTemplates.filter((item) => String(item.id) !== String(id));
  if (store.communicationTemplates.length === before) throw new Error("Communication template was not found.");
  saveStore();
  return { deleted: true, id };
}

function getCustomersForCommunicationAudience(audience, segmentId = "") {
  if (audience === "all") return clone(store.customers);
  const segment = store.segments.find((item) => String(item.id) === String(segmentId || audience.replace(/^segment:/, "")) || item.name === audience);
  if (!segment) return [];
  const rule = String(segment.rule || segment.name || "").toLowerCase();
  return clone(store.customers).filter((customer) => {
    if (rule.includes("high-value") || rule.includes("high value") || rule === "high-value") return Number(customer.totalSpend || 0) >= 50000;
    if (rule.includes("repeat")) return Number(customer.totalOrders || 0) >= 2;
    if (rule.includes("inactive") || rule.includes("at-risk") || rule.includes("at risk")) return customer.status === "Inactive" || customer.tags?.includes("At risk");
    if (rule.includes("new")) return customer.tags?.includes("New customer");
    return true;
  });
}

export async function dispatchCommunication(input = {}, actor = "CRM Staff") {
  const channel = COMMUNICATION_CHANNELS.includes(input.channel) ? input.channel : "In-app";
  const subject = String(input.subject || "").trim();
  const body = String(input.body || "").trim();
  if (!subject) throw new Error("Subject/title is required.");
  if (body.length < 5 || body.length > 3000) throw new Error("Message body must be between 5 and 3,000 characters.");
  const audience = String(input.audience || "all");
  const segmentId = String(input.segmentId || (audience.startsWith("segment:") ? audience.slice(8) : ""));
  const customers = getCustomersForCommunicationAudience(audience, segmentId);
  const notificationType = ["general", "order", "support", "offer"].includes(input.type) ? input.type : "general";
  const eligibleCustomers = customers.filter((customer) => {
    const preferences = getNotificationPreferences({ email: customer.email, id: customer.id, role: "CUSTOMER" });
    if (notificationType === "offer" && !preferences.marketingNotifications) return false;
    if (channel === "Email" && !preferences.emailNotifications) return false;
    if (channel === "SMS" && !preferences.smsNotifications) return false;
    return true;
  });
  const scheduledAt = String(input.scheduledAt || "").trim();
  let isScheduled = false;
  if (scheduledAt) {
    const scheduleTime = new Date(scheduledAt).getTime();
    if (!Number.isFinite(scheduleTime)) throw new Error("Choose a valid schedule date and time.");
    if (scheduleTime <= Date.now()) throw new Error("Scheduled send time must be in the future.");
    isScheduled = true;
  }
  const audienceName = audience === "all" ? "All customers" : (store.segments.find((item) => String(item.id) === segmentId)?.name || audience);
  const now = new Date().toISOString();
  const log = {
    id: `COM-${Date.now().toString().slice(-8)}`,
    subject,
    body,
    channel,
    audience: audienceName,
    audienceKey: audience,
    segmentId,
    recipientCount: audience === "all" ? customers.length : eligibleCustomers.length,
    type: notificationType,
    status: isScheduled ? "Scheduled" : (channel === "In-app" ? "Sent (demo)" : "Simulated"),
    scheduledAt: isScheduled ? new Date(scheduledAt).toISOString() : "",
    createdAt: now,
    sentAt: !isScheduled ? now : "",
    actor,
    templateId: input.templateId || "",
  };
  store.communicationHistory = [log, ...(store.communicationHistory || [])].slice(0, 300);
  saveStore();
  // Demo mode only: actual email and SMS providers are not configured.
  if (!isScheduled && channel === "In-app") {
    if (audience === "all") {
      createNotificationRecord({ title: subject, message: body, type: notificationType, audience: "customer", link: input.link || "", source: "communication", metadata: { communicationId: log.id } });
    } else {
      eligibleCustomers.forEach((customer) => createNotificationRecord({ title: subject, message: body, type: notificationType, recipientEmail: customer.email, link: input.link || "", source: "communication", metadata: { communicationId: log.id } }));
    }
  }
  return clone(log);
}

export async function getCommunicationHistory({ search = "", channel = "All", status = "All" } = {}) {
  const query = String(search || "").trim().toLowerCase();
  return clone(store.communicationHistory || []).filter((item) => {
    const matchesSearch = !query || [item.id, item.subject, item.body, item.audience, item.actor].some((value) => String(value || "").toLowerCase().includes(query));
    return matchesSearch && (channel === "All" || item.channel === channel) && (status === "All" || item.status === status);
  }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

export async function getNotificationsForUser(user = {}) { return getLocalNotificationsForUser(user); }
export async function markNotificationReadForUser(id, user = {}) { return markLocalNotificationRead(id, user); }
export async function markAllNotificationsReadForUser(user = {}) { return markAllLocalNotificationsRead(user); }
