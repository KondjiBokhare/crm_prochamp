import { useEffect, useState } from "react";

import {
  Sun,
  Moon,
  Monitor,
  Mail,
  MessageSquare,
  MessageCircle,
  Tag,
  Lock,
  ShieldCheck,
  LogOut,
  Trash2,
  ChevronRight,
  Globe,
  IndianRupee,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { useCustomerNotificationPreferences } from "../../hooks/useCustomerNotificationPreferences";

function Settings() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  // =========================================
  // THEME
  // =========================================
  const [theme, setTheme] = useState(
    () => localStorage.getItem("techgear_theme") || "light"
  );

  // =========================================
  // NOTIFICATIONS
  // =========================================
  const { preferences: notificationPreferences, updatePreference: updateNotificationPreference, error: notificationError, isApiMode: notificationApiMode } = useCustomerNotificationPreferences();

  // =========================================
  // PRIVACY
  // =========================================
  const [personalizedRecommendations, setPersonalizedRecommendations] =
    useState(true);

  // =========================================
  // APPLY THEME
  // =========================================
  useEffect(() => {
    let appliedTheme = theme;

    if (theme === "system") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;

      appliedTheme = prefersDark ? "dark" : "light";
    }

    document.documentElement.setAttribute(
      "data-theme",
      appliedTheme
    );

    localStorage.setItem(
      "techgear_theme",
      theme
    );

    // Listen for system theme changes
    if (theme === "system") {
      const mediaQuery = window.matchMedia(
        "(prefers-color-scheme: dark)"
      );

      const handleSystemThemeChange = (event) => {
        document.documentElement.setAttribute(
          "data-theme",
          event.matches ? "dark" : "light"
        );
      };

      mediaQuery.addEventListener(
        "change",
        handleSystemThemeChange
      );

      return () => {
        mediaQuery.removeEventListener(
          "change",
          handleSystemThemeChange
        );
      };
    }
  }, [theme]);

  // =========================================
  // LOGOUT
  // =========================================
  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // =========================================
  // DELETE ACCOUNT
  // =========================================
  const handleDeleteAccount = () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete your account?"
    );

    if (!confirmed) {
      return;
    }

    alert(
      "Account deletion will be connected to the backend later."
    );
  };

  return (
    <div className="account-detail-page settings-page">

      {/* =====================================
          PAGE HEADER
      ===================================== */}
      <div className="account-page-header">

        <span className="account-page-label">
          MY ACCOUNT
        </span>

        <h1 className="account-page-title">
          Settings
        </h1>

        <p className="account-page-subtitle">
          Manage your preferences, notifications and account security.
        </p>

      </div>

      <div className="settings-sections">

        {/* =====================================
            APPEARANCE
        ===================================== */}
        <section className="settings-card account-card">

          <div className="settings-card-header">
            <div>
              <h2>
                Appearance
              </h2>

              <p>
                Choose how TechGear looks on your device.
              </p>
            </div>
          </div>

          <div className="theme-options">

            {/* LIGHT */}
            <button
              type="button"
              className={`theme-option ${
                theme === "light"
                  ? "active"
                  : ""
              }`}
              onClick={() => setTheme("light")}
            >
              <div className="theme-option-icon">
                <Sun size={20} />
              </div>

              <div>
                <strong>
                  Light
                </strong>

                <span>
                  Use light appearance
                </span>
              </div>

              <span className="theme-radio"></span>
            </button>

            {/* DARK */}
            <button
              type="button"
              className={`theme-option ${
                theme === "dark"
                  ? "active"
                  : ""
              }`}
              onClick={() => setTheme("dark")}
            >
              <div className="theme-option-icon">
                <Moon size={20} />
              </div>

              <div>
                <strong>
                  Dark
                </strong>

                <span>
                  Use dark appearance
                </span>
              </div>

              <span className="theme-radio"></span>
            </button>

            {/* SYSTEM */}
            <button
              type="button"
              className={`theme-option ${
                theme === "system"
                  ? "active"
                  : ""
              }`}
              onClick={() => setTheme("system")}
            >
              <div className="theme-option-icon">
                <Monitor size={20} />
              </div>

              <div>
                <strong>
                  System
                </strong>

                <span>
                  Follow device preference
                </span>
              </div>

              <span className="theme-radio"></span>
            </button>

          </div>
        </section>

        {/* =====================================
            NOTIFICATIONS
        ===================================== */}
        <section className="settings-card account-card">

          <div className="settings-card-header">
            <div>
              <h2>
                Notifications
              </h2>

              <p>
                Control the messages and updates you receive.
              </p>
            </div>
          </div>
          {notificationError && <div className="crm-error-banner" role="alert">{notificationError}</div>}
          {notificationApiMode && <p className="support-success-notice">Email, SMS and WhatsApp preferences are saved to your Django account. Marketing preferences remain local until a backend field is added.</p>}

          <div className="settings-list">

            {/* EMAIL */}
            <div className="settings-row">

              <div className="settings-row-icon blue">
                <Mail size={18} />
              </div>

              <div className="settings-row-content">
                <strong>
                  Email Notifications
                </strong>

                <span>
                  Order updates, receipts and important account information.
                </span>
              </div>

              <label className="settings-switch">

                <input
                  type="checkbox"
                  checked={notificationPreferences.emailNotifications}
                  onChange={(e) => updateNotificationPreference("emailNotifications", e.target.checked)}
                />

                <span></span>

              </label>

            </div>

            {/* SMS */}
            <div className="settings-row">

              <div className="settings-row-icon purple">
                <MessageSquare size={18} />
              </div>

              <div className="settings-row-content">
                <strong>
                  SMS Notifications
                </strong>

                <span>
                  Delivery alerts and important account updates.
                </span>
              </div>

              <label className="settings-switch">

                <input
                  type="checkbox"
                  checked={notificationPreferences.smsNotifications}
                  onChange={(e) => updateNotificationPreference("smsNotifications", e.target.checked)}
                />

                <span></span>

              </label>

            </div>

            {/* WHATSAPP */}
            <div className="settings-row">

              <div className="settings-row-icon green">
                <MessageCircle size={18} />
              </div>

              <div className="settings-row-content">
                <strong>
                  WhatsApp Notifications
                </strong>

                <span>
                  Receive order updates, delivery alerts and support messages on WhatsApp.
                </span>
              </div>

              <label className="settings-switch">

                <input
                  type="checkbox"
                  checked={notificationPreferences.whatsappNotifications}
                  onChange={(e) => updateNotificationPreference("whatsappNotifications", e.target.checked)}
                />

                <span></span>

              </label>

            </div>

            {/* MARKETING */}
            <div className="settings-row">

              <div className="settings-row-icon orange">
                <Tag size={18} />
              </div>

              <div className="settings-row-content">
                <strong>
                  Marketing Communications
                </strong>

                <span>
                  Deals, offers, discounts and new product alerts.
                </span>
              </div>

              <label className="settings-switch">

                <input
                  type="checkbox"
                  checked={notificationPreferences.marketingNotifications}
                  onChange={(e) => updateNotificationPreference("marketingNotifications", e.target.checked)}
                />

                <span></span>

              </label>

            </div>

          </div>
        </section>

        {/* =====================================
            PRIVACY & PREFERENCES
        ===================================== */}
        <section className="settings-card account-card">

          <div className="settings-card-header">
            <div>
              <h2>
                Privacy & Preferences
              </h2>

              <p>
                Control personalization and your shopping experience.
              </p>
            </div>
          </div>

          {/* Personalized Recommendations */}
          <div className="settings-row">

            <div className="settings-row-icon green">
              <ShieldCheck size={18} />
            </div>

            <div className="settings-row-content">
              <strong>
                Personalized Recommendations
              </strong>

              <span>
                Use your browsing and shopping activity to improve recommendations.
              </span>
            </div>

            <label className="settings-switch">

              <input
                type="checkbox"
                checked={personalizedRecommendations}
                onChange={(e) =>
                  setPersonalizedRecommendations(
                    e.target.checked
                  )
                }
              />

              <span></span>

            </label>

          </div>

          {/* Language */}
          <div className="settings-row">

            <div className="settings-row-icon blue">
              <Globe size={18} />
            </div>

            <div className="settings-row-content">
              <strong>
                Language
              </strong>

              <span>
                Select your preferred language.
              </span>
            </div>

            <select className="settings-select">
              <option>
                English
              </option>

              <option>
                Hindi
              </option>
            </select>

          </div>

          {/* Currency */}
          <div className="settings-row">

            <div className="settings-row-icon orange">
              <IndianRupee size={18} />
            </div>

            <div className="settings-row-content">
              <strong>
                Currency
              </strong>

              <span>
                Choose the currency used across the store.
              </span>
            </div>

            <select className="settings-select">
              <option>
                INR (₹)
              </option>

              <option>
                USD ($)
              </option>
            </select>

          </div>

        </section>

        {/* =====================================
            SECURITY
        ===================================== */}
        <section className="settings-card account-card">

          <div className="settings-card-header">
            <div>
              <h2>
                Security
              </h2>

              <p>
                Protect your TechGear account.
              </p>
            </div>
          </div>

          {/* Change Password */}
          <button
            type="button"
            className="settings-action"
          >

            <div className="settings-row-icon blue">
              <Lock size={18} />
            </div>

            <div className="settings-row-content">
              <strong>
                Change Password
              </strong>

              <span>
                Update your account password.
              </span>
            </div>

            <ChevronRight size={18} />

          </button>

          {/* 2FA */}
          <button
            type="button"
            className="settings-action"
          >

            <div className="settings-row-icon green">
              <ShieldCheck size={18} />
            </div>

            <div className="settings-row-content">
              <strong>
                Two-Factor Authentication
              </strong>

              <span>
                Add an additional layer of protection to your account.
              </span>
            </div>

            <ChevronRight size={18} />

          </button>

        </section>

        {/* =====================================
            ACCOUNT ACTIONS
        ===================================== */}
        <section className="settings-card account-card">

          <div className="settings-card-header">
            <div>
              <h2>
                Account Actions
              </h2>

              <p>
                Manage your current session and account.
              </p>
            </div>
          </div>

          {/* LOGOUT */}
          <button
            type="button"
            className="settings-action"
            onClick={handleLogout}
          >

            <div className="settings-row-icon blue">
              <LogOut size={18} />
            </div>

            <div className="settings-row-content">
              <strong>
                Log Out
              </strong>

              <span>
                Sign out from this device.
              </span>
            </div>

            <ChevronRight size={18} />

          </button>

          {/* DELETE ACCOUNT */}
          <button
            type="button"
            className="settings-action danger"
            onClick={handleDeleteAccount}
          >

            <div className="settings-row-icon red">
              <Trash2 size={18} />
            </div>

            <div className="settings-row-content">
              <strong>
                Delete Account
              </strong>

              <span>
                Permanently delete your TechGear account.
              </span>
            </div>

            <ChevronRight size={18} />

          </button>

        </section>

      </div>
    </div>
  );
}

export default Settings;