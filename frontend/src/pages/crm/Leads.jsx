import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarClock, Download, Plus, Search, UserRoundCheck, TrendingUp } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { EmptyState, MetricCard, Modal, PageHeader, StatusBadge } from "../../components/crm/CrmUI";
import {
  crmLeadsMode,
  addLeadFollowUp,
  assignLead,
  convertLead,
  createLead,
  getLeads,
  updateLead,
  updateLeadStatus,
} from "../../services/crmService";

const SOURCES = ["Website", "Product Enquiry", "Campaign", "Referral", "Social Media", "Phone", "Email", "Event", "Other"];
const STATUSES = ["New", "Contacted", "Qualified", "Proposal", "Converted", "Lost"];
const EDITABLE_STATUSES = ["New", "Contacted", "Qualified", "Proposal", "Lost"];
const ASSIGNEES = ["Unassigned", "Mira Marketing", "Maya Manager", "Aarav Admin"];
const EMPTY_FORM = { name: "", email: "", phone: "", company: "", city: "", source: "Website", status: "New", assignedTo: "Unassigned", score: 50, estimatedValue: 0, nextFollowUpAt: "", notes: "" };
const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
const dateLabel = (value) => value ? new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const dateTimeLabel = (value) => value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";

function LeadForm({ initial = EMPTY_FORM, onSubmit, onCancel, saving, error }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const set = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  return (
    <form className="crm-form" onSubmit={(event) => { event.preventDefault(); onSubmit(form); }}>
      <div className="crm-form-grid">
        <label className="crm-form-field"><span>Full name *</span><input required maxLength={120} value={form.name} onChange={(event) => set("name", event.target.value)} placeholder="Lead name" /></label>
        <label className="crm-form-field"><span>Email *</span><input required type="email" maxLength={180} value={form.email} onChange={(event) => set("email", event.target.value)} placeholder="name@example.com" /></label>
        <label className="crm-form-field"><span>Phone</span><input maxLength={32} value={form.phone} onChange={(event) => set("phone", event.target.value)} placeholder="+91…" /></label>
        <label className="crm-form-field"><span>Company</span><input maxLength={120} value={form.company} onChange={(event) => set("company", event.target.value)} placeholder="Company or Independent" /></label>
        <label className="crm-form-field"><span>City</span><input maxLength={80} value={form.city} onChange={(event) => set("city", event.target.value)} placeholder="City" /></label>
        <label className="crm-form-field"><span>Lead source *</span><select value={form.source} onChange={(event) => set("source", event.target.value)}>{SOURCES.map((source) => <option key={source}>{source}</option>)}</select></label>
        <label className="crm-form-field"><span>Qualification status</span><select value={form.status} onChange={(event) => set("status", event.target.value)}>{EDITABLE_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
        <label className="crm-form-field"><span>Assigned to</span><select value={form.assignedTo} onChange={(event) => set("assignedTo", event.target.value)}>{ASSIGNEES.map((assignee) => <option key={assignee}>{assignee}</option>)}</select></label>
        <label className="crm-form-field"><span>Lead score (0–100)</span><input type="number" min="0" max="100" value={form.score} onChange={(event) => set("score", event.target.value)} /></label>
        <label className="crm-form-field"><span>Estimated deal value (₹)</span><input type="number" min="0" step="1" value={form.estimatedValue} onChange={(event) => set("estimatedValue", event.target.value)} /></label>
        <label className="crm-form-field"><span>Next follow-up date</span><input type="date" value={form.nextFollowUpAt || ""} onChange={(event) => set("nextFollowUpAt", event.target.value)} /></label>
      </div>
      <label className="crm-form-field"><span>Notes / requirements</span><textarea rows="3" maxLength="1000" value={form.notes} onChange={(event) => set("notes", event.target.value)} placeholder="Customer need, budget, products of interest…" /></label>
      {error && <div className="crm-error-banner" role="alert">{error}</div>}
      <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="crm-button crm-button-primary" disabled={saving}>{saving ? "Saving…" : "Save lead"}</button></div>
    </form>
  );
}

function Leads() {
  const { user, authenticatedRequest } = useAuth();
  const actor = user?.name || user?.email || "CRM Staff";
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sourceFilter, setSourceFilter] = useState("All");
  const [ownerFilter, setOwnerFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [activeLead, setActiveLead] = useState(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [followUp, setFollowUp] = useState({ type: "Call", summary: "", nextFollowUpAt: "" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    getLeads({}, authenticatedRequest).then((result) => { if (active) setLeads(result); })
      .catch((err) => { if (active) setError(err.message || "Could not load leads."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey, authenticatedRequest]);

  const visibleLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    return leads.filter((lead) => {
      const haystack = [lead.id, lead.name, lead.email, lead.phone, lead.company, lead.city].join(" ").toLowerCase();
      return (!query || haystack.includes(query))
        && (statusFilter === "All" || lead.status === statusFilter)
        && (sourceFilter === "All" || lead.source === sourceFilter)
        && (ownerFilter === "All" || lead.assignedTo === ownerFilter)
        && (!dateFrom || lead.createdAt >= dateFrom)
        && (!dateTo || lead.createdAt <= dateTo);
    });
  }, [leads, search, statusFilter, sourceFilter, ownerFilter, dateFrom, dateTo]);

  const metrics = useMemo(() => {
    const activeLeads = leads.filter((lead) => !["Converted", "Lost"].includes(lead.status));
    const qualified = leads.filter((lead) => ["Qualified", "Proposal"].includes(lead.status));
    const converted = leads.filter((lead) => lead.status === "Converted");
    const pipelineValue = activeLeads.reduce((sum, lead) => sum + (Number(lead.estimatedValue) || 0), 0);
    const due = activeLeads.filter((lead) => lead.nextFollowUpAt && lead.nextFollowUpAt <= new Date().toISOString().slice(0, 10)).length;
    return { total: leads.length, qualified: qualified.length, converted: converted.length, pipelineValue, due };
  }, [leads]);

  async function runAction(action, successMessage) {
    setError(""); setNotice("");
    try { await action(); setNotice(successMessage); setReloadKey((key) => key + 1); if (activeLead) { const refreshed = await getLeads({}, authenticatedRequest); setActiveLead(refreshed.find((item) => String(item.id) === String(activeLead.id)) || null); } }
    catch (err) { setError(err.message || "Could not update lead."); }
  }

  async function saveLead(form) {
    setSaving(true); setFormError("");
    try {
      if (editingLead) await updateLead(editingLead.id, { ...form, score: Number(form.score), estimatedValue: Number(form.estimatedValue) }, actor, authenticatedRequest);
      else await createLead({ ...form, score: Number(form.score), estimatedValue: Number(form.estimatedValue) }, actor, authenticatedRequest);
      setShowCreate(false); setEditingLead(null); setNotice(editingLead ? "Lead updated." : "Lead created."); setReloadKey((key) => key + 1);
    } catch (err) { setFormError(err.message || "Could not save lead."); }
    finally { setSaving(false); }
  }

  function openEdit(lead) { setEditingLead(lead); setFormError(""); setShowCreate(true); }

  async function handleFollowUp(event) {
    event.preventDefault();
    if (!activeLead) return;
    setError("");
    try {
      await addLeadFollowUp(activeLead.id, followUp, actor, authenticatedRequest);
      setFollowUp({ type: "Call", summary: "", nextFollowUpAt: "" });
      setNotice("Follow-up saved to lead history.");
      setReloadKey((key) => key + 1);
      const refreshed = await getLeads({}, authenticatedRequest);
      setActiveLead(refreshed.find((item) => String(item.id) === String(activeLead.id)) || null);
    } catch (err) { setError(err.message || "Could not save follow-up."); }
  }

  async function handleConvert(lead) {
    const ok = window.confirm(`Convert ${lead.name} into a customer? An existing customer with the same email will be linked instead of duplicated.`);
    if (!ok) return;
    try {
      const result = await convertLead(lead.id, actor, authenticatedRequest);
      setNotice(result.alreadyConverted ? "This lead is already converted." : `Lead converted and linked to customer ${result.customer?.id ?? "record"}.`);
      setError(""); setReloadKey((key) => key + 1);
      const refreshed = await getLeads({}, authenticatedRequest); setActiveLead(refreshed.find((item) => String(item.id) === String(lead.id)) || null);
    } catch (err) { setError(err.message || "Could not convert lead."); }
  }

  function exportCsv() {
    const cols = ["id", "name", "email", "phone", "company", "source", "status", "assignedTo", "score", "estimatedValue", "createdAt", "nextFollowUpAt", "convertedCustomerId"];
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...visibleLeads.map((lead) => cols.map((key) => escape(lead[key])).join(","))].join("\r\n");
    const blob = new Blob(["\\ufeff", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "crm-leads.csv"; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="crm-page crm-leads-page">
      <PageHeader title="Lead management" description="Capture prospects, qualify opportunities, plan follow-ups and convert qualified leads into customers." action={<div className="crm-leads-header-actions"><button type="button" className="crm-button crm-button-secondary" onClick={exportCsv}><Download size={15}/> Export CSV</button><button type="button" className="crm-button crm-button-primary" onClick={() => { setEditingLead(null); setFormError(""); setShowCreate(true); }}><Plus size={16}/> Add lead</button></div>} />
      {crmLeadsMode === "mock" ? <div className="crm-demo-notice">Demo mode · lead records and follow-up history are stored in this browser only; conversions create/link a demo customer.</div> : <div className="crm-demo-notice">Django API mode · lead records and follow-ups are saved in the organization database. Conversions create or link a real CRM customer record.</div>}
      {notice && <div className="crm-success-banner" role="status">{notice}</div>}
      {error && <div className="crm-error-banner" role="alert">{error}</div>}

      <div className="crm-metrics-grid crm-metrics-three crm-leads-metrics">
        <MetricCard label="Total leads" value={metrics.total} note="All sources" tone="blue" />
        <MetricCard label="Qualified pipeline" value={money(metrics.pipelineValue)} note={`${metrics.qualified} qualified / proposal`} tone="purple" />
        <MetricCard label="Converted leads" value={metrics.converted} note="Linked to customer records" tone="green" />
        <MetricCard label="Follow-ups due" value={metrics.due} note="Due today or overdue" tone="orange" />
      </div>

      <section className="crm-card crm-leads-list-card">
        <div className="crm-toolbar crm-leads-toolbar">
          <label className="crm-search-field"><span className="sr-only">Search leads</span><Search size={15}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, company or lead ID…" /></label>
          <label className="crm-filter-field"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All</option>{STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="crm-filter-field"><span>Source</span><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option>All</option>{SOURCES.map((source) => <option key={source}>{source}</option>)}</select></label>
          <label className="crm-filter-field"><span>Assigned to</span><select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}><option>All</option>{ASSIGNEES.map((owner) => <option key={owner}>{owner}</option>)}</select></label>
          <label className="crm-filter-field"><span>Created from</span><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
          <label className="crm-filter-field"><span>Created to</span><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
          <span className="crm-result-count">{visibleLeads.length} of {leads.length} leads</span>
        </div>
        {loading ? <div className="crm-loading">Loading leads…</div> : visibleLeads.length === 0 ? <EmptyState title="No leads found" message="Try different filters or add a new lead." /> : (
          <div className="crm-table-wrap"><table className="crm-table crm-leads-table"><thead><tr><th>Lead</th><th>Source</th><th>Status</th><th>Assigned to</th><th>Score</th><th>Est. value</th><th>Next follow-up</th><th>Actions</th></tr></thead><tbody>
            {visibleLeads.map((lead) => <tr key={lead.id}>
              <td><button type="button" className="crm-lead-person-button" onClick={() => { setActiveLead(lead); setError(""); }}><strong>{lead.name}</strong><small>{lead.id} · {lead.email}</small></button>{lead.company && <small className="crm-lead-company">{lead.company}</small>}</td>
              <td>{lead.source}</td><td><StatusBadge status={lead.status}/></td><td>{lead.assignedTo || "Unassigned"}</td>
              <td><div className="crm-lead-score"><span><i style={{ width: `${Math.max(0, Math.min(100, Number(lead.score) || 0))}%` }}/></span><strong>{lead.score ?? 0}</strong></div></td>
              <td className="crm-strong-cell">{money(lead.estimatedValue)}</td><td>{dateLabel(lead.nextFollowUpAt)}</td>
              <td><div className="crm-lead-row-actions"><button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => setActiveLead(lead)}>Manage</button><button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => openEdit(lead)} disabled={lead.status === "Converted"}>Edit</button></div></td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>

      {showCreate && <Modal title={editingLead ? `Edit ${editingLead.id}` : "Add new lead"} description="Capture the prospect and the next action so the team can track qualification." onClose={() => { setShowCreate(false); setEditingLead(null); setFormError(""); }} width="760px">
        <LeadForm key={editingLead?.id || "new-lead"} initial={editingLead || EMPTY_FORM} onSubmit={saveLead} onCancel={() => { setShowCreate(false); setEditingLead(null); }} saving={saving} error={formError}/>
      </Modal>}

      {activeLead && <Modal title={`${activeLead.name} · ${activeLead.id}`} description={`${activeLead.email}${activeLead.company ? ` · ${activeLead.company}` : ""}`} onClose={() => setActiveLead(null)} width="820px">
        <div className="crm-lead-detail">
          <div className="crm-lead-detail-stats"><div><span>Status</span><StatusBadge status={activeLead.status}/></div><div><span>Estimated value</span><strong>{money(activeLead.estimatedValue)}</strong></div><div><span>Score</span><strong>{activeLead.score}/100</strong></div><div><span>Created</span><strong>{dateLabel(activeLead.createdAt)}</strong></div></div>
          <div className="crm-form-grid crm-lead-inline-controls">
            <label className="crm-form-field"><span>Qualification status</span><select value={activeLead.status} disabled={activeLead.status === "Converted"} onChange={(event) => runAction(() => updateLeadStatus(activeLead.id, event.target.value, actor, authenticatedRequest), `Lead status changed to ${event.target.value}.`)}>{STATUSES.map((status) => <option key={status} disabled={status === "Converted"}>{status}</option>)}</select></label>
            <label className="crm-form-field"><span>Assigned owner</span><select value={activeLead.assignedTo || "Unassigned"} disabled={activeLead.status === "Converted"} onChange={(event) => runAction(() => assignLead(activeLead.id, event.target.value, actor, authenticatedRequest), `Lead assigned to ${event.target.value}.`)}>{ASSIGNEES.map((owner) => <option key={owner}>{owner}</option>)}</select></label>
          </div>
          {activeLead.notes && <div className="crm-lead-notes"><strong>Requirements / notes</strong><p>{activeLead.notes}</p></div>}
          {activeLead.status !== "Converted" && activeLead.status !== "Lost" && <button type="button" className="crm-button crm-button-primary crm-lead-convert" onClick={() => handleConvert(activeLead)}><UserRoundCheck size={15}/> Convert to customer <ArrowRight size={14}/></button>}
          {activeLead.status === "Converted" && <div className="crm-success-banner">Converted to customer #{activeLead.convertedCustomerId} on {dateTimeLabel(activeLead.convertedAt)}.</div>}
          <div className="crm-lead-followup-section">
            <h3><CalendarClock size={17}/> Log a follow-up</h3>
            <form className="crm-form crm-lead-followup-form" onSubmit={handleFollowUp}>
              <div className="crm-form-grid"><label className="crm-form-field"><span>Type</span><select value={followUp.type} onChange={(event) => setFollowUp((old) => ({ ...old, type: event.target.value }))}>{["Call", "Email", "Meeting", "Note"].map((type) => <option key={type}>{type}</option>)}</select></label><label className="crm-form-field"><span>Next follow-up</span><input type="date" value={followUp.nextFollowUpAt} onChange={(event) => setFollowUp((old) => ({ ...old, nextFollowUpAt: event.target.value }))}/></label></div>
              <label className="crm-form-field"><span>Summary *</span><textarea required rows="2" maxLength="1000" value={followUp.summary} onChange={(event) => setFollowUp((old) => ({ ...old, summary: event.target.value }))} placeholder="What was discussed and what happens next?" /></label>
              <div className="crm-form-actions"><button className="crm-button crm-button-primary" type="submit" disabled={activeLead.status === "Converted"}>Save follow-up</button></div>
            </form>
          </div>
          <div className="crm-lead-history-section"><h3><TrendingUp size={17}/> Activity history</h3>
            {[...(activeLead.followUps || []).map((item) => ({ ...item, kind: "followup" })), ...(activeLead.statusHistory || []).map((item, index) => ({ ...item, id: `history-${index}`, kind: "status" }))].sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).map((item) => <div className="crm-lead-history-item" key={item.id}><span className="crm-lead-history-dot"/><div><strong>{item.kind === "followup" ? `${item.type}: ${item.summary}` : item.event === "Assignment" ? `Assignment: ${item.from} → ${item.to}` : `Status: ${item.status}`}</strong><small>{dateTimeLabel(item.at)} · {item.by || "System"}{item.nextFollowUpAt ? ` · Next: ${dateLabel(item.nextFollowUpAt)}` : ""}</small></div></div>)}
          </div>
        </div>
      </Modal>}
    </div>
  );
}

export default Leads;
