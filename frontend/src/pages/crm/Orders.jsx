import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, RefreshCw, Search, StickyNote, Truck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { crmDataMode, crmOrdersMode, getOrderManagementOrders, getSupportedOrderTransitions, updateOrderFulfillmentStatus, updateOrderPaymentStatus, addOrderInternalNote } from "../../services/crmService";
import { EmptyState, MetricCard, Modal, PageHeader, StatusBadge } from "../../components/crm/CrmUI";

const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);
const dateLabel = (value) => {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const FULFILLMENT_NEXT = {
  Pending: ["Processing", "Cancelled"], Processing: ["Shipped", "Cancelled"], Shipped: ["Delivered"],
  Delivered: ["Return Requested"], "Return Requested": ["Returned"], Cancelled: [], Returned: [],
};
const PAYMENT_STATUSES = ["Pending", "Paid", "Failed", "Refunded", "Pay on delivery", "Not Processed"];
const FULFILLMENT_FILTERS = ["All", ...new Set([...Object.keys(FULFILLMENT_NEXT), "Confirmed", "Refunded"])];
const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

function OrderDetails({ order, onClose, canManage, canSupport, authenticatedRequest, onRefresh, onError, onNotice }) {
  const [nextFulfillment, setNextFulfillment] = useState(order.fulfillmentStatus);
  const [nextPayment, setNextPayment] = useState(order.paymentStatus);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const isApiOrder = order.source === "django-api";
  const allowedNext = isApiOrder ? (getSupportedOrderTransitions(order.fulfillmentStatus) || []) : (FULFILLMENT_NEXT[order.fulfillmentStatus] || []);
  const canRequestReturn = !isApiOrder && canSupport && !canManage && order.fulfillmentStatus === "Delivered";
  useEffect(() => {
    setNextFulfillment(order.fulfillmentStatus);
    setNextPayment(order.paymentStatus);
  }, [order.id, order.fulfillmentStatus, order.paymentStatus]);

  async function runAction(action, callback, message) {
    setSaving(true); setActiveAction(action); onError(""); onNotice("");
    try { await callback(); onNotice(message); await onRefresh(order.id); }
    catch (error) { onError(error.message || "Could not update the order."); }
    finally { setSaving(false); setActiveAction(""); }
  }
  const address = order.address;

  return <Modal title={`Order ${order.id}`} description={isApiOrder ? `Placed ${dateLabel(order.date)} · live Django record · line-item details are not in the current backend model` : `Placed ${dateLabel(order.date)} · ${order.itemCount} item(s)`} onClose={onClose} width="820px">
    <div className="crm-order-detail">
      <div className="crm-order-detail-grid">
        <section className="crm-order-info-box"><h3>Customer</h3><strong>{order.customerName}</strong>{order.customerEmail && <span>{order.customerEmail}</span>}{order.customerPhone && <span>{order.customerPhone}</span>}{order.customerId && <small>Customer ID: {order.customerId}</small>}</section>
        <section className="crm-order-info-box"><h3>Delivery address</h3>{address ? <><strong>{address.name || order.customerName}</strong><span>{[address.line, address.city].filter(Boolean).join(", ") || "Address details not supplied"}</span>{address.phone && <span>{address.phone}</span>}{address.type && <small>{address.type}</small>}</> : <span>{isApiOrder ? "The current Django Order API does not return delivery-address fields." : "Address details are not available for this seeded summary order."}</span>}</section>
      </div>
      <section className="crm-order-detail-section">
        <div className="crm-order-section-title"><h3>Order items</h3><span>{order.itemCount == null ? "Not supplied by API" : `${order.itemCount} unit(s)`}</span></div>
        {order.items.length ? <div className="crm-order-items">{order.items.map((item, index) => <div className="crm-order-item" key={`${order.id}-${item.id || index}`}>
          {item.image ? <img src={item.image} alt="" /> : <span className="crm-order-item-placeholder">IMG</span>}
          <div className="crm-order-item-copy"><strong>{item.name}</strong><span>{item.sku ? `SKU: ${item.sku} · ` : ""}Qty: {item.quantity}</span></div><strong>{money(item.price * item.quantity)}</strong>
        </div>)}</div> : <EmptyState title="Line items unavailable" message={isApiOrder ? "The current Django backend stores the order total and status but does not yet have OrderItem records." : "This seeded CRM summary order did not include its original item-level breakdown."} />}
        <div className="crm-order-totals">{Number.isFinite(Number(order.subtotal)) && <div><span>Subtotal</span><strong>{money(order.subtotal)}</strong></div>}{Number(order.discount) > 0 && <div><span>Discount</span><strong>−{money(order.discount)}</strong></div>}{Number(order.delivery) > 0 && <div><span>Delivery</span><strong>{money(order.delivery)}</strong></div>}<div className="crm-order-grand-total"><span>Order total</span><strong>{money(order.total)}</strong></div></div>
      </section>
      <div className="crm-order-status-grid">
        <section className="crm-order-detail-section"><h3>{isApiOrder ? "Order status" : "Fulfillment"}</h3><StatusBadge status={order.fulfillmentStatus}/>
          {canManage && allowedNext.length > 0 && <><label className="crm-form-field crm-order-control-label"><span>Move order to</span><select value={nextFulfillment} onChange={(event) => setNextFulfillment(event.target.value)}><option value={order.fulfillmentStatus}>{order.fulfillmentStatus} (current)</option>{allowedNext.map((status) => <option key={status}>{status}</option>)}</select></label>
            <button type="button" className="crm-button crm-button-primary" disabled={saving || nextFulfillment === order.fulfillmentStatus} onClick={() => runAction("fulfillment", () => updateOrderFulfillmentStatus(order.apiId || order.id, nextFulfillment, "CRM staff", authenticatedRequest), `${isApiOrder ? "Order status" : "Fulfillment"} updated to ${nextFulfillment}.`)}>{activeAction === "fulfillment" ? "Saving…" : isApiOrder ? "Update order status" : "Update fulfillment"}</button></>}
          {canRequestReturn && <button type="button" className="crm-button crm-button-secondary crm-order-return-button" disabled={saving} onClick={() => runAction("return", () => updateOrderFulfillmentStatus(order.id, "Return Requested", "Support staff"), "Return request recorded in demo data.")}>Request return</button>}
        </section>
        <section className="crm-order-detail-section"><h3>Payment</h3><StatusBadge status={order.paymentStatus}/>
          {isApiOrder ? <p className="crm-order-muted">The current Django Order model does not store payment status separately. Payment edits are disabled to avoid showing an update that was not persisted.</p> : canManage && <><label className="crm-form-field crm-order-control-label"><span>Payment status</span><select value={nextPayment} onChange={(event) => setNextPayment(event.target.value)}>{PAYMENT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
            <button type="button" className="crm-button crm-button-secondary" disabled={saving || nextPayment === order.paymentStatus} onClick={() => runAction("payment", () => updateOrderPaymentStatus(order.id, nextPayment, "CRM staff", authenticatedRequest), `Payment status updated to ${nextPayment}.`)}>{activeAction === "payment" ? "Saving…" : "Update payment"}</button></>}
        </section>
      </div>
      <section className="crm-order-detail-section">
        <div className="crm-order-section-title"><h3><StickyNote size={16}/> Internal notes</h3><span>{isApiOrder ? "Backend support not available" : "CRM staff only in this demo UI"}</span></div>
        {isApiOrder ? <p className="crm-order-muted">The supplied Django backend has no order-notes model or endpoint yet, so notes are disabled for live API orders.</p> : <><form className="crm-order-note-form" onSubmit={(event) => { event.preventDefault(); if (note.trim()) runAction("note", async () => { await addOrderInternalNote(order.id, note, "CRM staff", authenticatedRequest); setNote(""); }, "Internal note added."); }}>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Add a note for the support or operations team…" rows={3}/><button type="submit" className="crm-button crm-button-secondary" disabled={saving || !note.trim()}>{activeAction === "note" ? "Adding…" : "Add note"}</button>
        </form>
        {order.internalNotes.length ? <div className="crm-order-notes-list">{[...order.internalNotes].reverse().map((entry) => <article key={entry.id}><strong>{entry.author || "CRM staff"}</strong><small>{entry.createdAt ? new Date(entry.createdAt).toLocaleString("en-IN") : ""}</small><p>{entry.text}</p></article>)}</div> : <p className="crm-order-muted">No internal notes added.</p>}</>}
      </section>
      {order.statusHistory.length > 0 && <section className="crm-order-detail-section"><h3>Status history</h3><div className="crm-order-history">{[...order.statusHistory].reverse().map((entry, index) => <div key={entry.id || `${entry.at}-${index}`}><span className="crm-order-history-dot"/><div><strong>{entry.type === "payment" ? "Payment" : "Fulfillment"}: {entry.from} → {entry.to}</strong><small>{entry.by || "CRM staff"} · {entry.at ? new Date(entry.at).toLocaleString("en-IN") : ""}</small></div></div>)}</div></section>}
      <div className="crm-form-actions crm-order-modal-footer"><button type="button" className="crm-button crm-button-secondary" onClick={onClose}>Close</button></div>
    </div>
  </Modal>;
}

function Orders() {
  const { user, authenticatedRequest } = useAuth();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [fulfillmentStatus, setFulfillmentStatus] = useState("All");
  const [paymentStatus, setPaymentStatus] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const canManage = ["ADMIN", "CRM_MANAGER"].includes(user?.role);
  const canSupport = ["ADMIN", "CRM_MANAGER", "SUPPORT_AGENT"].includes(user?.role);
  const isApiOrdersMode = crmOrdersMode === "api";
  const availableStatusFilters = isApiOrdersMode
    ? ["All", "Pending", "Confirmed", "Processing", "Shipped", "Delivered", "Cancelled", "Refunded"]
    : FULFILLMENT_FILTERS;

  const loadOrders = useCallback(async () => {
    setLoading(true); setError("");
    try { const result = await getOrderManagementOrders({}, authenticatedRequest); setOrders(Array.isArray(result) ? result : []); }
    catch (loadError) { setError(loadError.message || "Could not load orders. Try again."); }
    finally { setLoading(false); }
  }, [authenticatedRequest]);
  useEffect(() => { loadOrders(); }, [loadOrders, reloadKey]);
  useEffect(() => {
    const refresh = () => setReloadKey((key) => key + 1);
    window.addEventListener("techgear:demo-orders-updated", refresh);
    window.addEventListener("techgear:crm-orders-updated", refresh);
    return () => { window.removeEventListener("techgear:demo-orders-updated", refresh); window.removeEventListener("techgear:crm-orders-updated", refresh); };
  }, []);

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return orders.filter((order) => {
      const searchable = [order.id, order.customerName, order.customerEmail, order.customerPhone, ...(order.items || []).map((item) => item.name)].some((value) => String(value || "").toLowerCase().includes(query));
      return (!query || searchable) && (fulfillmentStatus === "All" || order.fulfillmentStatus === fulfillmentStatus) && (paymentStatus === "All" || order.paymentStatus === paymentStatus) && (!from || order.date >= from) && (!to || order.date <= to);
    });
  }, [orders, search, fulfillmentStatus, paymentStatus, from, to]);
  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId) || null, [orders, selectedOrderId]);
  const metrics = useMemo(() => ({
    all: orders.length,
    needsAction: orders.filter((order) => ["Pending", "Confirmed", "Processing", "Return Requested"].includes(order.fulfillmentStatus)).length,
    paidRevenue: orders.filter((order) => order.paymentStatus === "Paid").reduce((total, order) => total + order.total, 0),
    returns: orders.filter((order) => ["Return Requested", "Returned"].includes(order.fulfillmentStatus)).length,
  }), [orders]);
  async function refreshSelected(id = selectedOrderId) {
    const result = await getOrderManagementOrders({}, authenticatedRequest);
    setOrders(Array.isArray(result) ? result : []);
    if (!result?.some((order) => order.id === id)) setSelectedOrderId("");
  }
  function exportCsv() {
    const rows = [["Order ID", "Date", "Customer", "Email", "Items", "Total INR", "Payment status", isApiOrdersMode ? "Order status" : "Fulfillment status"], ...visibleOrders.map((order) => [order.id, order.date, order.customerName, order.customerEmail, order.itemCount, order.total, order.paymentStatus, order.fulfillmentStatus])];
    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = "crm-orders.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return <div className="crm-page">
    <PageHeader title="Order Management" description={isApiOrdersMode ? "Live Django orders. The supplied backend supports a single order status and total amount; payment, line items, shipping address, notes and returns are not modelled yet." : "Review customer orders, update fulfillment and payment statuses, and record internal operational notes."} action={<button type="button" className="crm-button crm-button-secondary" onClick={exportCsv} disabled={!visibleOrders.length}><Download size={15}/> Export CSV</button>}/>
    {isApiOrdersMode ? <div className="crm-demo-notice">Live API mode · supported order-status changes are saved to Django. Payment updates, line-item details, delivery addresses, internal notes, refunds and return handling are not available from the current backend schema.</div> : crmDataMode === "mock" && <div className="crm-demo-notice">Demo mode · seeded CRM order summaries and checkout orders from this browser are combined here. Status changes and notes stay local; no real payment, shipping or notification is triggered.</div>}
    {notice && <div className="crm-success-banner" role="status">{notice}</div>}{error && <div className="crm-error-banner" role="alert">{error}</div>}
    <div className="crm-metrics-grid">
      <MetricCard label="Total orders" value={metrics.all.toLocaleString("en-IN")} note={isApiOrdersMode ? "Records from Django organization" : "Seeded and browser demo orders"} tone="blue"/>
      <MetricCard label="Needs action" value={metrics.needsAction.toLocaleString("en-IN")} note="Pending, confirmed, processing or return requested" tone="orange"/>
      <MetricCard label="Paid order value" value={isApiOrdersMode ? "Not tracked" : money(metrics.paidRevenue)} note={isApiOrdersMode ? "No separate payment field in backend" : "Orders marked Paid in demo data"} tone="green"/>
      <MetricCard label="Returns" value={isApiOrdersMode ? "Not tracked" : metrics.returns.toLocaleString("en-IN")} note={isApiOrdersMode ? "Returns are not modelled yet" : "Return requests and completed returns"} tone="purple"/>
    </div>
    <section className="crm-card">
      <div className="crm-toolbar crm-orders-toolbar">
        <label className="crm-search-field"><span className="sr-only">Search orders</span><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order ID, customer or product…"/></label>
        <label className="crm-filter-field"><span>{isApiOrdersMode ? "Order status" : "Fulfillment"}</span><select value={fulfillmentStatus} onChange={(event) => setFulfillmentStatus(event.target.value)}>{availableStatusFilters.map((value) => <option key={value}>{value}</option>)}</select></label>
        {!isApiOrdersMode && <label className="crm-filter-field"><span>Payment</span><select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)}>{["All", ...PAYMENT_STATUSES].map((value) => <option key={value}>{value}</option>)}</select></label>}
        <label className="crm-filter-field"><span>From</span><input aria-label="Orders from date" type="date" value={from} onChange={(event) => setFrom(event.target.value)}/></label>
        <label className="crm-filter-field"><span>To</span><input aria-label="Orders to date" type="date" value={to} onChange={(event) => setTo(event.target.value)}/></label>
        <button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => { setSearch(""); setFulfillmentStatus("All"); setPaymentStatus("All"); setFrom(""); setTo(""); }}><RefreshCw size={13}/> Clear</button>
        <span className="crm-result-count">{visibleOrders.length} of {orders.length} orders</span>
      </div>
      {loading ? <div className="crm-loading">Loading orders…</div> : visibleOrders.length === 0 ? <EmptyState title="No orders found" message="Try another order ID, customer name, status or date range."/> : <div className="crm-table-wrap"><table className="crm-table crm-orders-table">
        <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>{isApiOrdersMode ? "Payment (N/A)" : "Payment"}</th><th>{isApiOrdersMode ? "Order status" : "Fulfillment"}</th><th>Details</th></tr></thead>
        <tbody>{visibleOrders.map((order) => <tr key={order.id}><td><strong className="crm-strong-cell">{order.id}</strong>{order.demoOnly && <small className="crm-cell-subtext">Browser demo</small>}</td><td><div className="crm-order-customer-cell"><strong>{order.customerName}</strong><small>{order.customerEmail || order.customerPhone || "Customer details unavailable"}</small></div></td><td>{dateLabel(order.date)}</td><td>{order.itemCount == null ? (isApiOrdersMode ? "Not supplied" : 0) : order.itemCount}</td><td className="crm-strong-cell">{money(order.total)}</td><td><StatusBadge status={order.paymentStatus}/></td><td><StatusBadge status={order.fulfillmentStatus}/></td><td><button type="button" className="crm-button crm-button-small crm-button-secondary" onClick={() => { setSelectedOrderId(order.id); setError(""); setNotice(""); }}><Eye size={13}/> View</button></td></tr>)}</tbody>
      </table></div>}
    </section>
    <p className="crm-footnote"><Truck size={13} inline/> {isApiOrdersMode ? "Order-status changes are saved to Django. No courier booking, payment capture, refund, note persistence or customer notification is triggered by this frontend." : "Order status changes here are a mock workflow. No courier booking, payment capture, refund or customer notification is triggered."}</p>
    {selectedOrder && <OrderDetails key={`${selectedOrder.id}-${selectedOrder.fulfillmentStatus}-${selectedOrder.paymentStatus}`} order={selectedOrder} onClose={() => setSelectedOrderId("")} canManage={canManage} canSupport={canSupport} authenticatedRequest={authenticatedRequest} onRefresh={refreshSelected} onError={setError} onNotice={setNotice}/>}
  </div>;
}

export default Orders;
