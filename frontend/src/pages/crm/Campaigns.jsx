import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { crmCampaignsMode, crmCampaignResponsesMode, createCampaign, getCampaigns, getSegments, getCampaignResponses, simulateCampaignLaunch } from "../../services/crmService";
import { EmptyState, MetricCard, Modal, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";

const money = (amount) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; };
const emptyForm = { name: "", channel: "Email", segmentId: "", date: today(), subject: "", message: "", description: "" };

function Campaigns() {
  const { authenticatedRequest, hasRole } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [segments, setSegments] = useState([]);
  const [campaignResponses, setCampaignResponses] = useState([]);
  const [campaignResponsesError, setCampaignResponsesError] = useState("");
  const [responseSearch, setResponseSearch] = useState("");
  const [responseStatus, setResponseStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("All");
  const [status, setStatus] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const isApiMode = crmCampaignsMode === "api";
  const canManage = !isApiMode || hasRole(["ADMIN", "MARKETING_MANAGER"]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const campaignResponseRequest = crmCampaignResponsesMode === "api"
      ? getCampaignResponses({}, authenticatedRequest)
          .then((rows) => ({ rows, error: "" }))
          .catch((responseLoadError) => ({ rows: [], error: responseLoadError?.message || "Could not load campaign responses." }))
      : Promise.resolve({ rows: [], error: "" });
    Promise.all([
      getCampaigns({ search, channel, status }, authenticatedRequest),
      getSegments(authenticatedRequest),
      campaignResponseRequest,
    ])
      .then(([campaignResult, segmentResult, responseResult]) => { if (active) { setCampaigns(campaignResult); setSegments(segmentResult); setCampaignResponses(responseResult.rows || []); setCampaignResponsesError(responseResult.error || ""); } })
      .catch((err) => { if (active) setError(err.message || "Could not load campaigns."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [search, channel, status, reloadKey, authenticatedRequest]);

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const campaign = await createCampaign(form, authenticatedRequest);
      setForm(emptyForm);
      setShowCreate(false);
      setNotice(isApiMode
        ? `Campaign “${campaign.name}” saved in Django as ${campaign.status}. No email/SMS was sent.`
        : `Campaign “${campaign.name}” scheduled for ${campaign.date}. No actual message was sent.`);
      setSearch(""); setChannel("All"); setStatus("All"); setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err.message || "Could not create campaign.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLaunch(campaign) {
    const prompt = isApiMode
      ? `Move “${campaign.name}” to Running status? This updates the backend record only; it will not send email/SMS.`
      : `Simulate launch for “${campaign.name}”? This only changes demo records; it will not send real messages.`;
    if (!window.confirm(prompt)) return;
    try {
      await simulateCampaignLaunch(campaign.apiId || campaign.id, authenticatedRequest);
      setNotice(isApiMode
        ? `Campaign “${campaign.name}” status updated. No message was dispatched because a delivery worker/provider is not configured in this backend.`
        : `Demo launch simulated for “${campaign.name}”. No email/SMS was sent.`);
      setReloadKey((key) => key + 1);
    } catch (err) {
      setError(err.message || "Could not update campaign status.");
    }
  }

  const revenue = campaigns.reduce((sum, campaign) => sum + (Number(campaign.revenue) || 0), 0);
  const conversions = campaigns.reduce((sum, campaign) => sum + (Number(campaign.conversions) || 0), 0);
  const sent = campaigns.reduce((sum, campaign) => sum + (Number(campaign.sent) || 0), 0);
  const openCreate = () => { setError(""); setNotice(""); setForm({ ...emptyForm, date: today() }); setShowCreate(true); };

  return (
    <div className="crm-page">
      <PageHeader title="Campaigns" description="Plan customer communications and review campaign status." action={canManage ? <button type="button" className="crm-button crm-button-primary" onClick={openCreate}>+ New campaign</button> : null} />
      <div className="crm-demo-notice">{isApiMode ? "Live Django mode · campaign metadata and status are stored in PostgreSQL. This backend does not dispatch real messages or persist delivery metrics." : "Demo mode · creating or launching a campaign only changes local sample data. No real email/SMS is sent."}</div>
      {notice && <div className="crm-success-banner" role="status">{notice}</div>}
      {error && !showCreate && <div className="crm-error-banner" role="alert">{error}</div>}
      <div className="crm-metrics-grid crm-metrics-three">
        <MetricCard label="Campaigns" value={campaigns.length} note={isApiMode ? "Live backend records" : "Matching sample records"} tone="blue"/>
        <MetricCard label={isApiMode ? "Messages sent" : "Messages recorded as sent"} value={isApiMode ? "—" : sent.toLocaleString("en-IN")} note={isApiMode ? "Delivery API not implemented" : "Mock delivery count"} tone="purple"/>
        <MetricCard label={isApiMode ? "Conversions / revenue" : "Attributed revenue"} value={isApiMode ? "—" : money(revenue)} note={isApiMode ? "Campaign attribution not available" : `${conversions} sample conversions`} tone="green"/>
      </div>
      <SectionCard title="Campaign records" subtitle={isApiMode ? "Live records. Status controls do not send messages." : "Filter campaign records and simulate a launch in demo mode."}>
        <div className="crm-toolbar">
          <label className="crm-search-field"><span className="sr-only">Search campaigns</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search campaign name or ID…" /></label>
          <label className="crm-filter-field"><span>Channel</span><select value={channel} onChange={(event) => setChannel(event.target.value)}>{["All", "Email", "SMS", ...(isApiMode ? ["WhatsApp", "Push notification"] : ["In-app"])].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="crm-filter-field"><span>Status</span><select value={status} onChange={(event) => setStatus(event.target.value)}>{["All", "Draft", "Scheduled", "Active", "Completed", ...(isApiMode ? ["Cancelled"] : [])].map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        {loading ? <div className="crm-loading">Loading campaigns…</div> : campaigns.length === 0 ? <EmptyState title="No campaigns found" message="Try another search or filter, or create a campaign." /> : (
          <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Campaign</th><th>Channel</th><th>Audience</th><th>Sent</th><th>Conversions</th><th>Revenue</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>
            {campaigns.map((campaign) => <tr key={campaign.id}><td><strong>{campaign.name}</strong><small className="crm-cell-subtext">{campaign.segmentName || campaign.id}</small></td><td>{campaign.channel}</td><td>{Number(campaign.audience || 0).toLocaleString("en-IN")}</td><td>{isApiMode ? "—" : Number(campaign.sent || 0).toLocaleString("en-IN")}</td><td>{isApiMode ? "—" : Number(campaign.conversions || 0)}</td><td>{isApiMode ? "—" : money(campaign.revenue)}</td><td><StatusBadge status={campaign.status}/></td><td>{campaign.date || "—"}</td><td>{canManage && ["Scheduled", "Draft"].includes(campaign.status) ? <button type="button" className="crm-button crm-button-small crm-button-secondary" onClick={() => handleLaunch(campaign)}>{isApiMode ? "Set running" : "Simulate launch"}</button> : <span className="crm-muted-cell">—</span>}</td></tr>)}
          </tbody></table></div>
        )}
      </SectionCard>

      {crmCampaignResponsesMode === "api" && <SectionCard title="Campaign response activity" subtitle="Read-only response events from Django. These records do not imply that an email/SMS was sent by this frontend.">
        <div className="crm-toolbar">
          <label className="crm-search-field"><span className="sr-only">Search campaign responses</span><input value={responseSearch} onChange={(event) => setResponseSearch(event.target.value)} placeholder="Search campaign, customer or metadata…" /></label>
          <label className="crm-filter-field"><span>Response status</span><select value={responseStatus} onChange={(event) => setResponseStatus(event.target.value)}><option value="All">All statuses</option>{["SENT", "DELIVERED", "OPENED", "CLICKED", "CONVERTED", "FAILED", "UNSUBSCRIBED"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        </div>
        <div className="crm-demo-notice">{campaignResponses.length} response event(s) returned by Django. This backend includes no email/SMS delivery worker; events must be produced by a backend workflow or seeded for testing.</div>
        {campaignResponsesError && <div className="crm-error-banner" role="alert">{campaignResponsesError}</div>}
        {(() => {
          const query = responseSearch.trim().toLowerCase();
          const filtered = campaignResponses.filter((item) => {
            const matchesStatus = responseStatus === "All" || item.statusCode === responseStatus;
            const matchesSearch = !query || [item.campaignName, item.customerName, item.id, item.status, JSON.stringify(item.metadata)].some((value) => String(value || "").toLowerCase().includes(query));
            return matchesStatus && matchesSearch;
          });
          return filtered.length === 0 ? <EmptyState title="No campaign response events" message="Change the filter or wait until the backend has recorded campaign activity." /> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Campaign</th><th>Customer</th><th>Status</th><th>Response date</th><th>Metadata</th></tr></thead><tbody>{filtered.map((item) => <tr key={item.id}><td><strong>{item.campaignName}</strong><small className="crm-cell-subtext">ID {item.campaignId}</small></td><td>{item.customerName}<small className="crm-cell-subtext">ID {item.customerId}</small></td><td><StatusBadge status={item.status}/></td><td>{item.responseDate ? new Date(item.responseDate).toLocaleString("en-IN") : "—"}</td><td>{Object.keys(item.metadata || {}).length ? JSON.stringify(item.metadata) : "—"}</td></tr>)}</tbody></table></div>;
        })()}
      </SectionCard>}

      {showCreate && <Modal title="Schedule campaign" description={isApiMode ? "Creates a campaign record in Django. A delivery provider/worker is not included yet." : "Create a local demo campaign. Messaging integration will be added later."} onClose={() => setShowCreate(false)}>
        <form className="crm-form" onSubmit={handleCreate}>
          <label className="crm-form-field"><span>Campaign name *</span><input required maxLength={150} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Laptop upgrade week" /></label>
          <div className="crm-form-grid">
            <label className="crm-form-field"><span>Channel</span><select value={form.channel} onChange={(event) => setForm({ ...form, channel: event.target.value })}><option>Email</option><option>SMS</option>{isApiMode ? <><option>WhatsApp</option><option>Push notification</option></> : <option>In-app</option>}</select></label>
            <label className="crm-form-field"><span>Schedule date *</span><input type="date" required min={today()} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
          </div>
          <label className="crm-form-field"><span>Customer segment {isApiMode ? "*" : "(optional)"}</span><select value={form.segmentId} required={isApiMode} onChange={(event) => setForm({ ...form, segmentId: event.target.value })}>{!isApiMode && <option value="">All customers (demo)</option>}{segments.filter((segment) => isApiMode ? segment.status === "Active" : true).map((segment) => <option key={segment.id} value={segment.id}>{segment.name} ({Number(segment.customers || 0).toLocaleString("en-IN")})</option>)}</select></label>
          {isApiMode && <>
            <label className="crm-form-field"><span>Email subject *</span><input required maxLength={200} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Subject / message title" /></label>
            <label className="crm-form-field"><span>Message content *</span><textarea required rows="4" maxLength={10000} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Write the campaign message. Saving it does not send it." /></label>
          </>}
          {segments.length === 0 && isApiMode && <div className="crm-error-banner" role="alert">Create an active customer segment first; the Django Campaign model requires a segment.</div>}
          {error && <div className="crm-error-banner" role="alert">{error}</div>}
          <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="crm-button crm-button-primary" disabled={saving || (isApiMode && segments.filter((segment) => segment.status === "Active").length === 0)}>{saving ? "Saving…" : "Save campaign"}</button></div>
        </form>
      </Modal>}
    </div>
  );
}
export default Campaigns;
