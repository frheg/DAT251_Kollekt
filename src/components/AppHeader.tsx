import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { User, LogOut, Bell, Mail, ArrowRightLeft, Key, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useUser } from "../context/UserContext";
import { api } from "../lib/api";
import LanguageSwitcher from "./LanguageSwitcher";
import { formatTime } from "../i18n/helpers";
import type { MemberStatus } from "../lib/types";

const pageTitleKeys: Record<string, string> = {
  "/": "app.name",
  "/tasks": "header.pageTitles.tasks",
  "/calendar": "header.pageTitles.calendar",
  "/chat": "header.pageTitles.chat",
  "/economy": "header.pageTitles.economy",
  "/economy/pant": "header.pageTitles.pantTracker",
  "/leaderboard": "header.pageTitles.leaderboard",
  "/games": "header.pageTitles.games",
  "/profile": "header.pageTitles.profile",
};

export default function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const {
    currentUser,
    setCurrentUser,
    handleLogout,
    notifications,
    dismissNotification,
    clearAllNotifications,
    markAllNotificationsRead,
  } = useUser();
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const titleKey = pageTitleKeys[location.pathname] ?? "app.name";
  const title = t(titleKey);
  const isHomePage = location.pathname === "/";

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowNotifs(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleStatusChange = async (status: MemberStatus) => {
    if (!currentUser) return;
    try {
      await api.patch("/members/status", {
        memberName: currentUser.name,
        status,
      });
      setCurrentUser({ ...currentUser, status });
    } catch {}
  };

  const doLogout = async () => {
    setShowMenu(false);
    await handleLogout();
    navigate("/login");
  };

  const handleLeaveCollective = async () => {
    if (!currentUser) return;
    setShowMenu(false);
    try {
      await api.patch(
        `/members/leave-collective?memberName=${encodeURIComponent(currentUser.name)}`,
      );
      setCurrentUser({ ...currentUser, collectiveCode: "" });
      navigate("/create-household");
    } catch {}
  };

  return (
    <header className="sticky top-0 z-40 glass-strong">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <h1 className="min-w-0 flex-1 truncate pr-3 font-display font-bold text-lg tracking-tight">
          {isHomePage ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-7 w-7 overflow-hidden rounded-md shrink-0">
                <img
                  src="/favicon.png"
                  alt={t("app.logoAlt")}
                  className="h-full w-full object-cover scale-125"
                />
              </span>
              <span className="text-gradient">Kollekt</span>
            </span>
          ) : (
            title
          )}
        </h1>

        <div className="flex shrink-0 items-center gap-2" ref={menuRef}>
          <LanguageSwitcher />

          {/* Notification bell */}
          {currentUser && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifs((v) => !v);
                  setShowMenu(false);
                }}
                className="h-9 w-9 rounded-full glass flex items-center justify-center hover:bg-muted/50 transition-colors relative"
                aria-label={t("header.openNotifications")}
              >
                <Bell className="h-4 w-4 text-muted-foreground" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[9px] text-destructive-foreground font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifs && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    className="absolute right-0 top-12 z-50 w-72 glass-strong rounded-xl p-3 shadow-xl space-y-2"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs font-semibold">
                        {t("header.notifications")}
                      </p>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllNotificationsRead}
                            className="text-[10px] text-primary font-medium"
                          >
                            {t("header.markAllRead")}
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            onClick={clearAllNotifications}
                            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors font-medium"
                          >
                            {t("header.clearAll")}
                          </button>
                        )}
                      </div>
                    </div>
                    {notifications.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        {t("header.allCaughtUp")} ✅
                      </p>
                    )}
                    {notifications.slice(0, 6).map((n) => (
                      <div
                        key={n.id}
                        className={`group relative rounded-lg p-2 text-xs ${n.read ? "bg-muted/20" : "bg-primary/10 border border-primary/20"}`}
                      >
                        <button
                          onClick={() => dismissNotification(n.id)}
                          className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/60"
                        >
                          <X className="h-2.5 w-2.5 text-muted-foreground" />
                        </button>
                        <p className="text-foreground pr-4">{n.message}</p>
                        <p className="text-muted-foreground text-[9px] mt-0.5">
                          {formatTime(n.timestamp)}
                        </p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* User avatar button */}
          <div className="relative">
            <button
              onClick={() => {
                setShowMenu((v) => !v);
                setShowNotifs(false);
              }}
              className="h-9 w-9 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors border border-border"
              aria-label={t("header.openAccountMenu")}
            >
              {currentUser ? (
                <span className="text-sm font-bold text-foreground">
                  {currentUser.name[0].toUpperCase()}
                </span>
              ) : (
                <User className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            <AnimatePresence>
              {showMenu && currentUser && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    className="absolute right-0 top-12 z-50 w-56 glass-strong rounded-xl p-1.5 shadow-xl"
                  >
                    {/* User info */}
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-sm font-semibold">
                        {currentUser.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {currentUser.email}
                      </p>
                      <div className="flex gap-1 mt-1">
                        {(["ACTIVE", "AWAY"] as MemberStatus[]).map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(s)}
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium transition-all ${
                              currentUser.status === s
                                ? s === "ACTIVE"
                                  ? "bg-primary/20 text-primary"
                                  : "bg-secondary/20 text-secondary"
                                : "glass text-muted-foreground"
                            }`}
                          >
                            {s === "ACTIVE" ? "🟢" : "🟡"}{" "}
                            {t(`common.memberStatus.${s}`)}
                          </button>
                        ))}
                      </div>
                    </div>

                    {[
                      {
                        label: t("header.profile"),
                        icon: User,
                        action: () => {
                          navigate("/profile");
                          setShowMenu(false);
                        },
                      },
                      {
                        label: t("header.inviteFriends"),
                        icon: Mail,
                        action: () => {
                          navigate("/profile");
                          setShowMenu(false);
                        },
                      },
                      {
                        label: t("header.resetPassword"),
                        icon: Key,
                        action: () => {
                          navigate("/profile");
                          setShowMenu(false);
                        },
                      },
                      {
                        label: t("header.switchCollective"),
                        icon: ArrowRightLeft,
                        action: handleLeaveCollective,
                      },
                    ].map((item) => (
                      <button
                        key={item.label}
                        onClick={item.action}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-muted/50"
                      >
                        <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {item.label}
                      </button>
                    ))}

                    <div className="border-t border-border mt-1 pt-1">
                      <button
                        onClick={doLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        {t("header.logOut")}
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
