import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  Search,
  MapPin,
  User,
  Heart,
  ShoppingCart,
  ChevronDown,
  Bell,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useWishlist } from "../../context/WishlistContext";

import NotificationModal from "./NotificationModal";
import {
  getNotificationsForUser as getCrmNotificationsForUser,
  markNotificationReadForUser as markCrmNotificationReadForUser,
  markAllNotificationsReadForUser as markAllCrmNotificationsReadForUser,
} from "../../services/crmService";
import {
  getNotificationsForUser as getLocalNotificationsForUser,
  markNotificationReadForUser as markLocalNotificationReadForUser,
  markAllNotificationsReadForUser as markAllLocalNotificationsReadForUser,
  subscribeToNotificationChanges,
} from "../../services/notificationCenterService";
import { getStorefrontOrders, storefrontOrdersApiEnabled } from "../../services/storefrontOrderApiService";
import { getDemoOrders } from "../../services/demoOrderService";
import {
  isProductReviewSubmitted,
  syncReviewReminderNotifications,
} from "../../services/customerReviewUiService";
import StoreLogo from "./StoreLogo";

function Navbar() {
  const navigate = useNavigate();

  const { user, isAuthenticated, authenticatedRequest } = useAuth();

  const { cartItems } = useCart();

const { wishlistCount } = useWishlist();

  const [showNotifications, setShowNotifications] =
    useState(false);

  const [notifications, setNotifications] = useState([]);

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated || !user) { setNotifications([]); return; }

    let apiRecords = [];
    try {
      const records = await getCrmNotificationsForUser(user, authenticatedRequest);
      apiRecords = Array.isArray(records) ? records : [];
    } catch (error) {
      // Local review reminders should still display while the notification API is unavailable.
      console.warn("Could not load CRM notifications:", error.message);
    }

    const localReviewReminders = getLocalNotificationsForUser(user)
      .filter((notification) => notification.source === "review-reminder");
    const byId = new Map();
    [...apiRecords, ...localReviewReminders].forEach((notification) => {
      if (notification?.id != null) byId.set(String(notification.id), notification);
    });

    const merged = [...byId.values()]
      .filter((notification) => !(
        notification.source === "review-reminder" &&
        isProductReviewSubmitted(user, notification.metadata?.productId)
      ))
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    setNotifications(merged);
  }, [isAuthenticated, user?.email, user?.role, user?.id, authenticatedRequest]);

  useEffect(() => {
    loadNotifications();
    return subscribeToNotificationChanges(loadNotifications);
  }, [loadNotifications]);

  const syncReviewReminders = useCallback(async () => {
    if (!isAuthenticated || !user?.email || (user?.role && String(user.role).toUpperCase() !== "CUSTOMER")) return;
    try {
      let orders = [];
      if (storefrontOrdersApiEnabled) {
        if (typeof authenticatedRequest !== "function") return;
        orders = await getStorefrontOrders(authenticatedRequest);
      } else {
        const email = String(user.email).trim().toLowerCase();
        orders = getDemoOrders().filter((order) => String(order.customerEmail || "").trim().toLowerCase() === email);
      }
      syncReviewReminderNotifications(orders, user);
    } catch (error) {
      // Reminder generation is a UI enhancement; it must not break the storefront.
      console.warn("Could not check review reminders:", error?.message || error);
    }
  }, [isAuthenticated, user?.email, user?.role, user?.id, authenticatedRequest]);

  useEffect(() => {
    syncReviewReminders();
    window.addEventListener("techgear:demo-orders-updated", syncReviewReminders);
    window.addEventListener("focus", syncReviewReminders);
    // Frontend polling catches a status changed by CRM while the customer keeps the store open.
    const pollId = window.setInterval(syncReviewReminders, 60_000);
    return () => {
      window.removeEventListener("techgear:demo-orders-updated", syncReviewReminders);
      window.removeEventListener("focus", syncReviewReminders);
      window.clearInterval(pollId);
    };
  }, [syncReviewReminders]);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  /*
   * Cart count
   *
   * Example:
   * 1 product with quantity 3 → badge shows 3
   *
   * 2 different products:
   * product A quantity 2
   * product B quantity 1
   * → badge shows 3
   */
  const cartCount = cartItems.reduce(
    (total, item) =>
      total + Number(item.quantity || 0),
    0
  );

   

  const handleSearch = (event) => {
    event.preventDefault();

    const formData = new FormData(
      event.currentTarget
    );

    const query = formData
      .get("search")
      ?.trim();

    if (!query) return;

    navigate(
      `/products?search=${encodeURIComponent(query)}`
    );
  };

  const handleMarkRead = async (id) => {
    const notification = notifications.find((item) => String(item.id) === String(id));
    try {
      if (notification?.source === "review-reminder") {
        markLocalNotificationReadForUser(id, user);
      } else {
        await markCrmNotificationReadForUser(id, user, authenticatedRequest);
      }
    } finally {
      await loadNotifications();
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllCrmNotificationsReadForUser(user, authenticatedRequest);
    } catch (error) {
      console.warn("Could not mark remote notifications read:", error?.message || error);
    } finally {
      markAllLocalNotificationsReadForUser(user);
      await loadNotifications();
    }
  };

  return (
    <>
      <header className="main-navbar">

        {/* Reusable, admin-managed store identity */}
        <StoreLogo variant="navbar" />

        {/* Search */}
        <form
          className="search-box"
          onSubmit={handleSearch}
        >
          <input
            name="search"
            type="search"
            placeholder="Search for laptops, GPUs, CPUs, SSDs, motherboards..."
            autoComplete="off"
          />

          <button
            type="submit"
            aria-label="Search"
          >
            <Search size={21} />
          </button>
        </form>

        {/* Actions */}
        <div className="navbar-actions">

          {/* Delivery */}
          {isAuthenticated && (
            <div className="nav-action">
              <MapPin size={22} />

              <div>
                <small>
                  Deliver to
                </small>

                <strong>
                  {user?.location || "India"}
                </strong>
              </div>
            </div>
          )}

          {/* Account */}
          {isAuthenticated ? (
            <Link
              to="/profile"
              className="nav-action account-action"
            >
              <User size={23} />

              <div>
                <small>
                  Account
                </small>

                <strong>
                  {user?.name || "My Account"}
                </strong>
              </div>

              <ChevronDown size={14} />
            </Link>
          ) : (
            <Link
              to="/login"
              className="nav-action"
            >
              <User size={23} />

              <div>
                <small>
                  Account
                </small>

                <strong>
                  Sign In
                </strong>
              </div>
            </Link>
          )}

          {/* Notifications */}
          {isAuthenticated && (
            <button
              type="button"
              className="icon-action notification-button"
              onClick={() => {
                loadNotifications();
                setShowNotifications(true);
              }}
              aria-label="Notifications"
            >
              <div className="notification-icon-wrapper">
                <Bell size={23} />

                {unreadCount > 0 && (
                  <span className="notification-badge">
                    {unreadCount > 9
                      ? "9+"
                      : unreadCount}
                  </span>
                )}
              </div>

              <span>
                Notifications
              </span>
            </button>
          )}

          {/* Wishlist */}
          {isAuthenticated && (
  <Link
    to="/wishlist"
    className="icon-action"
  >
    <div className="wishlist-icon-wrapper">
      <Heart size={23} />

             {wishlistCount > 0 && (
               <span className="wishlist-badge">
                 {wishlistCount > 99
                   ? "99+"
                   : wishlistCount}
               </span>
             )}
          </div>

           <span>Wishlist</span>
         </Link>
        )}

          {/* Cart */}
          <Link
            to="/cart"
            className="icon-action cart-action"
          >
            <div className="cart-icon-wrapper">
              <ShoppingCart size={25} />

              {cartCount > 0 && (
                <span className="cart-badge">
                  {cartCount > 99
                    ? "99+"
                    : cartCount}
                </span>
              )}
            </div>

            <span>
              Cart
            </span>
          </Link>

        </div>
      </header>

      {/* Notification Modal */}
      {showNotifications &&
        isAuthenticated && (
          <NotificationModal
            notifications={notifications}
            onClose={() =>
              setShowNotifications(false)
            }
            onMarkAllRead={
              handleMarkAllRead
            }
            onMarkRead={
              handleMarkRead
            }
          />
        )}
    </>
  );
}

export default Navbar;