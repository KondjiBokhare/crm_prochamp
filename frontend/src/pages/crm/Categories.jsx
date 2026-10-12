import { useMemo, useState } from "react";
import { Layers3, Plus, Power, Tag } from "lucide-react";
import { createCategory, setCategoryStatus, useCategories } from "../../services/siteSettingsService";
import { EmptyState, MetricCard, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";
import { useAuth } from "../../context/AuthContext";
import { crmCategoriesMode } from "../../services/crmService";

const ICON_OPTIONS = ["laptop", "monitor", "cpu", "circuit", "memory", "drive", "fan", "zap", "package", "keyboard", "mouse", "wifi", "printer", "gamepad"];

function Categories() {
  const { authenticatedRequest } = useAuth();
  const categories = useCategories({ includeInactive: true, authenticatedRequest });
  const [name, setName] = useState("");
  const [iconKey, setIconKey] = useState("package");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activeCount = useMemo(() => categories.filter((item) => item.active).length, [categories]);

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    try {
      const category = await createCategory({ name, iconKey }, authenticatedRequest);
      setName("");
      setIconKey("package");
      setNotice(`Category “${category.name}” was added. It is now available in product forms and storefront navigation.`);
    } catch (err) {
      setError(err.message || "Could not create category.");
    }
  }

  async function toggle(category) {
    try {
      await setCategoryStatus(category.id, !category.active, authenticatedRequest);
      setNotice(`Category “${category.name}” is now ${category.active ? "inactive" : "active"}.`);
      setError("");
    } catch (err) {
      setError(err.message || "Could not update category.");
    }
  }

  return (
    <div className="crm-page">
      <PageHeader title="Category Management" description="Manage the single company's product categories. Active categories appear in the storefront navigation and product forms." action={<span className="crm-category-header-icon"><Layers3 size={20}/> Store taxonomy</span>} />
      {crmCategoriesMode === "mock" && <div className="crm-demo-notice">Demo mode · categories are stored in this browser. In API mode, changes are saved to Django/PostgreSQL.</div>}
      {notice && <div className="crm-success-banner" role="status">{notice}</div>}
      {error && <div className="crm-error-banner" role="alert">{error}</div>}
      <div className="crm-metrics-grid">
        <MetricCard label="Total categories" value={categories.length} note="Active and inactive" tone="blue" />
        <MetricCard label="Active categories" value={activeCount} note="Shown to customers" tone="green" />
        <MetricCard label="Inactive categories" value={categories.length - activeCount} note="Hidden from storefront menu" tone="orange" />
        <MetricCard label="Category source" value="Shared" note="Product forms and storefront use the same list" tone="purple" />
      </div>
      <SectionCard title="Add a category" subtitle="Create the category before selecting it while adding a product.">
        <form className="crm-category-create-form" onSubmit={handleCreate}>
          <label className="crm-form-field"><span>Category name *</span><input required maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Webcams" /></label>
          <label className="crm-form-field"><span>Navigation icon</span><select value={iconKey} onChange={(event) => setIconKey(event.target.value)}>{ICON_OPTIONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select></label>
          <button className="crm-button crm-button-primary" type="submit"><Plus size={15}/> Add category</button>
        </form>
      </SectionCard>
      <SectionCard title="Existing categories" subtitle="Deactivate categories to hide them from customers. Existing products are not deleted." action={<span className="crm-result-count">{categories.length} categories</span>}>
        {categories.length === 0 ? <EmptyState title="No categories yet" message="Add a category to start managing your catalogue." /> : (
          <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Category</th><th>Slug / ID</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {categories.map((category) => <tr key={category.id}><td><div className="crm-category-name"><span className="crm-category-icon"><Tag size={15}/></span><strong>{category.name}</strong></div></td><td><code>{category.id}</code></td><td><StatusBadge status={category.active ? "Active" : "Inactive"}/></td><td><button className="crm-button crm-button-secondary crm-button-small" type="button" onClick={() => toggle(category)}><Power size={13}/>{category.active ? "Deactivate" : "Activate"}</button></td></tr>)}
          </tbody></table></div>
        )}
      </SectionCard>
    </div>
  );
}

export default Categories;
