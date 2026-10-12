import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, CalendarClock, CheckCheck, Eye, FileText, History, Mail, Pencil, Plus, Send, Smartphone, Trash2, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  crmCommunicationsMode,
  createCommunicationTemplate,
  deleteCommunicationTemplate,
  dispatchCommunication,
  getCommunicationHistory,
  getCommunicationTemplates,
  getNotificationsForUser,
  getSegments,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
  updateCommunicationTemplate,
} from "../../services/crmService";
import { subscribeToNotificationChanges } from "../../services/notificationCenterService";
import { EmptyState, MetricCard, Modal, PageHeader, SectionCard, StatusBadge } from "../../components/crm/CrmUI";

const CHANNELS = ["In-app", "Email", "SMS"];
const TEMPLATE_STATUSES = ["Active", "Draft", "Archived"];
const nowLocal = () => new Date(Date.now() + 5 * 60 * 1000 - new Date().getTimezoneOffset() * 60 * 1000).toISOString().slice(0, 16);
const formatDate = (value) => value ? new Date(value).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const emptyTemplate = { name: "", channel: "In-app", subject: "", body: "", category: "General", status: "Draft" };
const emptyCompose = { templateId: "", channel: "In-app", audience: "all", subject: "", body: "", scheduledAt: "", link: "/products", type: "general" };
const moneyCount = (value) => Number(value || 0).toLocaleString("en-IN");

function channelIcon(channel) {
  if (channel === "Email") return <Mail size={15}/>;
  if (channel === "SMS") return <Smartphone size={15}/>;
  return <BellRing size={15}/>;
}

