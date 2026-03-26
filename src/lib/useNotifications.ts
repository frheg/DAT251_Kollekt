import { useEffect, useState } from "react";
import { api } from "./api";

export interface Notification {
  id: number;
  userName: string;
  message: string;
  type: string;
  timestamp: string;
  read: boolean;
}

export function useNotifications(userName: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.get<Notification[]>(`/notifications/${userName}`);
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName]);

  return { notifications, loading, refresh: fetchNotifications };
}
