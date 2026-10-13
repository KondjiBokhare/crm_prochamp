import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getOrderManagementOrders, crmReturnsMode } from "../../services/crmService";
import { createOrderReturn, getOrderReturns, updateOrderReturnStatus } from "../../services/crmOrderOperationsApiService";
import { EmptyState, MetricCard, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";

const REASONS = ["DAMAGED", "DEFECTIVE", "WRONG_ITEM", "NOT_AS_DESCRIBED", "CHANGE_OF_MIND", "OTHER"];
const STATUSES = ["REQUESTED", "APPROVED", "REJECTED", "ITEM_RECEIVED", "REFUND_PENDING", "CLOSED"];
const NEXT_STATUSES = { REQUESTED: ["APPROVED", "REJECTED"], APPROVED: ["ITEM_RECEIVED", "CLOSED"], REJECTED: ["CLOSED"], ITEM_RECEIVED: ["REFUND_PENDING", "CLOSED"], REFUND_PENDING: ["CLOSED"], CLOSED: [] };
const label = (value) => String(value || "—").replaceAll("_", " ");
const dateLabel = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function Returns() {
  const { authenticatedRequest } = useAuth();
  const [orders, setOrders] = useState([]); const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ orderId: "", reason: "DAMAGED", description: "" });
  const [drafts, setDrafts] = useState({}); const [search, setSearch] = useState(""); const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(async () => {
    if (crmReturnsMode !== "api") { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [orderRows, returnRows] = await Promise.all([getOrderManagementOrders({}, authenticatedRequest), getOrderReturns({ search, status: statusFilter }, authenticatedRequest)]);
      setOrders(orderRows.filter((order) => order.apiId)); setRows(returnRows);
      setForm((current) => ({ ...current, orderId: current.orderId || String(orderRows.find((order) => order.apiId)?.apiId || "") }));
      setDrafts(Object.fromEntries(returnRows.map((row) => [row.id, { status: row.status, resolutionNote: row.resolutionNote || "" }])));
    } catch (err) { setError(err?.message || "Could not load return requests."); }
    finally { setLoading(false); }
  }, [authenticatedRequest, search, statusFilter, reloadToken]);
  useEffect(() => { refresh(); }, [refresh]);

  const metrics = useMemo(() => ({ total: rows.length, review: rows.filter((row) => row.status === "REQUESTED").length, approved: rows.filter((row) => row.status === "APPROVED" || row.status === "ITEM_RECEIVED").length, refundPending: rows.filter((row) => row.status === "REFUND_PENDING").length }), [rows]);

  async function submit(event) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!form.orderId) throw new Error("Choose an existing Django order first.");
      await createOrderReturn(form, authenticatedRequest);
      setNotice("Return request recorded in Django. No refund or customer notification was triggered.");
      setForm((current) => ({ ...current, description: "" })); setReloadToken((value) => value + 1);
    } catch (err) { setError(err?.message || "Could not create return request."); }
    finally { setSaving(false); }
  }

  async function saveStatus(row) {
    const draft = drafts[row.id] || { status: row.status, resolutionNote: row.resolutionNote || "" };
    if (draft.status === row.status && draft.resolutionNote === row.resolutionNote) return;
    setError(""); setNotice(""); setSaving(true);
    try {
      await updateOrderReturnStatus(row.id, draft, authenticatedRequest);
      setNotice(`Return request #${row.id} updated to ${label(draft.status)}.`); setReloadToken((value) => value + 1);
    } catch (err) { setError(err?.message || "Could not update return status."); }
    finally { setSaving(false); }
  }

  return <div className="crm-page">
    <PageHeader title="Returns & RMA" description="Record and manage return requests against existing orders. Statuses are internal workflow only; no payment gateway or refund API is connected." action={<button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => setReloadToken((value) => value + 1)}><RefreshCw size={13}/> Refresh</button>} />
    {crmReturnsMode !== "api" && <div className="crm-demo-notice">API mode is not enabled. Add VITE_CRM_RETURNS_MODE=api to frontend/.env.local and restart Vite.</div>}
    <div className="crm-demo-notice">This staff-only screen records a return request for an existing Django order. It is not a customer return portal, and “Refund pending” does not send money.</div>
    {notice && <div className="crm-success-banner" role="status">{notice}</div>}{error && <div className="crm-error-banner" role="alert">{error}</div>}
    <div className="crm-metrics-grid"><MetricCard label="Return requests" value={metrics.total} note="Saved in Django" tone="blue"/><MetricCard label="Needs review" value={metrics.review} note="Newly recorded requests" tone="orange"/><MetricCard label="Approved / received" value={metrics.approved} note="Return workflow in progress" tone="green"/><MetricCard label="Refund pending" value={metrics.refundPending} note="Manual finance action required" tone="purple"/></div>
    <SectionCard title="Record a return request" subtitle="Select an order from this organization's Django order list.">
      <form className="crm-form" onSubmit={submit}><div className="crm-form-grid">
        <label className="crm-form-field"><span>Order *</span><select required value={form.orderId} onChange={(event) => setForm({ ...form, orderId: event.target.value })}><option value="">Select order</option>{orders.map((order) => <option key={order.apiId} value={order.apiId}>{order.orderNumber || order.id} · {order.customerName} · ₹{order.total.toLocaleString("en-IN")}</option>)}</select></label>
        <label className="crm-form-field"><span>Return reason *</span><select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}>{REASONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
        <label className="crm-form-field crm-comm-span-two"><span>Description</span><textarea maxLength={4000} rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the issue or customer request…"/></label>
      </div><div className="crm-form-actions"><button className="crm-button crm-button-primary" type="submit" disabled={saving || loading || !orders.length}><ClipboardList size={14}/>{saving ? "Saving…" : "Record return request"}</button></div></form>
    </SectionCard>
    <SectionCard title="Return request queue" subtitle="Only allowed status transitions can be saved. The timeline records each update.">
      <div className="crm-toolbar"><label className="crm-search-field"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, reason or description…"/></label><label className="crm-filter-field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option>{STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><span className="crm-result-count">{rows.length} requests</span></div>
      {loading ? <div className="crm-loading">Loading returns…</div> : rows.length === 0 ? <EmptyState title="No return requests" message="Record a return request for an existing order to begin the queue."/> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Request</th><th>Order / customer</th><th>Reason</th><th>Status</th><th>Resolution note</th><th>Updated</th><th>Save</th></tr></thead><tbody>{rows.map((row) => { const draft = drafts[row.id] || { status: row.status, resolutionNote: row.resolutionNote || "" }; const options = [...new Set([row.status, ...(NEXT_STATUSES[row.status] || [])])]; return <tr key={row.id}><td><strong>RET-{row.id}</strong><small>{dateLabel(row.createdAt)}</small></td><td><strong>{row.orderNumber}</strong><small>{row.customerName}</small></td><td><strong>{label(row.reason)}</strong><small>{row.description || "No description"}</small></td><td><StatusBadge status={label(row.status)}/><select aria-label={`Return ${row.id} next status`} value={draft.status} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, status: event.target.value } }))}>{options.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></td><td><textarea aria-label={`Return ${row.id} resolution note`} rows={2} maxLength={4000} value={draft.resolutionNote} onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: { ...draft, resolutionNote: event.target.value } }))}/></td><td>{dateLabel(row.updatedAt)}</td><td><button className="crm-button crm-button-secondary crm-button-small" type="button" disabled={saving || (draft.status === row.status && draft.resolutionNote === row.resolutionNote)} onClick={() => saveStatus(row)}>Save</button></td></tr>; })}</tbody></table></div>}
    </SectionCard>
  </div>;
}
