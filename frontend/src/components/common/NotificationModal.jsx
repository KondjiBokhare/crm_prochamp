import { Bell, CheckCheck, CreditCard, Package, Tag, MessageSquare, Star, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

function NotificationModal({ notifications = [], onClose, onMarkAllRead, onMarkRead }) {
  const navigate = useNavigate();
  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const getNotificationIcon = (type) => {
    switch (type) {
      case "order": return <Package size={18} />;
      case "offer": return <Tag size={18} />;
      case "payment": return <CreditCard size={18} />;
      case "support": return <MessageSquare size={18} />;
      case "review": return <Star size={18} />;
      default: return <Bell size={18} />;
    }
  };

  const openNotification = async (notification) => {
    await onMarkRead?.(notification.id);
    if (notification.link) {
      onClose?.();
      navigate(notification.link);
    }
  };

  return (
    <div className="notification-modal-overlay" onClick={onClose}>
      <div className="notification-modal" role="dialog" aria-modal="true" aria-labelledby="notification-modal-title" onClick={(event) => event.stopPropagation()}>
        <div className="notification-modal-header">
          <div><h2 id="notification-modal-title">Notifications</h2><p>{unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "You're all caught up"}</p></div>
          <div className="notification-modal-header-actions">
            {unreadCount > 0 && <button type="button" className="mark-all-read-button" onClick={onMarkAllRead}><CheckCheck size={16}/>Mark all as read</button>}
            <button type="button" className="notification-close-button" onClick={onClose} aria-label="Close notifications"><X size={20}/></button>
          </div>
        </div>
        <div className="notification-modal-list">
          {notifications.length === 0 ? <div className="notification-empty"><div className="notification-empty-icon"><Bell size={28}/></div><h3>No notifications</h3><p>Order updates, support replies and in-app announcements will appear here.</p></div> : notifications.map((notification) => (
            <button key={notification.id} type="button" className={`notification-item ${!notification.read ? "unread" : ""}`} onClick={() => openNotification(notification)}>
              <div className={`notification-item-icon ${notification.type || "general"}`}>{getNotificationIcon(notification.type)}</div>
              <div className="notification-item-content"><div className="notification-item-top"><strong>{notification.title}</strong>{!notification.read && <span className="notification-unread-dot"/>}</div><p>{notification.message}</p><span className="notification-time">{notification.time || (notification.createdAt ? new Date(notification.createdAt).toLocaleString("en-IN") : "Just now")}</span></div>
            </button>
          ))}
        </div>
        <div className="notification-modal-footer"><button type="button" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}

export default NotificationModal;
