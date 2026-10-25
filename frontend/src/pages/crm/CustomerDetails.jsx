import { useCallback, useEffect,   useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CreditCard, Eye, MapPin, MessageSquare, Clock3, Package,  RefreshCw, Truck, RotateCcw } from "lucide-react";
import { crmCustomersMode, getCustomerById, getCustomerOrders, updateCustomer } from "../../services/crmService";
import { getCustomerProfileOverview, getCustomerProfileImage } from "../../services/customerProfileApiService";
import { useAuth } from "../../context/AuthContext";
import { EmptyState, MetricCard, Modal, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";

const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(amount || 0));
const dateLabel = (value, withTime = false) => {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString("en-IN", withTime
    ? { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "2-digit", month: "short", year: "numeric" });
};
const nameInitials = (name = "Customer") => String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "C";
const toEditForm = (customer) => ({
  name: customer?.name || "", email: customer?.email || "", phone: customer?.phone || "",
  city: customer?.city || "", tags: (customer?.tags || []).join(", "), status: customer?.status || "Active",
  lifecycleStage: customer?.lifecycleStage || "CUSTOMER",
});
const genderLabels = { UNSPECIFIED: "Not specified", FEMALE: "Female", MALE: "Male", NON_BINARY: "Non-binary", PREFER_NOT_TO_SAY: "Prefer not to say" };

function DetailValue({ label, children }) {
  return <div className="crm-c360-value"><span>{label}</span><strong>{children || "—"}</strong></div>;
}

