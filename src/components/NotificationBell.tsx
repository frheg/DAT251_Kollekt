import { useNotifications } from "../lib/useNotifications";

interface NotificationBellProps {
  userName: string;
}

export function NotificationBell({ userName }: NotificationBellProps) {
  const { notifications, loading } = useNotifications(userName);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div style={{ position: "relative" }}>
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
      {unreadCount > 0 && (
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
          {unreadCount}
        </span>
      )}
      {/* Optionally, show a dropdown with notifications */}
      {/* <NotificationDropdown notifications={notifications} /> */}
    </div>
  );
}
