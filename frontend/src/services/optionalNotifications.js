export async function loadOptionalNotifications(load) {
  try {
    const rows = await load();
    return {
      rows: Array.isArray(rows) ? rows : [],
      error: "",
    };
  } catch (error) {
    return {
      rows: [],
      error: error?.message || "CRM notifications are temporarily unavailable.",
    };
  }
}
