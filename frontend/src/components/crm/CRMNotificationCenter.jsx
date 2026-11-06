import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import NotificationModal from "../common/NotificationModal";
import {
  getNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} from "../../services/crmService";
import { loadOptionalNotifications } from "../../services/optionalNotifications";
import { subscribeToNotificationChanges } from "../../services/notificationCenterService";

function CRMNotificationCenter() {
  const { user, isAuthenticated, authenticatedRequest } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [notificationError, setNotificationError] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const canUseStaffNotifications = Boolean(
    isAuthenticated &&
      user?.active === true &&
      user?.organizationId &&
      user?.role !== "CUSTOMER"
  );

  const loadNotifications = useCallback(async () => {
    if (!canUseStaffNotifications) {
      setNotifications([]);
      setNotificationError("");
      return;
    }

    const result = await loadOptionalNotifications(
      () => getNotificationsForUser(user, authenticatedRequest)
    );
    setNotifications(result.rows);
    setNotificationError(result.error);
  }, [canUseStaffNotifications, user, authenticatedRequest]);

  useEffect(() => {
    loadNotifications();
    return subscribeToNotificationChanges(loadNotifications);
  }, [loadNotifications]);

  const markRead = async (id) => {
    const result = await loadOptionalNotifications(async () => {
      await markNotificationReadForUser(id, user, authenticatedRequest);
      return getNotificationsForUser(user, authenticatedRequest);
    });
    if (result.error) {
      setNotificationError(result.error);
      return;
    }
    setNotifications(result.rows);
    setNotificationError("");
  };

  const markAllRead = async () => {
    const result = await loadOptionalNotifications(async () => {
      await markAllNotificationsReadForUser(user, authenticatedRequest);
      return getNotificationsForUser(user, authenticatedRequest);
    });
    if (result.error) {
      setNotificationError(result.error);
      return;
    }
    setNotifications(result.rows);
    setNotificationError("");
  };

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  if (!canUseStaffNotifications) return null;

  return (
    <div className="crm-notification-center">
      <button
        type="button"
        className="crm-notification-button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        onClick={() => setIsOpen(true)}
      >
        <Bell size={18} />
        {unreadCount > 0 && <span>{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>
      {notificationError && (
        <span className="crm-notification-error" role="status">
          Notifications are temporarily unavailable.
        </span>
      )}
      {isOpen && (
        <NotificationModal
          notifications={notifications}
          onClose={() => setIsOpen(false)}
          onMarkAllRead={markAllRead}
          onMarkRead={async (id) => {
            const notification = notifications.find(
              (item) => String(item.id) === String(id)
            );
            await markRead(id);
            if (notification?.link) {
              setIsOpen(false);
              navigate(notification.link);
            }
          }}
        />
      )}
    </div>
  );
}

export default CRMNotificationCenter;
