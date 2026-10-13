import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, Clock3, Headphones, MessageSquare, Plus, Search, Send, StickyNote, UserRoundCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  addSupportTicketMessage,
  assignSupportTicket,
  createSupportTicket,
  crmSupportMode,
  getSupportTicketById,
  getSupportTickets,
  updateSupportTicketPriority,
  updateSupportTicketStatus,
} from "../../services/crmService";
import { EmptyState, MetricCard, Modal, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";

const STATUSES = ["Open", "In Progress", "Waiting on Customer", "Resolved", "Closed"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const CATEGORIES = ["Order", "Delivery", "Payment", "Product", "Warranty", "Returns & Refunds", "Account", "Other"];
const ASSIGNEES = ["Unassigned", "Sam Support", "Neha Patel", "Amit Kumar", "Maya Manager"];
const emptyTicketDraft = () => ({ customerName: "", customerEmail: "", subject: "", category: "Other", orderId: "", description: "", priority: "Medium" });
const dateLabel = (value) => value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

function TicketDetails({ ticket: initialTicket, onClose, actor, canAssign, onChanged, onError, onNotice, authenticatedRequest }) {
  const [ticket, setTicket] = useState(initialTicket);
  const [status, setStatus] = useState(initialTicket.status);
  const [priority, setPriority] = useState(initialTicket.priority);
  const [assignedTo, setAssignedTo] = useState(initialTicket.assignedTo || "Unassigned");
  const [message, setMessage] = useState("");
  const [isInternal, setIsInternal] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTicket(initialTicket); setStatus(initialTicket.status); setPriority(initialTicket.priority); setAssignedTo(initialTicket.assignedTo || "Unassigned");
  }, [initialTicket]);

  const run = async (successText, operation) => {
    setSaving(true); onError(""); onNotice("");
    try {
      const result = await operation();
      const fresh = result?.id ? result : await getSupportTicketById(ticket.id, authenticatedRequest);
      if (fresh) { setTicket(fresh); setStatus(fresh.status); setPriority(fresh.priority); setAssignedTo(fresh.assignedTo || "Unassigned"); }
      await onChanged(); onNotice(successText);
    } catch (error) { onError(error.message || "Could not update this support ticket."); }
    finally { setSaving(false); }
  };

  async function submitMessage(event) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    await run(isInternal ? "Internal note added." : "Reply added to customer conversation.", async () => {
      const result = await addSupportTicketMessage(ticket.id, text, actor, isInternal, authenticatedRequest);
      setMessage("");
      return result;
    });
  }

  return <Modal title={`Ticket ${ticket.id}`} description={`${ticket.customerName} · Created ${dateLabel(ticket.createdAt)}`} onClose={onClose} width="900px">
    <div className="crm-ticket-detail">
      <div className="crm-ticket-detail-heading"><div><div className="crm-ticket-kicker">{ticket.category}{ticket.orderId ? ` · Order ${ticket.orderId}` : ""}</div><h2>{ticket.subject}</h2><p>Customer request and replies are shown in the conversation below.</p></div><StatusBadge status={ticket.status}/></div>
      <div className="crm-ticket-facts">
        <div><span>Customer</span><strong>{ticket.customerName}</strong><small>{ticket.customerEmail}</small></div>
        <div><span>Priority</span><strong><StatusBadge status={ticket.priority}/></strong><small>Updated {dateLabel(ticket.updatedAt)}</small></div>
        <div><span>Assigned to</span><strong>{ticket.assignedTo || "Unassigned"}</strong><small>Ticket ID: {ticket.id}</small></div>
      </div>
      <section className="crm-ticket-control-panel">
        <div className="crm-ticket-control"><label className="crm-form-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{STATUSES.map((value) => <option key={value}>{value}</option>)}</select></label><button type="button" className="crm-button crm-button-secondary" onClick={() => run(`Ticket status updated to ${status}.`, () => updateSupportTicketStatus(ticket.id, status, actor, authenticatedRequest))} disabled={saving || status === ticket.status}>Update status</button></div>
        <div className="crm-ticket-control"><label className="crm-form-field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)}>{PRIORITIES.map((value) => <option key={value}>{value}</option>)}</select></label><button type="button" className="crm-button crm-button-secondary" onClick={() => run(`Ticket priority updated to ${priority}.`, () => updateSupportTicketPriority(ticket.id, priority, actor, authenticatedRequest))} disabled={saving || priority === ticket.priority}>Update priority</button></div>
        {canAssign && <div className="crm-ticket-control"><label className="crm-form-field"><span>Assignee</span><select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>{ASSIGNEES.map((value) => <option key={value}>{value}</option>)}</select></label><button type="button" className="crm-button crm-button-secondary" onClick={() => run(`Ticket assigned to ${assignedTo}.`, () => assignSupportTicket(ticket.id, assignedTo, actor, authenticatedRequest))} disabled={saving || assignedTo === ticket.assignedTo}><UserRoundCheck size={14}/> Assign ticket</button></div>}
      </section>
      <section className="crm-ticket-thread"><div className="crm-ticket-section-title"><h3><MessageSquare size={16}/> Customer conversation</h3><span>{ticket.messages.length} message(s)</span></div>
        {ticket.messages.length ? ticket.messages.filter((entry) => !entry.isInternal).map((entry) => <article className="crm-ticket-message" key={entry.id}><div><strong>{entry.author || "Customer"}</strong><time>{dateLabel(entry.createdAt)}</time></div><p>{entry.text}</p></article>) : <EmptyState title="No replies yet" message="Replies added below will appear in the customer conversation."/>}
      </section>
      <section className="crm-ticket-thread crm-ticket-internal-section"><div className="crm-ticket-section-title"><h3><StickyNote size={16}/> Internal notes</h3><span>Visible to CRM staff only</span></div>
        {ticket.internalNotes.length ? [...ticket.internalNotes].reverse().map((entry) => <article className="crm-ticket-message internal" key={entry.id}><div><strong>{entry.author || "CRM staff"}</strong><time>{dateLabel(entry.createdAt)}</time></div><p>{entry.text}</p></article>) : <p className="crm-ticket-subtle">No internal notes have been added.</p>}
      </section>
      <section className="crm-ticket-thread"><div className="crm-ticket-section-title"><h3><Send size={16}/> Add reply or note</h3></div>
        <form className="crm-ticket-message-form" onSubmit={submitMessage}><label className="crm-ticket-internal-toggle"><input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)}/><span>Internal note (not visible to customer)</span></label><textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={3} placeholder={isInternal ? "Write an internal note for the support team…" : "Write a reply visible to the customer…"}/><div><small>{message.length}/2000 characters</small><button className="crm-button crm-button-primary" type="submit" disabled={saving || !message.trim()}>{saving ? "Saving…" : isInternal ? "Add internal note" : "Send reply"}</button></div></form>
      </section>
      <section className="crm-ticket-thread"><div className="crm-ticket-section-title"><h3><Clock3 size={16}/> Resolution history</h3><span>{ticket.statusHistory.length} event(s)</span></div>
        {ticket.statusHistory.length ? <div className="crm-ticket-history">{[...ticket.statusHistory].reverse().map((event, index) => <div key={event.id || `${event.at}-${index}`}><span className="crm-order-history-dot"/><div><strong>{event.type}{event.from ? `: ${event.from} → ${event.to}` : event.to ? `: ${event.to}` : ""}</strong><small>{event.by || actor} · {dateLabel(event.at)}</small></div></div>)}</div> : <p className="crm-ticket-subtle">No history yet.</p>}
      </section>
      <div className="crm-form-actions"><button className="crm-button crm-button-secondary" type="button" onClick={onClose}>Close details</button></div>
    </div>
  </Modal>;
}

