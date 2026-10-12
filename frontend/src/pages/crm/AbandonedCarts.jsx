import { useCallback, useEffect, useState } from "react";
import { Clock3, RefreshCw, ShoppingCart } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getAbandonedCarts } from "../../services/crmCommerceOpsApiService";
import { crmAbandonedCartsMode } from "../../services/crmService";
import { EmptyState, MetricCard, PageHeader, SectionCard } from "../../components/crm/CrmUI";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value) || 0);
const dateLabel = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

function AbandonedCarts() {
  const { authenticatedRequest } = useAuth();
  const [carts, setCarts] = useState([]);
  const [minAgeHours, setMinAgeHours] = useState("24");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const [summary, setSummary] = useState({ count: 0, minAgeHours: 24 });

  const refresh = useCallback(async () => {
    if (crmAbandonedCartsMode !== "api") { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const result = await getAbandonedCarts({ minAgeHours, search }, authenticatedRequest);
      setCarts(result.items); setSummary({ count: result.count, minAgeHours: result.minAgeHours });
    } catch (err) { setError(err?.message || "Could not load abandoned carts."); }
    finally { setLoading(false); }
  }, [authenticatedRequest, minAgeHours, search, reloadToken]);
  useEffect(() => { refresh(); }, [refresh]);
  const estimatedValue = carts.reduce((sum, cart) => sum + cart.subtotal, 0);
  const totalItems = carts.reduce((sum, cart) => sum + cart.quantityCount, 0);

  return <div className="crm-page">
    <PageHeader title="Abandoned Carts" description="Review old non-empty carts and their current catalogue value. Visitor identifiers are partially masked; no customer email or phone is available in this model." action={<button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => setReloadToken((value) => value + 1)}><RefreshCw size={13}/> Refresh</button>}/>
    {crmAbandonedCartsMode !== "api" && <div className="crm-demo-notice">API mode is not enabled. Add VITE_CRM_ABANDONED_CARTS_MODE=api and restart Vite.</div>}
    <div className="crm-demo-notice">Recovery messaging is not configured in this phase. This screen only reports persisted carts; it does not email, SMS or notify visitors.</div>
    {error && <div className="crm-error-banner" role="alert">{error}</div>}
    <div className="crm-metrics-grid">
      <MetricCard label="Abandoned carts" value={carts.length} note={`Not updated for ${summary.minAgeHours}h or more`} tone="blue"/>
      <MetricCard label="Estimated cart value" value={money(estimatedValue)} note="Current product prices; not order revenue" tone="green"/>
      <MetricCard label="Items in carts" value={totalItems} note="Total unit quantity" tone="purple"/>
      <MetricCard label="Recovery status" value="Report only" note="No recovery delivery provider configured" tone="orange"/>
    </div>
    <SectionCard title="Old carts" subtitle="Age is measured from the last saved cart update, not from a checkout-start event.">
      <div className="crm-toolbar"><label className="crm-filter-field"><span>Minimum age</span><select value={minAgeHours} onChange={(event) => setMinAgeHours(event.target.value)}><option value="1">1+ hour</option><option value="6">6+ hours</option><option value="12">12+ hours</option><option value="24">24+ hours</option><option value="48">48+ hours</option><option value="72">72+ hours</option><option value="168">7+ days</option></select></label><label className="crm-search-field"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, SKU or visitor hint…"/></label><span className="crm-result-count">{carts.length} carts</span></div>
      {loading ? <div className="crm-loading">Loading abandoned carts…</div> : carts.length === 0 ? <EmptyState title="No old carts found" message="Try a shorter age window or test from another browser visitor. Current non-empty carts are listed after the selected inactive period."/> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Visitor</th><th>Cart items</th><th>Current value</th><th>Last updated</th><th>Age</th></tr></thead><tbody>{carts.map((cart) => <tr key={cart.id}><td><strong>{cart.visitorHint}</strong><small>Cart ID: {cart.id}</small></td><td><strong>{cart.itemCount} product(s) · {cart.quantityCount} unit(s)</strong><small>{cart.productNames.join(", ") || "No product names"}</small></td><td>{money(cart.subtotal)}</td><td>{dateLabel(cart.updatedAt)}</td><td><span className="crm-abandoned-age"><Clock3 size={13}/>{cart.ageHours}h</span></td></tr>)}</tbody></table></div>}
    </SectionCard>
  </div>;
}

export default AbandonedCarts;
