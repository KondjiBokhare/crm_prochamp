import { useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { crmAuditLogsMode, getAuditLogs } from "../../services/crmService";
import { EmptyState, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";

function exportCsv(rows) {
  const data = [
    ["Timestamp", "User", "Action", "Entity type", "Entity ID", "Description", "IP address"],
    ...rows.map((item) => [item.createdAt, item.userEmail, item.action, item.entityType, item.entityId, item.description, item.ipAddress]),
  ];
  const csv = data.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "crm-audit-logs.csv"; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}

function AuditLogs() {
  const { authenticatedRequest } = useAuth();
  const isApiMode = crmAuditLogsMode === "api";
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("All");
  const [entityType, setEntityType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const invalidRange = Boolean(startDate && endDate && startDate > endDate);

  useEffect(() => {
    if (!isApiMode) { setItems([]); setLoading(false); setError(""); return undefined; }
    if (invalidRange) { setItems([]); setLoading(false); setError("Start date must be on or before end date."); return undefined; }
    let active = true;
    setLoading(true); setError("");
    getAuditLogs({ action, entityType, startDate, endDate, search }, authenticatedRequest)
      .then((rows) => { if (active) setItems(rows); })
      .catch((loadError) => { if (active) setError(loadError?.message || "Could not load audit logs."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isApiMode, action, entityType, startDate, endDate, search, authenticatedRequest, reloadKey, invalidRange]);

  const actionOptions = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"];
  const visibleRows = useMemo(() => items, [items]);

  return (
    <div className="crm-page">
      <PageHeader title="Audit Logs" description="Read-only history of sensitive changes recorded by Django." action={<button type="button" className="crm-button crm-button-secondary" onClick={() => setReloadKey((key) => key + 1)} disabled={!isApiMode || loading}><RefreshCw size={15}/> Refresh</button>} />
      {!isApiMode ? <div className="crm-error-banner" role="status">Audit Logs API mode is not enabled. Set VITE_CRM_AUDIT_LOGS_MODE=api in frontend/.env.local and restart Vite.</div> : <div className="crm-demo-notice"><ShieldCheck size={15} /> Live read-only Django audit records. Only users authorized by the backend can access this endpoint.</div>}
      {error && <div className="crm-error-banner" role="alert">{error}</div>}
      <SectionCard title="Recorded activity" subtitle={`${visibleRows.length} matching audit record(s)`} action={<button className="crm-button crm-button-secondary crm-button-small" type="button" onClick={() => exportCsv(visibleRows)} disabled={visibleRows.length === 0}><Download size={14}/> Export CSV</button>}>
        <div className="crm-toolbar">
          <label className="crm-search-field"><span className="sr-only">Search audit log</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search user, entity, action or description…" /></label>
          <label className="crm-filter-field"><span>Action</span><select value={action} onChange={(event) => setAction(event.target.value)}><option value="All">All actions</option>{actionOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="crm-filter-field"><span>Entity type</span><input value={entityType} onChange={(event) => setEntityType(event.target.value)} placeholder="Customer, Campaign…" /></label>
          <label className="crm-filter-field"><span>From</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label>
          <label className="crm-filter-field"><span>To</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label>
        </div>
        {loading ? <div className="crm-loading">Loading audit logs…</div> : !isApiMode ? <EmptyState title="Audit API not enabled" message="Enable API mode to read audit events from Django." /> : visibleRows.length === 0 ? <EmptyState title="No audit records found" message="Change the filters or perform a supported CRM action that creates an audit log." /> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Description</th><th>IP address</th></tr></thead><tbody>{visibleRows.map((item) => <tr key={item.id}><td>{item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN") : "—"}</td><td>{item.userEmail}</td><td><StatusBadge status={item.action}/></td><td>{item.entityType}</td><td>{item.entityId}</td><td>{item.description}</td><td>{item.ipAddress}</td></tr>)}</tbody></table></div>}
      </SectionCard>
      <p className="crm-footnote">Audit logs are read-only in this interface. The frontend cannot create, edit or delete audit records. Access enforcement is performed by Django.</p>
    </div>
  );
}

export default AuditLogs;
