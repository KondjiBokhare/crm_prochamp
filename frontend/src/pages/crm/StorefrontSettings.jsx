import { useEffect, useState } from "react";
import { Image as ImageIcon, Save, Settings2, Trash2 } from "lucide-react";
import { DEFAULT_FOOTER_LINKS, getSiteSettings, loadSiteSettings, saveSiteSettings, siteSettingsApiMode, useCategories } from "../../services/siteSettingsService";
import { useAuth } from "../../context/AuthContext";
import { compressProductImage, formatImageBytes } from "../../utils/productImageUtils";
import { PageHeader, SectionCard } from "../../components/crm/CrmUI";

const textFields = [
  ["brand.name", "Store / company name", "TechGear"],
  ["brand.tagline", "Logo tagline", "YOUR HARDWARE STORE"],
  ["brand.logoMark", "Fallback logo text", "TG"],
  ["topBar.message", "Announcement bar message", "Store announcement"],
  ["topBar.helpLabel", "Help link label", "Help Center"],
  ["topBar.trackLabel", "Order-tracking link label", "Track Order"],
  ["contact.email", "Support email", "support@example.com"],
  ["contact.phone", "Support phone", "+91..."],
  ["contact.address", "Business address", "City, state"],
  ["contact.hours", "Support hours", "Monday–Saturday"],
  ["footer.description", "Footer company description", "Short store description"],
];

const sectionTitles = [
  ["bestSelling", "Best-selling products"], ["deals", "Deals section"], ["buildPc", "Build PC banner"],
  ["purposes", "Shop by purpose"], ["brands", "Featured brands"], ["benefits", "Why choose us"],
];

function readPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const next = structuredClone(object);
  const keys = path.split(".");
  let current = next;
  keys.slice(0, -1).forEach((key) => { current[key] = { ...current[key] }; current = current[key]; });
  current[keys[keys.length - 1]] = value;
  return next;
}

function updateRow(rows, index, key, value) {
  return rows.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row);
}

