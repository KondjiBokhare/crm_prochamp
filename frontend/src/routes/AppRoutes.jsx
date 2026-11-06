
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { lazy, Suspense } from "react";

import StoreLayout from "../layouts/StoreLayout";
import CartLayout from "../layouts/CartLayout";
import AccountLayout from "../layouts/AccountLayout";
import CRMLayout from "../layouts/CRMLayout";

import ProtectedRoute from "../components/auth/ProtectedRoute";
import RoleGuard from "../components/auth/RoleGuard";
import { PAGE_PERMISSION_REGISTRY } from "../auth/roles";

const crmRoute = (pageKey) =>
  PAGE_PERMISSION_REGISTRY[pageKey].route.replace(/^\/crm\/?/, "");

// CRM authentication pages
 
const Unauthorized = lazy(() => import("../pages/crm/Unauthorized"));

// Customer storefront pages
const Home = lazy(() => import("../pages/customer/Home"));
const Products = lazy(() => import("../pages/customer/Products"));
const ProductDetails = lazy(() => import("../pages/customer/ProductDetails"));
const Login = lazy(() => import("../pages/customer/Login"));
const Signup = lazy(() => import("../pages/customer/Signup"));
const Cart = lazy(() => import("../pages/customer/Cart"));
const Checkout = lazy(() => import("../pages/customer/Checkout"));
const OrderConfirmation = lazy(
  () => import("../pages/customer/OrderConfirmation")
);
const MyOrders = lazy(() => import("../pages/customer/MyOrders"));
const MyProfile = lazy(() => import("../pages/customer/MyProfile"));
const Wishlist = lazy(() => import("../pages/customer/Wishlist"));
const SavedAddressesPage = lazy(
  () => import("../pages/customer/SavedAddressesPage")
);
const PaymentMethodsPage = lazy(
  () => import("../pages/customer/PaymentMethodsPage")
);
const MyReviews = lazy(() => import("../pages/customer/MyReviews"));
const SupportTickets = lazy(
  () => import("../pages/customer/SupportTickets")
);
const Settings = lazy(() => import("../pages/customer/Settings"));
const StoreInfoPage = lazy(
  () => import("../pages/customer/StoreInfoPage")
);

// CRM pages
const Dashboard = lazy(() => import("../pages/crm/Dashboard"));
const Customers = lazy(() => import("../pages/crm/Customers"));
const Leads = lazy(() => import("../pages/crm/Leads"));
const OrderManagement = lazy(() => import("../pages/crm/Orders"));
const Shipments = lazy(() => import("../pages/crm/Shipments"));
const Returns = lazy(() => import("../pages/crm/Returns"));
const OrderActivity = lazy(() => import("../pages/crm/OrderActivity"));
const SupportManagement = lazy(
  () => import("../pages/crm/SupportManagement")
);
const CustomerDetails = lazy(
  () => import("../pages/crm/CustomerDetails")
);
const Interactions = lazy(() => import("../pages/crm/Interactions"));
const Segments = lazy(() => import("../pages/crm/Segments"));
const Campaigns = lazy(() => import("../pages/crm/Campaigns"));
const Communications = lazy(
  () => import("../pages/crm/Communications")
);
const Analytics = lazy(() => import("../pages/crm/Analytics"));
const AuditLogs = lazy(() => import("../pages/crm/AuditLogs"));
const BannerManagement = lazy(
  () => import("../pages/crm/BannerManagement")
);
const ProductManagement = lazy(() => import("../pages/crm/Products"));
const Categories = lazy(() => import("../pages/crm/Categories"));
const StorefrontSettings = lazy(
  () => import("../pages/crm/StorefrontSettings")
);
const UserManagement = lazy(
  () => import("../pages/crm/UserManagement")
);
const HomepagePromotions = lazy(
  () => import("../pages/crm/HomepagePromotions")
);
const ProductReviewsModeration = lazy(
  () => import("../pages/crm/ProductReviews")
);
const InventoryManagement = lazy(
  () => import("../pages/crm/InventoryManagement")
);
const Coupons = lazy(() => import("../pages/crm/Coupons"));
const AbandonedCarts = lazy(
  () => import("../pages/crm/AbandonedCarts")
);

function RouteLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "40vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      Loading page…
    </div>
  );
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <AppRouteContent />
    </BrowserRouter>
  );
}

