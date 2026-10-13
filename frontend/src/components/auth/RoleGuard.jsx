import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { canUserAccessPage } from "../../services/staffUserService";

function RoleGuard({ allowedRoles, pageKey, children }) {
  const { user, hasRole } = useAuth();
  const allowed = pageKey ? canUserAccessPage(user, pageKey) : hasRole(allowedRoles);
  if (!allowed) return <Navigate to="/unauthorized" replace />;
  return children || <Outlet />;
}

export default RoleGuard;
