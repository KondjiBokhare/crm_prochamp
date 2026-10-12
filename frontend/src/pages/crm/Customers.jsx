import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { crmCustomersMode, createCustomer, getCustomers } from "../../services/crmService";
import { useAuth } from "../../context/AuthContext";
import { EmptyState, Modal, PageHeader, StatusBadge } from "../../components/crm/CrmUI";

const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const emptyForm = { name: "", email: "", phone: "", city: "", status: "Active", tags: "", lifecycleStage: "CUSTOMER" };

function Customers() {
  const { user, authenticatedRequest } = useAuth();
  const isCustomerApiMode = crmCustomersMode === "api";
  const canManageCustomers = isCustomerApiMode ? ["ADMIN", "SALES"].includes(user?.backendRole) : ["ADMIN", "CRM_MANAGER"].includes(user?.role);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [city, setCity] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), isCustomerApiMode ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [search, isCustomerApiMode]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getCustomers({ search: debouncedSearch, status, city }, authenticatedRequest)
      .then((result) => { if (active) setCustomers(result); })
      .catch((err) => { if (active) setError(err.message || "Could not load customers. Try refreshing the page."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debouncedSearch, status, city, reloadKey, authenticatedRequest]);

  const cities = [...new Set(customers.map((customer) => customer.city).filter(Boolean))].sort();

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await createCustomer(form, authenticatedRequest);
      setShowCreate(false);
      setForm(emptyForm);
      setSearch("");
      setStatus("All");
      setCity("All");
      setNotice(isCustomerApiMode ? `Customer ${created.name} was saved in Django.` : `Customer ${created.name} was added to local demo data.`);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err.message || "Could not create this demo customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="crm-page">
      <PageHeader title="Customers" description="Search customer profiles, review activity and open the full customer timeline." action={canManageCustomers ? <button type="button" className="crm-button crm-button-primary" onClick={() => { setError(""); setNotice(""); setShowCreate(true); }}>+ Add customer</button> : null} />
      {isCustomerApiMode ? <div className="crm-info-banner">Live Django mode · customers are loaded from PostgreSQL through the authenticated API. The current backend does not store city or tags, so those fields are not shown in this mode.</div> : <div className="crm-demo-notice">Demo mode · customer changes are saved in this browser only. They will not be sent to Django yet.</div>}
      {notice && <div className="crm-success-banner" role="status">{notice}</div>}
      {error && !showCreate && <div className="crm-error-banner" role="alert">{error}</div>}

      <section className="crm-card">
        <div className="crm-toolbar">
          <label className="crm-search-field">
            <span className="sr-only">Search customers</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isCustomerApiMode ? "Search name, email, phone or customer ID…" : "Search name, email, city or customer ID…"} />
          </label>
          <label className="crm-filter-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select></label>
          {!isCustomerApiMode && <label className="crm-filter-field"><span>City</span><select value={city} onChange={(event) => setCity(event.target.value)}><option>All</option>{cities.map((item) => <option key={item}>{item}</option>)}</select></label>}
          <span className="crm-result-count">{customers.length} customers</span>
        </div>

        {loading ? <div className="crm-loading">Loading customers…</div> : customers.length === 0 ? (
          <EmptyState title="No customers found" message="Try another search term or change the status/city filters." />
        ) : (
          <div className="crm-table-wrap">
            <table className="crm-table crm-customers-table">
              <thead><tr><th>Customer</th><th>Customer ID</th><th>Location</th><th>Orders</th><th>Total spend</th><th>Last order</th><th>Status</th><th>Details</th></tr></thead>
              <tbody>{customers.map((customer) => (
                <tr key={customer.id}>
                  <td><div className="crm-table-person"><span className="crm-customer-avatar">{customer.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span><strong>{customer.name}</strong><small>{customer.email}</small></span></div></td>
                  <td>#{customer.id}</td><td>{customer.city || "—"}</td><td>{customer.totalOrders ?? "—"}</td><td>{customer.totalSpend == null ? "—" : money(customer.totalSpend)}</td><td>{dateLabel(customer.lastOrderDate)}</td><td><StatusBadge status={customer.status} />{isCustomerApiMode && <small className="crm-table-subtext">{customer.lifecycleStage}</small>}</td><td><Link className="crm-text-link" to={`/crm/customers/${customer.id}`}>View profile →</Link></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {showCreate && <Modal title="Add customer" description={isCustomerApiMode ? "Create a customer record in Django. City and tags are not supported by the current backend schema." : "Add a sample CRM profile. This stays in local demo data until API integration."} onClose={() => setShowCreate(false)}>
        <form className="crm-form" onSubmit={handleCreate}>
          <div className="crm-form-grid">
            <label className="crm-form-field"><span>Full name *</span><input required maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Riya Shah" /></label>
            <label className="crm-form-field"><span>Email address *</span><input required type="email" maxLength={150} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="riya@example.com" /></label>
            <label className="crm-form-field"><span>Phone</span><input type="tel" maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="+91 …" /></label>
            <label className="crm-form-field"><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Active</option><option>Inactive</option></select></label>
            {isCustomerApiMode && <label className="crm-form-field"><span>Lifecycle stage</span><select value={form.lifecycleStage} onChange={(event) => setForm({ ...form, lifecycleStage: event.target.value })}><option value="VISITOR">Visitor</option><option value="LEAD">Lead</option><option value="CUSTOMER">Customer</option><option value="REPEAT">Repeat customer</option><option value="LOYAL">Loyal customer</option></select></label>}
            {!isCustomerApiMode && <><label className="crm-form-field"><span>City</span><input maxLength={80} value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="Pune" /></label><label className="crm-form-field"><span>Tags</span><input value={form.tags} onChange={(event) => setForm({ ...form, tags: event.target.value })} placeholder="Repeat, High value" /></label></>}
          </div>
          {error && <div className="crm-error-banner" role="alert">{error}</div>}
          <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="crm-button crm-button-primary" disabled={saving}>{saving ? "Saving…" : "Create customer"}</button></div>
        </form>
      </Modal>}
    </div>
  );
}

export default Customers;
