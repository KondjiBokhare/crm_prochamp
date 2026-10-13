import { Outlet } from "react-router-dom";
import TopBar from "../components/common/TopBar";
import Navbar from "../components/common/Navbar";
import CategoryNav from "../components/common/CategoryNav";
import StoreFooter from "../components/common/StoreFooter";

function StoreLayout() {
  return <div className="store-layout">
    <TopBar />
    <Navbar />
    <CategoryNav />
    <main><Outlet /></main>
    <StoreFooter />
  </div>;
}

export default StoreLayout;
