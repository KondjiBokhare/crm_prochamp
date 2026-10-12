import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { crmSegmentsMode, createSegment, getSegments } from "../../services/crmService";
import { EmptyState, Modal, PageHeader, StatusBadge } from "../../components/crm/CrmUI";

const emptyForm = { name: "", description: "", rule: "all", status: "Draft" };
const ruleLabels = {
  all: "All active customers",
  "high-value": "Lifetime spend of at least ₹50,000",
  repeat: "At least two eligible orders",
  inactive: "Inactive customers",
  new: "Customers at the Lead lifecycle stage",
  custom: "Custom backend rule",
};

function Segments() {
  const { authenticatedRequest, hasRole } = useAuth();
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("All");
  const [reloadKey, setReloadKey] = useState(0);
  const isApiMode = crmSegmentsMode === "api";
  const canWrite = !isApiMode || hasRole(["ADMIN", "MARKETING_MANAGER"]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getSegments(authenticatedRequest)
      .then((result) => { if (active) setSegments(result); })
      .catch((err) => { if (active) setError(err.message || "Could not load customer segments."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reloadKey, authenticatedRequest]);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, status: isApiMode && form.status === "Draft" ? "Inactive" : form.status };
      const segment = await createSegment(payload, authenticatedRequest);
      setForm(emptyForm);
      setShowCreate(false);
      setNotice(`Segment “${segment.name}” saved with ${segment.customers} matching ${isApiMode ? "database" : "sample"} customers.`);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err.message || "Could not create customer segment.");
    } finally {
      setSaving(false);
    }
  }

  const visibleSegments = filter === "All" ? segments : segments.filter((segment) => segment.status === filter);
  const openCreate = () => {
    setError(""); setNotice("");
    setForm({ ...emptyForm, status: isApiMode ? "Active" : "Draft" });
    setShowCreate(true);
  };

  return (
    <div className="crm-page">
      <PageHeader title="Customer segments" description="Group customers by purchase history and lifecycle for more relevant communication." action={canWrite ? <button type="button" className="crm-button crm-button-primary" onClick={openCreate}>+ Create segment</button> : null} />
      <div className="crm-demo-notice">{isApiMode ? "Live Django mode · segments and dynamic rule previews are loaded from PostgreSQL. Segment writes require the Admin or Marketing role." : "Demo mode · segment rules are evaluated against sample customer data and saved in this browser only."}</div>
      {notice && <div className="crm-success-banner" role="status">{notice}</div>}
      {error && !showCreate && <div className="crm-error-banner" role="alert">{error}</div>}
      <div className="crm-analytics-toolbar">
        <label>Segment status <select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>Active</option>{isApiMode ? <option>Inactive</option> : <option>Draft</option>}</select></label>
        <span>{visibleSegments.length} of {segments.length} segments</span>
      </div>
      {loading ? <div className="crm-loading">Loading segments…</div> : visibleSegments.length === 0 ? <EmptyState title="No segments found" message="Create a segment or change the status filter." /> : (
        <div className="crm-segment-grid">{visibleSegments.map((segment) => (
          <section className="crm-card crm-segment-card" key={segment.id}>
            <div className="crm-segment-card-top"><span className="crm-segment-icon">S</span><StatusBadge status={segment.status} /></div>
            <h2>{segment.name}</h2>
            <p>{segment.description}</p>
            <div className="crm-segment-meta"><strong>{Number(segment.customers || 0).toLocaleString("en-IN")}</strong><span>customers</span></div>
            <div className="crm-segment-rule"><strong>Rule</strong><span>{ruleLabels[segment.rule] || segment.description || "Custom segment rule"}</span></div>
            <small>Updated {segment.updatedAt || "—"}</small>
            <div className="crm-segment-actions"><Link className="crm-text-link" to="/crm/customers">Browse customers →</Link></div>
          </section>
        ))}</div>
      )}

      {showCreate && <Modal title="Create customer segment" description={isApiMode ? "The rule is saved to Django and evaluated against real customer/order records." : "Choose a rule to estimate the matching audience in sample data."} onClose={() => setShowCreate(false)}>
        <form className="crm-form" onSubmit={handleCreate}>
          <label className="crm-form-field"><span>Segment name *</span><input required maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. High-value customers" /></label>
          <label className="crm-form-field"><span>Matching rule *</span><select value={form.rule} onChange={(event) => setForm({ ...form, rule: event.target.value })}><option value="all">Active customers</option><option value="high-value">Lifetime spend ≥ ₹50,000</option><option value="repeat">At least two eligible orders</option><option value="inactive">Inactive customers</option><option value="new">Lead lifecycle stage</option></select></label>
          <label className="crm-form-field"><span>Description (optional)</span><textarea rows="3" maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder={ruleLabels[form.rule]} /></label>
          <label className="crm-form-field"><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{isApiMode ? <><option>Active</option><option>Inactive</option></> : <><option>Draft</option><option>Active</option></>}</select></label>
          {isApiMode && <p className="crm-muted-cell">Dynamic counts use existing customer and order records. “Lead lifecycle stage” maps to the backend lifecycle value LEAD.</p>}
          {error && <div className="crm-error-banner" role="alert">{error}</div>}
          <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="crm-button crm-button-primary" disabled={saving}>{saving ? "Saving…" : "Create segment"}</button></div>
        </form>
      </Modal>}
    </div>
  );
}
export default Segments;
