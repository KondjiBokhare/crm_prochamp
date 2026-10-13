import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import StoreLayout from "../layouts/StoreLayout";
import CartLayout from "../layouts/CartLayout";
import AccountLayout from "../layouts/AccountLayout";
import CRMLayout from "../layouts/CRMLayout";
import ProtectedRoute from "../components/auth/ProtectedRoute";
import RoleGuard from "../components/auth/RoleGuard";
import { CRM_ROLES } from "../auth/roles";
import CRMLogin from "../pages/crm/CRMLogin";
import Unauthorized from "../pages/crm/Unauthorized";

// Customer pages
import Home from "../pages/customer/Home";
import Products from "../pages/customer/Products";
import ProductDetails from "../pages/customer/ProductDetails";
import Login from "../pages/customer/Login";
import Signup from "../pages/customer/Signup";
import Cart from "../pages/customer/Cart";
import Checkout from "../pages/customer/Checkout";
import OrderConfirmation from "../pages/customer/OrderConfirmation";
import MyOrders from "../pages/customer/MyOrders";
import MyProfile from "../pages/customer/MyProfile";
import Wishlist from "../pages/customer/Wishlist";
import SavedAddressesPage from "../pages/customer/SavedAddressesPage";
import PaymentMethodsPage from "../pages/customer/PaymentMethodsPage";
import MyReviews from "../pages/customer/MyReviews";
import SupportTickets from "../pages/customer/SupportTickets";
import Settings from "../pages/customer/Settings";

