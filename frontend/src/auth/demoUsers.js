// Production does not contain built-in CRM demo accounts.
// All staff authentication must use the Django API.

export const DEMO_USERS = [];

export function authenticateDemoCrmUser() {
  return null;
}

export function getAvailableCrmLoginUsers() {
  return [];
}