function StorefrontSettings() {
  const [draft, setDraft] = useState(() => getSiteSettings());
  const { authenticatedRequest } = useAuth();
  const categories = useCategories();
  const [logoBusy, setLogoBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    loadSiteSettings(authenticatedRequest).then((value) => { if (active) setDraft(value); }).catch((loadError) => {
      if (active) setError(loadError.message || "Could not load saved storefront settings.");
    });
    return () => { active = false; };
  }, [authenticatedRequest]);

  const change = (path, value) => setDraft((current) => setPath(current, path, value));

  async function handleLogo(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLogoBusy(true); setError(""); setNotice("");
    try {
      const logoImage = await compressProductImage(file);
      setDraft((current) => setPath(current, "brand.logoImage", logoImage));
      setNotice(`Logo prepared (${formatImageBytes(logoImage)} compressed). Save settings to publish it.`);
    } catch (err) {
      setError(err.message || "Could not process logo image.");
    } finally { setLogoBusy(false); }
  }

  async function save(event) {
    event.preventDefault(); setError(""); setNotice("");
    try {
      if (!String(draft.brand.name || "").trim()) throw new Error("Store name is required.");
      if (draft.contact.email && !/^\S+@\S+\.\S+$/.test(draft.contact.email)) throw new Error("Enter a valid support email address.");
      await saveSiteSettings(draft, authenticatedRequest);
      setNotice("Storefront settings saved to Django. Refresh the customer website to verify the changes.");
    } catch (err) { setError(err.message || "Could not save store settings."); }
  }

  function updatePurpose(index, key, value) {
    setDraft((current) => setPath(current, "homepage.purposes", updateRow(current.homepage.purposes, index, key, value)));
  }
  function updateBenefit(index, key, value) {
    setDraft((current) => setPath(current, "homepage.benefits", updateRow(current.homepage.benefits, index, key, value)));
  }

  return (
    <div className="crm-page">
      <PageHeader title="Storefront Settings" description="Manage the company logo, brand identity, homepage sections, contact details and reusable marketing content." action={<span className="crm-category-header-icon"><Settings2 size={19}/> Website controls</span>} />
      {siteSettingsApiMode ? <div className="crm-demo-notice">API mode · settings are stored in Django for this organization. The logo is currently embedded in the settings JSON; a production deployment should use dedicated media storage.</div> : <div className="crm-demo-notice">Demo mode · these changes are stored in this browser. Backend persistence and media storage will be connected later.</div>}
      {notice && <div className="crm-success-banner" role="status">{notice}</div>}
      {error && <div className="crm-error-banner" role="alert">{error}</div>}
      <form className="crm-form crm-storefront-settings-form" onSubmit={save}>
        <SectionCard title="Store identity" subtitle="The logo and text here are reused by the storefront header, checkout and footer.">
          <div className="crm-store-identity-preview">
            {draft.brand.logoImage ? <img src={draft.brand.logoImage} alt="Current store logo"/> : <span>{draft.brand.logoMark || "TG"}</span>}
            <div><strong>{draft.brand.name || "Your store"}</strong><small>{draft.brand.tagline}</small></div>
          </div>
          <div className="crm-store-logo-upload">
            <label className="crm-image-upload-button"><ImageIcon size={16}/><span>{logoBusy ? "Optimizing logo…" : "Upload logo image"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={logoBusy} onChange={handleLogo}/></span></label>
            {draft.brand.logoImage && <button className="crm-button crm-button-secondary crm-button-small" type="button" onClick={() => change("brand.logoImage", "")}><Trash2 size={13}/> Remove logo</button>}
            <small>JPG, PNG or WebP. The image is compressed in your browser before it is saved with the storefront settings.</small>
          </div>
          <div className="crm-form-grid">
            {textFields.slice(0, 6).map(([path, label, placeholder]) => <label className="crm-form-field" key={path}><span>{label}</span><input value={readPath(draft, path) || ""} maxLength={path === "brand.name" ? 70 : 160} onChange={(event) => change(path, event.target.value)} placeholder={placeholder}/></label>)}
          </div>
        </SectionCard>

        <SectionCard title="Homepage sections" subtitle="Switch sections on/off and change copy. Hero and promotion banner content is managed separately in Banner Management.">
          <div className="crm-home-section-settings">
            {["hero", "promos", ...sectionTitles.map(([key]) => key)].map((key) => {
              const label = key === "hero" ? "Hero banner carousel" : key === "promos" ? "Promotional banners" : sectionTitles.find(([itemKey]) => itemKey === key)?.[1] || key;
              const section = draft.homepage.sections[key] || { enabled: true };
              return <div className="crm-home-section-setting" key={key}>
                <label className="crm-home-section-toggle"><input type="checkbox" checked={section.enabled !== false} onChange={(event) => change(`homepage.sections.${key}.enabled`, event.target.checked)}/><strong>{label}</strong></label>
                {! ["hero", "promos"].includes(key) && <div className="crm-form-grid">
                  {key !== "buildPc" && <label className="crm-form-field"><span>Section heading</span><input value={section.title || ""} onChange={(event) => change(`homepage.sections.${key}.title`, event.target.value)} /></label>}
                  {key !== "buildPc" && <label className="crm-form-field"><span>Subtitle</span><input value={section.subtitle || ""} onChange={(event) => change(`homepage.sections.${key}.subtitle`, event.target.value)} /></label>}
                  {key === "buildPc" && <>
                    <label className="crm-form-field"><span>First title line</span><input value={section.titleFirst || ""} onChange={(event) => change("homepage.sections.buildPc.titleFirst", event.target.value)}/></label>
                    <label className="crm-form-field"><span>Highlighted title</span><input value={section.titleHighlight || ""} onChange={(event) => change("homepage.sections.buildPc.titleHighlight", event.target.value)}/></label>
                    <label className="crm-form-field"><span>Eyebrow</span><input value={section.eyebrow || ""} onChange={(event) => change("homepage.sections.buildPc.eyebrow", event.target.value)}/></label>
                    <label className="crm-form-field"><span>Description</span><textarea rows={2} value={section.description || ""} onChange={(event) => change("homepage.sections.buildPc.description", event.target.value)}/></label>
                    <label className="crm-form-field"><span>Button text</span><input value={section.buttonText || ""} onChange={(event) => change("homepage.sections.buildPc.buttonText", event.target.value)}/></label>
                    <label className="crm-form-field"><span>Button destination</span><input value={section.buttonUrl || ""} onChange={(event) => change("homepage.sections.buildPc.buttonUrl", event.target.value)} placeholder="/products?category=CPUs"/></label>
                  </>}
                </div>}
              </div>;
            })}
          </div>
        </SectionCard>

        <SectionCard title="Hero benefit strip" subtitle="One customer-facing benefit per line. These labels are shown under the homepage hero banner.">
          <label className="crm-form-field"><span>Benefit labels</span><textarea rows={4} value={(draft.homepage.heroBenefits || []).join("\n")} onChange={(event) => change("homepage.heroBenefits", event.target.value.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 8))} placeholder={"Top Brands\nBest Prices\nFast Delivery"}/></label>
        </SectionCard>

        <SectionCard title="Shop by purpose cards" subtitle="Edit the homepage cards. Each category should match an active catalogue category for best results.">
          <div className="crm-settings-repeat-list">
            {draft.homepage.purposes.map((item, index) => <div className="crm-settings-repeat-item" key={item.id || index}>
              <label className="crm-form-field"><span>Card title</span><input value={item.title} onChange={(event) => updatePurpose(index, "title", event.target.value)}/></label>
              <label className="crm-form-field"><span>Description</span><input value={item.description} onChange={(event) => updatePurpose(index, "description", event.target.value)}/></label>
              <label className="crm-form-field"><span>Category target</span><select value={item.category || ""} onChange={(event) => updatePurpose(index, "category", event.target.value)}><option value="">Choose category</option>{[...categories, ...(item.category && !categories.some((category) => category.name === item.category) ? [{ id: `legacy-${item.category}`, name: item.category, active: false }] : [])].map((category) => <option key={category.id} value={category.name} disabled={!category.active}>{category.name}{category.active === false ? " (inactive)" : ""}</option>)}</select><small>Categories are managed in CRM → Categories.</small></label>
              <label className="crm-form-field"><span>Icon key</span><select value={item.icon || "package"} onChange={(event) => updatePurpose(index, "icon", event.target.value)}>{["gamepad", "briefcase", "video", "education", "tv", "package"].map((icon) => <option key={icon}>{icon}</option>)}</select></label>
              <button className="crm-button crm-button-secondary crm-button-small" type="button" onClick={() => change("homepage.purposes", draft.homepage.purposes.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={13}/> Remove card</button>
            </div>)}
            <button className="crm-button crm-button-secondary" type="button" onClick={() => change("homepage.purposes", [...draft.homepage.purposes, { id: `purpose-${Date.now()}`, title: "New purpose", description: "Describe who this is for", category: "Laptops", icon: "package" }])}>Add purpose card</button>
          </div>
        </SectionCard>

        <SectionCard title="Store benefits" subtitle="Edit the trust/benefit cards displayed near the bottom of the homepage.">
          <div className="crm-settings-repeat-list">
            {draft.homepage.benefits.map((item, index) => <div className="crm-settings-repeat-item" key={item.id || index}>
              <label className="crm-form-field"><span>Title</span><input value={item.title} onChange={(event) => updateBenefit(index, "title", event.target.value)}/></label>
              <label className="crm-form-field"><span>Description</span><input value={item.description} onChange={(event) => updateBenefit(index, "description", event.target.value)}/></label>
              <label className="crm-form-field"><span>Icon key</span><select value={item.icon || "package"} onChange={(event) => updateBenefit(index, "icon", event.target.value)}>{["shield", "truck", "credit-card", "return", "support", "package"].map((icon) => <option key={icon}>{icon}</option>)}</select></label>
              <button className="crm-button crm-button-secondary crm-button-small" type="button" onClick={() => change("homepage.benefits", draft.homepage.benefits.filter((_, rowIndex) => rowIndex !== index))}><Trash2 size={13}/> Remove benefit</button>
            </div>)}
            <button className="crm-button crm-button-secondary" type="button" onClick={() => change("homepage.benefits", [...draft.homepage.benefits, { id: `benefit-${Date.now()}`, title: "New benefit", description: "Describe the store benefit", icon: "package" }])}>Add benefit</button>
          </div>
        </SectionCard>

        <SectionCard title="Contact and footer details" subtitle="These details feed the storefront footer, Contact Us page and reusable brand elements.">
          <div className="crm-form-grid">
            {textFields.slice(6).map(([path, label, placeholder]) => <label className="crm-form-field" key={path}><span>{label}</span>{path === "footer.description" || path === "contact.address" ? <textarea rows={3} value={readPath(draft, path) || ""} onChange={(event) => change(path, event.target.value)} placeholder={placeholder}/> : <input value={readPath(draft, path) || ""} onChange={(event) => change(path, event.target.value)} placeholder={placeholder}/>}</label>)}
          </div>
          <p className="crm-settings-footnote">Essential footer pages (About, Contact, FAQs, Shipping, Returns, Privacy and Terms) are included. Review the policy wording before any production launch.</p>
        </SectionCard>

        <SectionCard title="Footer page links" subtitle="Choose which essential information pages appear in the customer website footer. Page routes remain standard and reusable.">
          <div className="crm-footer-link-settings">
            {DEFAULT_FOOTER_LINKS.map((defaultLink) => {
              const links = Array.isArray(draft.footer?.links) ? draft.footer.links : DEFAULT_FOOTER_LINKS;
              const current = links.find((link) => link.path === defaultLink.path);
              const enabled = Boolean(current);
              return <div className="crm-footer-link-setting" key={defaultLink.path}>
                <label className="crm-home-section-toggle"><input type="checkbox" checked={enabled} onChange={(event) => {
                  const nextLinks = event.target.checked
                    ? [...links.filter((link) => link.path !== defaultLink.path), { ...defaultLink }]
                    : links.filter((link) => link.path !== defaultLink.path);
                  change("footer.links", nextLinks);
                }}/><strong>{defaultLink.label}</strong></label>
                <label className="crm-form-field"><span>Displayed label</span><input disabled={!enabled} value={current?.label || defaultLink.label} maxLength={60} onChange={(event) => change("footer.links", links.map((link) => link.path === defaultLink.path ? { ...link, label: event.target.value } : link))}/></label>
                <code>{defaultLink.path}</code>
              </div>;
            })}
          </div>
        </SectionCard>

        <div className="crm-form-actions"><button className="crm-button crm-button-primary" type="submit"><Save size={15}/> Save storefront settings</button></div>
      </form>
    </div>
  );
}

export default StorefrontSettings;
