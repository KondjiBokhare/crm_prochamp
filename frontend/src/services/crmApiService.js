// Real API adapter. Endpoint paths and response shapes are proposed in
// docs/CRM_FRONTEND_API_CONTRACT.md and must be agreed with the backend team.
import { analyticsRequest, djangoRequest } from "./crmApiClient";

export async function getCustomers(params = {}) {
  const result = await djangoRequest("/customers", { query: params });
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}

export function createCustomer(input) {
  const tags = Array.isArray(input.tags)
    ? input.tags
    : String(input.tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
  return djangoRequest("/customers", {
    method: "POST",
    body: { ...input, tags },
  });
}

export function getCustomerById(id) {
  return djangoRequest(`/customers/${encodeURIComponent(id)}`);
}

export async function getCustomerOrders(customerId) {
  const result = await djangoRequest(`/customers/${encodeURIComponent(customerId)}/orders`);
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}

export async function getOrderManagementOrders(params = {}) {
  const result = await djangoRequest("/orders", { query: params });
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}

export function getManagedOrderById(id) {
  return djangoRequest(`/orders/${encodeURIComponent(id)}`);
}

export function updateOrderFulfillmentStatus(id, status) {
  return djangoRequest(`/orders/${encodeURIComponent(id)}/fulfillment-status`, { method: "PATCH", body: { fulfillmentStatus: status } });
}

export function updateOrderPaymentStatus(id, status) {
  return djangoRequest(`/orders/${encodeURIComponent(id)}/payment-status`, { method: "PATCH", body: { paymentStatus: status } });
}

export function addOrderInternalNote(id, text) {
  return djangoRequest(`/orders/${encodeURIComponent(id)}/notes`, { method: "POST", body: { text } });
}

export function getDashboardData() {
  return djangoRequest("/crm/dashboard/summary");
}

export async function getInteractions(params = {}) {
  const result = await djangoRequest("/interactions", { query: params });
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}

export function updateInteractionStatus(id, status) {
  return djangoRequest(`/interactions/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status },
  });
}

// Proposed customer-support API contract. Confirm paths and request shapes with the backend team.
export async function getSupportTickets(params = {}) {
  const result = await djangoRequest("/support/tickets", { query: params });
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}

export function getSupportTicketById(id) {
  return djangoRequest(`/support/tickets/${encodeURIComponent(id)}`);
}

export async function getMySupportTickets() {
  const result = await djangoRequest("/support/tickets/my");
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}

export function getMySupportTicketById(id) {
  return djangoRequest(`/support/tickets/my/${encodeURIComponent(id)}`);
}

export function createMySupportTicket(input) {
  return djangoRequest("/support/tickets/my", { method: "POST", body: input });
}

export function addMySupportTicketReply(id, text) {
  return djangoRequest(`/support/tickets/my/${encodeURIComponent(id)}/messages`, { method: "POST", body: { text } });
}

export function createSupportTicket(input) {
  return djangoRequest("/support/tickets", { method: "POST", body: input });
}

export function updateSupportTicketStatus(id, status) {
  return djangoRequest(`/support/tickets/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } });
}

export function updateSupportTicketPriority(id, priority) {
  return djangoRequest(`/support/tickets/${encodeURIComponent(id)}/priority`, { method: "PATCH", body: { priority } });
}

export function assignSupportTicket(id, assignedTo) {
  return djangoRequest(`/support/tickets/${encodeURIComponent(id)}/assignment`, { method: "PATCH", body: { assignedTo } });
}

export function addSupportTicketMessage(id, text, author, isInternal = false) {
  return djangoRequest(`/support/tickets/${encodeURIComponent(id)}/messages`, { method: "POST", body: { text, isInternal } });
}

export async function getSegments() {
  const result = await djangoRequest("/segments");
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}

export function createSegment(input) {
  return djangoRequest("/segments", { method: "POST", body: input });
}

export async function getCampaigns(params = {}) {
  const result = await djangoRequest("/campaigns", { query: params });
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}

