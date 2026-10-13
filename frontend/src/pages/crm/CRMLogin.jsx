import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { authenticateDemoCrmUser, getAvailableCrmLoginUsers } from "../../auth/demoUsers";
import { staffUsersChangedEvent } from "../../services/staffUserService";
import { ROLE_LABELS } from "../../auth/roles";
import { isApiAuthEnabled } from "../../services/authApi";
import "../../styles/crm.css";

function CRMLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithBackend, isAuthenticated, isCrmUser, isInitializing, authError } = useAuth();
  const [accounts, setAccounts] = useState(() => getAvailableCrmLoginUsers());
  const [email, setEmail] = useState(isApiAuthEnabled ? "admin@crm.com" : "admin@techgear.demo");
  const [password, setPassword] = useState(isApiAuthEnabled ? "" : "Demo@123");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isApiAuthEnabled) return undefined;
    const refreshAccounts = () => setAccounts(getAvailableCrmLoginUsers());
    window.addEventListener(staffUsersChangedEvent, refreshAccounts);
    window.addEventListener("storage", refreshAccounts);
    return () => {
      window.removeEventListener(staffUsersChangedEvent, refreshAccounts);
      window.removeEventListener("storage", refreshAccounts);
    };
  }, []);

  if (isInitializing) {
    return (
      <main className="crm-auth-page">
        <section className="crm-auth-card" aria-live="polite">
          <div className="crm-auth-brand-mark"><ShieldCheck size={26} /></div>
          <p className="crm-eyebrow">TECHGEAR WORKSPACE</p>
          <h1 id="crm-login-title">Checking session</h1>
          <p className="crm-auth-subtitle">Restoring your secure staff session…</p>
        </section>
      </main>
    );
  }

  if (isAuthenticated && isCrmUser) {
    return <Navigate to="/crm" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      if (isApiAuthEnabled) {
        await loginWithBackend(email, password);
      } else {
        const demoUser = authenticateDemoCrmUser(email, password);
        if (!demoUser) {
          throw new Error("Invalid credentials, or this staff account is inactive. Check the details and try again.");
        }
        login(demoUser);
      }
      navigate(location.state?.from || "/crm", { replace: true });
    } catch (loginError) {
      if (loginError.status === 401) {
        setError("Invalid work email/password, or this account is inactive.");
      } else {
        setError(loginError.message || "Login failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectDemoAccount = (account) => {
    setEmail(account.email);
    setPassword(account.isDemo && !account.hasCustomPassword ? "Demo@123" : "");
    setError("");
  };

  return (
    <main className="crm-auth-page">
      <section className="crm-auth-card" aria-labelledby="crm-login-title">
        <div className="crm-auth-brand-mark"><ShieldCheck size={26} /></div>
        <p className="crm-eyebrow">TECHGEAR WORKSPACE</p>
        <h1 id="crm-login-title">CRM sign in</h1>
        <p className="crm-auth-subtitle">Sign in to manage customers, campaigns and analytics.</p>

        {isApiAuthEnabled ? (
          <div className="crm-demo-notice" role="note">
            Django authentication is enabled. Staff credentials are checked by the backend API.
          </div>
        ) : (
          <div className="crm-demo-notice" role="note">
            Frontend demo mode only. These accounts are not real authentication and must not be used in production.
          </div>
        )}

        {(error || authError) && <div className="crm-error-banner" role="alert">{error || authError}</div>}

        <form className="crm-auth-form" onSubmit={handleSubmit}>
          <label htmlFor="crm-email">Work email</label>
          <div className="crm-auth-input-wrap">
            <Mail size={17} aria-hidden="true" />
            <input
              id="crm-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              placeholder="name@techgear.demo"
              required
            />
          </div>

          <label htmlFor="crm-password">Password</label>
          <div className="crm-auth-input-wrap">
            <LockKeyhole size={17} aria-hidden="true" />
            <input
              id="crm-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="crm-auth-password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          <button type="submit" className="crm-button crm-button-primary crm-auth-submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in to CRM"}
          </button>
        </form>

        {!isApiAuthEnabled && <div className="crm-demo-accounts">
          <h2>Demo accounts</h2>
          <p>Built-in demo accounts use <code>Demo@123</code>. Managed demo accounts use their assigned password.</p>
          <div className="crm-demo-account-list">
            {accounts.map((demoUser) => (
              <button
                key={demoUser.id}
                type="button"
                className="crm-demo-account"
                onClick={() => selectDemoAccount(demoUser)}
              >
                <span>{ROLE_LABELS[demoUser.role] || demoUser.role}</span>
                <strong>{demoUser.email}</strong>
                {!demoUser.isDemo && <small>Managed demo account · enter its password</small>}
              </button>
            ))}
          </div>
        </div>}
        <Link className="crm-auth-store-link" to="/">← Return to store</Link>
      </section>
    </main>
  );
}

export default CRMLogin;