function SupportManagement() {
  const { user, authenticatedRequest } = useAuth();
  const actor = user?.name || user?.email || "CRM Staff";
  const canAssign = ["ADMIN", "CRM_MANAGER"].includes(user?.role);
  const [items, setItems] = useState([]); const [search, setSearch] = useState(""); const [status, setStatus] = useState("All"); const [priority, setPriority] = useState("All"); const [category, setCategory] = useState("All"); const [assignedTo, setAssignedTo] = useState("All");
  const [selected, setSelected] = useState(null); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [reloadKey, setReloadKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false); const [draft, setDraft] = useState(emptyTicketDraft); const [creating, setCreating] = useState(false);

  const load = useCallback(async () => { setLoading(true); setError(""); try { const result = await getSupportTickets({}, authenticatedRequest); setItems(Array.isArray(result) ? result : []); } catch (loadError) { setError(loadError.message || "Could not load support tickets."); } finally { setLoading(false); } }, [authenticatedRequest]);
  useEffect(() => { load(); }, [load, reloadKey]);
  useEffect(() => {
    const refresh = () => setReloadKey((key) => key + 1);
    const refreshFromOtherTab = async (event) => {
      if (event.key !== "techgear_crm_mock_data_v1") return;
      refresh();
      // Keep an open ticket modal in sync when a customer replies in another tab.
      if (selected?.id) {
        try {
          const fresh = await getSupportTicketById(selected.id, authenticatedRequest);
          if (fresh) setSelected(fresh);
        } catch {
          // The queue reload will still report any data-loading problem.
        }
      }
    };
    window.addEventListener("techgear:support-tickets-updated", refresh);
    window.addEventListener("storage", refreshFromOtherTab);
    return () => {
      window.removeEventListener("techgear:support-tickets-updated", refresh);
      window.removeEventListener("storage", refreshFromOtherTab);
    };
  }, [selected?.id, authenticatedRequest]);
  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return items.filter((ticket) => { const hasQuery = !query || [ticket.id, ticket.subject, ticket.customerName, ticket.customerEmail, ticket.orderId, ticket.description].some((value) => String(value || "").toLowerCase().includes(query)); return hasQuery && (status === "All" || ticket.status === status) && (priority === "All" || ticket.priority === priority) && (category === "All" || ticket.category === category) && (assignedTo === "All" || ticket.assignedTo === assignedTo); }); }, [items, search, status, priority, category, assignedTo]);
  const metrics = useMemo(() => ({ open: items.filter((ticket) => ["Open", "In Progress", "Waiting on Customer"].includes(ticket.status)).length, urgent: items.filter((ticket) => ticket.priority === "Urgent" && !["Resolved", "Closed"].includes(ticket.status)).length, unassigned: items.filter((ticket) => ticket.assignedTo === "Unassigned" && !["Resolved", "Closed"].includes(ticket.status)).length, resolved: items.filter((ticket) => ["Resolved", "Closed"].includes(ticket.status)).length }), [items]);
  const refreshSelected = useCallback(async () => { const result = await getSupportTickets({}, authenticatedRequest); setItems(Array.isArray(result) ? result : []); if (selected?.id) { const fresh = await getSupportTicketById(selected.id, authenticatedRequest); if (fresh) setSelected(fresh); } }, [selected?.id, authenticatedRequest]);
  function resetFilters() { setSearch(""); setStatus("All"); setPriority("All"); setCategory("All"); setAssignedTo("All"); }

  async function handleCreateTicket(event) {
    event.preventDefault(); setCreating(true); setError(""); setNotice("");
    try {
      const created = await createSupportTicket(draft, authenticatedRequest);
      setShowCreate(false); setDraft(emptyTicketDraft()); setReloadKey((value) => value + 1);
      setNotice(`Support ticket ${created.id} was created.`);
    } catch (createError) { setError(createError.message || "Could not create the support ticket."); }
    finally { setCreating(false); }
  }

  return <div className="crm-page">
    <PageHeader title="Customer Support" description="Manage customer tickets, priorities, assignments, replies, internal notes and resolution history." action={<button type="button" className="crm-button crm-button-primary" onClick={() => { setDraft(emptyTicketDraft()); setShowCreate(true); setError(""); setNotice(""); }}><Plus size={15}/> New ticket</button>} />
    {crmSupportMode === "mock" && <div className="crm-demo-notice">Demo mode · tickets are saved in this browser only. In API mode, Django keeps staff replies and internal notes in PostgreSQL.</div>}
    {error && <div className="crm-error-banner" role="alert">{error}</div>}{notice && <div className="crm-success-banner" role="status">{notice}</div>}
    <div className="crm-metrics-grid crm-ticket-metrics"><MetricCard label="Active tickets" value={metrics.open} note="Open, in progress or waiting" tone="blue"/><MetricCard label="Urgent active" value={metrics.urgent} note="Requires prompt attention" tone="orange"/><MetricCard label="Unassigned" value={metrics.unassigned} note="Needs an owner" tone="purple"/><MetricCard label="Resolved / closed" value={metrics.resolved} note="Completed support requests" tone="green"/></div>
    <SectionCard title="Support ticket queue" subtitle={`${filtered.length} matching ticket(s)`} action={<span className="crm-ticket-queue-icon"><Headphones size={17}/> Service desk</span>}>
      <div className="crm-toolbar crm-ticket-toolbar"><label className="crm-search-field"><span className="sr-only">Search tickets</span><span className="crm-ticket-search-icon"><Search size={15}/></span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ticket, customer, order or subject…"/></label>
        <label className="crm-filter-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{["All", ...STATUSES].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="crm-filter-field"><span>Priority</span><select value={priority} onChange={(event) => setPriority(event.target.value)}>{["All", ...PRIORITIES].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="crm-filter-field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{["All", ...CATEGORIES].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="crm-filter-field"><span>Assignee</span><select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)}>{["All", ...ASSIGNEES].map((value) => <option key={value}>{value}</option>)}</select></label>
        <button type="button" className="crm-button crm-button-secondary" onClick={resetFilters}>Reset</button>
      </div>
      {loading ? <div className="crm-loading">Loading tickets…</div> : filtered.length === 0 ? <EmptyState title="No tickets found" message="Try another search or clear one or more filters."/> : <div className="crm-table-wrap"><table className="crm-table crm-ticket-table"><thead><tr><th>Ticket / subject</th><th>Customer</th><th>Category / order</th><th>Priority</th><th>Status</th><th>Assignee</th><th>Updated</th><th>Action</th></tr></thead><tbody>{filtered.map((ticket) => <tr key={ticket.id}><td><div className="crm-ticket-subject-cell"><strong>{ticket.subject}</strong><small>{ticket.id}</small></div></td><td><div className="crm-ticket-customer-cell"><strong>{ticket.customerName}</strong><small>{ticket.customerEmail}</small></div></td><td><div className="crm-ticket-subject-cell"><span>{ticket.category}</span><small>{ticket.orderId || "No linked order"}</small></div></td><td><StatusBadge status={ticket.priority}/></td><td><StatusBadge status={ticket.status}/></td><td>{ticket.assignedTo || "Unassigned"}</td><td>{dateLabel(ticket.updatedAt)}</td><td><button type="button" className="crm-button crm-button-small crm-button-secondary" onClick={() => { setSelected(ticket); setError(""); setNotice(""); }}>Manage <ArrowUpRight size={13}/></button></td></tr>)}</tbody></table></div>}
    </SectionCard>
    <div className="crm-ticket-footer-note"><AlertTriangle size={14}/> Internal notes are intended for staff only. The production API must enforce note visibility and support-role permissions server-side.</div>
    {showCreate && <Modal title="Create support ticket" description="Create a ticket for a customer and add it to the staff queue." onClose={() => setShowCreate(false)} width="760px">
      <form className="crm-form" onSubmit={handleCreateTicket}>
        <div className="crm-form-grid">
          <label className="crm-form-field"><span>Customer name *</span><input required maxLength={120} value={draft.customerName} onChange={(event) => setDraft((value) => ({ ...value, customerName: event.target.value }))} placeholder="Customer name" /></label>
          <label className="crm-form-field"><span>Customer email *</span><input required type="email" maxLength={254} value={draft.customerEmail} onChange={(event) => setDraft((value) => ({ ...value, customerEmail: event.target.value }))} placeholder="customer@example.com" /></label>
          <label className="crm-form-field"><span>Subject *</span><input required minLength={4} maxLength={160} value={draft.subject} onChange={(event) => setDraft((value) => ({ ...value, subject: event.target.value }))} placeholder="What does the customer need help with?" /></label>
          <label className="crm-form-field"><span>Category</span><select value={draft.category} onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value }))}>{CATEGORIES.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="crm-form-field"><span>Order ID (optional)</span><input maxLength={60} value={draft.orderId} onChange={(event) => setDraft((value) => ({ ...value, orderId: event.target.value }))} placeholder="Order reference" /></label>
          <label className="crm-form-field"><span>Priority</span><select value={draft.priority} onChange={(event) => setDraft((value) => ({ ...value, priority: event.target.value }))}>{PRIORITIES.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="crm-form-field crm-product-description-field"><span>Customer request *</span><textarea required minLength={10} maxLength={2000} rows={4} value={draft.description} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} placeholder="Describe the support request (10–2,000 characters)." /></label>
        </div>
        {error && <div className="crm-error-banner" role="alert">{error}</div>}
        <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="crm-button crm-button-primary" disabled={creating}>{creating ? "Creating…" : "Create ticket"}</button></div>
      </form>
    </Modal>}
    {selected && <TicketDetails ticket={selected} onClose={() => setSelected(null)} actor={actor} canAssign={canAssign} onChanged={refreshSelected} onError={setError} onNotice={setNotice} authenticatedRequest={authenticatedRequest}/>}
  </div>;
}

export default SupportManagement;
