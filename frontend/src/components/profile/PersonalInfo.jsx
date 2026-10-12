import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getCustomerProfile, isStorefrontAccountApiEnabled, updateCustomerProfile } from "../../services/storefrontAccountApiService";

const EMPTY_PROFILE = {
  first_name: "", last_name: "", email: "", phone: "", date_of_birth: "",
  gender: "UNSPECIFIED", email_updates: true, sms_updates: false, whatsapp_updates: false,
};

function PersonalInfo() {
  const { user, authenticatedRequest, refreshCurrentUser } = useAuth();
  const [profile, setProfile] = useState(() => ({
    ...EMPTY_PROFILE,
    first_name: String(user?.name || "").split(/\s+/)[0] || "",
    last_name: String(user?.name || "").split(/\s+/).slice(1).join(" "),
    email: user?.email || "",
  }));
  const [draft, setDraft] = useState(profile);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(Boolean(isStorefrontAccountApiEnabled));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!isStorefrontAccountApiEnabled || user?.role !== "CUSTOMER") {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await getCustomerProfile(authenticatedRequest);
      const next = { ...EMPTY_PROFILE, ...(result || {}) };
      setProfile(next);
      setDraft(next);
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest, user?.id, user?.role]);

  useEffect(() => { load(); }, [load]);

  const setField = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await updateCustomerProfile({
        first_name: draft.first_name.trim(),
        last_name: draft.last_name.trim(),
        phone: draft.phone.trim(),
        date_of_birth: draft.date_of_birth || null,
        gender: draft.gender,
        email_updates: Boolean(draft.email_updates),
        sms_updates: Boolean(draft.sms_updates),
        whatsapp_updates: Boolean(draft.whatsapp_updates),
      }, authenticatedRequest);
      const next = { ...EMPTY_PROFILE, ...(result || {}) };
      setProfile(next);
      setDraft(next);
      if (typeof refreshCurrentUser === "function") await refreshCurrentUser();
      setEditing(false);
      setNotice("Profile changes saved.");
    } catch (requestError) {
      setError(requestError.message || "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="profile-card">
      <div className="profile-card-header">
        <div><h2>Personal Information</h2><p>Your basic account information.</p></div>
        {isStorefrontAccountApiEnabled && user?.role === "CUSTOMER" && !editing && (
          <button type="button" className="outline-action-button" onClick={() => { setDraft(profile); setEditing(true); setNotice(""); }}>Edit</button>
        )}
      </div>
      {error && <div className="crm-error-banner" role="alert">{error}</div>}
      {notice && <p role="status" className="support-success-notice">{notice}</p>}
      {loading ? <p>Loading profile…</p> : editing ? (
        <form onSubmit={save} className="profile-edit-form">
          <label>First name<input required maxLength={150} value={draft.first_name} onChange={(event) => setField("first_name", event.target.value)} /></label>
          <label>Last name<input maxLength={150} value={draft.last_name} onChange={(event) => setField("last_name", event.target.value)} /></label>
          <label>Email address<input value={profile.email || user?.email || ""} readOnly /></label>
          <label>Mobile number<input maxLength={20} value={draft.phone} onChange={(event) => setField("phone", event.target.value)} /></label>
          <label>Date of birth<input type="date" value={draft.date_of_birth || ""} onChange={(event) => setField("date_of_birth", event.target.value)} /></label>
          <label>Gender<select value={draft.gender} onChange={(event) => setField("gender", event.target.value)}><option value="UNSPECIFIED">Not specified</option><option value="FEMALE">Female</option><option value="MALE">Male</option><option value="NON_BINARY">Non-binary</option><option value="PREFER_NOT_TO_SAY">Prefer not to say</option></select></label>
          <div className="profile-preference-options">
            <label><input type="checkbox" checked={draft.email_updates} onChange={(event) => setField("email_updates", event.target.checked)} /> Email updates</label>
            <label><input type="checkbox" checked={draft.sms_updates} onChange={(event) => setField("sms_updates", event.target.checked)} /> SMS updates</label>
            <label><input type="checkbox" checked={draft.whatsapp_updates} onChange={(event) => setField("whatsapp_updates", event.target.checked)} /> WhatsApp updates</label>
          </div>
          <div className="crm-form-actions"><button className="crm-button crm-button-secondary" type="button" onClick={() => { setDraft(profile); setEditing(false); }}>Cancel</button><button className="crm-button crm-button-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button></div>
        </form>
      ) : (
        <div className="personal-info-grid">
          <div><span>Full Name</span><strong>{[profile.first_name, profile.last_name].filter(Boolean).join(" ") || user?.name || "Not provided"}</strong></div>
          <div><span>Email Address</span><strong>{profile.email || user?.email || "Not provided"}</strong></div>
          <div><span>Mobile Number</span><strong>{profile.phone || "Not provided"}</strong></div>
          <div><span>Date of Birth</span><strong>{profile.date_of_birth || "Not specified"}</strong></div>
          <div><span>Gender</span><strong>{({ UNSPECIFIED: "Not specified", FEMALE: "Female", MALE: "Male", NON_BINARY: "Non-binary", PREFER_NOT_TO_SAY: "Prefer not to say" })[profile.gender] || "Not specified"}</strong></div>
          <div><span>Communication Preferences</span><strong>{[profile.email_updates && "Email", profile.sms_updates && "SMS", profile.whatsapp_updates && "WhatsApp"].filter(Boolean).join(", ") || "None selected"}</strong></div>
        </div>
      )}
      {!isStorefrontAccountApiEnabled && <p className="support-demo-notice">Demo profile · enable storefront account API mode to save changes to Django.</p>}
    </section>
  );
}

export default PersonalInfo;