function AppRouteContent() {
  const location = useLocation();

  const isCustomerAuthPath =
    location.pathname === "/login" ||
    location.pathname === "/signup";

  const backgroundLocation =
    location.state?.backgroundLocation ||
    (isCustomerAuthPath ? { pathname: "/" } : null);

  return (
    <>
      <Suspense fallback={<RouteLoading />}>
        <Routes location={backgroundLocation || location}>
          {/* Customer storefront */}
          <Route element={<StoreLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/products" element={<Products />} />
            <Route
              path="/product/:id"
              element={<ProductDetails />}
            />
            <Route path="/wishlist" element={<Wishlist />} />

            <Route
              path="/about"
              element={<StoreInfoPage pageKey="about" />}
            />
            <Route
              path="/contact"
              element={<StoreInfoPage pageKey="contact" />}
            />
            <Route
              path="/faq"
              element={<StoreInfoPage pageKey="faq" />}
            />
            <Route
              path="/shipping"
              element={<StoreInfoPage pageKey="shipping" />}
            />
            <Route
              path="/returns"
              element={<StoreInfoPage pageKey="returns" />}
            />
            <Route
              path="/privacy"
              element={<StoreInfoPage pageKey="privacy" />}
            />
            <Route
              path="/terms"
              element={<StoreInfoPage pageKey="terms" />}
            />
          </Route>

          {/* Cart and checkout */}
          <Route element={<CartLayout />}>
            <Route path="/cart" element={<Cart />} />
          </Route>

          <Route path="/checkout" element={<Checkout />} />
          <Route
            path="/order-confirmation"
            element={<OrderConfirmation />}
          />

          {/* Customer authentication is rendered separately below. */}

          {/* Customer account pages require a signed-in customer.
              Django must independently authorize API requests. */}
          <Route
            element={
              <ProtectedRoute
                allowedRoles={["CUSTOMER"]}
                loginPath="/login"
              >
                <AccountLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/profile" element={<MyProfile />} />
            <Route path="/orders" element={<MyOrders />} />
            <Route
              path="/account/wishlist"
              element={<Wishlist />}
            />
            <Route
              path="/addresses"
              element={<SavedAddressesPage />}
            />
            <Route
              path="/payments"
              element={<PaymentMethodsPage />}
            />
            <Route path="/reviews" element={<MyReviews />} />
            <Route path="/support" element={<SupportTickets />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* CRM authentication */}
          <Route
  path="/crm/login"
  element={
    <Navigate
      to="/login"
      replace
      state={{ from: "/crm" }}
    />
  }
/>
          <Route
            path="/unauthorized"
            element={<Unauthorized />}
          />

          {/* CRM authorization */}
          <Route
            path="/crm"
            element={
              <ProtectedRoute loginPath="/login">
                <CRMLayout />
              </ProtectedRoute>
            }
          >
            <Route
              index
              element={
                <RoleGuard pageKey="dashboard">
                  <Dashboard />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("customers")}
              element={
                <RoleGuard pageKey="customers">
                  <Customers />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("leads")}
              element={
                <RoleGuard pageKey="leads">
                  <Leads />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("customerDetails")}
              element={
                <RoleGuard pageKey="customerDetails">
                  <CustomerDetails />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("orders")}
              element={
                <RoleGuard pageKey="orders">
                  <OrderManagement />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("shipments")}
              element={
                <RoleGuard pageKey="shipments">
                  <Shipments />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("returns")}
              element={
                <RoleGuard pageKey="returns">
                  <Returns />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("orderActivity")}
              element={
                <RoleGuard pageKey="orderActivity">
                  <OrderActivity />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("support")}
              element={
                <RoleGuard pageKey="support">
                  <SupportManagement />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("interactions")}
              element={
                <RoleGuard pageKey="interactions">
                  <Interactions />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("segments")}
              element={
                <RoleGuard pageKey="segments">
                  <Segments />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("campaigns")}
              element={
                <RoleGuard pageKey="campaigns">
                  <Campaigns />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("communications")}
              element={
                <RoleGuard pageKey="communications">
                  <Communications />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("banners")}
              element={
                <RoleGuard pageKey="banners">
                  <BannerManagement />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("products")}
              element={
                <RoleGuard pageKey="products">
                  <ProductManagement />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("productReviews")}
              element={
                <RoleGuard pageKey="productReviews">
                  <ProductReviewsModeration />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("categories")}
              element={
                <RoleGuard pageKey="categories">
                  <Categories />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("storefrontSettings")}
              element={
                <RoleGuard pageKey="storefrontSettings">
                  <StorefrontSettings />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("homepagePromotions")}
              element={
                <RoleGuard pageKey="homepagePromotions">
                  <HomepagePromotions />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("userManagement")}
              element={
                <RoleGuard pageKey="userManagement">
                  <UserManagement />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("analytics")}
              element={
                <RoleGuard pageKey="analytics">
                  <Analytics />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("auditLogs")}
              element={
                <RoleGuard pageKey="auditLogs">
                  <AuditLogs />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("inventory")}
              element={
                <RoleGuard pageKey="inventory">
                  <InventoryManagement />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("coupons")}
              element={
                <RoleGuard pageKey="coupons">
                  <Coupons />
                </RoleGuard>
              }
            />

            <Route
              path={crmRoute("abandonedCarts")}
              element={
                <RoleGuard pageKey="abandonedCarts">
                  <AbandonedCarts />
                </RoleGuard>
              }
            />
          </Route>

          {/* Unknown URLs return to the storefront. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>

      {/* Customer login and signup overlay */}
      {isCustomerAuthPath && (
        <Suspense fallback={<RouteLoading />}>
          <Routes location={location}>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
          </Routes>
        </Suspense>
      )}
    </>
  );
}

export default AppRoutes;
