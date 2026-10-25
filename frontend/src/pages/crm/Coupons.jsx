import { useCallback, useEffect, useState } from "react";
import {  Power, RefreshCw, Tag } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { createDiscountCoupon, getDiscountCoupons, updateDiscountCoupon } from "../../services/crmCommerceOpsApiService";
import { crmCouponsMode } from "../../services/crmService";
import { EmptyState, MetricCard, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
const dateLabel = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "No date limit";
const blankForm = () => ({ code: "", name: "", discountType: "PERCENT", value: "10", minOrderValue: "0", maxDiscount: "", usageLimit: "", startsAt: "", endsAt: "", isActive: true });

function Coupons() {
  const { authenticatedRequest } = useAuth();
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(async () => {
    if (crmCouponsMode !== "api") { setLoading(false); return; }
    setLoading(true); setError("");
    try { setCoupons(await getDiscountCoupons({ search, active: activeFilter }, authenticatedRequest)); }
    catch (err) { setError(err?.message || "Could not load coupons."); }
    finally { setLoading(false); }
  }, [authenticatedRequest, search, activeFilter, reloadToken]);
  useEffect(() => { refresh(); }, [refresh]);

  function change(event) {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function save(event) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      const saved = await createDiscountCoupon(form, authenticatedRequest);
      setNotice(`Coupon ${saved.code} was saved. Storefront coupon checks are preview-only until real API order placement is implemented.`);
      setForm(blankForm()); setReloadToken((value) => value + 1);
    } catch (err) { setError(err?.message || "Could not save the coupon."); }
    finally { setSaving(false); }
  }

  async function toggle(coupon) {
    setUpdatingId(coupon.id); setError(""); setNotice("");
    try {
      const updated = await updateDiscountCoupon(coupon.id, { isActive: !coupon.isActive }, authenticatedRequest);
      setCoupons((current) => current.map((item) => item.id === coupon.id ? updated : item));
      setNotice(`${coupon.code} is now ${updated.isActive ? "active" : "inactive"}.`);
    } catch (err) { setError(err?.message || "Could not update coupon status."); }
    finally { setUpdatingId(null); }
  }

  const activeCount = coupons.filter((item) => item.isActive).length;
  const usageCapacity = coupons.filter((item) => item.usageLimit != null).length;

  return <div className="crm-page">
    <PageHeader title="Coupons & Discounts" description="Create percentage or fixed-value coupons and validate them against the server-held storefront cart." action={<button className="crm-button crm-button-secondary crm-button-small" type="button" onClick={() => setReloadToken((value) => value + 1)}><RefreshCw size={13}/> Refresh</button>}/>
    {crmCouponsMode !== "api" && <div className="crm-demo-notice">API mode is not enabled. Add VITE_CRM_COUPONS_MODE=api to frontend/.env.local and restart Vite.</div>}
    <div className="crm-demo-notice">Coupon validation checks the backend cart, price, dates and limits. Because order placement is still demo-only, coupon redemptions are not incremented and usage limits are not yet an enforceable checkout limit.</div>
    {notice && <div className="crm-success-banner" role="status">{notice}</div>}
    {error && <div className="crm-error-banner" role="alert">{error}</div>}
    <div className="crm-metrics-grid">
      <MetricCard label="Coupons" value={coupons.length} note="Matches current filter" tone="blue"/>
      <MetricCard label="Active coupons" value={activeCount} note="Enabled for storefront validation" tone="green"/>
      <MetricCard label="Usage-limited" value={usageCapacity} note="Limit is preview-only without order API" tone="orange"/>
      <MetricCard label="Coupon type" value="Percent / Fixed" note="Discount is capped to cart value" tone="purple"/>
    </div>
    <SectionCard title="Create a coupon" subtitle="Use an uppercase code with no spaces. Leave start/end empty for no schedule window.">
      <form className="crm-form" onSubmit={save}>
        <div className="crm-form-grid">
          <label className="crm-form-field"><span>Coupon code *</span><input name="code" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]{3,32}" value={form.code} onChange={change} placeholder="TECH10"/></label>
          <label className="crm-form-field"><span>Display name *</span><input name="name" required maxLength={120} value={form.name} onChange={change} placeholder="Welcome offer"/></label>
          <label className="crm-form-field"><span>Discount type *</span><select name="discountType" value={form.discountType} onChange={change}><option value="PERCENT">Percentage</option><option value="FIXED">Fixed amount (₹)</option></select></label>
          <label className="crm-form-field"><span>{form.discountType === "PERCENT" ? "Percentage (1–100) *" : "Discount amount (₹) *"}</span><input name="value" required type="number" min="0.01" max={form.discountType === "PERCENT" ? "100" : undefined} step="0.01" value={form.value} onChange={change}/></label>
          <label className="crm-form-field"><span>Minimum cart value (₹)</span><input name="minOrderValue" type="number" min="0" step="0.01" value={form.minOrderValue} onChange={change}/></label>
          <label className="crm-form-field"><span>Maximum discount (₹, optional)</span><input name="maxDiscount" type="number" min="0.01" step="0.01" value={form.maxDiscount} onChange={change} placeholder="No cap"/></label>
          <label className="crm-form-field"><span>Usage limit (optional)</span><input name="usageLimit" type="number" min="1" step="1" value={form.usageLimit} onChange={change} placeholder="Unlimited"/></label>
          <label className="crm-form-field"><span>Start date/time (optional)</span><input name="startsAt" type="datetime-local" value={form.startsAt} onChange={change}/></label>
          <label className="crm-form-field"><span>End date/time (optional)</span><input name="endsAt" type="datetime-local" value={form.endsAt} onChange={change}/></label>
          <label className="crm-form-field crm-check-field"><input name="isActive" type="checkbox" checked={form.isActive} onChange={change}/><span>Active immediately (subject to schedule)</span></label>
        </div>
        <div className="crm-form-actions"><button className="crm-button crm-button-primary" type="submit" disabled={saving || crmCouponsMode !== "api"}><Tag size={14}/>{saving ? "Saving coupon…" : "Create coupon"}</button></div>
      </form>
    </SectionCard>
    <SectionCard title="Coupon catalogue" subtitle="Disable an old coupon instead of deleting it when possible.">
      <div className="crm-toolbar"><label className="crm-search-field"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code or offer name…"/></label><label className="crm-filter-field"><span>Status</span><select value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}><option value="All">All statuses</option><option value="true">Active</option><option value="false">Inactive</option></select></label><span className="crm-result-count">{coupons.length} coupons</span></div>
      {loading ? <div className="crm-loading">Loading coupons…</div> : coupons.length === 0 ? <EmptyState title="No coupons found" message="Create a coupon to make it available for storefront validation."/> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Code / name</th><th>Discount</th><th>Minimum cart</th><th>Schedule</th><th>Usage</th><th>Status</th><th>Action</th></tr></thead><tbody>{coupons.map((coupon) => <tr key={coupon.id}><td><strong>{coupon.code}</strong><small>{coupon.name}</small></td><td>{coupon.discountType === "PERCENT" ? `${coupon.value}%` : money(coupon.value)}{coupon.maxDiscount != null && <small>Max {money(coupon.maxDiscount)}</small>}</td><td>{money(coupon.minOrderValue)}</td><td><small>From: {dateLabel(coupon.startsAt)}</small><small>Until: {dateLabel(coupon.endsAt)}</small></td><td>{coupon.usedCount}{coupon.usageLimit != null ? ` / ${coupon.usageLimit}` : " / unlimited"}</td><td><StatusBadge status={coupon.isActive ? "Active" : "Inactive"}/></td><td><button type="button" className="crm-button crm-button-secondary crm-button-small" disabled={updatingId === coupon.id} onClick={() => toggle(coupon)}><Power size={12}/>{coupon.isActive ? "Disable" : "Enable"}</button></td></tr>)}</tbody></table></div>}
    </SectionCard>
  </div>;
}

export default Coupons;
