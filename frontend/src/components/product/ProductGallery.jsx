import { useEffect, useState } from "react";
import {
  Heart,
  Share2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { useWishlist } from "../../context/WishlistContext";
import { recordWishlistChange } from "../../services/customerBehaviorService";

function ProductGallery({
  images,
  productName,
  productId,
}) {
  const galleryImages = Array.isArray(images) ? images.filter(Boolean) : [];
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    setActiveImage(0);
  }, [productId, galleryImages.length]);

  const {
    toggleWishlist,
    isWishlisted,
  } = useWishlist();

  const wishlisted = isWishlisted(productId);

  const nextImage = () => {
    setActiveImage((current) =>
      current >= galleryImages.length - 1
        ? 0
        : current + 1
    );
  };

  const previousImage = () => {
    setActiveImage((current) =>
      current === 0
        ? galleryImages.length - 1
        : current - 1
    );
  };

  const handleWishlist = () => {
    toggleWishlist(productId);
    recordWishlistChange({ id: productId, name: productName }, !wishlisted);
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;

    const shareData = {
      title: productName,
      text: `Check out ${productName} on TechGear.`,
      url: shareUrl,
    };

    try {
      // Native share support
      if (
        navigator.share &&
        typeof navigator.share === "function"
      ) {
        await navigator.share(shareData);
        return;
      }

      // Clipboard fallback
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText ===
          "function"
      ) {
        await navigator.clipboard.writeText(
          shareUrl
        );

        window.alert(
          "Product link copied to clipboard."
        );

        return;
      }

      // Final fallback
      window.prompt(
        "Copy this product link:",
        shareUrl
      );
    } catch (error) {
      // User cancelled the native share dialog
      if (
        error?.name === "AbortError"
      ) {
        return;
      }

      console.error(
        "Failed to share product:",
        error
      );

      try {
        await navigator.clipboard.writeText(
          shareUrl
        );

        window.alert(
          "Product link copied to clipboard."
        );
      } catch {
        window.prompt(
          "Copy this product link:",
          shareUrl
        );
      }
    }
  };

  return (
    <div className="product-gallery">

      <div className="product-gallery-main">

        {/* =========================
            PRODUCT ACTIONS
        ========================= */}

        <div className="gallery-top-actions">

          {/* Wishlist */}
          <button
            type="button"
            className={`gallery-heart ${
              wishlisted
                ? "active"
                : ""
            }`}
            aria-label={
              wishlisted
                ? "Remove from wishlist"
                : "Add to wishlist"
            }
            aria-pressed={wishlisted}
            onClick={handleWishlist}
          >
            <Heart
              size={20}
              fill={
                wishlisted
                  ? "currentColor"
                  : "none"
              }
            />
          </button>

          {/* Share */}
          <button
            type="button"
            className="gallery-share"
            aria-label="Share product"
            onClick={handleShare}
          >
            <Share2 size={20} />
          </button>

        </div>


        {/* =========================
            PREVIOUS IMAGE
        ========================= */}

        {galleryImages.length > 1 && <button
          type="button"
          className="gallery-arrow gallery-prev"
          onClick={previousImage}
          aria-label="Previous product image"
        >
          <ChevronLeft size={20} />
        </button>}


        {/* =========================
            MAIN IMAGE
        ========================= */}

        {galleryImages.length > 0 ? <img
          src={galleryImages[Math.min(activeImage, galleryImages.length - 1)]}
          alt={productName}
          className="gallery-main-image"
        /> : <div className="gallery-no-image" role="img" aria-label={`${productName} image unavailable`}>No product image available</div>}


        {/* =========================
            NEXT IMAGE
        ========================= */}

        {galleryImages.length > 1 && <button
          type="button"
          className="gallery-arrow gallery-next"
          onClick={nextImage}
          aria-label="Next product image"
        >
          <ChevronRight size={20} />
        </button>}

      </div>


      {/* =========================
          THUMBNAILS
      ========================= */}

      {galleryImages.length > 1 && <div className="gallery-thumbnails">

        {galleryImages.map((image, index) => (
          <button
            type="button"
            key={`${image}-${index}`}
            className={`gallery-thumbnail ${
              activeImage === index
                ? "active"
                : ""
            }`}
            onClick={() =>
              setActiveImage(index)
            }
            aria-label={`View image ${
              index + 1
            }`}
          >
            <img
              src={image}
              alt={`${productName} ${
                index + 1
              }`}
            />
          </button>
        ))}

      </div>}

    </div>
  );
}

export default ProductGallery;