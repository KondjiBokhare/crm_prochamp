// Demo notification store shared by customer storefront and CRM workspace.
// Production notifications should be loaded from the authenticated backend API.
const STORAGE_KEY = "techgear_notifications_v1";
const CHANGE_EVENT = "techgear:notifications-updated";
const MAX_NOTIFICATIONS = 500;
const PREFERENCES_PREFIX = "techgear_notification_preferences_v1:";
const DEFAULT_PREFERENCES = { emailNotifications: true, smsNotifications: true, whatsappNotifications: true, marketingNotifications: false };

function safeRead() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_NOTIFICATIONS)));
  } catch {
    // UI still works in memory for the current read if storage is unavailable.
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}


function preferenceStorageKey(user = {}) {
  const identity = String(user.email || user.id || user.role || "anonymous").trim().toLowerCase();
  return `${PREFERENCES_PREFIX}${encodeURIComponent(identity)}`;
}

export function getNotificationPreferences(user = {}) {
  if (typeof window === "undefined") return { ...DEFAULT_PREFERENCES };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(preferenceStorageKey(user)) || "{}");
    return { ...DEFAULT_PREFERENCES, ...(parsed && typeof parsed === "object" ? parsed : {}) };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function saveNotificationPreferences(user = {}, patch = {}) {
  const next = { ...getNotificationPreferences(user), ...patch };
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(preferenceStorageKey(user), JSON.stringify(next)); } catch { /* keep in memory for this call */ }
    window.dispatchEvent(new Event("techgear:notification-preferences-updated"));
  }
  return next;
}

export function notificationUserKey(user = {}) {
  const email = String(user.email || "").trim().toLowerCase();
  if (email) return `email:${email}`;
  return `role:${String(user.role || "ANONYMOUS").toUpperCase()}:${String(user.id || "unknown")}`;
}

function matchesUser(item, user = {}) {
  const role = String(user.role || "").toUpperCase();
  const email = String(user.email || "").trim().toLowerCase();
  const explicitEmails = Array.isArray(item.recipientEmails) ? item.recipientEmails.map((v) => String(v).toLowerCase()) : [];
  if (item.recipientEmail) return email && String(item.recipientEmail).toLowerCase() === email;
  if (explicitEmails.length) return email && explicitEmails.includes(email);
  if (Array.isArray(item.recipientRoles) && item.recipientRoles.length) return item.recipientRoles.map((v) => String(v).toUpperCase()).includes(role);
  if (item.recipientRole) return String(item.recipientRole).toUpperCase() === role;
  if (item.audience === "customer") return role === "CUSTOMER";
  if (item.audience === "crm") return role && role !== "CUSTOMER";
  return item.audience === "all" || !item.audience;
}

function withReadState(item, user) {
  const key = notificationUserKey(user);
  const readBy = Array.isArray(item.readBy) ? item.readBy : (item.read ? [key] : []);
  const time = item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Just now";
  return { ...item, read: readBy.includes(key), time };
}

export function getAllNotificationRecords() {
  if (typeof window === "undefined") return [];
  return safeRead();
}

export function getNotificationsForUser(user = {}) {
  if (typeof window === "undefined") return [];
  const preferences = getNotificationPreferences(user);
  return safeRead()
    .filter((item) => matchesUser(item, user))
    .filter((item) => !(String(user.role || "").toUpperCase() === "CUSTOMER" && item.type === "offer" && !preferences.marketingNotifications))
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    .map((item) => withReadState(item, user));
}

export function createNotificationRecord(input = {}) {
  if (typeof window === "undefined") return null;
  const title = String(input.title || "Update").trim();
  const message = String(input.message || "").trim();
  if (!title || !message) return null;
  const all = safeRead();
  const record = {
    id: input.id || `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title,
    message,
    type: input.type || "general",
    audience: input.audience || "all",
    recipientEmail: input.recipientEmail ? String(input.recipientEmail).trim().toLowerCase() : "",
    recipientEmails: Array.isArray(input.recipientEmails) ? input.recipientEmails.map((v) => String(v).trim().toLowerCase()).filter(Boolean) : [],
    recipientRole: input.recipientRole || "",
    recipientRoles: Array.isArray(input.recipientRoles) ? input.recipientRoles.map((v) => String(v).toUpperCase()) : [],
    link: input.link || "",
    source: input.source || "system",
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    createdAt: input.createdAt || new Date().toISOString(),
    readBy: [],
  };
  all.unshift(record);
  persist(all);
  return withReadState(record, { email: record.recipientEmail, role: record.recipientRole || (record.audience === "customer" ? "CUSTOMER" : "ANONYMOUS") });
}

export function markNotificationReadForUser(id, user = {}) {
  if (typeof window === "undefined") return [];
  const key = notificationUserKey(user);
  const all = safeRead().map((item) => {
    if (String(item.id) !== String(id) || !matchesUser(item, user)) return item;
    const readBy = Array.isArray(item.readBy) ? item.readBy : [];
    return { ...item, readBy: readBy.includes(key) ? readBy : [...readBy, key] };
  });
  persist(all);
  return getNotificationsForUser(user);
}

export function markAllNotificationsReadForUser(user = {}) {
  if (typeof window === "undefined") return [];
  const key = notificationUserKey(user);
  const all = safeRead().map((item) => {
    if (!matchesUser(item, user)) return item;
    const readBy = Array.isArray(item.readBy) ? item.readBy : (item.read ? [key] : []);
    return { ...item, readBy: readBy.includes(key) ? readBy : [...readBy, key] };
  });
  persist(all);
  return getNotificationsForUser(user);
}

export function clearNotificationsForUser(user = {}) {
  if (typeof window === "undefined") return [];
  persist(safeRead().filter((item) => !matchesUser(item, user)));
  return [];
}

export function subscribeToNotificationChanges(callback) {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => callback?.();
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) callback?.();
  };
  window.addEventListener(CHANGE_EVENT, onCustom);
  window.addEventListener("techgear:notification-preferences-updated", onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onCustom);
    window.removeEventListener("techgear:notification-preferences-updated", onCustom);
    window.removeEventListener("storage", onStorage);
  };
}
