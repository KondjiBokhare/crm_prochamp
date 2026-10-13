import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquareText, RefreshCw } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getOrderManagementOrders, crmOrderActivityMode } from "../../services/crmService";
import { createOrderActivity, getOrderActivity } from "../../services/crmOrderOperationsApiService";
import { EmptyState, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";

const label = (value) => String(value || "—").replaceAll("_", " ");
const dateLabel = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export default function OrderActivity() {
  const { authenticatedRequest } = useAuth();
  const [orders, setOrders] = useState([]); const [orderId, setOrderId] = useState(""); const [events, setEvents] = useState([]);
  const [eventType, setEventType] = useState("NOTE"); const [message, setMessage] = useState(""); const [typeFilter, setTypeFilter] = useState("All");
  const [loadingOrders, setLoadingOrders] = useState(true); const [loadingEvents, setLoadingEvents] = useState(false); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reloadToken, setReloadToken] = useState(0);

  const loadOrders = useCallback(async () => {
    if (crmOrderActivityMode !== "api") { setLoadingOrders(false); return; }
    setLoadingOrders(true); setError("");
    try { const result = await getOrderManagementOrders({}, authenticatedRequest); const rows = result.filter((row) => row.apiId); setOrders(rows); setOrderId((current) => current || String(rows[0]?.apiId || "")); }
    catch (err) { setError(err?.message || "Could not load orders."); }
    finally { setLoadingOrders(false); }
  }, [authenticatedRequest]);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  const loadEvents = useCallback(async () => {
    if (crmOrderActivityMode !== "api" || !orderId) { setEvents([]); return; }
    setLoadingEvents(true); setError("");
    try { setEvents(await getOrderActivity({ orderId: Number(orderId), eventType: typeFilter }, authenticatedRequest)); }
    catch (err) { setError(err?.message || "Could not load order activity."); }
    finally { setLoadingEvents(false); }
  }, [authenticatedRequest, orderId, typeFilter, reloadToken]);
  useEffect(() => { loadEvents(); }, [loadEvents]);

  const selectedOrder = useMemo(() => orders.find((order) => String(order.apiId) === String(orderId)), [orders, orderId]);
  async function submit(event) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!orderId) throw new Error("Choose an order first.");
      await createOrderActivity({ orderId: Number(orderId), eventType, message }, authenticatedRequest);
      setMessage(""); setNotice("Order activity saved to Django."); setReloadToken((value) => value + 1);
    } catch (err) { setError(err?.message || "Could not save order activity."); }
    finally { setSaving(false); }
  }

  return <div className="crm-page">
    <PageHeader title="Order Activity Timeline" description="Review shipment and return status changes and record durable internal notes or customer-contact events for existing orders." action={<button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => setReloadToken((value) => value + 1)}><RefreshCw size={13}/> Refresh timeline</button>} />
    {crmOrderActivityMode !== "api" && <div className="crm-demo-notice">API mode is not enabled. Add VITE_CRM_ORDER_ACTIVITY_MODE=api to frontend/.env.local and restart Vite.</div>}
    {notice && <div className="crm-success-banner" role="status">{notice}</div>}{error && <div className="crm-error-banner" role="alert">{error}</div>}
    <SectionCard title="Choose order" subtitle="Timeline is scoped to the selected order in your organization.">
      <div className="crm-form-grid"><label className="crm-form-field"><span>Order *</span><select value={orderId} onChange={(event) => setOrderId(event.target.value)} disabled={loadingOrders}><option value="">Select order</option>{orders.map((order) => <option key={order.apiId} value={order.apiId}>{order.orderNumber || order.id} · {order.customerName}</option>)}</select></label><label className="crm-form-field"><span>Filter events</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All</option><option value="NOTE">Internal note</option><option value="CUSTOMER_CONTACT">Customer contact</option><option value="SHIPMENT">Shipment update</option><option value="RETURN">Return update</option><option value="STATUS">Order status</option></select></label></div>
      {selectedOrder && <p className="crm-footnote">Selected: <strong>{selectedOrder.orderNumber || selectedOrder.id}</strong> · {selectedOrder.customerName} · ₹{selectedOrder.total.toLocaleString("en-IN")}</p>}
    </SectionCard>
    <SectionCard title="Add timeline entry" subtitle="Use an internal note for operational context or customer contact to log a call/email without implying a message was sent.">
      <form className="crm-form" onSubmit={submit}><div className="crm-form-grid"><label className="crm-form-field"><span>Event type</span><select value={eventType} onChange={(event) => setEventType(event.target.value)}><option value="NOTE">Internal note</option><option value="CUSTOMER_CONTACT">Customer contact</option></select></label><label className="crm-form-field crm-comm-span-two"><span>Message *</span><textarea maxLength={2000} rows={3} required value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Add order note or contact summary…"/></label></div><div className="crm-form-actions"><button className="crm-button crm-button-primary" type="submit" disabled={saving || loadingOrders || !orderId}><MessageSquareText size={14}/>{saving ? "Saving…" : "Add activity"}</button></div></form>
    </SectionCard>
    <SectionCard title="Activity history" subtitle={`${events.length} events for ${selectedOrder?.orderNumber || "selected order"}. Shipment and return API updates appear here automatically.`}>
      {loadingEvents ? <div className="crm-loading">Loading timeline…</div> : events.length === 0 ? <EmptyState title="No activity recorded yet" message="Shipment and return updates will create events automatically. You can also add an internal note above."/> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>When</th><th>Event</th><th>Message</th><th>Actor</th><th>Details</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{dateLabel(event.createdAt)}</td><td><StatusBadge status={label(event.eventType)}/></td><td>{event.message}</td><td>{event.actorEmail}</td><td>{event.metadata && Object.keys(event.metadata).length ? Object.entries(event.metadata).map(([key, value]) => `${label(key)}: ${String(value)}`).join(" · ") : "—"}</td></tr>)}</tbody></table></div>}
    </SectionCard>
  </div>;
}
