import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import "../../styles/crm.css";

function Unauthorized() {
  const { user, logout } = useAuth();
  const isCrmUser = user && user.role !== "CUSTOMER";

  return (
    <main className="crm-auth-page">
      <section className="crm-auth-card crm-access-denied">
        <div className="crm-auth-brand-mark crm-auth-brand-danger"><ShieldAlert size={26} /></div>
        <p className="crm-eyebrow">ACCESS CONTROL</p>
        <h1>Access restricted</h1>
        <p className="crm-auth-subtitle">
          Your current {user?.role || "account"} role does not have permission to open this page.
        </p>
        <Link className="crm-button crm-button-primary crm-auth-submit" to={isCrmUser ? "/crm" : "/"}>
          {isCrmUser ? "Return to CRM" : "Return to store"}
        </Link>
        <button
          className="crm-auth-plain-button"
          type="button"
          onClick={() => {
            logout();
            window.location.assign(isCrmUser ? "/crm/login" : "/login");
          }}
        >
          Sign out and switch account
        </button>
      </section>
    </main>
  );
}

export default Unauthorized;
