import { useCustomerNotificationPreferences } from "../../hooks/useCustomerNotificationPreferences";
import {
  Mail,
  MessageSquare,
  MessageCircle,
  Tag,
  Lock,
  Trash2,
  ChevronRight,
} from "lucide-react";

function AccountSettings() {
  const { preferences, updatePreference, error: notificationError, isApiMode: notificationApiMode } = useCustomerNotificationPreferences();

  const handleChangePassword = () => {
    alert("Change password will be connected to the backend later.");
  };

  const handleDeleteAccount = () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete your account?"
    );

    if (!confirmed) return;

    alert("Account deletion will be connected to the backend later.");
  };

  return (
    <section className="profile-card account-settings-card">
      {/* Header */}
      <div className="profile-card-header">
        <div>
          <h2>Account Settings</h2>

          <p>
            Manage your notifications and account preferences.
          </p>
        </div>

        <button
          type="button"
          className="outline-action-button"
          onClick={() =>
            alert("Account settings editing will be connected later.")
          }
        >
          Edit
        </button>
      </div>

      {notificationError && <div className="crm-error-banner" role="alert">{notificationError}</div>}
      {notificationApiMode && <p className="support-success-notice">Email, SMS and WhatsApp preferences sync with your Django account; marketing preference is stored locally.</p>}
      <div className="settings-list">

        {/* Email Notifications */}
        <div className="setting-row">
          <div className="setting-icon">
            <Mail size={18} />
          </div>

          <div className="setting-info">
            <strong>Email Notifications</strong>

            <span>
              Order updates, offers, and more
            </span>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={preferences.emailNotifications}
              onChange={(e) => updatePreference("emailNotifications", e.target.checked)}
            />

            <span></span>
          </label>
        </div>

        {/* SMS Notifications */}
        <div className="setting-row">
          <div className="setting-icon">
            <MessageSquare size={18} />
          </div>

          <div className="setting-info">
            <strong>SMS Notifications</strong>

            <span>
              Delivery alerts and important updates
            </span>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={preferences.smsNotifications}
              onChange={(e) => updatePreference("smsNotifications", e.target.checked)}
            />

            <span></span>
          </label>
        </div>

        {/* WhatsApp Notifications */}
        <div className="setting-row">
          <div className="setting-icon">
            <MessageCircle size={18} />
          </div>

          <div className="setting-info">
            <strong>WhatsApp Notifications</strong>

            <span>
              Order updates, delivery alerts and support messages
            </span>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={preferences.whatsappNotifications}
              onChange={(e) => updatePreference("whatsappNotifications", e.target.checked)}
            />

            <span></span>
          </label>
        </div>

        {/* Marketing Communications */}
        <div className="setting-row">
          <div className="setting-icon">
            <Tag size={18} />
          </div>

          <div className="setting-info">
            <strong>Marketing Communications</strong>

            <span>
              Exclusive deals and new product alerts
            </span>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={preferences.marketingNotifications}
              onChange={(e) => updatePreference("marketingNotifications", e.target.checked)}
            />

            <span></span>
          </label>
        </div>

        {/* Change Password */}
        <button
          type="button"
          className="setting-action"
          onClick={handleChangePassword}
        >
          <div className="setting-icon">
            <Lock size={18} />
          </div>

          <div>
            <strong>Change Password</strong>

            <span>
              Update your account password
            </span>
          </div>

          <ChevronRight size={18} />
        </button>

        {/* Delete Account */}
        <button
          type="button"
          className="setting-action danger"
          onClick={handleDeleteAccount}
        >
          <div className="setting-icon">
            <Trash2 size={18} />
          </div>

          <div>
            <strong>Delete Account</strong>

            <span>
              Permanently delete your account
            </span>
          </div>

          <ChevronRight size={18} />
        </button>

      </div>
    </section>
  );
}

export default AccountSettings;