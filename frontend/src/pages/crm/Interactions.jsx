import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { CustomerLink, EmptyState, Modal, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";
import { createInteraction, crmInteractionsMode, getCustomers, getInteractions, updateInteractionStatus } from "../../services/crmService";

const TYPES = ["Call", "Email", "Meeting", "WhatsApp", "Note", "Follow-up"];
function localDateTimeValue() {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
const emptyForm = () => ({ customerId: "", type: "Note", subject: "", description: "", dateTime: localDateTimeValue() });

function Interactions() {
  const { authenticatedRequest, hasRole } = useAuth();
  const [items, setItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const isApiMode = crmInteractionsMode === "api";
  const canWrite = !isApiMode || hasRole(["ADMIN", "CRM_MANAGER", "SUPPORT_AGENT"]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const filters = { search, type, status: isApiMode ? "All" : status };
    const requests = [getInteractions(filters, authenticatedRequest)];
    if (canWrite) requests.push(getCustomers({}, authenticatedRequest));
    Promise.all(requests)
      .then(([interactionResult, customerResult]) => {
        if (!active) return;
        setItems(interactionResult);
        if (customerResult) setCustomers(customerResult);
      })
      .catch((err) => { if (active) setError(err.message || "Could not load interactions."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, type, status, reloadKey, authenticatedRequest, isApiMode, canWrite]);

  async function toggleStatus(item) {
    try {
      await updateInteractionStatus(item.id, item.status === "Pending" ? "Completed" : "Pending", authenticatedRequest);
      setReloadKey((key) => key + 1);
      setError("");
    } catch (err) {
      setError(err.message || "Could not update interaction status.");
    }
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const result = await createInteraction(form, authenticatedRequest);
      setShowCreate(false);
      setForm(emptyForm());
      setNotice(`Interaction “${result.subject}” ${isApiMode ? "saved to Django" : "saved to demo data"}.`);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err.message || "Could not create interaction.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="crm-page">
      <PageHeader title="Interactions" description="Review customer emails, calls, meetings and follow-ups in one place." action={canWrite ? <button type="button" className="crm-button crm-button-primary" onClick={() => { setError(""); setNotice(""); setForm(emptyForm()); setShowCreate(true); }}>+ Log interaction</button> : null} />
      <div className="crm-demo-notice">{isApiMode ? "Live Django mode · interaction records are stored in PostgreSQL. The backend model records type, subject, description and time; it does not have Pending/Completed status." : "Demo mode · interaction status and records are stored in local sample data."}</div>
      {notice && <div className="crm-success-banner" role="status">{notice}</div>}
      {error && !showCreate && <div className="crm-error-banner" role="alert">{error}</div>}
      <SectionCard title="Customer interactions" subtitle={`${items.length} matching ${isApiMode ? "live" : "demo"} records`}>
        <div className="crm-toolbar">
          <label className="crm-search-field"><span className="sr-only">Search interactions</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search customer, subject, owner or ID…" /></label>
          <label className="crm-filter-field"><span>Type</span><select value={type} onChange={(event) => setType(event.target.value)}><option>All</option>{TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
          {!isApiMode && <label className="crm-filter-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{["All", "Pending", "Completed"].map((value) => <option key={value}>{value}</option>)}</select></label>}
        </div>
        {loading ? <div className="crm-loading">Loading interactions…</div> : items.length === 0 ? <EmptyState title="No interactions found" message={canWrite ? "Change the filters or log a new customer interaction." : "Try another search or filter."} /> : (
          <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Customer</th><th>Type</th><th>Subject</th><th>Date</th><th>Owner</th>{isApiMode ? <th>Description</th> : <><th>Status</th><th>Action</th></>}</tr></thead><tbody>
            {items.map((item) => <tr key={item.id}><td><CustomerLink customerId={item.customerId}>{item.customerName}</CustomerLink></td><td>{item.type}</td><td><strong>{item.subject}</strong></td><td>{item.date || "—"}</td><td>{item.owner || "—"}</td>{isApiMode ? <td>{item.description || <span className="crm-muted-cell">—</span>}</td> : <><td><StatusBadge status={item.status} /></td><td><button type="button" className="crm-button crm-button-small crm-button-secondary" onClick={() => toggleStatus(item)}>{item.status === "Pending" ? "Mark complete" : "Reopen"}</button></td></>}</tr>)}
          </tbody></table></div>
        )}
      </SectionCard>

      {showCreate && <Modal title="Log customer interaction" description={isApiMode ? "Saves one interaction to the authenticated customer organization." : "Create a demo interaction record."} onClose={() => setShowCreate(false)}>
        <form className="crm-form" onSubmit={handleCreate}>
          <label className="crm-form-field"><span>Customer *</span><select required value={form.customerId} onChange={(event) => setForm({ ...form, customerId: event.target.value })}><option value="">Select a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} — {customer.email}</option>)}</select></label>
          <div className="crm-form-grid">
            <label className="crm-form-field"><span>Interaction type *</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{TYPES.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="crm-form-field"><span>Date and time *</span><input type="datetime-local" required value={form.dateTime} onChange={(event) => setForm({ ...form, dateTime: event.target.value })} /></label>
          </div>
          <label className="crm-form-field"><span>Subject *</span><input required maxLength={200} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="e.g. Warranty follow-up" /></label>
          <label className="crm-form-field"><span>Description / notes</span><textarea rows="4" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Record the interaction summary" /></label>
          {customers.length === 0 && <div className="crm-error-banner" role="alert">No customers are available in the current data source. Create a customer first.</div>}
          {error && <div className="crm-error-banner" role="alert">{error}</div>}
          <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="crm-button crm-button-primary" disabled={saving || customers.length === 0}>{saving ? "Saving…" : "Save interaction"}</button></div>
        </form>
      </Modal>}
    </div>
  );
}
export default Interactions;
