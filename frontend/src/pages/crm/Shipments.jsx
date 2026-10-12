import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Truck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getOrderManagementOrders } from "../../services/crmService";
import { crmShipmentsMode } from "../../services/crmService";
import { createOrderShipment, getOrderShipments, updateOrderShipment } from "../../services/crmOrderOperationsApiService";
import { EmptyState, MetricCard, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";

const STATUS_OPTIONS = ["PREPARING", "LABEL_CREATED", "IN_TRANSIT", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION", "RETURN_TO_SENDER"];
const label = (value) => String(value || "—").replaceAll("_", " ");
const dateLabel = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const initialForm = () => ({ orderId: "", carrier: "", trackingNumber: "", trackingUrl: "", estimatedDelivery: "" });

export default function Shipments() {
  const { authenticatedRequest } = useAuth();
  const [orders, setOrders] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [draftStatuses, setDraftStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(async () => {
    if (crmShipmentsMode !== "api") { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [orderRows, shipmentRows] = await Promise.all([
        getOrderManagementOrders({}, authenticatedRequest),
        getOrderShipments({ search, status: statusFilter }, authenticatedRequest),
      ]);
      setOrders(orderRows.filter((order) => order.apiId));
      setShipments(shipmentRows);
      setForm((current) => ({ ...current, orderId: current.orderId || String(orderRows.find((order) => order.apiId)?.apiId || "") }));
      setDraftStatuses(Object.fromEntries(shipmentRows.map((row) => [row.id, row.status])));
    } catch (err) { setError(err?.message || "Could not load shipment records."); }
    finally { setLoading(false); }
  }, [authenticatedRequest, search, statusFilter, reloadToken]);
  useEffect(() => { refresh(); }, [refresh]);

  const metrics = useMemo(() => ({
    total: shipments.length,
    moving: shipments.filter((item) => ["LABEL_CREATED", "IN_TRANSIT", "OUT_FOR_DELIVERY"].includes(item.status)).length,
    delivered: shipments.filter((item) => item.status === "DELIVERED").length,
    exceptions: shipments.filter((item) => ["EXCEPTION", "RETURN_TO_SENDER"].includes(item.status)).length,
  }), [shipments]);

  async function submit(event) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!form.orderId) throw new Error("Choose an existing Django order first.");
      await createOrderShipment(form, authenticatedRequest);
      setNotice("Shipment record saved. Carrier updates must be maintained manually until a courier integration is configured.");
      setForm((current) => ({ ...initialForm(), orderId: current.orderId }));
      setReloadToken((value) => value + 1);
    } catch (err) { setError(err?.message || "Could not create shipment record."); }
    finally { setSaving(false); }
  }

  async function saveStatus(row) {
    const next = draftStatuses[row.id] || row.status;
    if (next === row.status) return;
    setError(""); setNotice(""); setSaving(true);
    try {
      await updateOrderShipment(row.id, { status: next }, authenticatedRequest);
      setNotice(`Shipment ${row.trackingNumber} updated to ${label(next)}.`);
      setReloadToken((value) => value + 1);
    } catch (err) { setError(err?.message || "Could not update shipment status."); }
    finally { setSaving(false); }
  }

  return <div className="crm-page">
    <PageHeader title="Shipment Tracking" description="Maintain organization-scoped shipment/tracking records against existing Django orders. Statuses are staff-updated; no courier API is connected." action={<button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => setReloadToken((value) => value + 1)}><RefreshCw size={13}/> Refresh</button>} />
    {crmShipmentsMode !== "api" && <div className="crm-demo-notice">API mode is not enabled. Add VITE_CRM_SHIPMENTS_MODE=api to frontend/.env.local and restart Vite.</div>}
    {notice && <div className="crm-success-banner" role="status">{notice}</div>}{error && <div className="crm-error-banner" role="alert">{error}</div>}
    <div className="crm-metrics-grid"><MetricCard label="Shipment records" value={metrics.total} note="Saved in Django" tone="blue"/><MetricCard label="In transit" value={metrics.moving} note="Label created, in transit or out for delivery" tone="orange"/><MetricCard label="Delivered" value={metrics.delivered} note="Manually marked delivered" tone="green"/><MetricCard label="Exceptions" value={metrics.exceptions} note="Delivery exception or return to sender" tone="purple"/></div>
    <SectionCard title="Create a shipment record" subtitle="This records carrier information only. It does not book a courier pickup or generate a shipping label.">
      <form className="crm-form" onSubmit={submit}><div className="crm-form-grid">
        <label className="crm-form-field"><span>Order *</span><select required value={form.orderId} onChange={(event) => setForm({ ...form, orderId: event.target.value })}><option value="">Select order</option>{orders.map((order) => <option key={order.apiId} value={order.apiId}>{order.orderNumber || order.id} · {order.customerName} · ₹{order.total.toLocaleString("en-IN")}</option>)}</select></label>
        <label className="crm-form-field"><span>Courier / carrier *</span><input required maxLength={100} value={form.carrier} onChange={(event) => setForm({ ...form, carrier: event.target.value })} placeholder="e.g. Delhivery, Blue Dart"/></label>
        <label className="crm-form-field"><span>Tracking number *</span><input required maxLength={120} value={form.trackingNumber} onChange={(event) => setForm({ ...form, trackingNumber: event.target.value })} placeholder="AWB / tracking ID"/></label>
        <label className="crm-form-field"><span>Tracking URL</span><input type="url" value={form.trackingUrl} onChange={(event) => setForm({ ...form, trackingUrl: event.target.value })} placeholder="https://carrier.example/track/…"/></label>
        <label className="crm-form-field"><span>Estimated delivery</span><input type="date" value={form.estimatedDelivery} onChange={(event) => setForm({ ...form, estimatedDelivery: event.target.value })}/></label>
      </div><div className="crm-form-actions"><button className="crm-button crm-button-primary" type="submit" disabled={saving || loading || !orders.length}><Truck size={14}/>{saving ? "Saving…" : "Save shipment"}</button></div></form>
    </SectionCard>
    <SectionCard title="Shipment records" subtitle="Status changes are also written to the order activity timeline.">
      <div className="crm-toolbar"><label className="crm-search-field"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, carrier or tracking number…"/></label><label className="crm-filter-field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option>{STATUS_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><span className="crm-result-count">{shipments.length} records</span></div>
      {loading ? <div className="crm-loading">Loading shipments…</div> : shipments.length === 0 ? <EmptyState title="No shipment records" message="Create a shipment record after selecting an order."/> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Order / customer</th><th>Carrier / tracking</th><th>Status</th><th>ETA</th><th>Created</th><th>Update status</th></tr></thead><tbody>{shipments.map((row) => <tr key={row.id}><td><strong>{row.orderNumber}</strong><small>{row.customerName}</small></td><td><strong>{row.carrier}</strong><small>{row.trackingUrl ? <a href={row.trackingUrl} target="_blank" rel="noreferrer">{row.trackingNumber}</a> : row.trackingNumber}</small></td><td><StatusBadge status={label(row.status)}/></td><td>{row.estimatedDelivery || "—"}</td><td>{dateLabel(row.createdAt)}</td><td><div className="crm-inline-actions"><select aria-label={`Shipment ${row.id} status`} value={draftStatuses[row.id] || row.status} onChange={(event) => setDraftStatuses((current) => ({ ...current, [row.id]: event.target.value }))}>{STATUS_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select><button className="crm-button crm-button-small crm-button-secondary" type="button" onClick={() => saveStatus(row)} disabled={saving || (draftStatuses[row.id] || row.status) === row.status}>Save</button></div></td></tr>)}</tbody></table></div>}
    </SectionCard>
  </div>;
}
