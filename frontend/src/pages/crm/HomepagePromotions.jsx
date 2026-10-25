import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check,  Package, RotateCcw, Save, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { crmHomepagePromotionsMode, getProducts } from "../../services/crmService";
import { getHomepagePromotionSettings, loadHomepagePromotionSettings, saveHomepagePromotionSettings } from "../../services/homepagePromotionsService";
import { EmptyState, MetricCard, PageHeader, SectionCard } from "../../components/crm/CrmUI";

const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);

function HomepagePromotions() {
  const { user, authenticatedRequest } = useAuth();
  const [products, setProducts] = useState([]);
  const [config, setConfig] = useState(() => getHomepagePromotionSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const refreshProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await getProducts({ includeInactive: true, status: "Active" }, authenticatedRequest);
      setProducts(Array.isArray(rows) ? rows.filter((item) => item.status === "Active" && Number(item.stock) > 0) : []);
    } catch (err) {
      setError(err.message || "Could not load active products.");
    } finally {
      setLoading(false);
    }
  }, [authenticatedRequest]);

  useEffect(() => { refreshProducts(); }, [refreshProducts]);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      loadHomepagePromotionSettings(authenticatedRequest)
        .then((saved) => { if (active) setConfig(saved); })
        .catch((err) => { if (active) setError(err.message || "Could not load homepage promotion settings."); });
    };
    refresh();
    window.addEventListener("techgear:homepage-promotions-updated", refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("techgear:product-catalog-updated", refreshProducts);
    return () => {
      active = false;
      window.removeEventListener("techgear:homepage-promotions-updated", refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("techgear:product-catalog-updated", refreshProducts);
    };
  }, [refreshProducts, authenticatedRequest]);

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((product) => !q || [product.name, product.sku, product.brand, product.category].some((value) => String(value || "").toLowerCase().includes(q)));
  }, [products, search]);
  const selectedSlots = useMemo(() => config.featuredProductIds.map((id) => ({
    id: String(id),
    product: products.find((product) => String(product.id) === String(id)) || null,
  })), [config.featuredProductIds, products]);
  const selectedProducts = useMemo(() => selectedSlots.map((slot) => slot.product).filter(Boolean), [selectedSlots]);

  function changeField(key, value) {
    setConfig((current) => ({ ...current, [key]: value }));
    setNotice(""); setError("");
  }

  function toggleProduct(productId) {
    setConfig((current) => {
      const ids = current.featuredProductIds.map(String);
      const id = String(productId);
      if (ids.includes(id)) return { ...current, selectionMode: "MANUAL", featuredProductIds: ids.filter((item) => item !== id) };
      if (ids.length >= 2) {
        setError("The homepage hero supports two featured product cards. Remove one before adding another.");
        return current;
      }
      setError("");
      return { ...current, selectionMode: "MANUAL", featuredProductIds: [...ids, id] };
    });
    setNotice("");
  }

  function reorder(index, direction) {
    setConfig((current) => {
      const ids = [...current.featuredProductIds];
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= ids.length) return current;
      [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
      return { ...current, selectionMode: "MANUAL", featuredProductIds: ids };
    });
    setNotice("");
  }

  function useAutomaticSelection() {
    setConfig((current) => ({ ...current, selectionMode: "AUTO" }));
    setNotice(""); setError("");
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true); setError(""); setNotice("");
    try {
      if (config.enabled && config.selectionMode === "MANUAL" && config.featuredProductIds.length === 0) throw new Error("Choose at least one featured product, or switch to automatic selection.");
      const liveIds = new Set(products.map((product) => String(product.id)));
      if (config.selectionMode === "MANUAL" && config.featuredProductIds.some((id) => !liveIds.has(String(id)))) {
        throw new Error("One selected product is no longer active/in stock. Remove it or choose another active product.");
      }
      const saved = await saveHomepagePromotionSettings(config, user, authenticatedRequest);
      setConfig(saved);
      setNotice("Homepage promotion settings saved. The customer homepage will use these featured products.");
    } catch (err) {
      setError(err.message || "Could not save homepage promotions.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="crm-page">
      <PageHeader title="Homepage Promotions" description="Marketing chooses which catalogue products appear in the homepage hero. Product price, stock and descriptions remain owned by Product Management." action={<span className="crm-category-header-icon"><Sparkles size={18}/> Marketing workspace</span>} />
      <div className="crm-demo-notice"><strong>{crmHomepagePromotionsMode === "api" ? "Django API mode." : "Demo mode."}</strong> {crmHomepagePromotionsMode === "api" ? "Promotion settings are stored by Django and scoped to your organization." : "Promotion selections are saved in this browser only."} Products must be Active and in stock to be selected. Featured product cards render beside a colour-based hero banner; if the active hero banner uses a full background image, clear that image URL in Banner Management to show the selected product cards.</div>
      {notice && <div className="crm-success-banner" role="status">{notice}</div>}
      {error && <div className="crm-error-banner" role="alert">{error}</div>}

      <div className="crm-metrics-grid crm-metrics-three">
        <MetricCard label="Active products available" value={products.length} note="Only active, in-stock items can be promoted" tone="blue" />
        <MetricCard label="Featured slots selected" value={config.selectionMode === "AUTO" ? "Auto" : selectedProducts.length} note="Up to two hero product cards" tone="purple" />
        <MetricCard label="Promotion status" value={config.enabled ? "Enabled" : "Paused"} note="Controls the hero product card area" tone={config.enabled ? "green" : "orange"} />
      </div>

      <form onSubmit={save}>
        <SectionCard title="Homepage feature settings" subtitle="Marketing controls product selection and copy. Product master data is not changed here." action={<button type="submit" className="crm-button crm-button-primary" disabled={saving}><Save size={15}/>{saving ? "Saving…" : "Save promotion settings"}</button>}>
          <div className="crm-form crm-promo-settings-form">
            <label className="crm-user-active-toggle"><input type="checkbox" checked={config.enabled} onChange={(event) => changeField("enabled", event.target.checked)}/><span><strong>Show featured products in the homepage hero</strong><small>Switch off to hide the product cards while keeping the hero banner.</small></span></label>
            <div className="crm-form-grid">
              <label className="crm-form-field">Featured section heading *<input value={config.sectionTitle} disabled={config.selectionMode === "AUTO"} onChange={(event) => changeField("sectionTitle", event.target.value)} maxLength={100} required placeholder="Featured products"/><small>Used when manual product selection is enabled.</small></label>
              <label className="crm-form-field">Supporting copy<input value={config.subtitle} disabled={config.selectionMode === "AUTO"} onChange={(event) => changeField("subtitle", event.target.value)} maxLength={180} placeholder="Picked by our team"/><small>Used when manual product selection is enabled.</small></label>
            </div>
            <div className="crm-promo-mode-toggle" role="group" aria-label="Featured product selection mode">
              <button type="button" className={config.selectionMode === "AUTO" ? "active" : ""} onClick={useAutomaticSelection}><RotateCcw size={14}/> Automatic selection</button>
              <button type="button" className={config.selectionMode === "MANUAL" ? "active" : ""} onClick={() => changeField("selectionMode", "MANUAL")}><Check size={14}/> Choose products manually</button>
            </div>
            <p className="crm-footnote">Automatic mode displays the first two active, in-stock catalogue products. Manual mode displays the products you select below, in the selected order.</p>
          </div>
        </SectionCard>

        <SectionCard title="Selected featured products" subtitle={config.selectionMode === "AUTO" ? "Switch to manual selection to choose specific products for the homepage." : "Choose up to two products. Use the arrows to choose which card appears first."}>
          {config.selectionMode === "AUTO" ? (
            <div className="crm-promo-auto-preview"><Sparkles size={20}/><div><strong>Automatic catalogue selection is enabled</strong><p>The homepage will display the first two available active products. The marketing team can switch to manual selection any time.</p></div></div>
          ) : (
            <div className="crm-promo-selected-list">
              {selectedSlots.length === 0 ? <EmptyState title="No featured products selected" message="Choose an active product from the catalogue below. The manual hero area will stay empty until a product is selected."/> : selectedSlots.map((slot, index) => slot.product ? (
                <article className="crm-promo-selected-card" key={slot.id}>
                  <span className="crm-promo-slot">{index + 1}</span>
                  <img src={slot.product.images?.[0] || slot.product.image || ""} alt={slot.product.name} onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}/>
                  <div className="crm-promo-selected-copy"><strong>{slot.product.name}</strong><span>{slot.product.brand} · {slot.product.category}</span><b>{money(slot.product.price)}</b></div>
                  <div className="crm-promo-order-actions"><button type="button" className="crm-button crm-button-secondary crm-button-small" aria-label="Move featured product up" disabled={index === 0} onClick={() => reorder(index, -1)}><ArrowUp size={13}/></button><button type="button" className="crm-button crm-button-secondary crm-button-small" aria-label="Move featured product down" disabled={index === selectedSlots.length - 1} onClick={() => reorder(index, 1)}><ArrowDown size={13}/></button><button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => toggleProduct(slot.id)}>Remove</button></div>
                </article>
              ) : (
                <article className="crm-promo-selected-card crm-promo-unavailable" key={slot.id}>
                  <span className="crm-promo-slot">{index + 1}</span><div className="crm-promo-missing-image"><Package size={22}/></div>
                  <div className="crm-promo-selected-copy"><strong>Unavailable product</strong><span>This product is inactive or out of stock. Remove it and choose another.</span></div>
                  <div className="crm-promo-order-actions"><button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => toggleProduct(slot.id)}>Remove</button></div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        {config.selectionMode === "MANUAL" && <SectionCard title="Product catalogue" subtitle="The marketing role can select products but cannot change their catalogue price, stock or status." action={<label className="crm-search-field"><span className="sr-only">Search products</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search product, SKU or category…"/></label>}>
          {loading ? <div className="crm-loading">Loading products…</div> : filteredProducts.length === 0 ? <EmptyState title="No active products found" message="Activate and stock products in Product Management first."/> : (
            <div className="crm-promotion-product-grid">
              {filteredProducts.map((product) => {
                const isSelected = config.featuredProductIds.map(String).includes(String(product.id));
                const full = config.featuredProductIds.length >= 2 && !isSelected;
                return <article className={`crm-promotion-product-card ${isSelected ? "is-selected" : ""}`} key={product.id}>
                  <div className="crm-promotion-product-image">{(product.images?.[0] || product.image) ? <img src={product.images?.[0] || product.image} alt={product.name}/> : <Package size={28}/>}</div>
                  <div className="crm-promotion-product-info"><strong>{product.name}</strong><span>{product.brand} · {product.category}</span><b>{money(product.price)}</b><small>Stock: {product.stock}</small></div>
                  <button type="button" className={`crm-button ${isSelected ? "crm-button-primary" : "crm-button-secondary"} crm-button-small`} disabled={full} onClick={() => toggleProduct(product.id)}>{isSelected ? <><Check size={13}/> Selected</> : <><PlusIcon/> Select</>}</button>
                </article>;
              })}
            </div>
          )}
        </SectionCard>}
      </form>
    </div>
  );
}

function PlusIcon() {
  return <span aria-hidden="true" className="crm-promo-plus">+</span>;
}

export default HomepagePromotions;
