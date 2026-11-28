import {
  Link,
  Navigate,
  useLocation,
  useSearchParams,
} from "react-router-dom";

import { useEffect, useRef, useState } from "react";

import AddressSection from "../../components/checkout/AddressSection";
import CheckoutItems from "../../components/checkout/CheckoutItems";
import PaymentSection from "../../components/checkout/PaymentSection";
import CheckoutSummary from "../../components/checkout/CheckoutSummary";
import StoreLogo from "../../components/common/StoreLogo";
import StoreFooter from "../../components/common/StoreFooter";

import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";

import { useProductCatalog } from "../../services/productCatalogService";
import { recordCheckoutStarted } from "../../services/customerBehaviorService";

function Checkout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  const { cartItems } = useCart();

  const {
    user,
    authenticatedRequest,
    isInitializing,
  } = useAuth();

  const products = useProductCatalog();

  const checkoutSignatureRef = useRef("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const isBuyNow =
    searchParams.get("mode") === "buy_now";

  const productId = searchParams.get("productId");

  const requestedQuantity = Number(
    searchParams.get("quantity") || 1
  );

  const validQuantity =
    Number.isInteger(requestedQuantity) &&
    requestedQuantity >= 1 &&
    requestedQuantity <= 100;

  const directProduct = isBuyNow
    ? products.find(
        (product) =>
          String(product.id) === String(productId)
      )
    : null;

  const validDirectProduct =
    directProduct &&
    validQuantity &&
    Number(directProduct.stock) >= requestedQuantity;

  const updateDirectQuantity = (nextQuantity) => {
  if (!isBuyNow || !directProduct || checkoutBusy) return;

  const maxQuantity = Math.min(
    Number(directProduct.stock),
    100
  );

  if (
    !Number.isInteger(nextQuantity) ||
    nextQuantity < 1 ||
    nextQuantity > maxQuantity
  ) {
    return;
  }

  const nextParams = new URLSearchParams(searchParams);

  nextParams.set("quantity", String(nextQuantity));

  setSearchParams(nextParams, { replace: true });
};

  const checkoutItems = isBuyNow
    ? validDirectProduct
      ? [
          {
            ...directProduct,
            quantity: requestedQuantity,
          },
        ]
      : []
    : cartItems || [];

  const [paymentMethod, setPaymentMethod] =
    useState("UPI");

  const [address, setAddress] = useState({
    name: user?.name || "",
    phone: "",
    line: "",
    city: "",
    type: "Home",
  });

  useEffect(() => {
    if (
      isInitializing ||
      user?.role !== "CUSTOMER" ||
      !checkoutItems.length
    ) return;

    const signature =
      `${isBuyNow ? "buy_now" : "cart"}:` +
      checkoutItems
        .map((item) => `${item.id}:${item.quantity}`)
        .sort()
        .join("|");

    if (checkoutSignatureRef.current === signature) {
      return;
    }

    checkoutSignatureRef.current = signature;

    recordCheckoutStarted(checkoutItems);
  }, [checkoutItems, isBuyNow, user, isInitializing]);

  useEffect(() => {
    if (user?.name) {
      setAddress((current) => ({
        ...current,
        name: current.name || user.name,
      }));
    }
  }, [user]);

  if (isInitializing) {
    return (
      <div className="crm-loading" role="status">
        Restoring session…
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}`,
        }}
      />
    );
  }

  if (user.role !== "CUSTOMER") {
    return <Navigate to="/unauthorized" replace />;
  }

  if (isBuyNow && !validDirectProduct) {
    return (
      <div className="checkout-layout-page">
        <header className="checkout-top-header">
          <StoreLogo variant="checkout" />
        </header>

        <div className="checkout-page">
          <h1>Product unavailable</h1>

          <p>
            The product is loading, unavailable, or
            the selected quantity exceeds available stock.
          </p>

          <Link
            to={
              productId
                ? `/product/${encodeURIComponent(productId)}`
                : "/products"
            }
            className="checkout-continue-link"
          >
            ← Back to Product
          </Link>
        </div>
      </div>
    );
  }

  if (!isBuyNow && !checkoutItems.length) {
    return <Navigate to="/cart" replace />;
  }

  const backPath = isBuyNow
    ? `/product/${encodeURIComponent(productId)}`
    : "/cart";

  return (
    <div className="checkout-layout-page">

      <header className="checkout-top-header">
        <StoreLogo variant="checkout" />

        <Link
          to={backPath}
          className="checkout-continue-link"
        >
          {isBuyNow
            ? "← Back to Product"
            : "← Back to Cart"}
        </Link>
      </header>

      <div className="checkout-page">

        <div className="checkout-breadcrumb">
          <Link to="/">Home</Link>
          <span>/</span>

          <Link to={backPath}>
            {isBuyNow ? "Product" : "Cart"}
          </Link>

          <span>/</span>
          <strong>Checkout</strong>
        </div>

        <div className="checkout-header">
          <div>
            <h1>
              {isBuyNow ? "Buy Now Checkout" : "Checkout"}
            </h1>

            <p>
              {isBuyNow
                ? "Purchase your selected product without changing your shopping cart."
                : "Review your items and delivery details."}
            </p>
          </div>

          <div className="checkout-progress">
            <span className="active">1</span>
            <span />
            <span className="active">2</span>
            <span />
            <span className="active">3</span>
          </div>
        </div>

        <div className="checkout-layout">

          <main className="checkout-main">

            <AddressSection
              address={address}
              onChange={setAddress}
            />

     <CheckoutItems
  items={checkoutItems}
  editableQuantity={isBuyNow}
  onQuantityChange={updateDirectQuantity}
  quantityDisabled={checkoutBusy}
/>

            <PaymentSection
              selectedMethod={paymentMethod}
              onChange={setPaymentMethod}
            />

          </main>

          <CheckoutSummary
  key={
    isBuyNow
      ? `buy_now:${productId}:${requestedQuantity}`
      : "cart"
  }
  cartItems={checkoutItems}
  address={address}
  paymentMethod={paymentMethod}
  customerEmail={user?.email || ""}
  authenticatedRequest={authenticatedRequest}
  checkoutMode={isBuyNow ? "buy_now" : "cart"}
  onBusyChange={setCheckoutBusy}
/>

        </div>
      </div>

      <StoreFooter />
    </div>
  );
}

export default Checkout;