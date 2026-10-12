// Shared HTTP client for Django CRM APIs and the FastAPI analytics service.
// The access token is deliberately kept in memory. Wire setCrmAccessToken from
// AuthContext after the real login/refresh flow is agreed with the backend team.
const DJANGO_API_BASE_URL = String(import.meta.env.VITE_DJANGO_API_BASE_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
const ANALYTICS_API_BASE_URL = String(import.meta.env.VITE_FASTAPI_ANALYTICS_BASE_URL || "http://localhost:8001").replace(/\/$/, "");

let accessToken = null;

export function setCrmAccessToken(token) {
  accessToken = token ? String(token) : null;
}

export function clearCrmAccessToken() {
  accessToken = null;
}

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "All") {
      query.set(key, String(value));
    }
  });
  const encoded = query.toString();
  return encoded ? `?${encoded}` : "";
}

async function request(baseUrl, path, options = {}) {
  const { query, body, headers: customHeaders, ...init } = options;
  const headers = new Headers(customHeaders || {});
  headers.set("Accept", "application/json");

  if (body !== undefined) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let response;
  try {
    response = await fetch(`${baseUrl}${path}${buildQuery(query)}`, {
      ...init,
      method: init.method || (body === undefined ? "GET" : "POST"),
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new Error("Could not reach the API. Check the backend URL and whether the service is running.", { cause: error });
  }

  if (response.status === 204) return null;

  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      throw new Error(`The API returned a non-JSON response (HTTP ${response.status}).`);
    }
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.detail || payload?.message || `API request failed (HTTP ${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.error?.code || payload?.code || (response.status === 401 ? "UNAUTHENTICATED" : "API_ERROR");
    error.details = payload?.error?.details || payload?.errors || null;
    throw error;
  }

  // Contract standardizes success as { data: ... }; allow bare responses during
  // development so small endpoints can be adopted without frontend rewrites.
  return payload && Object.prototype.hasOwnProperty.call(payload, "data") ? payload.data : payload;
}

export function djangoRequest(path, options = {}) {
  return request(DJANGO_API_BASE_URL, path, options);
}

export function analyticsRequest(path, options = {}) {
  return request(ANALYTICS_API_BASE_URL, path, options);
}

export { buildQuery };
