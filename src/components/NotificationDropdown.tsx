import { useState, useRef, useEffect } from "react";
import { useNotifications } from "../lib/useNotifications";
import { markAllNotificationsAsRead } from "../lib/api";

function getNotificationIconAndColor(type: string) {
  switch (type) {
    case "TASK_DEADLINE_SOON":
      return { icon: (
        <svg width="18" height="18" fill="none" stroke="#f59e42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      ), color: "#f59e42" };
    case "TASK_OVERDUE":
      return { icon: (
        <svg width="18" height="18" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><circle cx="12" cy="16" r="1"/></svg>
      ), color: "#fee2e2" };
    case "TASK_ASSIGNED":
    default:
      return { icon: (
        <svg width="18" height="18" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9 12l2 2l4-4"/></svg>
      ), color: "#d1fae5" };
  }
}

interface NotificationDropdownProps {
  userName: string;
}

export function NotificationDropdown({ userName }: NotificationDropdownProps) {
  const { notifications, loading, refresh } = useNotifications(userName);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Mark all as read when opening dropdown
  useEffect(() => {
    if (open && notifications.some((n) => !n.read)) {
      markAllNotificationsAsRead(userName).then(() => refresh());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        aria-label="Varsler"
        onClick={() => setOpen((v) => !v)}
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="lucide lucide-bell"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {notifications.filter((n) => !n.read).length > 0 && (
          <span
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              minWidth: 16,
              height: 16,
              background: "red",
              color: "white",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 600,
              lineHeight: 1,
              padding: "0 4px",
              boxShadow: "0 0 0 2px #fff",
              zIndex: 1,
            }}
          >
            {notifications.filter((n) => !n.read).length}
          </span>
        )}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            right: 0,
            marginTop: 8,
            minWidth: 260,
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            boxShadow: "0 4px 24px #0001",
            zIndex: 100,
            maxHeight: 350,
            overflowY: "auto",
          }}
        >
          <div style={{ padding: 12, borderBottom: "1px solid #eee", fontWeight: 600 }}>
            Varsler
          </div>
          {loading ? (
            <div style={{ padding: 16 }}>Laster...</div>
          ) : notifications.length === 0 ? (
            <div style={{ padding: 16, color: "#888" }}>Ingen varsler.</div>
          ) : (
            notifications.map((n) => {
              const { icon, color } = getNotificationIconAndColor(n.type);
              return (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: 12,
                    borderBottom: "1px solid #f3f4f6",
                    background: n.read ? "#f9fafb" : color,
                    fontWeight: n.read ? 400 : 600,
                  }}
                >
                  <span style={{ marginTop: 2 }}>{icon}</span>
                  <span style={{ flex: 1 }}>
                    <div>{n.message}</div>
                    <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{new Date(n.timestamp).toLocaleString()}</div>
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
