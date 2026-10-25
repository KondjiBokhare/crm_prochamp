import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {   ChevronLeft, ChevronRight,   ShieldCheck, Truck, Headphones } from "lucide-react";
import {
  getStorefrontBanners,
  recordBannerClick,
  recordBannerImpression,
} from "../../services/crmService";
import { useProductCatalog } from "../../services/productCatalogService";
import { useHomepagePromotionSettings } from "../../services/homepagePromotionsService";

const DEFAULT_HERO_TITLE = "Build. Game. Create.";
const DEFAULT_HERO_SUBTITLE = "Discover dependable PC hardware for work, play, and everything you want to create.";
const BANNER_INTERVAL_MS = 6000;
const PRODUCT_INTERVAL_MS = 6000;

function isPlaceholder(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return !text || /^(headline|subtitle|pname|product name|your title|your subtitle|title here|description here|your banner headline)$/i.test(text);
}

function safeText(value, fallback) {
  return isPlaceholder(value) ? fallback : String(value).trim();
}

function isHexColor(value) {
  return /^#([0-9a-f]{6})$/i.test(String(value || ""));
}

function rgbFromHex(hex) {
  const value = String(hex).replace("#", "");
  return [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16));
}

function relativeLuminance(hex) {
  if (!isHexColor(hex)) return 0.08;
  const channels = rgbFromHex(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrastRatio(first, second) {
  const one = relativeLuminance(first);
  const two = relativeLuminance(second);
  return (Math.max(one, two) + 0.05) / (Math.min(one, two) + 0.05);
}

function shadeHex(hex, factor = 0.58) {
  if (!isHexColor(hex)) return "#151914";
  const channels = rgbFromHex(hex).map((channel) => Math.round(channel * factor));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function getBannerVisual(banner) {
  const rawBaseColor = isHexColor(banner.backgroundColor) ? banner.backgroundColor : "#151914";
  const backgroundIsLight = relativeLuminance(rawBaseColor) > 0.72;
  const background = banner.imageUrl
    ? `linear-gradient(90deg, rgba(9, 16, 30, .78) 0%, rgba(9, 16, 30, .48) 52%, rgba(9, 16, 30, .12) 100%), url("${banner.imageUrl}") center / cover no-repeat`
    : `linear-gradient(120deg, ${shadeHex(rawBaseColor, 0.72)} 0%, ${rawBaseColor} 58%, ${shadeHex(rawBaseColor, 0.52)} 100%)`;
  const suppliedTextColor = isHexColor(banner.textColor) ? banner.textColor : "#ffffff";
  const textColor = !banner.imageUrl && backgroundIsLight
    ? "#171b15"
    : contrastRatio(suppliedTextColor, "#151914") < 4.2
      ? "#ffffff"
      : suppliedTextColor;
  return { background, textColor, backgroundIsLight };
}

function formatPrice(price) {
  const value = Number(price);
  return Number.isFinite(value) && value >= 0 ? `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}` : "Price on request";
}

function HeroBanner({ benefits = [] }) {
  const catalogue = useProductCatalog();
  const promotionSettings = useHomepagePromotionSettings();
  const [banners, setBanners] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0); // Includes the trailing clone during wrap-around.
  const [bannerTransitionEnabled, setBannerTransitionEnabled] = useState(true);
  const [currentProductIndex, setCurrentProductIndex] = useState(0); // Includes the trailing clone during wrap-around.
  const [productTransitionEnabled, setProductTransitionEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const seen = useRef(new Set());

  const usableProducts = useMemo(
    () => catalogue.filter((product) => product && product.id != null && !isPlaceholder(product.name)),
    [catalogue],
  );
  const featuredProducts = useMemo(() => {
    if (!promotionSettings.enabled) return [];
    if (promotionSettings.selectionMode === "MANUAL") {
      return (promotionSettings.featuredProductIds || [])
        .map((id) => usableProducts.find((product) => String(product.id) === String(id)))
        .filter(Boolean)
        .slice(0, 2);
    }
    // Auto mode rotates through more catalogue products; manual mode honours the admin's chosen list.
    return usableProducts.slice(0, 8);
  }, [promotionSettings.enabled, promotionSettings.selectionMode, promotionSettings.featuredProductIds, usableProducts]);

  const activeBannerIndex = banners.length ? currentIndex % banners.length : 0;
  const banner = banners[activeBannerIndex] || null;
  const bannerSlides = banners.length > 1 ? [...banners, banners[0]] : banners;
  const productSlides = featuredProducts.length > 1 ? [...featuredProducts, featuredProducts[0]] : featuredProducts;
  // Include the cloned first card in the track geometry so every step is exactly one viewport.
  const productSlideCount = productSlides.length;

  useEffect(() => {
    let active = true;
    getStorefrontBanners({ placement: "HERO" })
      .then((items) => {
        if (active) {
          setBanners(Array.isArray(items) ? items : []);
          setCurrentIndex(0);
        }
      })
      .catch(() => {
        if (active) setBanners([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!banner || banner.id == null || seen.current.has(banner.id)) return;
    seen.current.add(banner.id);
    recordBannerImpression(banner.id).catch(() => {});
  }, [banner]);

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index >= banners.length ? 0 : index + 1));
    }, BANNER_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    setCurrentProductIndex(0);
    setProductTransitionEnabled(true);
    if (featuredProducts.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setCurrentProductIndex((index) => (index >= featuredProducts.length ? 0 : index + 1));
    }, PRODUCT_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [featuredProducts.length]);

  const moveBanner = (direction) => {
    if (banners.length < 2) return;
    const index = currentIndex % banners.length;
    if (direction > 0) setCurrentIndex(index === banners.length - 1 ? banners.length : index + 1);
    else setCurrentIndex(index === 0 ? banners.length - 1 : index - 1);
  };

  // const moveProduct = (direction) => {
  //   if (featuredProducts.length < 2) return;
  //   const index = currentProductIndex % featuredProducts.length;
  //   if (direction > 0) setCurrentProductIndex(index === featuredProducts.length - 1 ? featuredProducts.length : index + 1);
  //   else setCurrentProductIndex(index === 0 ? featuredProducts.length - 1 : index - 1);
  // };

  const handleBannerTrackTransitionEnd = (event) => {
    if (event.target !== event.currentTarget || currentIndex !== banners.length || banners.length < 2) return;
    setBannerTransitionEnabled(false);
    setCurrentIndex(0);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => setBannerTransitionEnabled(true)));
  };

  const handleProductTrackTransitionEnd = (event) => {
    if (event.target !== event.currentTarget || currentProductIndex !== featuredProducts.length || featuredProducts.length < 2) return;
    setProductTransitionEnabled(false);
    setCurrentProductIndex(0);
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => setProductTransitionEnabled(true)));
  };

  const handleBannerClick = (clickedBanner) => {
    if (clickedBanner?.id == null) return;
    recordBannerClick(clickedBanner.id).catch(() => {});
  };

  if (loading) {
    return (
      <section className="home-hero-showcase home-hero-showcase-loading" aria-label="Featured promotions">
        <div className="home-hero-banner-rail" />
        <aside className="home-hero-product-pane"><div className="home-hero-product-skeleton" /></aside>
      </section>
    );
  }
  if (!banner) return null;

  return (
    <section className="home-hero-showcase" aria-label="Featured promotions">
      <div className="home-hero-banner-rail">
        <div
          className="home-hero-banner-track"
          style={{ transform: `translate3d(-${currentIndex * 100}%, 0, 0)`, transition: bannerTransitionEnabled ? undefined : "none" }}
          onTransitionEnd={handleBannerTrackTransitionEnd}
        >
          {bannerSlides.map((item, index) => {
            const visual = getBannerVisual(item);
            const activeIndex = index % banners.length;
            const targetUrl = String(item.targetUrl || "/products");
            const isExternal = /^https?:\/\//i.test(targetUrl);
            const title = safeText(item.title, DEFAULT_HERO_TITLE);
            const subtitle = safeText(item.subtitle, DEFAULT_HERO_SUBTITLE);
            const buttonText = safeText(item.buttonText, "Shop Now");
            return (
              <article
                key={`${item.id ?? item.name ?? "banner"}-${index}`}
                className={`home-hero-slide${item.imageUrl ? " has-image" : " color-only"}${visual.backgroundIsLight && !item.imageUrl ? " is-light" : ""}`}
                style={{ background: visual.background, color: visual.textColor }}
                aria-label={title}
                aria-hidden={activeIndex !== activeBannerIndex}
              >
                <div className="home-hero-slide-copy">
                  {item.eyebrow && !isPlaceholder(item.eyebrow) && <span className="home-hero-eyebrow">{item.eyebrow}</span>}
                  <h1>{title}</h1>
                  <p>{subtitle}</p>
                  {isExternal ? (
                    <a className="home-hero-cta" href={targetUrl} target="_blank" rel="noreferrer" onClick={() => handleBannerClick(item)}>
                      {buttonText}<span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <Link className="home-hero-cta" to={targetUrl} onClick={() => handleBannerClick(item)}>
                      {buttonText}<span aria-hidden="true">↗</span>
                    </Link>
                  )}
                </div>
                {benefits.length > 0 && activeIndex === activeBannerIndex && (
                  <div className="home-hero-benefits">
                    {benefits.map((label, benefitIndex) => {
                      const cleanLabel = String(label || "").trim();
                      if (!cleanLabel || isPlaceholder(cleanLabel)) return null;
                      const Icon = /deliver|shipping|fast/i.test(cleanLabel)
                        ? Truck
                        : /support|help/i.test(cleanLabel)
                          ? Headphones
                          : ShieldCheck;
                      return <div key={`${cleanLabel}-${benefitIndex}`}><Icon size={17} /><span>{cleanLabel}</span></div>;
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </div>
        {banners.length > 1 && (
          <>
            <button className="home-hero-arrow home-hero-arrow-prev" type="button" aria-label="Previous banner" onClick={() => moveBanner(-1)}>
              <ChevronLeft size={21} />
            </button>
            <button className="home-hero-arrow home-hero-arrow-next" type="button" aria-label="Next banner" onClick={() => moveBanner(1)}>
              <ChevronRight size={21} />
            </button>
            <div className="home-hero-dots" aria-label="Choose a banner">
              {banners.map((item, index) => (
                <button
                  key={item.id ?? index}
                  type="button"
                  className={index === activeBannerIndex ? "active" : ""}
                  aria-label={`Show banner ${index + 1}`}
                  aria-current={index === activeBannerIndex ? "true" : undefined}
                  onClick={() => setCurrentIndex(index)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <aside className="home-hero-product-pane" aria-label="Featured products">
        <div className="home-hero-product-heading">
          <div>
            <span className="home-hero-product-kicker">Exclisive Products</span>
            <h2>{safeText(promotionSettings.sectionTitle, "Featured products")}</h2>
            <p>{safeText(promotionSettings.subtitle, "Picked for your setup.")}</p>
          </div>
          {/* {featuredProducts.length > 1 && (
            <div className="home-hero-product-controls">
              <button type="button" aria-label="Previous featured product" onClick={() => moveProduct(-1)}><ChevronUp size={17} /></button>
              <button type="button" aria-label="Next featured product" onClick={() => moveProduct(1)}><ChevronDown size={17} /></button>
            </div>
          )} */}
        </div>
        {featuredProducts.length > 0 ? (
          <div className="home-hero-product-window">
            <div
              className="home-hero-product-track"
              style={{
                // Track height is N viewport-heights. Transform percentages are relative to
                // the track itself, so each step must be 1/N of the track, not 100% of it.
                height: `${productSlideCount * 100}%`,
                minHeight: 0,
                "--home-hero-product-count": productSlideCount,
                transform: `translate3d(0, -${productSlideCount ? (currentProductIndex * 100) / productSlideCount : 0}%, 0)`,
                transition: productTransitionEnabled ? undefined : "none",
              }}
              onTransitionEnd={handleProductTrackTransitionEnd}
            >
              {productSlides.map((product, index) => {
                const imageUrl = product.images?.[0] || product.image;
                return (
                  <article
                    className="home-hero-product-slide"
                    key={`${product.id}-${index}`}
                    style={{
                      // A slide is one viewport high even when the track contains a clone.
                      flex: `0 0 ${productSlideCount ? 100 / productSlideCount : 100}%`,
                      height: `${productSlideCount ? 100 / productSlideCount : 100}%`,
                      minHeight: 0,
                    }}
                  >
                    <Link className="home-hero-product-card" to={`/product/${product.id}`} aria-label={`View ${product.name}`}>
                      <div className="home-hero-product-image">
                        {imageUrl ? <img src={imageUrl} alt={product.name} loading={index === (currentProductIndex % featuredProducts.length) ? "eager" : "lazy"} /> : <span>{String(product.brand || product.name).slice(0, 24)}</span>}
                      </div>
                      <div className="home-hero-product-info">
                        <span className="home-hero-product-label">FEATURED HARDWARE</span>
                        <h3>{safeText(product.name, "Featured product")}</h3>
                        {product.brand && !isPlaceholder(product.brand) && <p className="home-hero-product-brand">{product.brand}</p>}
                        <strong>{formatPrice(product.price)}</strong>
                        <span className="home-hero-product-link">Explore product <span aria-hidden="true">↗</span></span>
                      </div>
                    </Link>
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="home-hero-product-empty">
            <span className="home-hero-product-empty-icon">TG</span>
            <strong>Featured hardware</strong>
            <p>Products will appear here when the catalogue has valid product names and the promotion is enabled.</p>
            <Link to="/products">Browse all products <span aria-hidden="true">→</span></Link>
          </div>
        )}
        {featuredProducts.length > 1 && (
          <div className="home-hero-product-progress" aria-label={`Featured product ${(currentProductIndex % featuredProducts.length) + 1} of ${featuredProducts.length}`}>
            <div><span style={{ width: `${(((currentProductIndex % featuredProducts.length) + 1) / featuredProducts.length) * 100}%` }} /></div>
            <small>{String((currentProductIndex % featuredProducts.length) + 1).padStart(2, "0")} / {String(featuredProducts.length).padStart(2, "0")}</small>
          </div>
        )}
      </aside>
    </section>
  );
}

export default HeroBanner;