export function createCampaign(input) {
  return djangoRequest("/campaigns", { method: "POST", body: input });
}

export function simulateCampaignLaunch(id) {
  // In API mode this requests a real backend state transition. No email/SMS is
  // sent by the frontend; backend policy/provider determines campaign execution.
  return djangoRequest(`/campaigns/${encodeURIComponent(id)}/launch`, { method: "POST", body: {} });
}

export function getAnalyticsData({ from = "", to = "" } = {}) {
  return analyticsRequest("/analytics/overview", { query: { from, to } });
}


// Banner-management endpoints are proposed and must be agreed with the Django team.
export async function getBanners(params = {}) {
  const result = await djangoRequest("/banners", { query: params });
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}

export function createBanner(input) {
  return djangoRequest("/banners", { method: "POST", body: input });
}

export function updateBanner(id, input) {
  return djangoRequest(`/banners/${encodeURIComponent(id)}`, { method: "PATCH", body: input });
}

export function setBannerStatus(id, status) {
  return djangoRequest(`/banners/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } });
}

export async function getStorefrontBanners({ placement = "All" } = {}) {
  const result = await djangoRequest("/storefront/banners", { query: { placement } });
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}

export function recordBannerImpression(id) {
  return djangoRequest(`/storefront/banners/${encodeURIComponent(id)}/impression`, { method: "POST", body: {} });
}

export function recordBannerClick(id) {
  return djangoRequest(`/storefront/banners/${encodeURIComponent(id)}/click`, { method: "POST", body: {} });
}


// Proposed Lead Management API contract; confirm these paths with the Django team.
export async function getLeads(params = {}) {
  const result = await djangoRequest("/leads", { query: params });
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}

export function createLead(input) {
  return djangoRequest("/leads", { method: "POST", body: input });
}

export function updateLead(id, input) {
  return djangoRequest(`/leads/${encodeURIComponent(id)}`, { method: "PATCH", body: input });
}

export function updateLeadStatus(id, status) {
  return djangoRequest(`/leads/${encodeURIComponent(id)}/status`, { method: "PATCH", body: { status } });
}

export function assignLead(id, assignedTo) {
  return djangoRequest(`/leads/${encodeURIComponent(id)}/assignment`, { method: "PATCH", body: { assignedTo } });
}

export function addLeadFollowUp(id, input) {
  return djangoRequest(`/leads/${encodeURIComponent(id)}/follow-ups`, { method: "POST", body: input });
}

export function convertLead(id) {
  return djangoRequest(`/leads/${encodeURIComponent(id)}/convert`, { method: "POST", body: {} });
}


// Communications and in-app notification endpoints. Confirm exact paths and
// provider/scheduling behavior with the backend team before enabling API mode.
export async function getCommunicationTemplates(params = {}) {
  const result = await djangoRequest("/communications/templates", { query: params });
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}
export function createCommunicationTemplate(input) {
  return djangoRequest("/communications/templates", { method: "POST", body: input });
}
export function updateCommunicationTemplate(id, input) {
  return djangoRequest(`/communications/templates/${encodeURIComponent(id)}`, { method: "PATCH", body: input });
}
export function deleteCommunicationTemplate(id) {
  return djangoRequest(`/communications/templates/${encodeURIComponent(id)}`, { method: "DELETE" });
}
export async function getCommunicationHistory(params = {}) {
  const result = await djangoRequest("/communications/history", { query: params });
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}
export function dispatchCommunication(input) {
  return djangoRequest("/communications/send", { method: "POST", body: input });
}
export async function getNotificationsForUser() {
  const result = await djangoRequest("/notifications");
  return Array.isArray(result) ? result : result?.items || result?.results || [];
}
export function markNotificationReadForUser(id) {
  return djangoRequest(`/notifications/${encodeURIComponent(id)}/read`, { method: "POST", body: {} });
}
export function markAllNotificationsReadForUser() {
  return djangoRequest("/notifications/read-all", { method: "POST", body: {} });
}
