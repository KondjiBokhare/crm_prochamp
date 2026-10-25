import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, Clock3, Headphones, MessageSquare, Plus, Send } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { addMySupportTicketReply, createMySupportTicket, getMySupportTickets, getMySupportTicketById, getLocalMySupportTickets, importLegacyMySupportTickets, storefrontSupportMode } from "../../services/crmService";
import { Modal, StatusBadge } from "../../components/crm/CrmUI";

const CATEGORIES = ["Order", "Delivery", "Payment", "Product", "Warranty", "Returns & Refunds", "Account", "Other"];
const dateLabel = (value) => value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function NewTicketForm({ user, authenticatedRequest, onClose, onCreated, onError }) {
  const [subject, setSubject] = useState(""); const [category, setCategory] = useState("Order"); const [orderId, setOrderId] = useState(""); const [description, setDescription] = useState(""); const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault(); setSaving(true); onError("");
    try { const ticket = await createMySupportTicket({ subject, category, orderId, description }, user, authenticatedRequest); await onCreated(ticket); }
    catch (error) { onError(error.message || "Could not create the support ticket."); }
    finally { setSaving(false); }
  }
  return <Modal title="Create a support ticket" description="Tell us what you need help with. You can follow replies from this page." onClose={onClose} width="640px">
    <form className="support-customer-form" onSubmit={submit}>
      <label><span>Subject *</span><input required minLength={4} maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="For example, delivery is delayed"/></label>
      <div className="support-customer-form-row"><label><span>Category *</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Order ID (optional)</span><input value={orderId} onChange={(event) => setOrderId(event.target.value)} maxLength={60} placeholder="e.g. TG-2048"/></label></div>
      <label><span>Describe the issue *</span><textarea required minLength={10} maxLength={2000} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Include any relevant details…"/></label>
      <p className="support-customer-form-footnote">Signed in as {user?.email || "your customer account"}. Do not include passwords or payment card details.</p>
      <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="crm-button crm-button-primary" disabled={saving}>{saving ? "Submitting…" : "Submit ticket"}</button></div>
    </form>
  </Modal>;
}

function CustomerTicketDetails({ ticket: initialTicket, user, authenticatedRequest, onClose, onUpdated, onError }) {
  const [ticket, setTicket] = useState(initialTicket); const [reply, setReply] = useState(""); const [saving, setSaving] = useState(false);

  async function submitReply(event) {
    event.preventDefault(); if (!reply.trim()) return; setSaving(true); onError("");
    try { await addMySupportTicketReply(ticket.id, reply, user, authenticatedRequest); setReply(""); const fresh = await getMySupportTicketById(ticket.id, user?.email, authenticatedRequest); if (fresh) setTicket(fresh); await onUpdated(); }
    catch (error) { onError(error.message || "Could not send your reply."); }
    finally { setSaving(false); }
  }
  // The initial request is already shown in the separate "Your request" block.
  // Later public replies belong in the conversation thread below.
  const publicMessages = (ticket.messages || []).filter((entry) => !entry.isInternal && !entry.isInitialRequest);
  return <Modal title={`Ticket ${ticket.id}`} description={ticket.subject} onClose={onClose} width="700px">
    <div className="support-customer-ticket-detail">
      <div className="support-customer-detail-meta"><span>{ticket.category}{ticket.orderId ? ` · Order ${ticket.orderId}` : ""}</span><StatusBadge status={ticket.status}/><small>Last updated {dateLabel(ticket.updatedAt)}</small></div>
      <section className="support-customer-original-message"><strong>Your request</strong><p>{ticket.description}</p><small>Submitted {dateLabel(ticket.createdAt)}</small></section>
      <h3 className="support-customer-thread-title"><MessageSquare size={16}/> Conversation</h3>
      {publicMessages.length ? publicMessages.map((entry) => <article className="support-customer-reply" key={entry.id}><div><strong>{entry.author || "Support Team"}</strong><time>{dateLabel(entry.createdAt)}</time></div><p>{entry.text}</p></article>) : <p className="support-customer-muted">No replies yet. Our team will respond here.</p>}
      {ticket.status === "Closed" ? <div className="support-customer-closed-note">This ticket is closed. Create a new ticket if you need further help.</div> : <form className="support-customer-reply-form" onSubmit={submitReply}><label htmlFor="support-customer-reply">Add a reply</label><textarea id="support-customer-reply" value={reply} onChange={(event) => setReply(event.target.value)} maxLength={2000} rows={3} placeholder="Write your reply…"/><button type="submit" className="crm-button crm-button-primary" disabled={saving || !reply.trim()}><Send size={14}/>{saving ? "Sending…" : "Send reply"}</button></form>}
      <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={onClose}>Close</button></div>
    </div>
  </Modal>;
}

