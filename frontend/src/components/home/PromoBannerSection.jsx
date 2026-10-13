import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStorefrontBanners, recordBannerClick, recordBannerImpression } from "../../services/crmService";

function shadeHex(hex, factor = 0.62) {
  const match = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!match) return "#061a3c";
  const value = match[1];
  const channels = [0, 2, 4].map((start) => Math.round(parseInt(value.slice(start, start + 2), 16) * factor));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function PromoBannerSection() {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tracked, setTracked] = useState([]);

  useEffect(() => {
    let active = true;
    getStorefrontBanners({ placement: "PROMO" })
      .then((items) => { if (active) setBanners(items); })
      .catch(() => { if (active) setBanners([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const untracked = banners.filter((banner) => !tracked.includes(banner.id));
    if (!untracked.length) return;
    untracked.forEach((banner) => recordBannerImpression(banner.id).catch(() => {}));
    setTracked((current) => [...current, ...untracked.map((banner) => banner.id)]);
  }, [banners, tracked]);

  if (loading || banners.length === 0) return null;

  return (
    <section className="promo-section promo-section-managed" aria-label="Current promotions">
      {banners.map((banner) => {
        const baseColor = banner.backgroundColor || "#1266bb";
        const style = banner.imageUrl
          ? { background: `linear-gradient(90deg, rgba(0,0,0,.62), rgba(0,0,0,.12)), url("${banner.imageUrl}") center / cover no-repeat`, color: banner.textColor || "#ffffff" }
          : { background: `linear-gradient(135deg, ${shadeHex(baseColor, 0.62)} 0%, ${baseColor} 100%)`, color: banner.textColor || "#ffffff" };
        const handleClick = () => { recordBannerClick(banner.id).catch(() => {}); };
        const targetUrl = String(banner.targetUrl || "/products");
        const isExternal = /^https?:\/\//i.test(targetUrl);
        const action = isExternal
          ? <a className="promo-button" href={targetUrl} target="_blank" rel="noreferrer" onClick={handleClick}>{banner.buttonText || "Shop Now"} →</a>
          : <Link className="promo-button" to={targetUrl} onClick={handleClick}>{banner.buttonText || "Shop Now"} →</Link>;

        return (
          <article key={banner.id} className="promo-banner promo-banner-managed" style={style}>
            <div className="promo-content">
              {banner.eyebrow && <span className="promo-brand">{banner.eyebrow}</span>}
              <h2>{banner.title}</h2>
              {banner.subtitle && <p>{banner.subtitle}</p>}
              {action}
            </div>
            {!banner.imageUrl && <div className="promo-product" aria-hidden="true" />}
          </article>
        );
      })}
    </section>
  );
}

export default PromoBannerSection;
