import { Search, ChevronDown } from "lucide-react";
import { useSearchParams } from "react-router-dom";
 
import OrderCard from "../../components/orders/OrderCard";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getDemoOrders } from "../../services/demoOrderService";
import { useAuth } from "../../context/AuthContext";
import { getStorefrontOrders, importLegacyDemoOrders, storefrontOrdersApiEnabled } from "../../services/storefrontOrderApiService";

const ORDER_FILTERS = ["All Orders", "Processing", "Shipped", "Delivered", "Cancelled", "Returned"];

function toOrderCard(order) {
  const rawStatus = String(order.fulfillmentStatus || order.status || "Processing").toLowerCase();
  const status = rawStatus.includes("cancel") ? "Cancelled"
    : rawStatus.includes("return") ? "Returned"
      : rawStatus.includes("deliver") ? "Delivered"
        : rawStatus.includes("ship") ? "Shipped" : "Processing";
  const statusClass = status.toLowerCase();
  return {
    ...order,
    date: new Date(order.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }),
    status,
    statusClass,
    currentStep: status === "Delivered" ? 5 : status === "Shipped" ? 3 : status === "Processing" ? 1 : 0,
    deliveryMessage: order.demoOnly ? "Demo order only — shipment has not been booked." : (order.deliveryMessage || "Check your latest order status."),
    action: null,
    items: (order.items || []).map((item, index) => ({
      ...item,
      id: item.id ?? `${order.id}-${index}`,
      productId: item.productId ?? item.product_id ?? item.catalogProductId ?? item.product?.id ?? item.id ?? null,
      image: item.image || item.images?.[0] || item.product?.image || "",
    })),
    total: Number(order.total) || 0,
  };
}

function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Orders");
  const [period, setPeriod] = useState("all");
  const [loadError, setLoadError] = useState("");
  const { user, authenticatedRequest } = useAuth();
  const [searchParams] = useSearchParams();
  const reviewOrderQuery = searchParams.get("reviewOrder") || "";
  const reviewProductQuery = searchParams.get("productId") || "";

  const refreshOrders = useCallback(async () => {
    if (!storefrontOrdersApiEnabled) {
      setOrders(getDemoOrders().map(toOrderCard));
      setLoadError("");
      return;
    }
    if (!user?.email || typeof authenticatedRequest !== "function") {
      setOrders([]);
      setLoadError("Sign in with your registered customer account to load orders from the CRM.");
      return;
    }
    let importError = "";
    try {
      // Import this account's older browser-only demo orders once/idempotently,
      // then load the canonical rows that staff CRM Orders will also read.
      await importLegacyDemoOrders(authenticatedRequest, user.email);
    } catch (error) {
      importError = `Older browser orders could not be synced: ${error.message || "API request failed."}`;
    }
    try {
      const liveOrders = await getStorefrontOrders(authenticatedRequest);
      setOrders(liveOrders.map(toOrderCard));
      setLoadError(importError);
    } catch (error) {
      setOrders([]);
      setLoadError(error.message || importError || "Could not load orders from the CRM.");
    }
  }, [user?.email, authenticatedRequest]);

  useEffect(() => {
    refreshOrders();
    window.addEventListener("storage", refreshOrders);
    window.addEventListener("techgear:demo-orders-updated", refreshOrders);
    return () => {
      window.removeEventListener("storage", refreshOrders);
      window.removeEventListener("techgear:demo-orders-updated", refreshOrders);
    };
  }, [refreshOrders, reviewOrderQuery, reviewProductQuery]);

  const counts = useMemo(() => ORDER_FILTERS.reduce((result, label) => {
    result[label] = label === "All Orders" ? orders.length : orders.filter((order) => order.status === label).length;
    return result;
  }, {}), [orders]);

  const visibleOrders = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = Date.now();
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "All Orders" || order.status === statusFilter;
      const matchesSearch = !query || `${order.id} ${(order.items || []).map((item) => item.name).join(" ")}`.toLowerCase().includes(query);
      const age = now - new Date(order.createdAt).getTime();
      const matchesPeriod = period === "all" || (Number.isFinite(age) && age <= (period === "30" ? 30 : 180) * 24 * 60 * 60 * 1000);
      return matchesStatus && matchesSearch && matchesPeriod;
    });
  }, [orders, search, statusFilter, period]);

  return (
    <div className="orders-page">
    
      <main className="orders-main">
        <div className="orders-heading">
          <div><h1>My Orders</h1><p>{storefrontOrdersApiEnabled ? "Your orders are securely loaded from your customer account and shared with CRM." : "View orders created from this account in this browser demo."}</p></div>
          <div className="orders-search"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order ID or product..."/><Search size={20}/></div>
        </div>

        <div className="order-filters" role="group" aria-label="Filter orders by status">
          {ORDER_FILTERS.map((label) => <button key={label} type="button" className={statusFilter === label ? "active" : ""} onClick={() => setStatusFilter(label)}>{label} ({counts[label] || 0})</button>)}
          <label className="period-filter"><span className="sr-only">Filter order period</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">All Time</option><option value="30">Last 30 Days</option><option value="180">Last 6 Months</option></select><ChevronDown size={16}/></label>
        </div>

        {loadError && <div className="crm-error-banner" role="alert">{loadError}</div>}
        {!storefrontOrdersApiEnabled && orders.some((order) => order.demoOnly) && <div className="crm-demo-notice">Demo orders are stored in this browser only. They are not real payments or shipments.</div>}
        <div className="orders-list">
          {visibleOrders.map((order) => <OrderCard key={order.id} order={order}/>) }
          {visibleOrders.length === 0 && <div className="orders-empty-state"><h3>{orders.length ? "No orders match these filters" : "No orders yet"}</h3><p>{orders.length ? "Try a different status, search term or date range." : (storefrontOrdersApiEnabled ? "Place an order from your signed-in customer account to create a CRM order." : "Place a demo order and it will appear here with its actual products and total.")}</p></div>}
        </div>
      </main>
    </div>
  );
}

export default MyOrders;