function SupportTickets() {
  const { user, authenticatedRequest } = useAuth();
  const [tickets, setTickets] = useState([]); const [filter, setFilter] = useState("All"); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [showCreate, setShowCreate] = useState(false); const [selected, setSelected] = useState(null); const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(async () => {
    if (!user?.email) { setTickets([]); setLoading(false); return; }
    setLoading(true);
    try {
      if (storefrontSupportMode === "api") {
        // Migrate this customer's browser-only demo tickets into the shared CRM
        // table before loading the canonical server-side list. Import is idempotent.
        try {
          const legacyTickets = await getLocalMySupportTickets(user.email);
          await importLegacyMySupportTickets(legacyTickets, user.email, authenticatedRequest);
        } catch (migrationError) {
          console.warn("Could not import older browser support tickets:", migrationError?.message || migrationError);
        }
      }
      const result = await getMySupportTickets(user.email, authenticatedRequest);
      setTickets(Array.isArray(result) ? result : []);
      setError("");
    }
    catch (loadError) { setError(loadError.message || "Could not load your tickets."); }
    finally { setLoading(false); }
  }, [user?.email, authenticatedRequest]);
  useEffect(() => { load(); }, [load, reloadKey]);
  useEffect(() => {
    const refresh = () => setReloadKey((key) => key + 1);
    const refreshFromOtherTab = async (event) => {
      if (event.key !== "techgear_crm_mock_data_v1") return;
      refresh();
      // Refresh an already-open conversation too, not just the ticket list.
      if (selected?.id && user?.email) {
        try {
          const fresh = await getMySupportTicketById(selected.id, user.email, authenticatedRequest);
          if (fresh) setSelected(fresh);
        } catch {
          // The list reload will still show an error if the record cannot load.
        }
      }
    };
    window.addEventListener("techgear:support-tickets-updated", refresh);
    window.addEventListener("storage", refreshFromOtherTab);
    return () => {
      window.removeEventListener("techgear:support-tickets-updated", refresh);
      window.removeEventListener("storage", refreshFromOtherTab);
    };
  }, [selected?.id, user?.email, authenticatedRequest]);
  const filtered = tickets.filter((ticket) => filter === "All" || ticket.status === filter);
  const onCreated = async (ticket) => { setShowCreate(false); setNotice(`Ticket ${ticket.id} has been submitted.`); setError(""); setReloadKey((key) => key + 1); };
  const onUpdated = async () => { await load(); setNotice("Your reply has been added."); };

  return <div className="account-detail-page">
    <div className="account-page-header support-page-heading"><div><h1 className="account-page-title">Support Tickets</h1><p className="account-page-subtitle">Create a support request and follow the conversation with our team.</p></div><button type="button" className="support-new-ticket-button" onClick={() => { setShowCreate(true); setError(""); }}><Plus size={16}/> New Ticket</button></div>
    {storefrontSupportMode !== "api" && <div className="support-demo-notice">Demo mode · your tickets and replies are saved in this browser only.</div>}
    {error && <div className="crm-error-banner" role="alert">{error}</div>}{notice && <div className="support-success-notice" role="status">{notice}</div>}
    <div className="support-help-card account-card"><div className="support-help-icon"><Headphones size={24}/></div><div className="support-help-content"><h2>Need help with an order?</h2><p>Our team can help with orders, payments, delivery, warranty, returns and product questions.</p></div><button type="button" className="support-contact-button" onClick={() => setShowCreate(true)}>Contact Support</button></div>
    <div className="support-section-header"><div><h2>My Tickets</h2><p>{filtered.length} ticket(s)</p></div><select aria-label="Filter support tickets" className="support-filter" value={filter} onChange={(event) => setFilter(event.target.value)}>{["All", "Open", "In Progress", "Waiting on Customer", "Resolved", "Closed"].map((value) => <option key={value} value={value}>{value === "All" ? "All Tickets" : value}</option>)}</select></div>
    {loading ? <div className="support-customer-empty">Loading your support tickets…</div> : filtered.length === 0 ? <div className="support-customer-empty"><Headphones size={30}/><strong>{filter === "All" ? "No support tickets yet" : `No ${filter.toLowerCase()} tickets`}</strong><p>Create a ticket and our team will follow up here.</p><button type="button" className="crm-button crm-button-primary" onClick={() => setShowCreate(true)}><Plus size={14}/> Create your first ticket</button></div> : <div className="support-ticket-list">{filtered.map((ticket) => <article key={ticket.id} className="support-ticket-card account-card">
      <div className="support-ticket-top"><div className="support-ticket-title-wrap"><div className="support-ticket-icon"><Headphones size={18}/></div><div><h3>{ticket.subject}</h3><p>Ticket #{ticket.id} · {ticket.category}{ticket.orderId ? ` · ${ticket.orderId}` : ""}</p></div></div><span className={`support-status ${String(ticket.status).toLowerCase().replace(/\s+/g, "-")}`}>{ticket.status === "Open" ? <Clock3 size={13}/> : ticket.status === "Resolved" || ticket.status === "Closed" ? <CheckCircle2 size={13}/> : <AlertCircle size={13}/>} {ticket.status}</span></div>
      <p className="support-ticket-message">{ticket.description}</p><div className="support-ticket-bottom"><div className="support-ticket-meta"><span>Updated {dateLabel(ticket.updatedAt)}</span><span>Priority: <strong className={`priority-${String(ticket.priority).toLowerCase()}`}>{ticket.priority}</strong></span></div><button type="button" className="support-view-button" onClick={() => setSelected(ticket)}>View conversation <ChevronRight size={15}/></button></div>
    </article>)}</div>}
    {showCreate && <NewTicketForm user={user} authenticatedRequest={authenticatedRequest} onClose={() => setShowCreate(false)} onCreated={onCreated} onError={setError}/>}
    {selected && <CustomerTicketDetails key={`${selected.id}:${selected.updatedAt || ""}`} ticket={selected} user={user} authenticatedRequest={authenticatedRequest} onClose={() => setSelected(null)} onUpdated={onUpdated} onError={setError}/>}
  </div>;
}

export default SupportTickets;
