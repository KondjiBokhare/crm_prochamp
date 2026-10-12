import { mapApiSupportTicket } from "./crmSupportApiService";

const configuredSupportMode = String(import.meta.env.VITE_STOREFRONT_SUPPORT_MODE || "").trim().toLowerCase();
const storefrontAccountApiEnabled = String(import.meta.env.VITE_STOREFRONT_ACCOUNT_MODE || "").trim().toLowerCase() === "api";
export const storefrontSupportApiEnabled = configuredSupportMode
  ? configuredSupportMode === "api"
  : storefrontAccountApiEnabled;
const TICKETS_PATH = "/api/storefront/account/support-tickets/";

function requireRequest(authenticatedRequest) {
  if (!storefrontSupportApiEnabled) throw new Error("Storefront Support API mode is disabled. Set VITE_STOREFRONT_SUPPORT_MODE=api and restart Vite.");
  if (typeof authenticatedRequest !== "function") throw new Error("Sign in with your registered customer account to access support tickets.");
  return authenticatedRequest;
}

function unwrap(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

export async function getMySupportTickets(authenticatedRequest) {
  const result = await requireRequest(authenticatedRequest)(TICKETS_PATH, { method: "GET" });
  return unwrap(result).map(mapApiSupportTicket);
}

export async function getMySupportTicketById(id, authenticatedRequest) {
  const raw = await requireRequest(authenticatedRequest)(`${TICKETS_PATH}${encodeURIComponent(id)}/`, { method: "GET" });
  return raw ? mapApiSupportTicket(raw) : null;
}

export async function createMySupportTicket(input = {}, authenticatedRequest) {
  const raw = await requireRequest(authenticatedRequest)(TICKETS_PATH, {
    method: "POST",
    body: {
      subject: String(input.subject || "").trim(),
      category: String(input.category || "Other"),
      orderId: String(input.orderId || "").trim(),
      description: String(input.description || input.message || "").trim(),
    },
  });
  return mapApiSupportTicket(raw);
}

export async function addMySupportTicketReply(id, text, authenticatedRequest) {
  const raw = await requireRequest(authenticatedRequest)(`${TICKETS_PATH}${encodeURIComponent(id)}/messages/`, {
    method: "POST",
    body: { text: String(text || "").trim() },
  });
  return mapApiSupportTicket(raw);
}

export async function importLegacyMySupportTickets(tickets = [], email = "", authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  const targetEmail = String(email || "").trim().toLowerCase();
  const matching = (Array.isArray(tickets) ? tickets : []).filter((ticket) => String(ticket.customerEmail || ticket.customer_email || "").trim().toLowerCase() === targetEmail);
  if (!matching.length) return { created: 0, duplicates: 0, skipped: 0 };
  return request(`${TICKETS_PATH}import-legacy/`, { method: "POST", body: { tickets: matching } });
}
