import { Bell, CheckCircle2, Clock, IdCard, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PATHS } from "../../router/paths";
import { KPI_DATA } from "../../features/admin/analytics/mockData";

const notifications = [
  { id: "triage", title: "Reports awaiting action", detail: `${KPI_DATA.month.pendingReports} reports need triage or assignment`, icon: Clock, tone: "amber", path: `${PATHS.adminIncidentReports}?queue=pending-triage` },
  { id: "sla", title: "Emergency SLA reminders", detail: "2 verification timers are approaching takeover", icon: ShieldAlert, tone: "red", path: PATHS.adminIncidentReports },
  { id: "verify", title: "Resolution verification", detail: "4 evidence submissions require review", icon: CheckCircle2, tone: "green", path: PATHS.adminResolutionVerification },
  { id: "registration", title: "Registration review", detail: "3 resident applications are pending", icon: IdCard, tone: "blue", path: "/admin/registrations" },
];

export default function AdminNotifications() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState([]);
  const unread = notifications.filter((item) => !read.includes(item.id)).length;

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
      if (event.type === "pointerdown" && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", close);
    return () => {
      document.removeEventListener("keydown", close);
      document.removeEventListener("pointerdown", close);
    };
  }, [open]);

  const openNotification = (item) => {
    setRead((current) => current.includes(item.id) ? current : [...current, item.id]);
    setOpen(false);
    navigate(item.path);
  };

  return <div ref={rootRef} className="admin-notifications print:hidden">
    <button ref={buttonRef} type="button" onClick={() => setOpen((value) => !value)} aria-label={`${unread} unread admin notifications`} aria-expanded={open} className="admin-notifications__trigger">
      <Bell size={17} />
      {unread > 0 && <span>{unread}</span>}
    </button>
    {open && <section className="admin-notifications__panel" aria-label="Admin notifications">
      <div className="admin-notifications__head"><div><strong>Notifications</strong><p>Frontend operational alerts</p></div><button type="button" onClick={() => setRead(notifications.map((item) => item.id))}>Mark all read</button></div>
      <div className="admin-notifications__list">{notifications.map((item) => {
        const Icon = item.icon;
        const isRead = read.includes(item.id);
        return <button key={item.id} type="button" onClick={() => openNotification(item)} className={isRead ? "is-read" : ""}>
          <span className={`admin-notifications__icon is-${item.tone}`}><Icon size={16} /></span>
          <span><strong>{item.title}</strong><small>{item.detail}</small></span>
          {!isRead && <i aria-label="Unread" />}
        </button>;
      })}</div>
    </section>}
  </div>;
}
