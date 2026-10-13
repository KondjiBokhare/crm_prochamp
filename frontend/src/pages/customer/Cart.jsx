import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";

import { useCart } from "../../context/CartContext";

import CartItem from "../../components/cart/CartItem";
import CartSummary from "../../components/cart/CartSummary";
import ProductCard from "../../components/home/ProductCard";
import { useProductCatalog } from "../../services/productCatalogService";
import { calculateCartTotals } from "../../utils/pricing";
import { useEffect, useState } from "react";
import { clearAppliedStorefrontCoupon, getAppliedStorefrontCoupon, getCartSignature, saveAppliedStorefrontCoupon, storefrontCouponsApiEnabled, validateStorefrontCoupon } from "../../services/storefrontCouponApiService";

function Cart() {
  const {
    cartItems,
    removeFromCart,
  } = useCart();
  const [couponInput, setCouponInput] = useState(() => getAppliedStorefrontCoupon()?.code || "");
  const [appliedCoupon, setAppliedCoupon] = useState(() => getAppliedStorefrontCoupon());
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState("");
  const [couponNotice, setCouponNotice] = useState("");
  const cartSignature = getCartSignature(cartItems);
  const catalogue = useProductCatalog();
  const cartProductIds = new Set(cartItems.map((item) => String(item.id)));
  const relatedProducts = catalogue.filter((product) => !cartProductIds.has(String(product.id))).slice(0, 4);

  const { subtotal, discount, delivery } = calculateCartTotals(cartItems, appliedCoupon?.discountAmount || 0);

  useEffect(() => {
    if (!appliedCoupon || !cartItems.length) return;
    if (appliedCoupon.cartSignature && appliedCoupon.cartSignature !== cartSignature) {
      clearAppliedStorefrontCoupon();
      setAppliedCoupon(null);
      setCouponNotice("Cart contents changed, so the previous coupon was removed. Apply it again to re-check eligibility.");
      setCouponError("");
    }
  }, [cartSignature, appliedCoupon, cartItems.length]);

  async function applyCoupon() {
    setCouponError(""); setCouponNotice(""); setCouponBusy(true);
    try {
      if (!cartItems.length) throw new Error("Add a product to your cart first.");
      const result = await validateStorefrontCoupon(couponInput, cartItems);
      const stored = { ...result, cartSignature };
      saveAppliedStorefrontCoupon(stored);
      setAppliedCoupon(stored);
      setCouponInput(result.code);
      setCouponNotice(`${result.code} applied. Discount is a preview for this demo checkout; redemption is not recorded.`);
    } catch (err) {
      clearAppliedStorefrontCoupon(); setAppliedCoupon(null);
      setCouponError(err?.message || "Could not validate this coupon.");
    } finally { setCouponBusy(false); }
  }

  function removeCoupon() {
    clearAppliedStorefrontCoupon(); setAppliedCoupon(null); setCouponError(""); setCouponNotice("Coupon removed from this cart.");
  }

  return (
    <div className="cart-page">

      {/* =========================
          CART HEADER
      ========================= */}
      <div className="cart-header-content">
        <div>
          <h1>Shopping Cart</h1>

          <p>
            {cartItems.length}{" "}
            {cartItems.length === 1
              ? "product"
              : "products"}{" "}
            in your cart
          </p>
        </div>
      </div>

      {/* =========================
          EMPTY CART
      ========================= */}
      {cartItems.length === 0 ? (
        <div className="empty-cart">

          <ShoppingCart size={60} />

          <h2>Your cart is empty</h2>

          <p>
            Add some hardware products to continue
            shopping.
          </p>

          <Link
            to="/products"
            className="empty-cart-button"
          >
            Start Shopping
          </Link>

        </div>
      ) : (
        <>
          {/* =========================
              CART CONTENT
          ========================= */}
          <div className="cart-layout">

            {/* Products */}
            <main className="cart-items-section">

              <div className="cart-items-header">
                <span>PRODUCT</span>
                <span>PRICE / QUANTITY</span>
              </div>

              {cartItems.map((item) => (
                <CartItem
                  key={item.id}
                  item={item}
                  onRemove={removeFromCart}
                />
              ))}

            </main>

            {/* Summary */}
            <CartSummary
              subtotal={subtotal}
              discount={discount}
              delivery={delivery}
              couponDiscount={appliedCoupon?.discountAmount || 0}
              appliedCouponCode={appliedCoupon?.code || ""}
              couponInput={couponInput}
              onCouponInputChange={setCouponInput}
              onApplyCoupon={applyCoupon}
              onRemoveCoupon={removeCoupon}
              couponBusy={couponBusy}
              couponError={couponError}
              couponNotice={couponNotice}
              couponEnabled={storefrontCouponsApiEnabled}
            />

          </div>

          {/* =========================
              RELATED PRODUCTS
          ========================= */}
          {relatedProducts.length > 0 && <section className="cart-related-products">

            <div className="section-heading">
              <div>
                <h2>
                  Frequently Bought Together
                </h2>

                <p className="section-subtitle">
                  Complete your setup with these
                  products.
                </p>
              </div>

              <Link
                to="/products"
                className="view-all-button"
              >
                View All →
              </Link>
            </div>

            <div className="cart-related-grid">
              {relatedProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                />
              ))}
            </div>

          </section>}
        </>
      )}

    </div>
  );
}

export default Cart;