// CRM pages
import Dashboard from "../pages/crm/Dashboard";
import Customers from "../pages/crm/Customers";
import Leads from "../pages/crm/Leads";
import OrderManagement from "../pages/crm/Orders";
import Shipments from "../pages/crm/Shipments";
import Returns from "../pages/crm/Returns";
import OrderActivity from "../pages/crm/OrderActivity";
import SupportManagement from "../pages/crm/SupportManagement";
import CustomerDetails from "../pages/crm/CustomerDetails";
import Interactions from "../pages/crm/Interactions";
import Segments from "../pages/crm/Segments";
import Campaigns from "../pages/crm/Campaigns";
import Communications from "../pages/crm/Communications";
import Analytics from "../pages/crm/Analytics";
import AuditLogs from "../pages/crm/AuditLogs";
import BannerManagement from "../pages/crm/BannerManagement";
import ProductManagement from "../pages/crm/Products";
import Categories from "../pages/crm/Categories";
import StorefrontSettings from "../pages/crm/StorefrontSettings";
import StoreInfoPage from "../pages/customer/StoreInfoPage";
import UserManagement from "../pages/crm/UserManagement";
import HomepagePromotions from "../pages/crm/HomepagePromotions";
import ProductReviewsModeration from "../pages/crm/ProductReviews";
import InventoryManagement from "../pages/crm/InventoryManagement";
import Coupons from "../pages/crm/Coupons";
import AbandonedCarts from "../pages/crm/AbandonedCarts";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Customer storefront */}
        <Route element={<StoreLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:id" element={<ProductDetails />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/about" element={<StoreInfoPage pageKey="about" />} />
          <Route path="/contact" element={<StoreInfoPage pageKey="contact" />} />
          <Route path="/faq" element={<StoreInfoPage pageKey="faq" />} />
          <Route path="/shipping" element={<StoreInfoPage pageKey="shipping" />} />
          <Route path="/returns" element={<StoreInfoPage pageKey="returns" />} />
          <Route path="/privacy" element={<StoreInfoPage pageKey="privacy" />} />
          <Route path="/terms" element={<StoreInfoPage pageKey="terms" />} />
        </Route>

        {/* Cart and checkout */}
        <Route element={<CartLayout />}>
          <Route path="/cart" element={<Cart />} />
        </Route>
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/order-confirmation" element={<OrderConfirmation />} />

        {/* Customer authentication */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* Customer account pages require a signed-in customer. This guard is
            frontend UX only; the real API must independently authorize requests. */}
        <Route
          element={
            <ProtectedRoute allowedRoles={["CUSTOMER"]} loginPath="/login">
              <AccountLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/profile" element={<MyProfile />} />
          <Route path="/orders" element={<MyOrders />} />
          <Route path="/account/wishlist" element={<Wishlist />} />
          <Route path="/addresses" element={<SavedAddressesPage />} />
          <Route path="/payments" element={<PaymentMethodsPage />} />
          <Route path="/reviews" element={<MyReviews />} />
          <Route path="/support" element={<SupportTickets />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* CRM demo login is separate from customer storefront login. */}
        <Route path="/crm/login" element={<CRMLogin />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* CRM route checks role before rendering any CRM page. Per-page guards
            only control frontend access; Django must repeat checks on every API. */}
        <Route
          path="/crm"
          element={
            <ProtectedRoute allowedRoles={CRM_ROLES} loginPath="/crm/login">
              <CRMLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RoleGuard pageKey="dashboard"><Dashboard /></RoleGuard>} />
          <Route path="customers" element={<RoleGuard pageKey="customers"><Customers /></RoleGuard>} />
          <Route path="leads" element={<RoleGuard pageKey="leads"><Leads /></RoleGuard>} />
          <Route path="customers/:id" element={<RoleGuard pageKey="customerDetails"><CustomerDetails /></RoleGuard>} />
          <Route path="orders" element={<RoleGuard pageKey="orders"><OrderManagement /></RoleGuard>} />
          <Route path="shipments" element={<RoleGuard pageKey="shipments"><Shipments /></RoleGuard>} />
          <Route path="returns" element={<RoleGuard pageKey="returns"><Returns /></RoleGuard>} />
          <Route path="order-activity" element={<RoleGuard pageKey="orderActivity"><OrderActivity /></RoleGuard>} />
          <Route path="support" element={<RoleGuard pageKey="support"><SupportManagement /></RoleGuard>} />
          <Route path="interactions" element={<RoleGuard pageKey="interactions"><Interactions /></RoleGuard>} />
          <Route path="segments" element={<RoleGuard pageKey="segments"><Segments /></RoleGuard>} />
          <Route path="campaigns" element={<RoleGuard pageKey="campaigns"><Campaigns /></RoleGuard>} />
          <Route path="communications" element={<RoleGuard pageKey="communications"><Communications /></RoleGuard>} />
          <Route path="banners" element={<RoleGuard pageKey="banners"><BannerManagement /></RoleGuard>} />
          <Route path="products" element={<RoleGuard pageKey="products"><ProductManagement /></RoleGuard>} />
          <Route path="product-reviews" element={<RoleGuard pageKey="productReviews"><ProductReviewsModeration /></RoleGuard>} />
          <Route path="categories" element={<RoleGuard pageKey="categories"><Categories /></RoleGuard>} />
          <Route path="storefront-settings" element={<RoleGuard pageKey="storefrontSettings"><StorefrontSettings /></RoleGuard>} />
          <Route path="homepage-promotions" element={<RoleGuard pageKey="homepagePromotions"><HomepagePromotions /></RoleGuard>} />
          <Route path="users" element={<RoleGuard allowedRoles={["ADMIN"]}><UserManagement /></RoleGuard>} />
          <Route path="analytics" element={<RoleGuard pageKey="analytics"><Analytics /></RoleGuard>} />
          <Route path="audit-logs" element={<RoleGuard pageKey="auditLogs"><AuditLogs /></RoleGuard>} />
          <Route path="inventory" element={<RoleGuard pageKey="inventory"><InventoryManagement /></RoleGuard>} />
          <Route path="coupons" element={<RoleGuard pageKey="coupons"><Coupons /></RoleGuard>} />
          <Route path="abandoned-carts" element={<RoleGuard pageKey="abandonedCarts"><AbandonedCarts /></RoleGuard>} />
        </Route>

        {/* Unknown URLs return to the storefront. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