function Communications() {
  const { user, authenticatedRequest } = useAuth();
  const navigate = useNavigate();
  const actor = user?.name || user?.email || "CRM Staff";
  const [tab, setTab] = useState("compose");
  const [templates, setTemplates] = useState([]);
  const [segments, setSegments] = useState([]);
  const [history, setHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templateChannel, setTemplateChannel] = useState("All");
  const [historySearch, setHistorySearch] = useState("");
  const [historyChannel, setHistoryChannel] = useState("All");
  const [historyStatus, setHistoryStatus] = useState("All");
  const [templateModal, setTemplateModal] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState("");
  const [templateForm, setTemplateForm] = useState(emptyTemplate);
  const [compose, setCompose] = useState(emptyCompose);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [templateRows, segmentRows, historyRows, notificationRows] = await Promise.all([
        getCommunicationTemplates({ search: templateSearch, channel: templateChannel }, authenticatedRequest),
        getSegments(authenticatedRequest),
        getCommunicationHistory({ search: historySearch, channel: historyChannel, status: historyStatus }, authenticatedRequest),
        getNotificationsForUser(user, authenticatedRequest),
      ]);
      setTemplates(Array.isArray(templateRows) ? templateRows : []);
      setSegments(Array.isArray(segmentRows) ? segmentRows : []);
      setHistory(Array.isArray(historyRows) ? historyRows : []);
      setNotifications(Array.isArray(notificationRows) ? notificationRows : []);
    } catch (loadError) {
      setError(loadError.message || "Could not load the communication center.");
    } finally {
      setLoading(false);
    }
  }, [templateSearch, templateChannel, historySearch, historyChannel, historyStatus, user?.email, user?.role, user?.id, authenticatedRequest]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => subscribeToNotificationChanges(async () => {
    try {
      const rows = await getNotificationsForUser(user, authenticatedRequest);
      setNotifications(Array.isArray(rows) ? rows : []);
    } catch { /* the next page reload can retry */ }
  }), [user?.email, user?.role, user?.id, authenticatedRequest]);

  useEffect(() => {
    if (!compose.templateId) return;
    const selectedTemplate = templates.find((template) => String(template.id) === String(compose.templateId));
    if (selectedTemplate) {
      const category = String(selectedTemplate.category || "").toLowerCase();
      const type = category === "marketing" ? "offer" : category === "support" ? "support" : category === "transactional" ? "order" : "general";
      setCompose((current) => ({ ...current, channel: selectedTemplate.channel, subject: selectedTemplate.subject, body: selectedTemplate.body, type }));
    }
  }, [compose.templateId, templates]);

  const unread = notifications.filter((item) => !item.read).length;
  const scheduledCount = history.filter((item) => item.status === "Scheduled").length;
  const recentCount = history.filter((item) => ["Sent (demo)", "Simulated", "Recorded (not sent)"].includes(item.status)).length;
  const filteredTemplates = useMemo(() => templates.filter((item) => item.status !== "Archived"), [templates]);

  const openNewTemplate = () => {
    setError(""); setNotice(""); setEditingTemplateId(""); setTemplateForm(emptyTemplate); setTemplateModal(true);
  };
  const openEditTemplate = (template) => {
    setError(""); setNotice(""); setEditingTemplateId(template.id); setTemplateForm({ name: template.name, channel: template.channel, subject: template.subject, body: template.body, category: template.category || "General", status: template.status }); setTemplateModal(true);
  };

  async function saveTemplate(event) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      if (editingTemplateId) await updateCommunicationTemplate(editingTemplateId, templateForm, authenticatedRequest);
      else await createCommunicationTemplate(templateForm, authenticatedRequest);
      setTemplateModal(false);
      setNotice(editingTemplateId ? "Template updated." : "Template created.");
      await load();
    } catch (saveError) { setError(saveError.message || "Could not save the template."); }
    finally { setSaving(false); }
  }

  async function removeTemplate(template) {
    if (!window.confirm(`Delete template “${template.name}”?`)) return;
    setError(""); setNotice("");
    try {
      await deleteCommunicationTemplate(template.id, authenticatedRequest);
      if (compose.templateId === template.id) setCompose((current) => ({ ...current, templateId: "" }));
      setNotice("Template deleted."); await load();
    } catch (deleteError) { setError(deleteError.message || "Could not delete the template."); }
  }

  async function sendMessage(event, schedule = false) {
    event?.preventDefault?.();
    setSaving(true); setError(""); setNotice("");
    try {
      if (schedule && !compose.scheduledAt) throw new Error("Choose a future date and time to schedule the message.");
      const payload = { ...compose, scheduledAt: schedule ? compose.scheduledAt : "" };
      const record = await dispatchCommunication(payload, actor, authenticatedRequest);
      if (crmCommunicationsMode === "api") {
        setNotice(record.status === "Scheduled"
          ? `Schedule record saved for ${formatDate(record.scheduledAt)}. No background worker is configured, so this is not queued for delivery.`
          : `Communication request recorded for ${moneyCount(record.recipientCount)} customer record(s). No email/SMS provider or customer notification delivery was invoked.`);
      } else if (record.status === "Scheduled") {
        setNotice(`Message scheduled for ${formatDate(record.scheduledAt)}. This browser demo does not run a background scheduler.`);
      } else if (record.channel === "In-app") {
        setNotice(`In-app demo notification created for ${moneyCount(record.recipientCount)} customer record(s). It will appear in the customer notification bell when the recipient is in scope.`);
      } else {
        setNotice(`${record.channel} message recorded as simulated. No external email/SMS provider was contacted.`);
      }
      setCompose(emptyCompose);
      await load();
    } catch (sendError) { setError(sendError.message || "Could not process this communication."); }
    finally { setSaving(false); }
  }

  async function markOneRead(id) {
    try {
      await markNotificationReadForUser(id, user, authenticatedRequest);
      setNotifications(await getNotificationsForUser(user, authenticatedRequest));
    } catch (markError) { setError(markError.message || "Could not mark notification as read."); }
  }
  async function markAllRead() {
    try {
      await markAllNotificationsReadForUser(user, authenticatedRequest);
      setNotifications(await getNotificationsForUser(user, authenticatedRequest));
      setNotice("All notifications marked as read.");
    } catch (markError) { setError(markError.message || "Could not mark notifications as read."); }
  }
  async function openNotification(item) {
    await markOneRead(item.id);
    if (item.link) navigate(item.link);
  }

  return <div className="crm-page crm-communications-page">
    <PageHeader title="Communications" description="Manage reusable message templates, record communication requests, review history and monitor CRM notifications." action={<button className="crm-button crm-button-primary" type="button" onClick={openNewTemplate}><Plus size={15}/> New template</button>}/>
    {crmCommunicationsMode === "api" ? <div className="crm-demo-notice">API mode · Templates, history and staff notifications are stored in Django. Email/SMS delivery and scheduled execution are not configured; dispatch records do not mean a message was sent.</div> : <div className="crm-demo-notice">Demo mode · In-app messages create browser-local notifications. Email/SMS and scheduled sends are recorded only; no provider or background worker is running.</div>}
    {error && !templateModal && <div className="crm-error-banner" role="alert">{error}</div>}
    {notice && <div className="crm-success-banner" role="status">{notice}</div>}

    <div className="crm-metrics-grid crm-metrics-three">
      <MetricCard label="Active templates" value={templates.filter((item) => item.status === "Active").length} note={`${templates.length} templates available`} tone="blue"/>
      <MetricCard label="Messages processed" value={recentCount} note="Simulated / in-app demo records" tone="green"/>
      <MetricCard label="Scheduled messages" value={scheduledCount} note="Saved schedule records; no browser scheduler" tone="purple"/>
    </div>

    <div className="crm-comm-tabs" role="tablist" aria-label="Communication sections">
      <button type="button" className={tab === "compose" ? "active" : ""} onClick={() => setTab("compose")}><Send size={15}/> Compose</button>
      <button type="button" className={tab === "templates" ? "active" : ""} onClick={() => setTab("templates")}><FileText size={15}/> Templates</button>
      <button type="button" className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><History size={15}/> History</button>
      <button type="button" className={tab === "notifications" ? "active" : ""} onClick={() => setTab("notifications")}><BellRing size={15}/> CRM notifications {unread > 0 && <span className="crm-comm-tab-badge">{unread}</span>}</button>
    </div>

    {tab === "compose" && <SectionCard title="Compose customer communication" subtitle={crmCommunicationsMode === "api" ? "Choose a channel and customer audience. API mode records the request only; this phase does not send email/SMS or customer in-app notifications." : "Choose a channel and customer audience. In-app is the only channel that produces a visible demo notification."}>
      <form className="crm-comm-compose" onSubmit={(event) => sendMessage(event, false)}>
        <div className="crm-comm-form-grid">
          <label className="crm-form-field"><span>Template (optional)</span><select value={compose.templateId} onChange={(event) => setCompose((current) => ({ ...current, templateId: event.target.value }))}><option value="">Write from scratch</option>{filteredTemplates.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.channel}</option>)}</select></label>
          <label className="crm-form-field"><span>Channel *</span><select value={compose.channel} onChange={(event) => setCompose((current) => ({ ...current, channel: event.target.value }))}>{CHANNELS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="crm-form-field"><span>Audience *</span><select value={compose.audience} onChange={(event) => setCompose((current) => ({ ...current, audience: event.target.value }))}><option value="all">All customers</option>{segments.filter((item) => item.status === "Active").map((segment) => <option key={segment.id} value={`segment:${segment.id}`}>{segment.name}</option>)}</select></label>
          <label className="crm-form-field"><span>Message type *</span><select value={compose.type} onChange={(event) => setCompose((current) => ({ ...current, type: event.target.value }))}><option value="general">General update</option><option value="order">Transactional / order update</option><option value="support">Support update</option><option value="offer">Marketing / offers</option></select></label>
          <label className="crm-form-field"><span>CTA link (optional)</span><select value={compose.link} onChange={(event) => setCompose((current) => ({ ...current, link: event.target.value }))}><option value="/products">Products</option><option value="/orders">My Orders</option><option value="/support">Support</option><option value="/">Homepage</option></select></label>
          <label className="crm-form-field crm-comm-span-two"><span>Subject / notification title *</span><input value={compose.subject} onChange={(event) => setCompose((current) => ({ ...current, subject: event.target.value }))} maxLength={160} required placeholder="e.g. New graphics card deals"/></label>
          <label className="crm-form-field crm-comm-span-two"><span>Message *</span><textarea value={compose.body} onChange={(event) => setCompose((current) => ({ ...current, body: event.target.value }))} minLength={5} maxLength={3000} rows={5} required placeholder="Write a clear message for customers…"/><small>{compose.body.length}/3000 characters</small></label>
          <label className="crm-form-field"><span>Schedule for (optional)</span><input type="datetime-local" min={nowLocal()} value={compose.scheduledAt} onChange={(event) => setCompose((current) => ({ ...current, scheduledAt: event.target.value }))}/></label>
          <div className="crm-comm-send-info"><Users size={16}/><span>{compose.audience === "all" ? `All ${segments.length ? "customer" : "available customer"} records in the demo catalogue` : `Selected active segment: ${segments.find((item) => `segment:${item.id}` === compose.audience)?.name || "segment"}`}. In demo mode, real email/SMS is never sent.</span></div>
        </div>
        <div className="crm-form-actions"><button className="crm-button crm-button-secondary" type="button" onClick={() => setCompose(emptyCompose)}>Clear form</button><button className="crm-button crm-button-secondary" type="button" disabled={saving || !compose.scheduledAt} onClick={(event) => sendMessage(event, true)}><CalendarClock size={15}/> Schedule</button><button className="crm-button crm-button-primary" type="submit" disabled={saving}>{saving ? "Processing…" : <><Send size={15}/> {crmCommunicationsMode === "api" ? "Record communication request" : "Send demo now"}</>}</button></div>
      </form>
    </SectionCard>}

    {tab === "templates" && <SectionCard title="Reusable message templates" subtitle="Create and maintain transactional, support and marketing content. Template changes are saved in Django when API mode is enabled.">
      <div className="crm-toolbar"><label className="crm-search-field"><span className="sr-only">Search templates</span><input value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} placeholder="Search templates…"/></label><label className="crm-filter-field"><span>Channel</span><select value={templateChannel} onChange={(event) => setTemplateChannel(event.target.value)}><option>All</option>{CHANNELS.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      {loading ? <div className="crm-loading">Loading templates…</div> : templates.length === 0 ? <EmptyState title="No templates" message="Create a reusable template to get started."/> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Template</th><th>Channel</th><th>Category</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{templates.map((template) => <tr key={template.id}><td><strong>{template.name}</strong><small className="crm-cell-subtext">{template.subject || template.id}</small></td><td><span className="crm-comm-channel">{channelIcon(template.channel)}{template.channel}</span></td><td>{template.category}</td><td><StatusBadge status={template.status}/></td><td>{template.updatedAt || "—"}</td><td><div className="crm-comm-row-actions"><button type="button" className="crm-button crm-button-small crm-button-secondary" onClick={() => openEditTemplate(template)}><Pencil size={13}/> Edit</button><button type="button" className="crm-button crm-button-small crm-button-danger" onClick={() => removeTemplate(template)}><Trash2 size={13}/> Delete</button><button type="button" className="crm-button crm-button-small crm-button-secondary" onClick={() => { setCompose((current) => ({ ...current, templateId: template.id })); setTab("compose"); }}><Eye size={13}/> Use</button></div></td></tr>)}</tbody></table></div>}
    </SectionCard>}

    {tab === "history" && <SectionCard title="Communication history" subtitle="A demo record is not proof that an email/SMS was delivered. Provider delivery receipts belong to the backend integration.">
      <div className="crm-toolbar"><label className="crm-search-field"><span className="sr-only">Search communication history</span><input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search subject, audience or ID…"/></label><label className="crm-filter-field"><span>Channel</span><select value={historyChannel} onChange={(event) => setHistoryChannel(event.target.value)}><option>All</option>{CHANNELS.map((item) => <option key={item}>{item}</option>)}</select></label><label className="crm-filter-field"><span>Status</span><select value={historyStatus} onChange={(event) => setHistoryStatus(event.target.value)}><option>All</option>{["Sent (demo)", "Simulated", "Recorded (not sent)", "Scheduled"].map((item) => <option key={item}>{item}</option>)}</select></label></div>
      {loading ? <div className="crm-loading">Loading history…</div> : history.length === 0 ? <EmptyState title="No communication activity" message="Send a demo in-app message or schedule a record to see activity here."/> : <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Message</th><th>Channel</th><th>Audience</th><th>Recipients</th><th>Status</th><th>Schedule / Created</th><th>Owner</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td><strong>{item.subject}</strong><small className="crm-cell-subtext">{item.id}</small></td><td><span className="crm-comm-channel">{channelIcon(item.channel)}{item.channel}</span></td><td>{item.audience}</td><td>{moneyCount(item.recipientCount)}</td><td><StatusBadge status={item.status}/></td><td>{formatDate(item.scheduledAt || item.createdAt)}</td><td>{item.actor || "—"}</td></tr>)}</tbody></table></div>}
    </SectionCard>}

    {tab === "notifications" && <SectionCard title="CRM notifications" subtitle="New support tickets and customer replies appear here for authorized staff. Read state is kept per signed-in staff account when API mode is enabled.">
      <div className="crm-comm-notification-actions"><span>{unread} unread alert{unread === 1 ? "" : "s"}</span>{unread > 0 && <button className="crm-button crm-button-secondary" type="button" onClick={markAllRead}><CheckCheck size={15}/> Mark all as read</button>}</div>
      {notifications.length === 0 ? <EmptyState title="No CRM notifications" message="A new support ticket or staff reply can create a persistent CRM notification when API mode is enabled."/> : <div className="crm-comm-notification-list">{notifications.map((item) => <article className={`crm-comm-notification ${item.read ? "read" : "unread"}`} key={item.id}><div className="crm-comm-notification-icon"><BellRing size={17}/></div><div className="crm-comm-notification-content"><div className="crm-comm-notification-title"><strong>{item.title}</strong>{!item.read && <span className="crm-unread-dot"/>}</div><p>{item.message}</p><small>{formatDate(item.createdAt)}</small></div><div className="crm-comm-notification-actions">{!item.read && <button className="crm-button crm-button-small crm-button-secondary" type="button" onClick={() => markOneRead(item.id)}>Mark read</button>}{item.link && <button className="crm-button crm-button-small crm-button-secondary" type="button" onClick={() => openNotification(item)}>Open</button>}</div></article>)}</div>}
    </SectionCard>}

    {templateModal && <Modal title={editingTemplateId ? "Edit template" : "New message template"} description="Use clear content. Placeholders such as {{customer_name}} remain text until the backend template renderer is added." onClose={() => setTemplateModal(false)} width="720px">
      <form className="crm-comm-template-form" onSubmit={saveTemplate}>
        <div className="crm-comm-form-grid">
          <label className="crm-form-field"><span>Template name *</span><input required minLength={3} maxLength={100} value={templateForm.name} onChange={(event) => setTemplateForm((current) => ({ ...current, name: event.target.value }))} /></label>
          <label className="crm-form-field"><span>Channel *</span><select value={templateForm.channel} onChange={(event) => setTemplateForm((current) => ({ ...current, channel: event.target.value }))}>{CHANNELS.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="crm-form-field"><span>Category</span><select value={templateForm.category} onChange={(event) => setTemplateForm((current) => ({ ...current, category: event.target.value }))}>{["Transactional", "Support", "Marketing", "General"].map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="crm-form-field"><span>Status</span><select value={templateForm.status} onChange={(event) => setTemplateForm((current) => ({ ...current, status: event.target.value }))}>{TEMPLATE_STATUSES.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="crm-form-field crm-comm-span-two"><span>Subject / title *</span><input required maxLength={160} value={templateForm.subject} onChange={(event) => setTemplateForm((current) => ({ ...current, subject: event.target.value }))} /></label>
          <label className="crm-form-field crm-comm-span-two"><span>Message body *</span><textarea required minLength={5} maxLength={3000} rows={5} value={templateForm.body} onChange={(event) => setTemplateForm((current) => ({ ...current, body: event.target.value }))} /></label>
        </div>
        {error && <div className="crm-error-banner" role="alert">{error}</div>}
        <div className="crm-form-actions"><button type="button" className="crm-button crm-button-secondary" onClick={() => setTemplateModal(false)}>Cancel</button><button type="submit" className="crm-button crm-button-primary" disabled={saving}>{saving ? "Saving…" : "Save template"}</button></div>
      </form>
    </Modal>}
  </div>;
}

export default Communications;
