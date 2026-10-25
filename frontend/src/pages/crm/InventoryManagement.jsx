import { useCallback, useEffect, useMemo, useState } from "react";
import {   RefreshCw, SlidersHorizontal } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getProducts } from "../../services/crmService";
import { createInventoryAdjustment, getInventoryMovements } from "../../services/crmCommerceOpsApiService";
import { crmInventoryMode } from "../../services/crmService";
import { EmptyState, MetricCard, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";


const dateLabel = (value) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";
const initialForm = () => ({ productId: "", direction: "ADD", quantity: "1", movementType: "RESTOCK", reason: "" });

function InventoryManagement() {
  const { authenticatedRequest } = useAuth();
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(async () => {
    if (crmInventoryMode !== "api") { setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const [productRows, movementRows] = await Promise.all([
        getProducts({ includeInactive: true, status: "All" }, authenticatedRequest),
        getInventoryMovements({ search, movementType: typeFilter }, authenticatedRequest),
      ]);
      setProducts(productRows);
      setMovements(movementRows);
      setForm((current) => ({ ...current, productId: current.productId || String(productRows[0]?.id || "") }));
    } catch (err) { setError(err?.message || "Could not load inventory data."); }
    finally { setLoading(false); }
  }, [authenticatedRequest, search, typeFilter, reloadToken]);

  useEffect(() => { refresh(); }, [refresh]);

  const selectedProduct = products.find((item) => String(item.id) === String(form.productId));
  const lowStockCount = useMemo(() => products.filter((item) => item.status === "Active" && Number(item.stock) <= 5).length, [products]);
  const totalUnits = useMemo(() => products.reduce((sum, item) => sum + Math.max(0, Number(item.stock) || 0), 0), [products]);

  function changeForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value, ...(name === "direction" ? { movementType: value === "ADD" ? "RESTOCK" : value === "REMOVE" ? "ADJUSTMENT" : "COUNT_CORRECTION" } : {}) }));
  }

  async function saveAdjustment(event) {
    event.preventDefault(); setError(""); setNotice(""); setSaving(true);
    try {
      if (!form.productId) throw new Error("Choose a product first.");
      const result = await createInventoryAdjustment({ ...form, productId: Number(form.productId), quantity: Number(form.quantity) }, authenticatedRequest);
      setNotice(`${result.productName}: stock ${result.stockBefore} → ${result.stockAfter} saved to inventory history.`);
      setForm((current) => ({ ...current, quantity: "1", reason: "" }));
      setReloadToken((value) => value + 1);
    } catch (err) { setError(err?.message || "Could not save the inventory adjustment."); }
    finally { setSaving(false); }
  }

  return <div className="crm-page">
    <PageHeader title="Inventory Management" description="Adjust stock with a reason and keep a persistent, organization-scoped movement history." action={<button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => setReloadToken((value) => value + 1)}><RefreshCw size={13}/> Refresh</button>} />
    {crmInventoryMode !== "api" && <div className="crm-demo-notice">API mode is not enabled. Add VITE_CRM_INVENTORY_MODE=api to frontend/.env.local and restart Vite.</div>}
    {notice && <div className="crm-success-banner" role="status">{notice}</div>}
    {error && <div className="crm-error-banner" role="alert">{error}</div>}
    <div className="crm-metrics-grid">
      <MetricCard label="Catalogue products" value={products.length} note="All product statuses" tone="blue"/>
      <MetricCard label="Units in stock" value={totalUnits.toLocaleString("en-IN")} note="Current catalogue quantity" tone="green"/>
      <MetricCard label="Low stock" value={lowStockCount} note="Active products with 5 or fewer units" tone="orange"/>
      <MetricCard label="Recent movements" value={movements.length} note="Latest up to 300 records" tone="purple"/>
    </div>
    <SectionCard title="Record a stock movement" subtitle="Use Add for deliveries/returns, Remove for damage/write-off, or Set exact stock for a count correction.">
      <form className="crm-form" onSubmit={saveAdjustment}>
        <div className="crm-form-grid">
          <label className="crm-form-field"><span>Product *</span><select name="productId" required value={form.productId} onChange={changeForm}><option value="">Select product</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name} · {product.sku} · Stock {product.stock}</option>)}</select>{selectedProduct && <small>Current stock: {selectedProduct.stock}</small>}</label>
          <label className="crm-form-field"><span>Adjustment type *</span><select name="direction" value={form.direction} onChange={changeForm}><option value="ADD">Add quantity</option><option value="REMOVE">Remove quantity</option><option value="SET">Set exact stock count</option></select></label>
          <label className="crm-form-field"><span>{form.direction === "SET" ? "New stock quantity *" : "Quantity *"}</span><input name="quantity" type="number" min={form.direction === "SET" ? "0" : "1"} max="1000000" step="1" required value={form.quantity} onChange={changeForm}/></label>
          <label className="crm-form-field"><span>Movement type *</span><select name="movementType" value={form.movementType} onChange={changeForm}><option value="ADJUSTMENT">Manual adjustment</option><option value="RESTOCK">Restock</option><option value="DAMAGE">Damaged / written off</option><option value="RETURN">Customer return</option><option value="COUNT_CORRECTION">Stock count correction</option></select></label>
          <label className="crm-form-field crm-comm-span-two"><span>Notes (optional)</span><input name="reason" maxLength={500} value={form.reason} onChange={changeForm} placeholder="e.g. Supplier invoice INV-102 or annual stock count"/></label>
        </div>
        <div className="crm-form-actions"><button className="crm-button crm-button-primary" type="submit" disabled={saving || loading || !products.length}><SlidersHorizontal size={14}/>{saving ? "Saving movement…" : "Save stock movement"}</button></div>
      </form>
    </SectionCard>
    <SectionCard title="Inventory movement history" subtitle="Stock changes initiated through this page and product stock edits are recorded here.">
      <div className="crm-toolbar">
        <label className="crm-search-field"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, SKU or notes…"/></label>
        <label className="crm-filter-field"><span>Movement</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="All">All types</option><option value="RESTOCK">Restock</option><option value="DAMAGE">Damage</option><option value="RETURN">Return</option><option value="ADJUSTMENT">Adjustment</option><option value="COUNT_CORRECTION">Count correction</option></select></label>
        <span className="crm-result-count">{movements.length} movements</span>
      </div>
      {loading ? <div className="crm-loading">Loading inventory…</div> : movements.length === 0 ? <EmptyState title="No stock movements yet" message="Make a stock adjustment or edit a product's stock to create the first record."/> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>When</th><th>Product / SKU</th><th>Type</th><th>Change</th><th>Before</th><th>After</th><th>Actor</th><th>Reason</th></tr></thead><tbody>{movements.map((item) => <tr key={item.id}><td>{dateLabel(item.createdAt)}</td><td><strong>{item.productName}</strong><small>{item.sku}</small></td><td><StatusBadge status={item.movementType.replaceAll("_", " ")}/></td><td><strong className={item.quantityDelta > 0 ? "crm-stock-positive" : "crm-stock-negative"}>{item.quantityDelta > 0 ? "+" : ""}{item.quantityDelta}</strong></td><td>{item.stockBefore}</td><td>{item.stockAfter}</td><td>{item.actorEmail}</td><td>{item.reason}</td></tr>)}</tbody></table></div>}
    </SectionCard>
  </div>;
}

export default InventoryManagement;
