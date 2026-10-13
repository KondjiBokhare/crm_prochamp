import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import {
  crmAnalyticsMode,
  crmCustomersMode,
  crmDataMode,
  crmInteractionsMode,
  crmOrdersMode,
  getAnalyticsData,
  getCustomers,
  getDashboardData,
  getInteractions,
  getOrderManagementOrders,
} from "../../services/crmService";
import { useAuth } from "../../context/AuthContext";
import { MetricCard, PageHeader, SectionCard, StatusBadge, CustomerLink } from "../../components/crm/CrmUI";

const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);
const dateLabel = (value) => {
  if (!value) return "—";
  const raw = String(value);
  const date = new Date(raw.includes("T") ? raw : `${raw.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};
const numberLabel = (value) => value == null ? "—" : Number(value).toLocaleString("en-IN");
const finiteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const toLocalISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const API_MODES = {
  analytics: crmAnalyticsMode === "api",
  customers: crmCustomersMode === "api",
  orders: crmOrdersMode === "api",
  interactions: crmInteractionsMode === "api",
};
const USES_LIVE_API = Object.values(API_MODES).some(Boolean);
const dateWindow = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: toLocalISO(from), to: toLocalISO(to) };
};
const isRepeatEligible = (order) => !["CANCELLED", "REFUNDED"].includes(String(order?.backendStatus || order?.status || "").toUpperCase());
const isDelivered = (order) => String(order?.backendStatus || order?.fulfillmentStatus || order?.status || "").toUpperCase() === "DELIVERED";

function sortNewest(items, dateKey) {
  return [...items].sort((left, right) => String(right?.[dateKey] || "").localeCompare(String(left?.[dateKey] || "")));
}

function calculateRepeatCustomers(customers, orders, analytics) {
  if (Array.isArray(customers) && Array.isArray(orders)) {
    const counts = new Map();
    orders.filter(isRepeatEligible).forEach((order) => {
      const customerId = order.customerId ?? order.customer;
      if (customerId == null) return;
      const key = String(customerId);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.values()].filter((count) => count > 1).length;
  }

  if (Array.isArray(customers)) {
    const knownCounts = customers.filter((customer) => customer.totalOrders != null && Number.isFinite(Number(customer.totalOrders)));
    if (knownCounts.length > 0 || customers.length === 0) {
      return knownCounts.filter((customer) => Number(customer.totalOrders) > 1).length;
    }
  }

  return analytics?.repeatCustomers == null ? null : finiteNumber(analytics.repeatCustomers);
}

function prepareApiDashboard({ analytics, customers, orders, interactions, unavailable }) {
  const totalCustomers = Array.isArray(customers) ? customers.length : (analytics?.totalCustomers ?? null);
  const activeCustomers = Array.isArray(customers)
    ? customers.filter((customer) => customer.status !== "Inactive" && customer.isActive !== false).length
    : (analytics?.activeCustomers ?? null);
  const repeatCustomers = calculateRepeatCustomers(customers, orders, analytics);
  const repeatCustomerRate = totalCustomers > 0 && repeatCustomers != null
    ? Math.round((repeatCustomers / totalCustomers) * 100)
    : (totalCustomers === 0 ? 0 : null);

  // Prefer the backend's explicitly scoped, date-filtered aggregate revenue.
  // If Analytics API is unavailable, calculate realized revenue from returned delivered CRM orders.
  const totalDeliveredRevenue = analytics
    ? finiteNumber(analytics.totalRevenue)
    : (Array.isArray(orders) ? orders.filter(isDelivered).reduce((sum, order) => sum + finiteNumber(order.total), 0) : null);
  const deliveredOrders = analytics
    ? analytics.deliveredOrders
    : (Array.isArray(orders) ? orders.filter(isDelivered).length : null);

  const recentOrders = Array.isArray(orders)
    ? sortNewest(orders, "date").slice(0, 5)
    : [];
  const recentCustomers = Array.isArray(customers)
    ? sortNewest(customers, "joinedAt").slice(0, 5)
    : [];

  return {
    source: "django-api",
    totalCustomers,
    activeCustomers,
    totalDeliveredRevenue,
    deliveredOrders,
    repeatCustomers,
    repeatCustomerRate,
    interactionsCount: Array.isArray(interactions) ? interactions.length : null,
    totalOrders: analytics?.totalOrders ?? (Array.isArray(orders) ? orders.length : null),
    recentOrders,
    recentCustomers,
    analyticsAvailable: Boolean(analytics),
    customersAvailable: Array.isArray(customers),
    ordersAvailable: Array.isArray(orders),
    interactionsAvailable: Array.isArray(interactions),
    unavailable,
  };
}

function Dashboard() {
  const { authenticatedRequest } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        if (!USES_LIVE_API) {
          if (crmDataMode !== "mock") {
            throw new Error("No supported live dashboard sources are enabled. Set the relevant VITE_CRM_*_MODE variables to api and restart Vite.");
          }
          const mockData = await getDashboardData();
          if (!active) return;
          setData({ ...mockData, source: "mock" });
          setLastRefreshed(new Date());
          return;
        }

        const window = dateWindow();
        const sources = [
          ...(API_MODES.analytics ? [{ key: "analytics", label: "Analytics", load: () => getAnalyticsData({ from: window.from, to: window.to }, authenticatedRequest) }] : []),
          ...(API_MODES.customers ? [{ key: "customers", label: "Customers", load: () => getCustomers({}, authenticatedRequest) }] : []),
          ...(API_MODES.orders ? [{ key: "orders", label: "Orders", load: () => getOrderManagementOrders({}, authenticatedRequest) }] : []),
          ...(API_MODES.interactions ? [{ key: "interactions", label: "Interactions", load: () => getInteractions({}, authenticatedRequest) }] : []),
        ];
        const settled = await Promise.all(sources.map(async (source) => ({ ...source, result: await Promise.resolve().then(source.load).then((value) => ({ ok: true, value })).catch((loadError) => ({ ok: false, error: loadError })) })));
        const loaded = {};
        const failures = [];
        settled.forEach(({ key, label, result }) => {
          if (result.ok) loaded[key] = result.value;
          else failures.push({ key, label, error: result.error });
        });

        if (Object.keys(loaded).length === 0) {
          throw failures[0]?.error || new Error("Dashboard data could not be loaded from the API.");
        }
        if (!active) return;

        setData(prepareApiDashboard({
          analytics: loaded.analytics ?? null,
          customers: Array.isArray(loaded.customers) ? loaded.customers : null,
          orders: Array.isArray(loaded.orders) ? loaded.orders : null,
          interactions: Array.isArray(loaded.interactions) ? loaded.interactions : null,
          unavailable: failures.map(({ label, error: loadError }) => `${label}: ${loadError?.message || "request failed"}`),
        }));
        if (failures.length) {
          setError(`Some live dashboard sections could not load: ${failures.map(({ label }) => label).join(", ")}. Other values shown are from successful API responses.`);
        }
        setLastRefreshed(new Date());
      } catch (loadError) {
        if (active) setError(loadError?.message || "Could not load dashboard data.");
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    return () => { active = false; };
  }, [authenticatedRequest, refreshKey]);

  const isMockData = data?.source === "mock";
  const revenueNote = isMockData
    ? `${data?.paidOrders ?? 0} sample orders marked paid`
    : data?.analyticsAvailable
      ? `Delivered orders from the last 30 days · ${data?.deliveredOrders ?? 0} delivered`
      : data?.deliveredOrders == null
        ? "Order data unavailable"
        : `${numberLabel(data.deliveredOrders)} delivered CRM orders in loaded order records`;
  const orderStatusUnavailable = data && !data.ordersAvailable;

  return (
    <div className="crm-page">
      <PageHeader
        title="Dashboard"
        description="A current snapshot of customer activity and store performance."
        action={(
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button className="crm-button crm-button-secondary" type="button" onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}>
              <RefreshCw size={14} aria-hidden="true" /> {loading ? "Refreshing…" : "Refresh data"}
            </button>
            <Link className="crm-button crm-button-primary" to="/crm/analytics">View analytics</Link>
          </div>
        )}
      />

      {isMockData && <div className="crm-demo-notice">Demo mode · figures shown here are sample data, not live store metrics. Enable the individual VITE_CRM_*_MODE=api settings and restart Vite to load live dashboard values.</div>}
      {error && <div className={data ? "crm-demo-notice" : "crm-error-banner"} role="status">{error}</div>}
      {data?.source === "django-api" && lastRefreshed && (
        <p style={{ margin: "-6px 0 14px", color: "#64748b", fontSize: 11 }}>
          Live Django data · last refreshed {lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          {data.analyticsAvailable ? " · revenue and order KPI window: last 30 days" : " · aggregate analytics unavailable; available list APIs are used"}
        </p>
      )}

      {loading && !data ? <div className="crm-loading">Loading dashboard…</div> : !data ? (
        <SectionCard title="Dashboard data unavailable" subtitle="The live dashboard could not load data from Django.">
          <p style={{ padding: 16, color: "#64748b", fontSize: 13 }}>Check that the backend is running, you are signed in to the CRM, and the dashboard APIs are available to your staff role. Then select Refresh data.</p>
        </SectionCard>
      ) : (
        <>
          <div className="crm-metrics-grid">
            <MetricCard
              label="Total customers"
              value={numberLabel(data.totalCustomers)}
              note={data.activeCustomers == null ? "Customer count from available source" : `${numberLabel(data.activeCustomers)} active customers`}
              tone="blue"
            />
            <MetricCard
              label={isMockData ? "Paid revenue in sample orders" : "Delivered revenue"}
              value={isMockData ? money(data.totalPaidRevenue) : (data.totalDeliveredRevenue == null ? "—" : money(data.totalDeliveredRevenue))}
              note={revenueNote}
              tone="green"
            />
            <MetricCard
              label={isMockData ? "Repeat-purchase customers" : "Repeat-purchase rate"}
              value={isMockData ? `${data.repeatCustomerRate}%` : (data.repeatCustomerRate == null ? "—" : `${data.repeatCustomerRate}%`)}
              note={isMockData
                ? "Share of sample customers with 2+ orders"
                : data.repeatCustomers == null
                  ? "Repeat purchase data unavailable"
                  : `${numberLabel(data.repeatCustomers)} customers with 2+ non-cancelled orders`}
              tone="purple"
            />
            <MetricCard
              label={isMockData ? "Pending interactions" : "CRM interactions"}
              value={numberLabel(isMockData ? data.pendingInteractions : data.interactionsCount)}
              note={isMockData
                ? "Require team follow-up"
                : data.interactionsAvailable
                  ? "Recorded interactions; backend does not currently store pending status"
                  : "Enable VITE_CRM_INTERACTIONS_MODE=api for the live count"}
              tone="orange"
            />
          </div>

          <div className="crm-dashboard-grid">
            <SectionCard
              title="Recent orders"
              subtitle={isMockData ? "Latest sample orders" : data.ordersAvailable ? (data.analyticsAvailable ? `${numberLabel(data.totalOrders)} orders in the last 30 days` : `${numberLabel(data.totalOrders)} orders returned by the CRM API`) : "Live Orders API is unavailable"}
              action={<Link className="crm-text-link" to="/crm/orders">Manage orders →</Link>}
            >
              <div className="crm-table-wrap">
                <table className="crm-table">
                  <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.recentOrders.map((order) => (
                      <tr key={order.id}>
                        <td className="crm-strong-cell">{order.orderNumber || order.id}</td>
                        <td><CustomerLink customerId={order.customerId}>{order.customerName || "Customer"}</CustomerLink></td>
                        <td>{dateLabel(order.date)}</td>
                        <td>{money(order.total)}</td>
                        <td><StatusBadge status={isMockData ? order.paymentStatus : order.fulfillmentStatus} /></td>
                      </tr>
                    ))}
                    {data.recentOrders.length === 0 && <tr><td colSpan={5} style={{ padding: 18, color: "#64748b" }}>{orderStatusUnavailable ? "No live order records are available. Check the Orders API mode and backend response." : "No orders were returned by the selected data source."}</td></tr>}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <SectionCard
              title="Recently added customers"
              subtitle={isMockData ? "Latest sample profiles" : data.customersAvailable ? "Latest profiles returned by the CRM Customers API" : "Live Customers API is unavailable"}
              action={<Link className="crm-text-link" to="/crm/customers">View all →</Link>}
            >
              <div className="crm-recent-list">
                {data.recentCustomers.map((customer) => {
                  const name = String(customer.name || "Customer");
                  return (
                    <div className="crm-recent-customer" key={customer.id}>
                      <span className="crm-customer-avatar">{name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                      <div className="crm-recent-customer-copy"><CustomerLink customerId={customer.id}>{name}</CustomerLink><span>{customer.email || "No email recorded"}</span></div>
                      <StatusBadge status={customer.status || "Active"} />
                    </div>
                  );
                })}
                {data.recentCustomers.length === 0 && <p style={{ padding: 16, color: "#64748b", fontSize: 12 }}>{data.customersAvailable ? "No customers found for this organization." : "Enable VITE_CRM_CUSTOMERS_MODE=api to show live customers."}</p>}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
