import { useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";

import ProductGallery from "../../components/product/ProductGallery";
import ProductInfo from "../../components/product/ProductInfo";
import ProductHighlights from "../../components/product/ProductHighlights";
import ProductSpecifications from "../../components/product/ProductSpecifications";
import ProductReviews from "../../components/product/ProductReviews";
import RelatedProducts from "../../components/product/RelatedProducts";

import { useProductCatalog } from "../../services/productCatalogService";
import { recordProductView } from "../../services/customerBehaviorService";

function ProductDetails() {
  const { id } = useParams();
  const products = useProductCatalog();
  const lastTrackedProductId = useRef(null);

  const product = products.find(
    (item) => String(item.id) === String(id)
  );

  useEffect(() => {
    if (!product || String(lastTrackedProductId.current) === String(product.id)) return;
    lastTrackedProductId.current = product.id;
    recordProductView(product);
  }, [product]);

  if (!product) {
    return (
      <div className="product-details-page">
        <h1>Product Not Found</h1>

        <p>
          The product you are looking for does not exist.
        </p>

        <Link
          to="/"
          className="product-not-found-home-link"
        >
          Go to Home
        </Link>
      </div>
    );
  }

  const category =
    product.category || "Graphics Cards";

  return (
    <div className="product-details-page">

      {/* Breadcrumb */}
      <nav
        className="products-breadcrumb"
        aria-label="Breadcrumb"
      >
        <Link
          to="/"
          className="products-breadcrumb-link"
        >
          Home
        </Link>

        <span>/</span>

        <Link
          to="/products"
          className="products-breadcrumb-link"
        >
          Category
        </Link>

        <span>/</span>

        <Link
          to={`/products?category=${encodeURIComponent(
            category
          )}`}
          className="products-breadcrumb-link"
        >
          {category}
        </Link>

        <span>/</span>

        <strong>
          {product.name}
        </strong>
      </nav>

      {/* Main Product */}
      <div className="product-main">

        <ProductGallery
          images={product.images?.length ? product.images : (product.image ? [product.image] : [])}
          productName={product.name}
          productId={product.id}
        />

        <ProductInfo
          product={product}
        />

      </div>

      {/* Highlights */}
      <ProductHighlights
        highlights={product.highlights}
      />

      {/* Specifications */}
      <ProductSpecifications
        specifications={product.specifications}
      />

      {/* Reviews */}
      <ProductReviews
        productId={product.id}
        rating={product.rating}
        totalReviews={product.reviews}
      />

      {/* Related Products */}
      <RelatedProducts
        product={product}
      />

      <p className="storefront-behavior-notice" role="note">
        Anonymous visitor IDs are used to persist your cart and wishlist and to understand aggregate storefront activity. Product reviews are publicly displayed only after moderation. This prototype does not use these IDs to identify you or intentionally collect payment credentials.
      </p>

    </div>
  );
}

export default ProductDetails;