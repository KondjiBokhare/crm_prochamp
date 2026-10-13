import { Link, Navigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import AddressSection from "../../components/checkout/AddressSection";
import CheckoutItems from "../../components/checkout/CheckoutItems";
import PaymentSection from "../../components/checkout/PaymentSection";
import CheckoutSummary from "../../components/checkout/CheckoutSummary";
import StoreLogo from "../../components/common/StoreLogo";
import StoreFooter from "../../components/common/StoreFooter";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { getSavedCheckoutAddress } from "../../services/demoOrderService";
import { recordCheckoutStarted } from "../../services/customerBehaviorService";

function Checkout() {
  const { cartItems, clearCart } = useCart();
  const { user, authenticatedRequest } = useAuth();
  const checkoutSignatureRef = useRef("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [address, setAddress] = useState(() => getSavedCheckoutAddress() || {
    name: user?.name || "", phone: "", line: "", city: "", type: "Home",
  });

  useEffect(() => {
    if (!cartItems?.length) return;
    const signature = cartItems.map((item) => `${item.id}:${item.quantity}`).sort().join("|");
    if (checkoutSignatureRef.current === signature) return;
    checkoutSignatureRef.current = signature;
    recordCheckoutStarted(cartItems);
  }, [cartItems]);

  useEffect(() => {
    if (user?.name) setAddress((current) => ({ ...current, name: current.name || user.name }));
  }, [user]);

  if (!cartItems || cartItems.length === 0) return <Navigate to="/cart" replace />;

  return <div className="checkout-layout-page">
    <header className="checkout-top-header">
      <StoreLogo variant="checkout" />
      <Link to="/cart" className="checkout-continue-link">← Back to Cart</Link>
    </header>
    <div className="checkout-page">
      <div className="checkout-breadcrumb"><Link to="/">Home</Link><span>/</span><Link to="/cart">Cart</Link><span>/</span><strong>Checkout</strong></div>
      <div className="checkout-header"><div><h1>Checkout</h1><p>Review your items and delivery details. This is a demo checkout.</p></div><div className="checkout-progress"><span className="active">1</span><span/><span className="active">2</span><span/><span className="active">3</span></div></div>
      <div className="checkout-layout">
        <main className="checkout-main">
          <AddressSection address={address} onChange={setAddress}/>
          <CheckoutItems items={cartItems}/>
          <PaymentSection selectedMethod={paymentMethod} onChange={setPaymentMethod}/>
        </main>
        <CheckoutSummary cartItems={cartItems} address={address} paymentMethod={paymentMethod} clearCart={clearCart} customerEmail={user?.email || ""} authenticatedRequest={authenticatedRequest}/>
      </div>
    </div>
    <StoreFooter />
  </div>;
}

export default Checkout;
