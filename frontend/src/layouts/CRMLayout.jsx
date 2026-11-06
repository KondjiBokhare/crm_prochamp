import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import CRMNotificationCenter from "../components/crm/CRMNotificationCenter";
import "../styles/crm.css";

function CRMLayout() {
  return (
    <div className="crm-layout">
      <Sidebar />
      <main className="crm-content">
        <div className="crm-workspace-toolbar">
          <CRMNotificationCenter />
        </div>
        <Outlet />
      </main>
    </div>
  );
}

export default CRMLayout;
