import { useEffect, useMemo, useState } from "react";
import { Activity, Eye, Search as SearchIcon, ShoppingCart, ShoppingBag, TrendingUp, Users, Trash2, RefreshCw } from "lucide-react";
import { crmAnalyticsMode, getAnalyticsData } from "../../services/crmService";
import { useAuth } from "../../context/AuthContext";
import { EmptyState, MetricCard, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";
import { CUSTOMER_BEHAVIOR_CHANGE_EVENT, clearCustomerBehaviorDemoData, getCustomerBehaviorSummary } from "../../services/customerBehaviorService";
import { behaviorAnalyticsApiEnabled, getBehaviorAnalytics } from "../../services/behaviorApiService";

const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);
const shortDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

function toLocalISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function aggregateTrend(points, period) {
  if (period === "daily") return points.map((point) => ({ ...point, label: shortDate(point.date) }));
  const grouped = new Map();
  points.forEach((point) => {
    const date = new Date(`${point.date}T00:00:00`);
    let key;
    let label;
    if (period === "weekly") {
      const dayOffset = (date.getDay() + 6) % 7;
      date.setDate(date.getDate() - dayOffset);
      key = toLocalISO(date);
      label = `Week of ${shortDate(key)}`;
    } else {
      key = point.date.slice(0, 7);
      label = date.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    }
    const current = grouped.get(key) || { label, revenue: 0, orders: 0, date: key };
    current.revenue += point.revenue;
    current.orders += point.orders;
    grouped.set(key, current);
  });
  return [...grouped.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function downloadCsv(data, metrics, fromDate, toDate) {
  const rows = [
    ["Section", "Metric", "Value"],
    ...metrics.map((metric) => ["KPI", metric.label, metric.rawValue]),
    ["Report filter", "From date", fromDate || "All dates"],
    ["Report filter", "To date", toDate || "All dates"],
    [],
    ["Revenue trend", "Date / period", "Revenue (INR)", "Orders"],
    ...data.revenueTrend.map((point) => ["Revenue trend", point.date, point.revenue, point.orders]),
    [],
    ["Campaign", "Channel", "Status", "Audience", "Sent", "Conversions", "Revenue (INR)"],
    ...data.campaigns.map((campaign) => [campaign.name, campaign.channel, campaign.status, campaign.audience, campaign.sent, campaign.conversions, campaign.revenue]),
  ];
  const csv = rows.map((row) => row.map((cell) => {
    const value = cell == null ? "" : String(cell);
    return `"${value.replace(/"/g, '""')}"`;
  }).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `crm-analytics-${fromDate || "start"}-to-${toDate || "end"}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function BehaviourProductList({ items, metric, metricLabel, emptyMessage }) {
  if (!items?.length) return <EmptyState title="No activity yet" message={emptyMessage} />;
  return (
    <div className="crm-behaviour-list">
      {items.slice(0, 6).map((item, index) => (
        <div className="crm-behaviour-row" key={item.productId}>
          <span className="crm-behaviour-rank">{index + 1}</span>
          <div className="crm-behaviour-row-main">
            <strong>{item.productName}</strong>
            <span>{item.category || "Other"}{item.brand ? ` · ${item.brand}` : ""}</span>
          </div>
          <div className="crm-behaviour-row-value">
            <strong>{Number(item[metric]) || 0}</strong>
            <span>{metricLabel}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BehaviourSearchList({ items }) {
  if (!items?.length) return <EmptyState title="No searches yet" message="Submit a search from the customer storefront to see popular search terms here." />;
  return (
    <div className="crm-behaviour-list">
      {items.slice(0, 6).map((item, index) => (
        <div className="crm-behaviour-row" key={item.query.toLowerCase()}>
          <span className="crm-behaviour-rank">{index + 1}</span>
          <div className="crm-behaviour-row-main">
            <strong>{item.query}</strong>
            <span>{item.zeroResultSearches} searches returned no exact results · {item.linkedToProduct} followed a product view</span>
          </div>
          <div className="crm-behaviour-row-value">
            <strong>{item.searches}</strong>
            <span>searches</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function BehaviourSearchJourneyList({ items }) {
  if (!items?.length) return <EmptyState title="No linked journeys yet" message="Open a product detail page, then submit a search from the navbar. The demo will record the sequence anonymously." />;
  return (
    <div className="crm-behaviour-list">
      {items.slice(0, 6).map((item, index) => (
        <div className="crm-behaviour-row" key={`${item.previousViewedProductId}-${item.query.toLowerCase()}`}>
          <span className="crm-behaviour-rank">{index + 1}</span>
          <div className="crm-behaviour-row-main">
            <strong>Viewed: {item.previousViewedProductName}</strong>
            <span>Then searched “{item.query}” · {item.zeroResultSearches} zero-result search(es)</span>
          </div>
          <div className="crm-behaviour-row-value">
            <strong>{item.occurrences}</strong>
            <span>journeys</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Analytics() {
  const { authenticatedRequest } = useAuth();
  const isApiMode = crmAnalyticsMode === "api";
  const isBehaviorApiMode = behaviorAnalyticsApiEnabled;
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState("daily");
  const initialToDate = toLocalISO(new Date());
  const initialFrom = new Date();
  initialFrom.setDate(initialFrom.getDate() - 29);
  const [fromDate, setFromDate] = useState(() => toLocalISO(initialFrom));
  const [toDate, setToDate] = useState(() => initialToDate);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [behavior, setBehavior] = useState(() => getCustomerBehaviorSummary({ days: 30 }));
  const [behaviorLoading, setBehaviorLoading] = useState(false);
  const [behaviorError, setBehaviorError] = useState("");
  const [behaviorRefreshKey, setBehaviorRefreshKey] = useState(0);
  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate);

  useEffect(() => {
    let active = true;
    if (invalidRange) { setLoading(false); setData(null); return () => { active = false; }; }
    setLoading(true);
    setError("");
    getAnalyticsData({ from: fromDate, to: toDate }, authenticatedRequest)
      .then((result) => { if (active) setData(result); })
      .catch((loadError) => { if (active) setError(loadError?.message || "Could not load analytics data."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fromDate, toDate, invalidRange, authenticatedRequest, isApiMode]);

  useEffect(() => {
    let active = true;
    const refreshBehaviour = async () => {
      if (!isBehaviorApiMode) {
        setBehavior(getCustomerBehaviorSummary({ days: 30 }));
        setBehaviorError("");
        return;
      }
      setBehaviorLoading(true);
      setBehaviorError("");
      try {
        const result = await getBehaviorAnalytics(authenticatedRequest, 30);
        if (active) setBehavior(result);
      } catch (loadError) {
        if (active) setBehaviorError(loadError?.message || "Could not load server behaviour analytics.");
      } finally {
        if (active) setBehaviorLoading(false);
      }
    };
    const onLocalChange = () => {
      if (!isBehaviorApiMode) refreshBehaviour();
    };
    window.addEventListener(CUSTOMER_BEHAVIOR_CHANGE_EVENT, onLocalChange);
    window.addEventListener("storage", onLocalChange);
    refreshBehaviour();
    return () => {
      active = false;
      window.removeEventListener(CUSTOMER_BEHAVIOR_CHANGE_EVENT, onLocalChange);
      window.removeEventListener("storage", onLocalChange);
    };
  }, [isBehaviorApiMode, authenticatedRequest, behaviorRefreshKey]);

  const trend = useMemo(() => aggregateTrend(data?.revenueTrend || [], period), [data, period]);
  const maxRevenue = Math.max(...trend.map((point) => point.revenue), 1);
  const metrics = data && !isApiMode ? [
    { label: "Paid revenue", value: money(data.revenue), rawValue: data.revenue, note: "Sum of paid sample orders in date range", tone: "green" },
    { label: "Paid orders", value: data.paidOrders.toLocaleString("en-IN"), rawValue: data.paidOrders, note: "Payment status = Paid", tone: "blue" },
    { label: "Average order value", value: money(data.averageOrderValue), rawValue: data.averageOrderValue, note: "Paid revenue ÷ paid orders", tone: "purple" },
    { label: "Repeat-purchase rate", value: `${data.repeatPurchaseRate}%`, rawValue: data.repeatPurchaseRate, note: "Customers with 2+ orders ÷ all customers", tone: "orange" },
    { label: "Cancellation rate", value: `${data.cancellationRate}%`, rawValue: data.cancellationRate, note: "Cancelled orders ÷ orders in range", tone: "blue" },
    { label: "Refund rate", value: `${data.refundRate}%`, rawValue: data.refundRate, note: "Refunded value ÷ (paid + refunded value)", tone: "orange" },
    { label: "Campaign conversion", value: `${data.campaignConversionRate}%`, rawValue: data.campaignConversionRate, note: "Conversions ÷ recorded sent messages", tone: "purple" },
    { label: "Customers", value: data.customerCount.toLocaleString("en-IN"), rawValue: data.customerCount, note: "All customers in mock dataset", tone: "green" },
  ] : [];

  function resetDates() {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    setFromDate(toLocalISO(start));
    setToDate(toLocalISO(end));
  }

  function downloadApiCsv() {
    if (!data) return;
    const rows = [
      ["Metric", "Value", "Scope"],
      ["Total customers", data.totalCustomers, "Current organization snapshot"],
      ["Active customers", data.activeCustomers, "Current organization snapshot"],
      ["New customers", data.newCustomers, `Created ${fromDate} to ${toDate}`],
      ["Repeat customers", data.repeatCustomers, "Current lifecycle stage"],
      ["Loyal customers", data.loyalCustomers, "Current lifecycle stage"],
      ["Total orders", data.totalOrders, `Order date ${fromDate} to ${toDate}`],
      ["Delivered orders", data.deliveredOrders, `Order date ${fromDate} to ${toDate}`],
      ["Cancelled orders", data.cancelledOrders, `Order date ${fromDate} to ${toDate}`],
      ["Revenue (INR)", data.totalRevenue, `Delivered orders dated ${fromDate} to ${toDate}`],
      ["Average order value (INR)", data.averageOrderValue, `Delivered orders dated ${fromDate} to ${toDate}`],
      ["Campaigns created", data.totalCampaigns, `Created ${fromDate} to ${toDate}`],
      ["Completed campaigns", data.completedCampaigns, `Created ${fromDate} to ${toDate}`],
      ["Campaign responses", data.totalCampaignResponses, `Response date ${fromDate} to ${toDate}`],
      ["Converted responses", data.convertedResponses, `Response date ${fromDate} to ${toDate}`],
      ["Campaign response rate (%)", data.campaignResponseRate, `Response date ${fromDate} to ${toDate}`],
    ];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `crm-live-analytics-${fromDate}-to-${toDate}.csv`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove(); window.URL.revokeObjectURL(url);
  }

  if (isApiMode) {
    const apiMetrics = data ? [
      { label: "Total revenue", value: money(data.totalRevenue), note: "Sum of delivered order amounts in the selected range", tone: "green" },
      { label: "Orders", value: data.totalOrders.toLocaleString("en-IN"), note: "Orders dated in selected range", tone: "blue" },
      { label: "Delivered orders", value: data.deliveredOrders.toLocaleString("en-IN"), note: "Selected date range", tone: "green" },
      { label: "Cancelled orders", value: data.cancelledOrders.toLocaleString("en-IN"), note: "Selected date range", tone: "orange" },
      { label: "Average order value", value: money(data.averageOrderValue), note: "Delivered-order revenue ÷ delivered orders", tone: "purple" },
      { label: "Total customers", value: data.totalCustomers.toLocaleString("en-IN"), note: "Current organization snapshot", tone: "blue" },
      { label: "Active customers", value: data.activeCustomers.toLocaleString("en-IN"), note: "Current organization snapshot", tone: "green" },
      { label: "New customers", value: data.newCustomers.toLocaleString("en-IN"), note: "Created in selected date range", tone: "blue" },
      { label: "Repeat customers", value: data.repeatCustomers.toLocaleString("en-IN"), note: "Current lifecycle stage", tone: "purple" },
      { label: "Loyal customers", value: data.loyalCustomers.toLocaleString("en-IN"), note: "Current lifecycle stage", tone: "green" },
      { label: "Campaigns created", value: data.totalCampaigns.toLocaleString("en-IN"), note: "Created in selected date range", tone: "blue" },
      { label: "Completed campaigns", value: data.completedCampaigns.toLocaleString("en-IN"), note: "Campaigns created in selected range", tone: "green" },
      { label: "Campaign responses", value: data.totalCampaignResponses.toLocaleString("en-IN"), note: "Response date in selected range", tone: "purple" },
      { label: "Converted responses", value: data.convertedResponses.toLocaleString("en-IN"), note: "Response date in selected range", tone: "green" },
      { label: "Campaign response rate", value: `${data.campaignResponseRate}%`, note: "Converted responses ÷ response records in range", tone: "orange" },
    ] : [];

    return (
      <div className="crm-page">
        <PageHeader title="Analytics" description="Live organization-level reporting from Django and PostgreSQL." action={<button className="crm-button crm-button-secondary" type="button" disabled={!data || invalidRange} onClick={downloadApiCsv}>Export CSV</button>} />
        <div className="crm-demo-notice">Live Django mode · organization-level business aggregates and, when enabled, pseudonymous storefront behaviour analytics are read from PostgreSQL.</div>
        <div className="crm-analytics-toolbar crm-analytics-filters">
          <label>From <input aria-label="Report start date" type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
          <label>To <input aria-label="Report end date" type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
          <button type="button" className="crm-button crm-button-secondary" onClick={resetDates}>Last 30 days</button>
          <span>Report period: {fromDate} — {toDate}</span>
        </div>
        {invalidRange && <div className="crm-error-banner" role="alert">The start date must be on or before the end date.</div>}
        {error && <div className="crm-error-banner" role="alert">{error}</div>}
        {loading ? <div className="crm-loading">Loading live analytics…</div> : data ? <>
          <div className="crm-metrics-grid crm-analytics-metrics">{apiMetrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>
          <SectionCard title="Metric scope" subtitle="The endpoint returns aggregates, not daily/weekly/monthly time-series data.">
            <div className="crm-definition-list">
              <div><strong>Period-filtered</strong><span>Orders, delivered/cancelled counts, delivered-order revenue, new customers, campaigns created, and campaign responses use the selected date range.</span></div>
              <div><strong>Current snapshot</strong><span>Total/active/repeat/loyal customers reflect the current organization state rather than a historical snapshot for the selected dates.</span></div>
              <div><strong>Response-rate basis</strong><span>Converted campaign-response records divided by all campaign-response records in the selected period. It is not a message-delivery or marketing attribution metric.</span></div>
            </div>
          </SectionCard>
        </> : null}
        <SectionCard
          title={isBehaviorApiMode ? "Server-persisted customer behaviour" : "Browser-local customer behaviour (demo)"}
          subtitle={isBehaviorApiMode ? `Anonymous storefront events stored in Django · last ${behavior.periodDays || 30} days` : "Product views and searches tracked in this browser only"}
          action={isBehaviorApiMode
            ? <button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => setBehaviorRefreshKey((value) => value + 1)}><RefreshCw size={13} /> Refresh activity</button>
            : null}
        >
          <div className="crm-behaviour-privacy-note"><Activity size={16}/><span>{isBehaviorApiMode ? "Pseudonymous visitor/session identifiers only. Names, emails, phone numbers and payment credentials are not intentionally collected. Purchases recorded by this demo are simulated and do not indicate a real payment." : "These events are local to this browser and may differ across devices. No customer names, emails or payment credentials are collected by this demo tracker."}</span></div>
          {behaviorLoading && <div className="crm-loading">Loading persisted behaviour events…</div>}
          {behaviorError && <div className="crm-error-banner" role="alert">{behaviorError}</div>}
          <div className="crm-metrics-grid crm-behaviour-metrics">
            <MetricCard label="Product views" value={(behavior.totalViews || 0).toLocaleString("en-IN")} note={`${behavior.uniqueViewers || 0} anonymous visitor(s)`} tone="blue" />
            <MetricCard label="Searches" value={(behavior.totalSearches || 0).toLocaleString("en-IN")} note="Submitted search terms" tone="purple" />
            <MetricCard label="Add-to-cart events" value={(behavior.totalCartAdds || 0).toLocaleString("en-IN")} note={`${behavior.uniqueCartVisitors || 0} anonymous visitor(s)`} tone="orange" />
            <MetricCard label="Purchased units" value={(behavior.totalPurchaseUnits || 0).toLocaleString("en-IN")} note="Simulated checkout only" tone="green" />
          </div>
          {isBehaviorApiMode && <div className="crm-behaviour-grid">
            <div className="crm-behaviour-card"><div className="crm-behaviour-card-heading"><Eye size={16}/><div><h3>Most viewed products</h3><p>Products opened most often</p></div></div><BehaviourProductList items={behavior.mostViewed} metric="views" metricLabel="views" emptyMessage="Open product detail pages on the storefront after enabling behaviour API mode." /></div>
            <div className="crm-behaviour-card"><div className="crm-behaviour-card-heading"><SearchIcon size={16}/><div><h3>Most searched terms</h3><p>What visitors are looking for</p></div></div><BehaviourSearchList items={behavior.popularSearches} /></div>
            <div className="crm-behaviour-card"><div className="crm-behaviour-card-heading"><ShoppingCart size={16}/><div><h3>Most added to cart</h3><p>Product interest signals</p></div></div><BehaviourProductList items={behavior.mostAddedToCart} metric="cartAdds" metricLabel="units added" emptyMessage="Add products to cart from the storefront." /></div>
            <div className="crm-behaviour-card"><div className="crm-behaviour-card-heading"><Users size={16}/><div><h3>Journey funnel</h3><p>Unique anonymous visitors by action</p></div></div><div className="crm-behaviour-funnel"><div><span>Viewed a product</span><strong>{behavior.uniqueViewers || 0}</strong></div><div><span>Added to cart</span><strong>{behavior.uniqueCartVisitors || 0}</strong></div><div><span>Started checkout</span><strong>{behavior.checkoutVisitors || 0}</strong></div><div><span>Placed demo order</span><strong>{behavior.uniquePurchasers || 0}</strong></div></div><p className="crm-behaviour-funnel-note">View-to-cart: {behavior.viewsToCartRate || 0}% · Checkout-to-demo-purchase: {behavior.checkoutToPurchaseRate || 0}%</p></div>
          </div>}
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="crm-page">
      <PageHeader title="Analytics" description="Explore revenue, orders, repeat purchasing and campaign performance." action={<button className="crm-button crm-button-secondary" type="button" disabled={!data || invalidRange} onClick={() => downloadCsv(data, metrics, fromDate, toDate)}>Export CSV</button>} />
      {isApiMode ? <div className="crm-demo-notice">Live Django aggregate mode · company-level metrics come from PostgreSQL. {isBehaviorApiMode ? "Behaviour metrics are also read from persisted pseudonymous storefront events." : "Behaviour metrics remain local to this browser until VITE_CRM_BEHAVIOR_ANALYTICS_MODE=api is enabled."}</div> : <div className="crm-demo-notice">Demo business metrics · {isBehaviorApiMode ? "customer behaviour is fetched from the Django API." : "all customer behaviour events are stored in this browser only."}</div>}
      <div className="crm-analytics-toolbar crm-analytics-filters">
        <label>From <input aria-label="Report start date" type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>To <input aria-label="Report end date" type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
        {!isApiMode && <label>Trend granularity <select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>}
        <button type="button" className="crm-button crm-button-secondary" onClick={resetDates}>Last 30 days</button>
        <span>Report period: {fromDate || "all dates"} — {toDate || "all dates"}</span>
      </div>
      {invalidRange && <div className="crm-error-banner" role="alert">The start date must be on or before the end date.</div>}
      {error && <div className="crm-error-banner" role="alert">{error}</div>}
      <SectionCard title={isBehaviorApiMode ? "Server-persisted customer behaviour" : "Customer behaviour insights"} subtitle={isBehaviorApiMode ? `Anonymous storefront events from Django · last ${behavior.periodDays || 30} days` : "Anonymous first-party demo events from the storefront · last 30 days"} action={isBehaviorApiMode ? <button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => setBehaviorRefreshKey((value) => value + 1)}><RefreshCw size={13} /> Refresh activity</button> : <button type="button" className="crm-button crm-button-secondary crm-button-small" onClick={() => { if (window.confirm("Clear all local demo behaviour events from this browser?")) clearCustomerBehaviorDemoData(); }}><Trash2 size={13} /> Clear demo activity</button>}>
        <div className="crm-behaviour-privacy-note"><Activity size={16} /><span>{isBehaviorApiMode ? "Pseudonymous visitor/session identifiers only. Purchases recorded by this demo are simulated and do not indicate a real payment. No customer names, emails, phone numbers or payment credentials are intentionally collected." : "Tracks product views, submitted search terms, wishlist actions, add-to-cart activity, checkout starts and simulated purchases. No customer names, emails or payment credentials are collected by this demo tracker."}</span></div>
        {behaviorLoading && <div className="crm-loading">Loading persisted behaviour events…</div>}
        {behaviorError && <div className="crm-error-banner" role="alert">{behaviorError}</div>}
        <div className="crm-metrics-grid crm-behaviour-metrics">
          <MetricCard label="Product views" value={behavior.totalViews.toLocaleString("en-IN")} note={`${behavior.uniqueViewers} anonymous browser visitor(s)`} tone="blue" />
          <MetricCard label="Searches" value={behavior.totalSearches.toLocaleString("en-IN")} note="Submitted search terms" tone="purple" />
          <MetricCard label="Add-to-cart events" value={behavior.totalCartAdds.toLocaleString("en-IN")} note={`${behavior.uniqueCartVisitors} anonymous visitor(s)`} tone="orange" />
          <MetricCard label="Purchased units" value={behavior.totalPurchaseUnits.toLocaleString("en-IN")} note="Simulated checkout only" tone="green" />
        </div>
        <div className="crm-behaviour-grid">
          <div className="crm-behaviour-card"><div className="crm-behaviour-card-heading"><Eye size={16}/><div><h3>Most viewed products</h3><p>Products customers open most often</p></div></div><BehaviourProductList items={behavior.mostViewed} metric="views" metricLabel="views" emptyMessage="Open product detail pages in the storefront to populate this list." /></div>
          <div className="crm-behaviour-card"><div className="crm-behaviour-card-heading"><SearchIcon size={16}/><div><h3>Most searched terms</h3><p>What customers are looking for</p></div></div><BehaviourSearchList items={behavior.popularSearches} /></div>
          <div className="crm-behaviour-card"><div className="crm-behaviour-card-heading"><Activity size={16}/><div><h3>Searches after product views</h3><p>Which terms customers search after opening a product</p></div></div><BehaviourSearchJourneyList items={behavior.searchAfterViews} /></div>
          <div className="crm-behaviour-card"><div className="crm-behaviour-card-heading"><ShoppingCart size={16}/><div><h3>Most added to cart</h3><p>Interest that moves toward checkout</p></div></div><BehaviourProductList items={behavior.mostAddedToCart} metric="cartAdds" metricLabel="units added" emptyMessage="Add one or more products to the cart from product details." /></div>
          <div className="crm-behaviour-card"><div className="crm-behaviour-card-heading"><ShoppingBag size={16}/><div><h3>Frequently purchased</h3><p>Ranked by simulated checkout purchases</p></div></div><BehaviourProductList items={behavior.mostPurchased} metric="purchasedQuantity" metricLabel="units" emptyMessage="Place a demo order from checkout to record sample purchase activity. No real payment is processed." /></div>
          <div className="crm-behaviour-card crm-behaviour-adoption-card"><div className="crm-behaviour-card-heading"><TrendingUp size={16}/><div><h3>Most adopted products</h3><p>Interest score combines views, cart adds and purchases</p></div></div>
            {!behavior.adoptionProducts.length ? <EmptyState title="Not enough activity yet" message="Browse, search and add products to cart to build an interest ranking." /> : <div className="crm-behaviour-list">{behavior.adoptionProducts.slice(0, 6).map((item, index) => <div className="crm-behaviour-row" key={item.productId}><span className="crm-behaviour-rank">{index + 1}</span><div className="crm-behaviour-row-main"><strong>{item.productName}</strong><span>{item.views} views · {item.cartAdds} added · {item.purchasedQuantity} purchased</span></div><div className="crm-behaviour-row-value"><strong>{item.adoptionScore}</strong><span>interest score</span></div></div>)}</div>}
          </div>
          <div className="crm-behaviour-card"><div className="crm-behaviour-card-heading"><Users size={16}/><div><h3>Journey funnel</h3><p>Unique anonymous visitors by action</p></div></div>
            <div className="crm-behaviour-funnel"><div><span>Viewed a product</span><strong>{behavior.uniqueViewers}</strong></div><div><span>Added to cart</span><strong>{behavior.uniqueCartVisitors}</strong></div><div><span>Started checkout</span><strong>{behavior.checkoutVisitors}</strong></div><div><span>Placed demo order</span><strong>{behavior.uniquePurchasers}</strong></div></div>
            <p className="crm-behaviour-funnel-note">View-to-cart: {behavior.viewsToCartRate}% · Checkout-to-demo-purchase: {behavior.checkoutToPurchaseRate}%</p>
          </div>
        </div>
      </SectionCard>
      {loading ? <div className="crm-loading">Calculating sample report…</div> : !data ? null : (
        <>
          <div className="crm-metrics-grid crm-analytics-metrics">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div>



          <div className="crm-dashboard-grid">
            <SectionCard title="Revenue trend" subtitle={period === "daily" ? "Sample revenue by day" : period === "weekly" ? "Revenue grouped by calendar week" : "Revenue grouped by month"}>
              {trend.length === 0 ? <EmptyState title="No revenue points in this range" message="Choose a different date range to see the sample trend." /> : <div className="crm-bar-chart" role="img" aria-label={`Sample revenue trend, ${period} granularity`}>
                {trend.map((point) => <div className="crm-bar-column" key={`${period}-${point.date}`} title={`${point.label}: ${money(point.revenue)} · ${point.orders} orders`}><span className="crm-bar-value">{Math.round(point.revenue / 1000)}k</span><div className="crm-bar-track"><div className="crm-bar-fill" style={{ height: `${Math.max((point.revenue / maxRevenue) * 100, 3)}%` }} /></div><span className="crm-bar-label">{point.label}</span></div>)}
              </div>}
            </SectionCard>
            <SectionCard title="Campaign results" subtitle="Campaigns whose scheduled date falls inside the selected date range">
              {data.campaigns.length === 0 ? <EmptyState title="No campaigns in this range" message="Change the date range to view campaign results." /> : <div className="crm-recent-list">{data.campaigns.map((campaign) => <div className="crm-campaign-row" key={campaign.id}><div><strong>{campaign.name}</strong><span>{campaign.channel} · {campaign.conversions} conversions</span></div><div className="crm-campaign-row-end"><strong>{money(campaign.revenue)}</strong><StatusBadge status={campaign.status}/></div></div>)}</div>}
            </SectionCard>
          </div>
          <SectionCard title="Report definitions" subtitle="Current prototype calculation rules">
            <div className="crm-definition-list">{metrics.map((metric) => <div key={metric.label}><strong>{metric.label}</strong><span>{metric.note}</span></div>)}</div>
          </SectionCard>
          <div className="crm-footnote">Sample reporting only. Customer count and repeat-purchase rate currently use all sample customers, while order metrics are date-filtered. Confirm these KPI definitions with the data/backend teammate before final integration. The final report will consume a protected FastAPI aggregated-report endpoint.</div>
        </>
      )}
    </div>
  );
}
export default Analytics;
