import { useCallback, useEffect, useMemo, useState } from "react";
import { Image as ImageIcon, PackagePlus, Pencil, Power, RefreshCw, Search, Upload, X } from "lucide-react";
import { crmProductsMode, createProduct, getProducts, setProductStatus, updateProduct } from "../../services/crmService";
import { EmptyState, MetricCard, Modal, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";
import { compressProductImage, productImageLimits } from "../../utils/productImageUtils";
import { useCategories } from "../../services/siteSettingsService";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(amount) || 0);
const emptyForm = () => ({ name: "", sku: "", brand: "", category: "", subcategory: "", price: "", mrp: "", stock: "0", status: "Active", image: "", images: [], shortDescription: "", specs: "", highlights: "", tags: "" });
const dateLabel = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function ProductManagement() {
  const { authenticatedRequest } = useAuth();
  const [products, setProducts] = useState([]);
  const categoryRecords = useCategories({ includeInactive: true, authenticatedRequest });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const results = await getProducts({ includeInactive: true, search, status, category }, authenticatedRequest);
      setProducts(results);
    } catch (err) {
      setError(err.message || "Could not load products. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [search, status, category, reloadKey, authenticatedRequest]);

  useEffect(() => { refresh(); }, [refresh]);

  const categories = useMemo(() => {
    const names = new Set(categoryRecords.filter((item) => item.active).map((item) => item.name));
    products.forEach((product) => { if (product.category) names.add(product.category); });
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [categoryRecords, products]);
  const metrics = useMemo(() => ({
    total: products.length,
    active: products.filter((item) => item.status === "Active").length,
    lowStock: products.filter((item) => item.status === "Active" && Number(item.stock) <= 5).length,
    drafts: products.filter((item) => item.status === "Draft").length,
  }), [products]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setNotice("");
    setShowEditor(true);
  }

  function openEdit(product) {
    setEditing(product);
    setForm({
      ...emptyForm(),
      ...product,
      image: product.images?.[0] || product.image || "",
      images: Array.isArray(product.images) && product.images.length ? [...product.images] : product.image ? [product.image] : [],
      price: String(product.price ?? ""),
      mrp: product.mrp == null ? "" : String(product.mrp),
      stock: String(product.stock ?? 0),
      highlights: Array.isArray(product.highlights) ? product.highlights.join(", ") : product.highlights || "",
      tags: Array.isArray(product.tags) ? product.tags.join(", ") : product.tags || "",
    });
    setError("");
    setNotice("");
    setShowEditor(true);
  }

  function changeForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleImagesSelected(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const availableSlots = productImageLimits.maxImages - (form.images || []).length;
    if (files.length > availableSlots) {
      setError(`A product can have up to ${productImageLimits.maxImages} images. Remove an existing image first or select fewer files.`);
      return;
    }

    setImageProcessing(true);
    setError("");
    try {
      const uploadedImages = [];
      for (const file of files) {
        uploadedImages.push(await compressProductImage(file));
      }
      setForm((current) => {
        const images = [...(current.images || []), ...uploadedImages];
        return { ...current, images, image: images[0] || "" };
      });
    } catch (err) {
      setError(err.message || "Could not process selected images.");
    } finally {
      setImageProcessing(false);
    }
  }

  function removeProductImage(indexToRemove) {
    setForm((current) => {
      const images = (current.images || []).filter((_, index) => index !== indexToRemove);
      return { ...current, images, image: images[0] || "" };
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = { ...form, image: form.images?.[0] || "", images: form.images || [] };
      const saved = editing ? await updateProduct(editing.id, payload, authenticatedRequest) : await createProduct(payload, authenticatedRequest);
      setShowEditor(false);
      setNotice(`${saved.name} was ${editing ? "updated" : "added"}. ${saved.status === "Active" ? "It is available in the storefront catalogue." : "It is not visible to customers until its status is Active."}`);
      setSearch("");
      setStatus("All");
      setCategory("All");
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(err.message || "Could not save product.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(product) {
    const nextStatus = product.status === "Active" ? "Inactive" : "Active";
    const confirmed = window.confirm(`${nextStatus === "Active" ? "Publish" : "Hide"} “${product.name}” ${nextStatus === "Active" ? "on" : "from"} the customer storefront?`);
    if (!confirmed) return;
    setError("");
    setNotice("");
    try {
      await setProductStatus(product.id, nextStatus, authenticatedRequest);
      setNotice(`${product.name} is now ${nextStatus.toLowerCase()}.`);
      setReloadKey((value) => value + 1);
    } catch (err) {
      setError(err.message || "Could not update the product status.");
    }
  }

  return (
    <div className="crm-page">
      <PageHeader
        title="Product Management"
        description="Manage the company's product catalogue, pricing, stock and storefront visibility. Only Active products are displayed to customers."
        action={<button type="button" className="crm-button crm-button-primary" onClick={openCreate}><PackagePlus size={16} /> Add product</button>}
      />
      {crmProductsMode === "mock" && <div className="crm-demo-notice">Demo mode · product changes are saved in this browser and shared with the customer storefront. They are not saved to PostgreSQL.</div>}
      {notice && <div className="crm-success-banner" role="status">{notice}</div>}
      {error && !showEditor && <div className="crm-error-banner" role="alert">{error}</div>}

      <div className="crm-metrics-grid crm-product-metrics">
        <MetricCard label="Catalogue products" value={metrics.total} note="All statuses" tone="blue" />
        <MetricCard label="Active products" value={metrics.active} note="Visible in storefront" tone="green" />
        <MetricCard label="Low stock" value={metrics.lowStock} note="Active products with 5 or fewer units" tone="orange" />
        <MetricCard label="Drafts" value={metrics.drafts} note="Not yet published" tone="purple" />
      </div>

      <SectionCard title="Product catalogue" subtitle="Add new items, update pricing and stock, or hide products from the storefront." action={<button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => setReloadKey((value) => value + 1)}><RefreshCw size={13} /> Refresh</button>}>
        <div className="crm-toolbar">
          <label className="crm-search-field"><span className="sr-only">Search products</span><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, SKU, brand or category…" /></label>
          <label className="crm-filter-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="All">All statuses</option><option>Active</option><option>Draft</option><option>Inactive</option></select></label>
          <label className="crm-filter-field"><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="All">All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
          <span className="crm-result-count">{products.length} products</span>
        </div>

        {loading ? <div className="crm-loading">Loading products…</div> : products.length === 0 ? <EmptyState title="No products found" message="Try another search or add a product to the catalogue." /> : (
          <div className="crm-table-wrap">
            <table className="crm-table crm-product-table">
              <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead>
              <tbody>{products.map((product) => (
                <tr key={product.id}>
                  <td><div className="crm-product-cell">{(product.images?.[0] || product.image) ? <img src={product.images?.[0] || product.image} alt="" loading="lazy" onError={(event) => { event.currentTarget.style.visibility = "hidden"; }} /> : <span className="crm-product-no-image"><ImageIcon size={18} /></span>}<span><strong>{product.name}</strong><small>{product.brand}{(product.images?.length || 0) > 1 ? ` · ${product.images.length} images` : ""}</small></span></div></td>
                  <td><code>{product.sku}</code></td>
                  <td>{product.category}</td>
                  <td><strong>{money(product.price)}</strong>{product.mrp > product.price && <small className="crm-cell-subtext">MRP {money(product.mrp)}</small>}</td>
                  <td><span className={Number(product.stock) <= 5 ? "crm-product-low-stock" : ""}>{product.stock}</span></td>
                  <td><StatusBadge status={product.status} /></td>
                  <td>{dateLabel(product.updatedAt)}</td>
                  <td><div className="crm-product-actions"><button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => openEdit(product)}><Pencil size={12} /> Edit</button><button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => handleStatusChange(product)} title={product.status === "Active" ? "Hide from storefront" : "Make active and publish"}><Power size={12} /> {product.status === "Active" ? "Hide" : "Activate"}</button></div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {showEditor && <Modal title={editing ? "Edit product" : "Add product"} description="Product changes are stored locally in demo mode and shared with the customer storefront." width="780px" onClose={() => setShowEditor(false)}>
        <form className="crm-form" onSubmit={handleSave}>
          <div className="crm-form-grid">
            <label className="crm-form-field"><span>Product name *</span><input name="name" required maxLength={160} value={form.name} onChange={changeForm} placeholder="e.g. TechGear Wireless Mouse" /></label>
            <label className="crm-form-field"><span>SKU / Product code *</span><input name="sku" required maxLength={64} value={form.sku} onChange={changeForm} placeholder="e.g. TG-MOU-001" /></label>
            <label className="crm-form-field"><span>Brand *</span><input name="brand" required maxLength={80} value={form.brand} onChange={changeForm} placeholder="Brand name" /></label>
            <label className="crm-form-field"><span>Category *</span><select name="category" required value={form.category} onChange={changeForm}><option value="">Select an available category</option>{categoryRecords.filter((item) => item.active || (editing && item.name === form.category)).map((item) => <option key={item.id} value={item.name} disabled={!item.active && item.name !== form.category}>{item.name}{!item.active ? " (inactive)" : ""}</option>)}</select><small>Need a new category? <Link to="/crm/categories" className="crm-text-link">Create it in Category Management</Link>.</small></label>
            <label className="crm-form-field"><span>Subcategory</span><input name="subcategory" maxLength={80} value={form.subcategory} onChange={changeForm} placeholder="e.g. Wireless Mouse" /></label>
            <label className="crm-form-field"><span>Status</span><select name="status" value={form.status} onChange={changeForm}><option>Draft</option><option>Active</option><option>Inactive</option></select><small>Active products appear on the customer storefront.</small></label>
            <label className="crm-form-field"><span>Selling price (₹) *</span><input name="price" type="number" min="0.01" step="0.01" required value={form.price} onChange={changeForm} placeholder="1499" /></label>
            <label className="crm-form-field"><span>MRP (₹)</span><input name="mrp" type="number" min="0" step="0.01" value={form.mrp} onChange={changeForm} placeholder="1999" /><small>Must be equal to or higher than selling price.</small></label>
            <label className="crm-form-field"><span>Stock quantity *</span><input name="stock" type="number" min="0" step="1" required value={form.stock} onChange={changeForm} /></label>
            <div className="crm-form-field crm-product-images-field">
              <span>Product images</span>
              <label className={`crm-image-upload-button ${imageProcessing ? "is-processing" : ""}`}>
                <Upload size={16} />
                <span>{imageProcessing ? "Optimizing images…" : "Choose images from your device"}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={imageProcessing || (form.images || []).length >= productImageLimits.maxImages} onChange={handleImagesSelected} />
              </label>
              <small>Upload up to {productImageLimits.maxImages} JPG, PNG or WebP images per product. Each image is resized/compressed to help fit the browser demo storage. No external URL is required.</small>
              {(form.images || []).length > 0 ? (
                <div className="crm-product-image-preview-grid">
                  {form.images.map((image, index) => (
                    <div className="crm-product-image-preview" key={`${index}-${image.slice(0, 32)}`}>
                      <img src={image} alt={`Product preview ${index + 1}`} />
                      <span>{index === 0 ? "Primary" : `Image ${index + 1}`}</span>
                      <button type="button" aria-label={`Remove image ${index + 1}`} onClick={() => removeProductImage(index)}><X size={13} /></button>
                    </div>
                  ))}
                </div>
              ) : <div className="crm-product-images-empty"><ImageIcon size={19} /><span>No images selected yet</span></div>}
            </div>
            <label className="crm-form-field crm-product-description-field"><span>Short description</span><textarea name="shortDescription" rows={3} maxLength={500} value={form.shortDescription} onChange={changeForm} placeholder="Describe the main product benefit…" /></label>
            <label className="crm-form-field"><span>Specifications (short)</span><input name="specs" maxLength={250} value={form.specs} onChange={changeForm} placeholder="Bluetooth 5.3 | USB-C | 1 year warranty" /></label>
            <label className="crm-form-field"><span>Highlights</span><textarea name="highlights" rows={2} value={form.highlights} onChange={changeForm} placeholder="Separate highlights with commas" /></label>
            <label className="crm-form-field"><span>Search tags</span><input name="tags" value={form.tags} onChange={changeForm} placeholder="gaming, accessories, wireless" /></label>
          </div>
          {error && <div className="crm-error-banner" role="alert">{error}</div>}
          <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={() => setShowEditor(false)}>Cancel</button><button type="submit" className="crm-button crm-button-primary" disabled={saving || imageProcessing}>{imageProcessing ? "Preparing images…" : saving ? "Saving…" : editing ? "Save changes" : "Create product"}</button></div>
        </form>
      </Modal>}
    </div>
  );
}

export default ProductManagement;
