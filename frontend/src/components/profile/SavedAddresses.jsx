import { useCallback, useEffect, useState } from "react";
import { Building2, Home, Pencil, Trash2, Plus, MapPin } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerAddresses,
  isStorefrontAccountApiEnabled,
  updateCustomerAddress,
} from "../../services/storefrontAccountApiService";

const EMPTY_ADDRESS = {
  label: "HOME", full_name: "", phone: "", address_line1: "", address_line2: "",
  city: "", state: "", postal_code: "", country: "India", is_default: false,
};

function SavedAddresses() {
  const { user, authenticatedRequest } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(Boolean(isStorefrontAccountApiEnabled));
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_ADDRESS);

  const load = useCallback(async () => {
    if (!isStorefrontAccountApiEnabled || user?.role !== "CUSTOMER") {
      setAddresses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setAddresses(await getCustomerAddresses(authenticatedRequest));
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Could not load saved addresses.");
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, user?.id, user?.role]);

  useEffect(() => { load(); }, [load]);

  function startAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_ADDRESS, full_name: user?.name || "" });
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function startEdit(address) {
    setEditingId(address.id);
    setForm({ ...EMPTY_ADDRESS, ...address });
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function setField(field, value) { setForm((current) => ({ ...current, [field]: value })); }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = { ...form };
      if (editingId) await updateCustomerAddress(editingId, payload, authenticatedRequest);
      else await createCustomerAddress(payload, authenticatedRequest);
      setShowForm(false);
      setEditingId(null);
      setNotice(editingId ? "Address updated." : "Address saved.");
      await load();
    } catch (requestError) {
      setError(requestError.message || "Could not save this address.");
    } finally {
      setSaving(false);
    }
  }

  async function removeAddress(address) {
    if (!window.confirm(`Delete the ${address.label?.toLowerCase() || "saved"} address?`)) return;
    setError("");
    setNotice("");
    try {
      await deleteCustomerAddress(address.id, authenticatedRequest);
      setNotice("Address deleted.");
      await load();
    } catch (requestError) {
      setError(requestError.message || "Could not delete this address.");
    }
  }

  const labelIcon = (label) => label === "WORK" ? Building2 : label === "HOME" ? Home : MapPin;

  return (
    <section className="profile-card">
      <div className="profile-card-header">
        <div><h2>Saved Addresses</h2><p>Manage your saved delivery and work addresses.</p></div>
        {isStorefrontAccountApiEnabled && user?.role === "CUSTOMER" && <button type="button" className="text-action-button" onClick={startAdd}>Manage / Add</button>}
      </div>
      {error && <div className="crm-error-banner" role="alert">{error}</div>}
      {notice && <p role="status" className="support-success-notice">{notice}</p>}
      {loading ? <p>Loading saved addresses…</p> : addresses.length ? (
        <div className="address-list">
          {addresses.map((address) => {
            const Icon = labelIcon(address.label);
            return <div className="profile-address-card" key={address.id}>
              <div className="profile-address-icon"><Icon size={20} /></div>
              <div className="profile-address-content">
                <div className="profile-address-title"><strong>{address.label === "HOME" ? "Home" : address.label === "WORK" ? "Work" : "Other"}</strong>{address.is_default && <span>Default</span>}</div>
                <p>{address.full_name} · {address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}, {address.city}, {address.state} {address.postal_code}, {address.country}</p>
                <small>{address.phone}</small>
              </div>
              <div className="address-actions"><button type="button" aria-label="Edit address" onClick={() => startEdit(address)}><Pencil size={16} /></button><button type="button" aria-label="Delete address" onClick={() => removeAddress(address)}><Trash2 size={16} /></button></div>
            </div>;
          })}
        </div>
      ) : <div className="support-customer-empty"><MapPin size={24}/><strong>No saved addresses yet</strong><p>Add an address to make future checkout easier.</p></div>}
      {isStorefrontAccountApiEnabled && user?.role === "CUSTOMER" && !showForm && <button type="button" className="add-profile-item-button" onClick={startAdd}><Plus size={17}/> Add New Address</button>}
      {showForm && <form className="profile-edit-form address-editor-form" onSubmit={save}>
        <h3>{editingId ? "Edit address" : "Add new address"}</h3>
        <label>Address type<select value={form.label} onChange={(event) => setField("label", event.target.value)}><option value="HOME">Home</option><option value="WORK">Work / College</option><option value="OTHER">Other</option></select></label>
        <label>Recipient name<input required maxLength={150} value={form.full_name} onChange={(event) => setField("full_name", event.target.value)} /></label>
        <label>Phone<input required maxLength={20} value={form.phone} onChange={(event) => setField("phone", event.target.value)} /></label>
        <label>Address line 1<input required maxLength={250} value={form.address_line1} onChange={(event) => setField("address_line1", event.target.value)} /></label>
        <label>Address line 2<input maxLength={250} value={form.address_line2} onChange={(event) => setField("address_line2", event.target.value)} /></label>
        <div className="address-editor-grid"><label>City<input required value={form.city} onChange={(event) => setField("city", event.target.value)} /></label><label>State<input required value={form.state} onChange={(event) => setField("state", event.target.value)} /></label></div>
        <div className="address-editor-grid"><label>Postal code<input required minLength={3} value={form.postal_code} onChange={(event) => setField("postal_code", event.target.value)} /></label><label>Country<input required value={form.country} onChange={(event) => setField("country", event.target.value)} /></label></div>
        <label className="address-default-option"><input type="checkbox" checked={form.is_default} onChange={(event) => setField("is_default", event.target.checked)} /> Set as default address</label>
        <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="crm-button crm-button-primary" disabled={saving}>{saving ? "Saving…" : "Save address"}</button></div>
      </form>}
      {!isStorefrontAccountApiEnabled && <p className="support-demo-notice">Demo mode · saved addresses are not connected to the backend yet.</p>}
    </section>
  );
}

export default SavedAddresses;
