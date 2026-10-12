import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ShieldCheck, Truck, Headphones } from "lucide-react";
import { getStorefrontBanners, recordBannerClick, recordBannerImpression } from "../../services/crmService";
import { useProductCatalog } from "../../services/productCatalogService";
import { useHomepagePromotionSettings } from "../../services/homepagePromotionsService";

function shadeHex(hex, factor = 0.58) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!match) return "#061a3c";
  const value = match[1];
  const channels = [0, 2, 4].map((start) => Math.round(parseInt(value.slice(start, start + 2), 16) * factor));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function HeroBanner({ benefits = [] }) {
  const catalogue = useProductCatalog();
  const promotionSettings = useHomepagePromotionSettings();
  const featuredProducts = !promotionSettings.enabled
    ? []
    : promotionSettings.selectionMode === "MANUAL"
      ? promotionSettings.featuredProductIds
          .map((id) => catalogue.find((product) => String(product.id) === String(id)))
          .filter(Boolean)
          .slice(0, 2)
      : catalogue.slice(0, 2);
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const seen = useRef(new Set());
  const banner = banners[currentIndex] || null;

  useEffect(() => {
    let active = true;
    getStorefrontBanners({ placement: "HERO" })
      .then((items) => { if (active) { setBanners(items); setCurrentIndex(0); } })
      .catch(() => { if (active) setBanners([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!banner || seen.current.has(banner.id)) return;
    seen.current.add(banner.id);
    recordBannerImpression(banner.id).catch(() => {});
  }, [banner]);

  const move = (direction) => {
    if (banners.length < 2) return;
    setCurrentIndex((index) => (index + direction + banners.length) % banners.length);
  };

  const handleClick = () => {
    if (!banner) return;
    recordBannerClick(banner.id).catch(() => {});
    const targetUrl = banner.targetUrl || "/products";
    if (!targetUrl.startsWith("/")) {
      // External targets open in a new tab from the anchor below.
      return;
    }
  };

  if (loading) return <section className="hero-section hero-section-loading" aria-label="Featured promotions" />;
  if (!banner) return null;

  const baseColor = banner.backgroundColor || "#061a3c";
  const background = banner.imageUrl
    ? `linear-gradient(90deg, rgba(3, 21, 45, .94) 0%, rgba(3, 30, 65, .8) 50%, rgba(3, 21, 45, .22) 100%), url("${banner.imageUrl}") center / cover no-repeat`
    : baseColor.toLowerCase() === "#061a3c"
      ? "linear-gradient(90deg, #03152d 0%, #06285b 48%, #061a3c 100%)"
      : `linear-gradient(90deg, ${shadeHex(baseColor, 0.48)} 0%, ${baseColor} 58%, ${shadeHex(baseColor, 0.75)} 100%)`;
  const targetUrl = String(banner.targetUrl || "/products");
  const isExternal = /^https?:\/\//i.test(targetUrl);

  return (
    <section className={`hero-section hero-section-managed${banner.imageUrl ? " hero-section-with-image" : " hero-section-color-only"}`} aria-label="Featured promotions" style={{ background, color: banner.textColor || "#ffffff" }}>
      {banners.length > 1 && <button className="hero-arrow hero-left" type="button" aria-label="Previous banner" onClick={() => move(-1)}><ChevronLeft size={24} /></button>}
      <div className="hero-content">
        <div className="hero-text">
          {banner.eyebrow && <span className="hero-label">{banner.eyebrow}</span>}
          <h1>{banner.title}</h1>
          {banner.subtitle && <p>{banner.subtitle}</p>}
          {isExternal ? (
            <a className="primary-button hero-managed-cta" href={targetUrl} target="_blank" rel="noreferrer" onClick={handleClick}>{banner.buttonText || "Shop Now"} →</a>
          ) : (
            <Link className="primary-button hero-managed-cta" to={targetUrl} onClick={handleClick}>{banner.buttonText || "Shop Now"} →</Link>
          )}
        </div>
        {!banner.imageUrl && featuredProducts.length > 0 && <div className="hero-image hero-featured-products-wrap">
          {promotionSettings.selectionMode === "MANUAL" && <div className="hero-featured-heading"><strong>{promotionSettings.sectionTitle}</strong>{promotionSettings.subtitle && <p>{promotionSettings.subtitle}</p>}</div>}
          <div className="hero-image-placeholder hero-featured-products">{featuredProducts.map((product) => <Link key={product.id} className="hero-featured-product" to={`/product/${product.id}`}><div className="hero-featured-product-image">{(product.images?.[0] || product.image) ? <img src={product.images?.[0] || product.image} alt={product.name} /> : <span>{String(product.brand || product.name).slice(0, 16)}</span>}</div><span className="hero-featured-product-name">{product.name}</span><strong>₹{Number(product.price || 0).toLocaleString("en-IN")}</strong></Link>)}</div>
        </div>}
        {benefits.length > 0 && <div className="hero-benefits">
          {benefits.map((label, index) => {
            const cleanLabel = String(label || "").trim();
            if (!cleanLabel) return null;
            const Icon = /deliver|shipping|fast/i.test(cleanLabel) ? Truck : /support|help/i.test(cleanLabel) ? Headphones : ShieldCheck;
            return <div key={`${cleanLabel}-${index}`}><Icon size={25} /><span>{cleanLabel}</span></div>;
          })}
        </div>}
      </div>
      {banners.length > 1 && <button className="hero-arrow hero-right" type="button" aria-label="Next banner" onClick={() => move(1)}><ChevronRight size={24} /></button>}
      {banners.length > 1 && <div className="hero-dots">{banners.map((item, index) => <button key={item.id} type="button" className={index === currentIndex ? "active" : ""} aria-label={`Show banner ${index + 1}`} onClick={() => setCurrentIndex(index)} />)}</div>}
    </section>
  );
}

export default HeroBanner;