function CustomerDetails() {
  const { id } = useParams();
  const { user, authenticatedRequest, authenticatedBlobRequest } = useAuth();
  const isCustomerApiMode = crmCustomersMode === "api";
  const canManageCustomers = isCustomerApiMode ? ["ADMIN", "SALES"].includes(user?.backendRole) : ["ADMIN", "CRM_MANAGER"].includes(user?.role);
  const [customer, setCustomer] = useState(null);
  const [overview, setOverview] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoadError, setOrdersLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(toEditForm(null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setOrdersLoadError("");
    const requests = isCustomerApiMode
      ? Promise.all([
          getCustomerById(id, authenticatedRequest),
          getCustomerProfileOverview(id, authenticatedRequest).catch((err) => {
            if (active) setOrdersLoadError(err.message || "Some customer profile sections could not be loaded.");
            return null;
          }),
        ])
      : Promise.all([
          getCustomerById(id, authenticatedRequest),
          getCustomerOrders(id, authenticatedRequest).then((rows) => ({ orders: rows })).catch((err) => {
            if (active) setOrdersLoadError(err.message || "Order history is unavailable.");
            return null;
          }),
        ]);
    requests
      .then(([customerResult, overviewResult]) => {
        if (!active) return;
        setCustomer(customerResult);
        setOverview(overviewResult);
        const orderRows = Array.isArray(overviewResult?.orders) ? overviewResult.orders : [];
        setOrders(orderRows);
        if (customerResult) setEditForm(toEditForm(customerResult));
      })
      .catch((err) => { if (active) setError(err.message || "Could not load this customer profile."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, authenticatedRequest, reloadKey, isCustomerApiMode]);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    if (isCustomerApiMode && overview?.profileImageAvailable && typeof authenticatedBlobRequest === "function") {
      getCustomerProfileImage(id, authenticatedBlobRequest)
        .then((blob) => {
          if (!active) return;
          objectUrl = URL.createObjectURL(blob);
          setProfileImageUrl(objectUrl);
        })
        .catch(() => { if (active) setProfileImageUrl(""); });
    } else {
      setProfileImageUrl("");
    }
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, isCustomerApiMode, overview?.profileImageAvailable, authenticatedBlobRequest]);

  const handleEditChange = useCallback((field, value) => setEditForm((previous) => ({ ...previous, [field]: value })), []);

  async function handleUpdate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await updateCustomer(id, editForm, authenticatedRequest);
      setShowEdit(false);
      setNotice(isCustomerApiMode ? "Customer record updated in Django." : "Customer record updated in demo data.");
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(err.message || "Could not update this customer.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshOverview() {
    setRefreshing(true);
    setError("");
    try {
      setReloadKey((value) => value + 1);
    } finally {
      window.setTimeout(() => setRefreshing(false), 350);
    }
  }

  const profile = overview?.profile || null;
  const addresses = overview?.addresses || [];
  const tickets = overview?.supportTickets || [];
  const interactions = overview?.interactions || [];
  const activity = overview?.activity || [];
  const deliveredOrders = orders.filter((order) => String(order.status || order.fulfillmentStatus || "").toUpperCase() === "DELIVERED");
  const apiOrderSpend = deliveredOrders.reduce((total, order) => total + Number(order.total || 0), 0);

  const initials = nameInitials(customer?.name);

  if (loading) return <div className="crm-loading">Loading customer 360° profile…</div>;
  if (!customer) return <div className="crm-page"><PageHeader title="Customer not found" description={error || "This ID does not match a customer available to your account."} /><EmptyState title="No customer record" message={isCustomerApiMode ? "Confirm the customer belongs to your organization and your account has permission to view it." : "Return to the customer list and choose a customer from the demo dataset."} /><Link className="crm-button crm-button-primary" to="/crm/customers">Back to customers</Link></div>;

  return (
    <div className="crm-page crm-customer-360">
      <PageHeader eyebrow="CUSTOMER 360° PROFILE" title={customer.name} description={`${customer.email} · Customer #${customer.id}`} action={<div className="crm-inline-actions">{isCustomerApiMode && <button type="button" className="crm-button crm-button-secondary" onClick={refreshOverview} disabled={refreshing}><RefreshCw size={14} className={refreshing ? "crm-spin-icon" : ""}/> Refresh</button>}{canManageCustomers && <button type="button" className="crm-button crm-button-primary" onClick={() => { setEditForm(toEditForm(customer)); setError(""); setShowEdit(true); }}>Edit customer</button>}<Link className="crm-button crm-button-secondary" to="/crm/customers">← All customers</Link></div>} />
      {notice && <div className="crm-success-banner" role="status">{notice}</div>}
      {error && <div className="crm-error-banner" role="alert">{error}</div>}
      {isCustomerApiMode && <div className="crm-info-banner">Live customer data · address, order, support and activity records are restricted to your organization. Sensitive card/UPI credentials are never shown.</div>}

      <div className="crm-profile-summary crm-card crm-c360-summary">
        <div className="crm-c360-avatar">{profileImageUrl ? <img src={profileImageUrl} alt={`${customer.name} profile`} /> : <span>{initials}</span>}</div>
        <div className="crm-profile-main"><h2>{customer.name}</h2><p>{customer.email}</p><p>{profile?.phone || customer.phone || "No phone recorded"}</p><div className="crm-tag-list"><span className="crm-tag">{customer.lifecycleStage || "CUSTOMER"}</span>{profile?.gender && profile.gender !== "UNSPECIFIED" && <span className="crm-tag">{genderLabels[profile.gender] || profile.gender}</span>}{profileImageUrl && <span className="crm-tag">Profile photo</span>}</div></div>
        <div className="crm-c360-summary-status"><StatusBadge status={customer.status} /><small>Customer since {dateLabel(customer.joinedAt || overview?.customer?.joinedAt || overview?.customer?.accountCreatedAt)}</small></div>
      </div>

      <div className="crm-metrics-grid crm-metrics-three">
        <MetricCard label={isCustomerApiMode ? "Realized spend (delivered orders)" : "Lifetime spend (sample)"} value={isCustomerApiMode ? money(apiOrderSpend) : money(customer.totalSpend)} note={isCustomerApiMode ? "Calculated from delivered orders" : "Sample customer record"} tone="green" />
        <MetricCard label="Total orders" value={isCustomerApiMode ? orders.length : customer.totalOrders} note={isCustomerApiMode ? "Orders associated with this customer" : "Customer profile count"} tone="blue" />
        <MetricCard label="Support tickets" value={isCustomerApiMode ? tickets.length : "—"} note={isCustomerApiMode ? "Customer's tickets and replies" : "Not available in demo profile"} tone="purple" />
      </div>

      <SectionCard title="Personal details" subtitle="Account identity, saved details and communication preferences">
        {isCustomerApiMode ? profile ? <div className="crm-c360-detail-grid">
          <DetailValue label="Full name">{[profile.firstName, profile.lastName].filter(Boolean).join(" ") || customer.name}</DetailValue>
          <DetailValue label="Email address">{profile.email || customer.email}</DetailValue>
          <DetailValue label="Mobile number">{profile.phone || customer.phone || "Not provided"}</DetailValue>
          <DetailValue label="Date of birth">{dateLabel(profile.dateOfBirth)}</DetailValue>
          <DetailValue label="Gender">{genderLabels[profile.gender] || profile.gender || "Not specified"}</DetailValue>
          <DetailValue label="Email updates">{profile.emailUpdates == null ? "Not saved" : profile.emailUpdates ? "Enabled" : "Disabled"}</DetailValue>
          <DetailValue label="SMS updates">{profile.smsUpdates == null ? "Not saved" : profile.smsUpdates ? "Enabled" : "Disabled"}</DetailValue>
          <DetailValue label="WhatsApp updates">{profile.whatsappUpdates == null ? "Not saved" : profile.whatsappUpdates ? "Enabled" : "Disabled"}</DetailValue>
          <DetailValue label="Account registered">{dateLabel(overview?.customer?.accountCreatedAt)}</DetailValue>
          <DetailValue label="Most recent login">{dateLabel(overview?.customer?.lastLoginAt, true)}</DetailValue>
          <DetailValue label="Profile last updated">{dateLabel(profile.updatedAt, true)}</DetailValue>
        </div> : <EmptyState title="No linked storefront profile" message="This CRM customer has no storefront account linked in the same organization." /> : <div className="crm-c360-detail-grid"><DetailValue label="Phone">{customer.phone}</DetailValue><DetailValue label="Joined">{dateLabel(customer.joinedAt)}</DetailValue></div>}
      </SectionCard>

      <SectionCard title="Saved addresses" subtitle="Delivery and other addresses saved in the customer's account">
        {!isCustomerApiMode ? <EmptyState title="API mode required" message="Saved addresses are only available when the storefront account API is connected." /> : addresses.length === 0 ? <EmptyState title="No saved addresses" message="The customer has not saved an address in their storefront account." /> : <div className="crm-c360-address-grid">{addresses.map((address) => <article className="crm-c360-address-card" key={address.id}><div className="crm-c360-address-head"><span className="crm-c360-address-icon"><MapPin size={18}/></span><div><strong>{address.labelDisplay || address.label || "Address"}</strong>{address.isDefault && <span className="crm-c360-default-pill">Default</span>}</div></div><p><strong>{address.fullName}</strong> · {address.phone}</p><p>{address.addressLine1}{address.addressLine2 ? `, ${address.addressLine2}` : ""}</p><p>{address.city}, {address.state} {address.postalCode}</p><p>{address.country}</p><small>Updated {dateLabel(address.updatedAt, true)}</small></article>)}</div>}
      </SectionCard>

      <SectionCard title="Saved payment methods" subtitle="Only provider-tokenized or masked payment metadata may be stored and viewed here">
        {Array.isArray(overview?.savedPaymentMethods) && overview.savedPaymentMethods.length ? <div className="crm-c360-payment-list">{overview.savedPaymentMethods.map((method) => <article className="crm-c360-payment-card" key={method.id}><CreditCard size={21}/><div><strong>{method.label || method.brand || method.type}</strong><p>{method.maskedDetails || (method.lastFour ? `•••• ${method.lastFour}` : "Masked payment reference")}</p><small>{method.isDefault ? "Default method" : "Saved method"}</small></div></article>)}</div> : <div className="crm-c360-payment-empty"><CreditCard size={22}/><div><strong>No saved payment instruments</strong><p>{overview?.paymentMethodsNotice || "The current storefront does not have payment tokenization enabled. No card number, CVV, or full UPI credentials are stored."}</p></div></div>}
        {orders.some((order) => order.paymentMethod) && <div className="crm-c360-order-payment-summary"><strong>Payment options recorded on orders</strong><p>{[...new Set(orders.map((order) => order.paymentMethod).filter((value) => value && value !== "Not recorded"))].join(" · ") || "No payment option recorded"}</p><small>These are checkout selections, not saved payment methods or proof that payment was processed.</small></div>}
      </SectionCard>

      <SectionCard title="Order history" subtitle={isCustomerApiMode ? "Select any order to open its full snapshot, address, items and payment status" : "Sample orders linked to this customer"}>
        {ordersLoadError && isCustomerApiMode && <div className="crm-error-banner" role="alert">{ordersLoadError}</div>}
        {orders.length === 0 ? <EmptyState title="No orders found" message={isCustomerApiMode ? "No order is currently linked to this CRM customer in the backend." : "No matching order is available in demo data."} /> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Fulfillment</th><th>Details</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id || order.orderNumber}><td className="crm-strong-cell">{order.orderNumber || order.id}{order.demoOnly && <small className="crm-cell-subtext">Imported demo order</small>}</td><td>{dateLabel(order.date || order.order_date)}</td><td>{Array.isArray(order.items) && order.items.length ? order.items.reduce((total, item) => total + Number(item.quantity || 1), 0) : "—"}</td><td className="crm-strong-cell">{money(order.total ?? order.amount)}</td><td><StatusBadge status={order.paymentStatus || "Not tracked"}/><small className="crm-cell-subtext">{order.paymentMethod || "Not recorded"}</small></td><td><StatusBadge status={order.status || order.fulfillmentStatus}/></td><td><button type="button" className="crm-button crm-button-small crm-button-secondary" onClick={() => setSelectedOrder(order)}><Eye size={13}/> View details</button></td></tr>)}</tbody></table></div>}
      </SectionCard>

      <SectionCard title="Support tickets" subtitle="Tickets raised by the customer, including replies and current status">
        {tickets.length === 0 ? <EmptyState title="No support tickets" message="No support tickets are linked to this customer account." /> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Ticket</th><th>Subject</th><th>Priority</th><th>Status</th><th>Created</th><th>Conversation</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td className="crm-strong-cell">{ticket.id}</td><td>{ticket.subject}<small className="crm-cell-subtext">{ticket.category || "Other"}{ticket.orderId ? ` · Order ${ticket.orderId}` : ""}</small></td><td><StatusBadge status={ticket.priority}/></td><td><StatusBadge status={ticket.status}/></td><td>{dateLabel(ticket.createdAt)}</td><td><button type="button" className="crm-button crm-button-small crm-button-secondary" onClick={() => setSelectedTicket(ticket)}><MessageSquare size={13}/> {ticket.messages?.length || 0} replies</button></td></tr>)}</tbody></table></div>}
      </SectionCard>

      <SectionCard title="Customer interactions" subtitle="Recorded calls, emails, meetings, WhatsApp, notes and follow-ups">
        {interactions.length === 0 ? <EmptyState title="No interactions recorded" message="New CRM interactions will appear here when a staff member logs a customer contact or note." /> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Type</th><th>Subject</th><th>Notes</th><th>Date</th><th>Logged by</th></tr></thead><tbody>{interactions.map((item) => <tr key={item.id}><td><StatusBadge status={item.typeDisplay || item.type}/></td><td className="crm-strong-cell">{item.subject}</td><td>{item.description || "—"}</td><td>{dateLabel(item.date, true)}</td><td>{item.createdBy || "—"}</td></tr>)}</tbody></table></div>}
      </SectionCard>

      <SectionCard title="Customer activity & log history" subtitle="Combined account, order, support, address, interaction and CRM audit events">
        {activity.length === 0 ? <EmptyState title="No activity recorded" message="As new orders, profile updates, support tickets and CRM interactions are saved, they will appear here." /> : <ol className="crm-c360-timeline">{activity.map((event) => <li className="crm-c360-timeline-item" key={event.id}><span className="crm-c360-timeline-marker"><Clock3 size={14}/></span><div className="crm-c360-timeline-content"><div className="crm-c360-timeline-heading"><strong>{event.title}</strong><time>{dateLabel(event.date, true)}</time></div><p>{event.description || "Activity recorded."}</p><span className="crm-c360-event-type">{String(event.kind || "activity").replaceAll("-", " ")}</span></div></li>)}</ol>}
      </SectionCard>

      {showEdit && <Modal title="Edit customer" description={isCustomerApiMode ? "Updates the CRM customer record. Storefront personal details remain customer-managed." : "Update the customer profile in demo data."} onClose={() => setShowEdit(false)}>
        <form className="crm-form" onSubmit={handleUpdate}>
          <div className="crm-form-grid">
            <label className="crm-form-field"><span>Full name *</span><input required maxLength={100} value={editForm.name} onChange={(event) => handleEditChange("name", event.target.value)} /></label>
            <label className="crm-form-field"><span>Email address *</span><input required type="email" maxLength={150} value={editForm.email} onChange={(event) => handleEditChange("email", event.target.value)} /></label>
            <label className="crm-form-field"><span>Phone</span><input type="tel" maxLength={30} value={editForm.phone} onChange={(event) => handleEditChange("phone", event.target.value)} /></label>
            <label className="crm-form-field"><span>Status</span><select value={editForm.status} onChange={(event) => handleEditChange("status", event.target.value)}><option>Active</option><option>Inactive</option></select></label>
            {isCustomerApiMode && <label className="crm-form-field"><span>Lifecycle stage</span><select value={editForm.lifecycleStage} onChange={(event) => handleEditChange("lifecycleStage", event.target.value)}><option value="VISITOR">Visitor</option><option value="LEAD">Lead</option><option value="CUSTOMER">Customer</option><option value="REPEAT">Repeat customer</option><option value="LOYAL">Loyal customer</option></select></label>}
            {!isCustomerApiMode && <><label className="crm-form-field"><span>City</span><input maxLength={80} value={editForm.city} onChange={(event) => handleEditChange("city", event.target.value)} /></label><label className="crm-form-field"><span>Tags</span><input value={editForm.tags} onChange={(event) => handleEditChange("tags", event.target.value)} /></label></>}
          </div>
          {error && <div className="crm-error-banner" role="alert">{error}</div>}
          <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={() => setShowEdit(false)}>Cancel</button><button type="submit" className="crm-button crm-button-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></div>
        </form>
      </Modal>}

      {selectedOrder && <Modal title={`Order ${selectedOrder.orderNumber || selectedOrder.id}`} description={`Placed ${dateLabel(selectedOrder.date || selectedOrder.order_date, true)} · ${selectedOrder.source === "legacy-browser-demo" || selectedOrder.demoOnly ? "Historical browser-demo order" : "Customer order record"}`} onClose={() => setSelectedOrder(null)} width="960px">
        <div className="crm-c360-modal-body">
          <div className="crm-c360-detail-grid"><DetailValue label="Order total">{money(selectedOrder.total ?? selectedOrder.amount)}</DetailValue><DetailValue label="Order status">{selectedOrder.status || selectedOrder.fulfillmentStatus || "—"}</DetailValue><DetailValue label="Payment method">{selectedOrder.paymentMethod || "Not recorded"}</DetailValue><DetailValue label="Payment status">{selectedOrder.paymentStatus || "Not tracked by backend"}</DetailValue><DetailValue label="Subtotal">{selectedOrder.subtotal == null ? "—" : money(selectedOrder.subtotal)}</DetailValue><DetailValue label="Discount">{selectedOrder.discount == null ? "—" : money(selectedOrder.discount)}</DetailValue><DetailValue label="Coupon">{selectedOrder.couponCode || "None"}</DetailValue><DetailValue label="Delivery fee">{selectedOrder.delivery == null ? "—" : money(selectedOrder.delivery)}</DetailValue></div>
          <h3 className="crm-c360-subheading"><Package size={17}/> Items</h3>
          {selectedOrder.items?.length ? <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Product</th><th>SKU</th><th>Unit price</th><th>Qty</th><th>Line total</th></tr></thead><tbody>{selectedOrder.items.map((item, index) => <tr key={`${item.id || item.sku || item.name}-${index}`}><td><div className="crm-c360-order-product">{item.image && <img src={item.image} alt="" loading="lazy"/>}<div><strong>{item.name || "Product"}</strong>{item.specs && <small>{item.specs}</small>}</div></div></td><td>{item.sku || "—"}</td><td>{money(item.price)}</td><td>{item.quantity || 1}</td><td>{money(item.lineTotal ?? (Number(item.price || 0) * Number(item.quantity || 1)))}</td></tr>)}</tbody></table></div> : <EmptyState title="No line-item snapshot" message="This older or staff-created order does not have product-level details stored."/>}
          <h3 className="crm-c360-subheading"><MapPin size={17}/> Delivery address snapshot</h3>
          {selectedOrder.address && Object.keys(selectedOrder.address).length ? <div className="crm-c360-address-snapshot"><strong>{selectedOrder.address.name || selectedOrder.address.fullName || "Recipient"}</strong><p>{selectedOrder.address.phone || ""}</p><p>{selectedOrder.address.line || [selectedOrder.address.addressLine1, selectedOrder.address.addressLine2].filter(Boolean).join(", ")}</p><p>{[selectedOrder.address.city, selectedOrder.address.state, selectedOrder.address.postal_code || selectedOrder.address.postalCode, selectedOrder.address.country].filter(Boolean).join(", ")}</p></div> : <p className="crm-muted-text">No delivery address snapshot stored.</p>}
          <h3 className="crm-c360-subheading"><Truck size={17}/> Shipment & tracking</h3>
          {selectedOrder.shipments?.length ? <div className="crm-c360-linked-records">{selectedOrder.shipments.map((shipment) => <article className="crm-c360-linked-record" key={shipment.id}><div><strong>{shipment.carrier || "Carrier not recorded"}</strong><p>Tracking: {shipment.trackingNumber || "Not recorded"}</p><p>Estimated delivery: {dateLabel(shipment.estimatedDelivery)}</p><p>Last updated: {dateLabel(shipment.updatedAt, true)}</p>{shipment.trackingUrl && <a href={shipment.trackingUrl} target="_blank" rel="noreferrer">Open carrier tracking</a>}</div><StatusBadge status={shipment.status}/></article>)}</div> : <p className="crm-muted-text">No shipment record is linked to this order yet.</p>}
          <h3 className="crm-c360-subheading"><RotateCcw size={17}/> Returns & refund requests</h3>
          {selectedOrder.returns?.length ? <div className="crm-c360-linked-records">{selectedOrder.returns.map((returnItem) => <article className="crm-c360-linked-record" key={returnItem.id}><div><strong>Return #{returnItem.id} · {returnItem.reason || "Other"}</strong><p>{returnItem.description || "No additional reason provided."}</p>{returnItem.resolutionNote && <p>Resolution: {returnItem.resolutionNote}</p>}<small>Updated {dateLabel(returnItem.updatedAt, true)}</small></div><StatusBadge status={returnItem.status}/></article>)}</div> : <p className="crm-muted-text">No return or refund request is linked to this order.</p>}
          {selectedOrder.demoOnly && <div className="crm-info-banner">This is a historical demo order. The record does not prove that payment was processed or that a shipment was booked.</div>}
        </div>
      </Modal>}

      {selectedTicket && <Modal title={`Support ticket ${selectedTicket.id}`} description={selectedTicket.subject} onClose={() => setSelectedTicket(null)} width="840px">
        <div className="crm-c360-modal-body"><div className="crm-c360-detail-grid"><DetailValue label="Category">{selectedTicket.category}</DetailValue><DetailValue label="Priority">{selectedTicket.priority}</DetailValue><DetailValue label="Status">{selectedTicket.status}</DetailValue><DetailValue label="Order reference">{selectedTicket.orderId}</DetailValue><DetailValue label="Created">{dateLabel(selectedTicket.createdAt, true)}</DetailValue><DetailValue label="Last updated">{dateLabel(selectedTicket.updatedAt, true)}</DetailValue></div><h3 className="crm-c360-subheading"><MessageSquare size={17}/> Initial request</h3><div className="crm-c360-ticket-message"><strong>{customer.name}</strong><p>{selectedTicket.description || "No description was saved."}</p></div><h3 className="crm-c360-subheading">Conversation & internal notes</h3>{selectedTicket.messages?.length ? <div className="crm-c360-ticket-thread">{selectedTicket.messages.map((message) => <article className={`crm-c360-ticket-message ${message.isInternal ? "is-internal" : ""}`} key={message.id}><div><strong>{message.author || "Support"}</strong><time>{dateLabel(message.createdAt, true)}</time></div>{message.isInternal && <span className="crm-c360-event-type">Internal note</span>}<p>{message.text}</p></article>)}</div> : <EmptyState title="No replies yet" message="The ticket has not received any additional messages."/>}</div>
      </Modal>}
    </div>
  );
}

export default CustomerDetails;
