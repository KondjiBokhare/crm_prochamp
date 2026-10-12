const CUSTOMER_ROOT = "/api/crm/customers/";

function requireRequest(authenticatedRequest) {
  if (typeof authenticatedRequest !== "function") {
    throw new Error("Customer profile details require an authenticated CRM session.");
  }
  return authenticatedRequest;
}

export async function getCustomerProfileOverview(customerId, authenticatedRequest) {
  const request = requireRequest(authenticatedRequest);
  return request(`${CUSTOMER_ROOT}${encodeURIComponent(customerId)}/profile-overview/`, { method: "GET" });
}

export async function getCustomerProfileImage(customerId, authenticatedBlobRequest) {
  if (typeof authenticatedBlobRequest !== "function") {
    throw new Error("A signed-in CRM session is required to view the customer's profile image.");
  }
  return authenticatedBlobRequest(`${CUSTOMER_ROOT}${encodeURIComponent(customerId)}/profile-image/`);
}
