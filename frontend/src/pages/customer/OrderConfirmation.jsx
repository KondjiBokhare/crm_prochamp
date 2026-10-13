import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, PackageSearch } from "lucide-react";
import OrderSuccess from "../../components/order/orderSuccess";
import OrderSummaryCard from "../../components/order/OrderSummaryCard";
import StoreLogo from "../../components/common/StoreLogo";
import StoreFooter from "../../components/common/StoreFooter";
import { getDemoOrderById } from "../../services/demoOrderService";
import { useAuth } from "../../context/AuthContext";
import { clearAppliedStorefrontCoupon } from "../../services/storefrontCouponApiService";
import { getStorefrontOrderById, storefrontOrdersApiEnabled } from "../../services/storefrontOrderApiService";
import { useCart } from "../../context/CartContext";

function OrderConfirmation() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId") || "";
  const { authenticatedRequest } = useAuth();
  const { clearCart } = useCart();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    const load = async () => {
      try {
        const found = storefrontOrdersApiEnabled
          ? await getStorefrontOrderById(orderId, authenticatedRequest)
          : getDemoOrderById(orderId);
        if (!active) return;
        setOrder(found);
        if (found) {
          // Clear only after the confirmation page has retrieved the persisted order.
          clearCart();
          clearAppliedStorefrontCoupon();
        }
      } catch (error) {
        if (active) setLoadError(error.message || "Could not load the order confirmation.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [orderId, authenticatedRequest, clearCart]);

  return <div className="order-confirmation-shell">
    <header className="checkout-top-header"><StoreLogo variant="checkout"/><Link to="/products" className="checkout-continue-link">Continue Shopping →</Link></header>
    <div className="order-confirmation-page">
      <div className="order-breadcrumb"><Link to="/">Home</Link><span>/</span><strong>Order Confirmation</strong></div>
      {loading ? <section className="order-confirmation-empty"><PackageSearch size={42}/><h1>Loading order…</h1><p>Retrieving your saved order details.</p></section> : loadError ? <section className="order-confirmation-empty"><PackageSearch size={42}/><h1>Order could not be loaded</h1><p>{loadError}</p><Link className="continue-shopping-button" to="/orders">View My Orders <ArrowRight size={18}/></Link></section> : order ? <>
        <OrderSuccess order={order}/>
        <OrderSummaryCard order={order}/>
        <div className="order-actions">
          <Link to="/orders" className="track-order-button"><PackageSearch size={18}/> Track My Order</Link>
          <Link to="/" className="continue-shopping-button">Continue Shopping <ArrowRight size={18}/></Link>
        </div>
      </> : <section className="order-confirmation-empty"><PackageSearch size={42}/><h1>No order found</h1><p>{storefrontOrdersApiEnabled ? "The order number may be invalid, or this order may belong to another account." : "Place a demo order from checkout to see its actual items and calculated total here."}</p><Link className="continue-shopping-button" to="/cart">Return to cart <ArrowRight size={18}/></Link></section>}
    </div>
    <StoreFooter />
  </div>;
}

export default OrderConfirmation;
