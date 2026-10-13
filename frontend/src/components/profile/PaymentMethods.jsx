import { useCallback, useEffect, useState } from "react";
import { CreditCard, Smartphone, Pencil, Trash2, Plus, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  createCustomerPaymentMethod,
  deleteCustomerPaymentMethod,
  getCustomerPaymentMethods,
  isStorefrontAccountApiEnabled,
  updateCustomerPaymentMethod,
} from "../../services/storefrontAccountApiService";

const EMPTY_FORM = { method_type: "UPI", label: "", provider: "", upi_id: "", last_four: "", is_default: false };

function PaymentMethods() {
  const { user, authenticatedRequest } = useAuth();
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(Boolean(isStorefrontAccountApiEnabled));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = useCallback(async () => {
    if (!isStorefrontAccountApiEnabled || user?.role !== "CUSTOMER") {
      setMethods([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setMethods(await getCustomerPaymentMethods(authenticatedRequest));
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Could not load saved payment methods.");
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, user?.id, user?.role]);

  useEffect(() => { load(); }, [load]);

  function startAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, is_default: methods.length === 0 });
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function startEdit(method) {
    setEditingId(method.id);
    setForm({ ...EMPTY_FORM, ...method });
    setShowForm(true);
    setError("");
    setNotice("");
  }

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    const payload = {
      method_type: form.method_type,
      label: form.label.trim(),
      provider: form.provider.trim(),
      upi_id: form.method_type === "UPI" ? form.upi_id.trim() : "",
      last_four: form.method_type === "CARD" ? form.last_four.trim() : "",
      is_default: Boolean(form.is_default),
    };
    try {
      if (editingId) await updateCustomerPaymentMethod(editingId, payload, authenticatedRequest);
      else await createCustomerPaymentMethod(payload, authenticatedRequest);
      setShowForm(false);
      setEditingId(null);
      setNotice(editingId ? "Payment method updated." : "Payment method saved.");
      await load();
    } catch (requestError) {
      setError(requestError.message || "Could not save this payment method.");
    } finally {
      setSaving(false);
    }
  }

  async function removeMethod(method) {
    if (!window.confirm(`Remove ${method.label || "this payment method"}?`)) return;
    setError("");
    setNotice("");
    try {
      await deleteCustomerPaymentMethod(method.id, authenticatedRequest);
      setNotice("Payment method removed.");
      await load();
    } catch (requestError) {
      setError(requestError.message || "Could not remove this payment method.");
    }
  }

  return (
    <section className="profile-card">
      <div className="profile-card-header">
        <div><h2>Payment Methods</h2><p>Save a masked payment reference for your account.</p></div>
        {isStorefrontAccountApiEnabled && user?.role === "CUSTOMER" && !showForm && <button type="button" className="text-action-button" onClick={startAdd}>Manage Payment Methods</button>}
      </div>
      {error && <div className="crm-error-banner" role="alert">{error}</div>}
      {notice && <p role="status" className="support-success-notice">{notice}</p>}
      {loading ? <p>Loading saved payment methods…</p> : methods.length ? (
        <div className="payment-list">
          {methods.map((payment) => (
            <div className="profile-payment-card" key={payment.id}>
              <div className="payment-brand-icon">{payment.method_type === "UPI" ? <Smartphone size={20}/> : <CreditCard size={20}/>}</div>
              <div className="payment-method-info">
                <div><strong>{payment.label}</strong>{payment.is_default && <span>Default</span>}</div>
                <small>{payment.method_type === "UPI" ? payment.upi_id : `${payment.provider || "Card"} · ending ${payment.last_four}`}</small>
                <small className="payment-safe-note">Saved reference only · not enabled for charging</small>
              </div>
              <div className="payment-actions">
                <button type="button" aria-label="Edit payment method" onClick={() => startEdit(payment)}><Pencil size={16}/></button>
                <button type="button" aria-label="Delete payment method" onClick={() => removeMethod(payment)}><Trash2 size={16}/></button>
              </div>
            </div>
          ))}
        </div>
      ) : <div className="support-customer-empty"><CreditCard size={24}/><strong>No saved payment methods yet</strong><p>Save a UPI ID or a card label with only its last four digits. Never enter a full card number or CVV.</p></div>}

      {isStorefrontAccountApiEnabled && user?.role === "CUSTOMER" && !showForm && <button type="button" className="add-profile-item-button" onClick={startAdd}><Plus size={17}/> Add New Payment Method</button>}
      {showForm && <form className="profile-edit-form payment-method-editor" onSubmit={save}>
        <h3>{editingId ? "Edit saved payment reference" : "Add a payment reference"}</h3>
        <div className="address-editor-grid">
          <label>Payment type<select value={form.method_type} onChange={(event) => setField("method_type", event.target.value)}><option value="UPI">UPI</option><option value="CARD">Card</option></select></label>
          <label>Display name<input required maxLength={100} placeholder={form.method_type === "UPI" ? "e.g. Google Pay" : "e.g. HDFC debit card"} value={form.label} onChange={(event) => setField("label", event.target.value)}/></label>
        </div>
        <label>{form.method_type === "UPI" ? "UPI provider (optional)" : "Card network / bank (optional)"}<input maxLength={80} placeholder={form.method_type === "UPI" ? "e.g. Google Pay" : "e.g. Visa · HDFC"} value={form.provider} onChange={(event) => setField("provider", event.target.value)}/></label>
        {form.method_type === "UPI" ? <label>UPI ID<input required maxLength={150} placeholder="name@provider" value={form.upi_id} onChange={(event) => setField("upi_id", event.target.value)}/></label> : <label>Card last four digits<input required inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} placeholder="1234" value={form.last_four} onChange={(event) => setField("last_four", event.target.value.replace(/\D/g, "").slice(0, 4))}/></label>}
        <label className="address-default-option"><input type="checkbox" checked={Boolean(form.is_default)} onChange={(event) => setField("is_default", event.target.checked)}/> Set as default</label>
        <div className="payment-safety-notice"><ShieldCheck size={17}/><span>Do not enter a full card number, expiry date, CVV, banking password or OTP. These records are display references only; the store cannot charge using them.</span></div>
        <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="crm-button crm-button-primary" disabled={saving}>{saving ? "Saving…" : "Save payment method"}</button></div>
      </form>}
      {!isStorefrontAccountApiEnabled && <p className="support-demo-notice">Demo mode · saved payment methods are not connected to the backend. Static sample payment records are not shown as real saved details.</p>}
    </section>
  );
}

export default PaymentMethods;
