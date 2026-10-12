import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Eye, Image as ImageIcon, MousePointerClick, Pencil, Pause, Play, Plus, RefreshCw } from "lucide-react";
import { crmBannersMode, createBanner, getBanners, setBannerStatus, updateBanner } from "../../services/crmService";
import { useAuth } from "../../context/AuthContext";
import { EmptyState, MetricCard, Modal, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function defaultEndDate() {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const emptyForm = () => ({
  name: "",
  eyebrow: "",
  title: "",
  subtitle: "",
  buttonText: "Shop Now",
  targetUrl: "/products",
  imageUrl: "",
  placement: "HERO",
  backgroundColor: "#061a3c",
  textColor: "#ffffff",
  status: "Draft",
  startDate: todayISO(),
  endDate: defaultEndDate(),
});

const money = (value) => new Intl.NumberFormat("en-IN", { style: "decimal", maximumFractionDigits: 0 }).format(value || 0);

function effectiveStatus(banner) {
  const today = todayISO();
  if (banner.status === "Active" && banner.startDate > today) return "Scheduled";
  if (banner.status === "Active" && banner.endDate < today) return "Expired";
  return banner.status;
}

function shadeHex(hex, factor = 0.58) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!match) return "#061a3c";
  const value = match[1];
  const channels = [0, 2, 4].map((start) => Math.round(parseInt(value.slice(start, start + 2), 16) * factor));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function bannerBackground(banner) {
  if (banner.imageUrl) {
    return `linear-gradient(90deg, rgba(3, 12, 28, .78), rgba(3, 12, 28, .18)), url("${banner.imageUrl}") center / cover no-repeat`;
  }
  const base = banner.backgroundColor || "#061a3c";
  return banner.placement === "HERO"
    ? `linear-gradient(90deg, ${shadeHex(base, 0.48)} 0%, ${base} 58%, ${shadeHex(base, 0.75)} 100%)`
    : `linear-gradient(135deg, ${shadeHex(base, 0.62)} 0%, ${base} 100%)`;
}

function BannerPreview({ banner, compact = false }) {
  return (
    <div className={`crm-banner-preview${compact ? " crm-banner-preview-compact" : ""}`} style={{ background: bannerBackground(banner), color: banner.textColor || "#fff" }}>
      <div className="crm-banner-preview-copy">
        {banner.eyebrow && <span>{banner.eyebrow}</span>}
        <strong>{banner.title || "Your banner headline"}</strong>
        {banner.subtitle && <p>{banner.subtitle}</p>}
        {banner.buttonText && <i>{banner.buttonText} →</i>}
      </div>
      {banner.placement === "PROMO" && <span className="crm-banner-preview-type">PROMO</span>}
    </div>
  );
}

function BannerManagement() {
  const { authenticatedRequest } = useAuth();
  const [banners, setBanners] = useState([]);
  const [search, setSearch] = useState("");
  const [placement, setPlacement] = useState("All");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
      const results = await getBanners({ search, placement, status }, authenticatedRequest);
      setBanners(results);
    } catch (err) {
      setError(err.message || "Could not load banners.");
    } finally {
      setLoading(false);
    }
  }, [search, placement, status, reloadKey, authenticatedRequest]);

  useEffect(() => { refresh(); }, [refresh]);

  const totals = useMemo(() => {
    const active = banners.filter((item) => effectiveStatus(item) === "Active").length;
    const impressions = banners.reduce((sum, item) => sum + (Number(item.impressions) || 0), 0);
    const clicks = banners.reduce((sum, item) => sum + (Number(item.clicks) || 0), 0);
    return { active, impressions, clicks, ctr: impressions ? (clicks / impressions) * 100 : 0 };
  }, [banners]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setError("");
    setNotice("");
    setShowEditor(true);
  }

  function openEdit(banner) {
    setEditing(banner);
    setForm({ ...emptyForm(), ...banner });
    setError("");
    setNotice("");
    setShowEditor(true);
  }

  function changeForm(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitBanner(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const saved = editing ? await updateBanner(editing.id, form, authenticatedRequest) : await createBanner(form, authenticatedRequest);
      setShowEditor(false);
      setNotice(`Banner “${saved.name}” ${editing ? "updated" : "created"}. ${saved.status === "Active" ? "It will appear on the storefront during its scheduled dates." : "It is not published yet."}`);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err.message || "Could not save the banner.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(banner) {
    const nextStatus = banner.status === "Active" ? "Paused" : "Active";
    const verb = nextStatus === "Active" ? "activate" : "pause";
    if (!window.confirm(`Are you sure you want to ${verb} “${banner.name}”?`)) return;
    setError("");
    try {
      await setBannerStatus(banner.id, nextStatus, authenticatedRequest);
      setNotice(`Banner “${banner.name}” is now ${nextStatus.toLowerCase()}.`);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err.message || "Could not update the banner status.");
    }
  }

  return (
    <div className="crm-page">
      <PageHeader
        title="Banner Management"
        description="Create company-owned promotional banners for your storefront, choose placement, and review clicks and impressions."
        action={<button type="button" className="crm-button crm-button-primary" onClick={openCreate}><Plus size={16} /> New banner</button>}
      />
      <div className="crm-demo-notice">
        {crmBannersMode === "mock"
          ? "Demo mode · banners are saved in this browser only. Image URLs are supported; server publishing is not enabled."
          : "Django API mode · banners are stored in PostgreSQL. Image URLs are supported; direct file uploads require media storage configuration."}
      </div>
      {notice && <div className="crm-success-banner" role="status">{notice}</div>}
      {error && !showEditor && <div className="crm-error-banner" role="alert">{error}</div>}

      <div className="crm-metrics-grid crm-metrics-three crm-banner-metrics">
        <MetricCard label="Banners in view" value={banners.length} note="Matches selected filters" tone="blue" />
        <MetricCard label="Currently active" value={totals.active} note="Active within scheduled dates" tone="green" />
        <MetricCard label="Impressions" value={money(totals.impressions)} note={`${money(totals.clicks)} clicks · ${totals.ctr.toFixed(2)}% click-through rate`} tone="purple" />
      </div>

      <SectionCard title="Company promotions" subtitle="Hero banners appear in the homepage hero area. Promo tiles appear below the hero." action={<button type="button" className="crm-button crm-button-secondary" onClick={() => setReloadKey((key) => key + 1)}><RefreshCw size={14} /> Refresh</button>}>
        <div className="crm-toolbar">
          <label className="crm-search-field"><span className="sr-only">Search banners</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, headline or ID…" /></label>
          <label className="crm-filter-field">Placement
            <select value={placement} onChange={(event) => setPlacement(event.target.value)}>
              <option value="All">All placements</option><option value="HERO">Homepage hero</option><option value="PROMO">Promo tile</option>
            </select>
          </label>
          <label className="crm-filter-field">Status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="All">All statuses</option><option value="Active">Active</option><option value="Draft">Draft</option><option value="Paused">Paused</option>
            </select>
          </label>
          <span className="crm-result-count">{banners.length} banner{banners.length === 1 ? "" : "s"}</span>
        </div>

        {loading ? <div className="crm-loading">Loading banners…</div> : banners.length === 0 ? (
          <EmptyState title="No banners match" message="Clear filters or create a new company promotion." />
        ) : (
          <div className="crm-banner-list">
            {banners.map((banner) => {
              const clicks = Number(banner.clicks) || 0;
              const impressions = Number(banner.impressions) || 0;
              const ctr = impressions ? (clicks / impressions) * 100 : 0;
              return (
                <article className="crm-banner-row" key={banner.id}>
                  <div className="crm-banner-row-preview"><BannerPreview banner={banner} compact /></div>
                  <div className="crm-banner-row-main">
                    <div className="crm-banner-name-line"><strong>{banner.name}</strong><StatusBadge status={effectiveStatus(banner)} /></div>
                    <p>{banner.title} {banner.subtitle ? `· ${banner.subtitle}` : ""}</p>
                    <div className="crm-banner-meta">
                      <span><ImageIcon size={13} /> {banner.placement === "HERO" ? "Homepage hero" : "Promo tile"}</span>
                      <span><CalendarDays size={13} /> {banner.startDate} → {banner.endDate}</span>
                      <span><Eye size={13} /> {money(impressions)} impressions</span>
                      <span><MousePointerClick size={13} /> {money(clicks)} clicks ({ctr.toFixed(2)}% CTR)</span>
                    </div>
                  </div>
                  <div className="crm-banner-row-actions">
                    <button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => openEdit(banner)}><Pencil size={13} /> Edit</button>
                    <button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => changeStatus(banner)}>
                      {banner.status === "Active" ? <Pause size={13} /> : <Play size={13} />}{banner.status === "Active" ? "Pause" : "Activate"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionCard>

      {showEditor && (
        <Modal title={editing ? "Edit banner" : "Create banner"} description="These banners promote your own company products and offers; external advertiser billing is not included." onClose={() => setShowEditor(false)} width="900px">
          <form className="crm-form" onSubmit={submitBanner}>
            {error && <div className="crm-error-banner" role="alert">{error}</div>}
            <div className="crm-form-grid">
              <label className="crm-form-field">Internal banner name *<input name="name" value={form.name} onChange={changeForm} required maxLength={100} placeholder="e.g. Festival laptop sale" /></label>
              <label className="crm-form-field">Placement *<select name="placement" value={form.placement} onChange={changeForm} required><option value="HERO">Homepage hero carousel</option><option value="PROMO">Homepage promo tile</option></select></label>
              <label className="crm-form-field">Small label / eyebrow<input name="eyebrow" value={form.eyebrow} onChange={changeForm} maxLength={70} placeholder="e.g. FESTIVAL SPECIAL" /></label>
              <label className="crm-form-field">Headline *<input name="title" value={form.title} onChange={changeForm} required maxLength={100} placeholder="e.g. Upgrade your setup" /></label>
              <label className="crm-form-field">Subtitle<textarea name="subtitle" value={form.subtitle} onChange={changeForm} rows={2} maxLength={220} placeholder="Short supporting copy" /></label>
              <label className="crm-form-field">Button text<input name="buttonText" value={form.buttonText} onChange={changeForm} maxLength={35} placeholder="Shop Now" /></label>
              <label className="crm-form-field">Destination URL *<input name="targetUrl" value={form.targetUrl} onChange={changeForm} required placeholder="/products or https://example.com" /></label>
              <label className="crm-form-field">Banner image URL (optional)<input name="imageUrl" type="url" value={form.imageUrl} onChange={changeForm} placeholder="https://.../banner.webp" /><small>Use an image URL for now. Upload/storage will be added with the backend.</small></label>
              <label className="crm-form-field">Start date *<input name="startDate" type="date" value={form.startDate} onChange={changeForm} required /></label>
              <label className="crm-form-field">End date *<input name="endDate" type="date" value={form.endDate} onChange={changeForm} min={form.startDate} required /></label>
              <label className="crm-form-field">Publication status<select name="status" value={form.status} onChange={changeForm}><option value="Draft">Draft</option><option value="Active">Active (publish on schedule)</option><option value="Paused">Paused</option></select></label>
              <div className="crm-form-field"><span>Banner colours</span><div className="crm-banner-colours"><label>Background <input aria-label="Background colour" name="backgroundColor" type="color" value={form.backgroundColor} onChange={changeForm} /></label><label>Text <input aria-label="Text colour" name="textColor" type="color" value={form.textColor} onChange={changeForm} /></label></div></div>
            </div>
            <div className="crm-banner-form-preview"><div className="crm-banner-preview-heading">Live preview</div><BannerPreview banner={form} /></div>
            <div className="crm-form-actions">
              <button type="button" className="crm-button crm-button-secondary" onClick={() => setShowEditor(false)}>Cancel</button>
              <button type="submit" className="crm-button crm-button-primary" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Create banner"}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export default BannerManagement;
