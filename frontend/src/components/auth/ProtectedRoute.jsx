import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/** UI route guard only. Server-side permissions are still required. */
function ProtectedRoute({ children, allowedRoles, loginPath = "/login" }) {
  const { isAuthenticated, hasRole, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <div className="crm-loading" role="status" aria-live="polite">Restoring session…</div>;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={loginPath}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  if (allowedRoles?.length && !hasRole(allowedRoles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children || <Outlet />;
}

export default ProtectedRoute;
