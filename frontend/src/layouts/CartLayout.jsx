import { Link, Outlet } from "react-router-dom";
import StoreLogo from "../components/common/StoreLogo";
import StoreFooter from "../components/common/StoreFooter";

function CartLayout() {
  return <div className="cart-layout-page">
    <header className="cart-header">
      <StoreLogo variant="cart" />
      <Link to="/products" className="cart-continue-link">Continue Shopping →</Link>
    </header>
    <main><Outlet /></main>
    <StoreFooter />
  </div>;
}

export default CartLayout;
