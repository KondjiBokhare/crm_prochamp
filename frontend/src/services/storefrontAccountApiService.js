const ACCOUNT_MODE = String(import.meta.env.VITE_STOREFRONT_ACCOUNT_MODE || "demo").trim().toLowerCase();
export const isStorefrontAccountApiEnabled = ACCOUNT_MODE === "api";

function requireRequest(authenticatedRequest) {
  if (!isStorefrontAccountApiEnabled) {
    throw new Error("Storefront account API mode is disabled. Set VITE_STOREFRONT_ACCOUNT_MODE=api and restart Vite.");
  }
  if (typeof authenticatedRequest !== "function") {
    throw new Error("Sign in with a customer account to manage your profile and addresses.");
  }
}

export async function getCustomerProfile(authenticatedRequest) {
  requireRequest(authenticatedRequest);
  return authenticatedRequest("/api/storefront/account/profile/");
}

export async function updateCustomerProfile(changes, authenticatedRequest) {
  requireRequest(authenticatedRequest);
  return authenticatedRequest("/api/storefront/account/profile/", { method: "PATCH", body: changes });
}

export async function getCustomerAddresses(authenticatedRequest) {
  requireRequest(authenticatedRequest);
  const result = await authenticatedRequest("/api/storefront/account/addresses/");
  return Array.isArray(result) ? result : (Array.isArray(result?.results) ? result.results : []);
}

export async function createCustomerAddress(address, authenticatedRequest) {
  requireRequest(authenticatedRequest);
  return authenticatedRequest("/api/storefront/account/addresses/", { method: "POST", body: address });
}

export async function updateCustomerAddress(id, changes, authenticatedRequest) {
  requireRequest(authenticatedRequest);
  return authenticatedRequest(`/api/storefront/account/addresses/${encodeURIComponent(id)}/`, { method: "PATCH", body: changes });
}

export async function deleteCustomerAddress(id, authenticatedRequest) {
  requireRequest(authenticatedRequest);
  return authenticatedRequest(`/api/storefront/account/addresses/${encodeURIComponent(id)}/`, { method: "DELETE" });
}

export async function getCustomerPaymentMethods(authenticatedRequest) {
  requireRequest(authenticatedRequest);
  const result = await authenticatedRequest("/api/storefront/account/payment-methods/");
  return Array.isArray(result) ? result : (Array.isArray(result?.results) ? result.results : []);
}

export async function createCustomerPaymentMethod(paymentMethod, authenticatedRequest) {
  requireRequest(authenticatedRequest);
  return authenticatedRequest("/api/storefront/account/payment-methods/", { method: "POST", body: paymentMethod });
}

export async function updateCustomerPaymentMethod(id, changes, authenticatedRequest) {
  requireRequest(authenticatedRequest);
  return authenticatedRequest(`/api/storefront/account/payment-methods/${encodeURIComponent(id)}/`, { method: "PATCH", body: changes });
}

export async function deleteCustomerPaymentMethod(id, authenticatedRequest) {
  requireRequest(authenticatedRequest);
  return authenticatedRequest(`/api/storefront/account/payment-methods/${encodeURIComponent(id)}/`, { method: "DELETE" });
}
