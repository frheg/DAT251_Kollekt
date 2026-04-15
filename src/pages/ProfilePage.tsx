import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Mail,
  Key,
  LogOut,
  Trash2,
  ArrowRightLeft,
  Copy,
  Check,
  ChevronDown,
  UserPlus,
  UserMinus,
  Settings,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  api,
  getNotificationPreferences,
  updateNotificationPreference,
  getUserMessage,
} from "../lib/api";
import { useUser } from "../context/UserContext";
import { formatDateTime, translateKey } from "../i18n/helpers";
import type {
  AppUser,
  MemberStatus,
  NotificationPreferences,
  LeaderboardPlayer,
  Achievement,
} from "../lib/types";

const STATUS_OPTIONS: { value: MemberStatus; emoji: string }[] = [
  { value: "ACTIVE", emoji: "🟢" },
  { value: "AWAY", emoji: "🟡" },
];

const NOTIFICATION_TYPES = [
  "TASK_ASSIGNED",
  "TASK_DEADLINE_SOON",
  "TASK_OVERDUE",
  "NEW_MESSAGE",
  "EXPENSE_OWED",
  "EXPENSE_DEADLINE_SOON",
  "EXPENSE_OVERDUE",
  "SHOPPING_ITEM_ADDED",
  "EVENT_ADDED",
] as const;

export default function ProfilePage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const {
    currentUser,
    setCurrentUser,
    handleLogout,
    notifications,
    notificationsLoading,
    dismissNotification,
    clearAllNotifications,
    markAllNotificationsRead,
  } = useUser();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [expandNotifs, setExpandNotifs] = useState(false);
  const [expandNotifPrefs, setExpandNotifPrefs] = useState(false);
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>({});
  const [expandInvite, setExpandInvite] = useState(false);
  const [expandPassword, setExpandPassword] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [friendName, setFriendName] = useState("");
  const [friendError, setFriendError] = useState("");
  const [myStats, setMyStats] = useState<LeaderboardPlayer | null>(null);
  const [achievementsUnlocked, setAchievementsUnlocked] = useState(0);
  const [achievementsTotal, setAchievementsTotal] = useState(0);

  const name = currentUser?.name ?? "";

  useEffect(() => {
    if (!name) return;
    getNotificationPreferences(name).then(setNotifPrefs).catch(() => {});
    Promise.all([
      api.get<{ players: LeaderboardPlayer[] }>(`/leaderboard?memberName=${encodeURIComponent(name)}&period=OVERALL`),
      api.get<Achievement[]>(`/achievements?memberName=${encodeURIComponent(name)}`),
    ]).then(([lb, ach]) => {
      setMyStats(lb.players.find((p) => p.name === name) ?? null);
      setAchievementsUnlocked(ach.filter((a) => a.unlocked).length);
      setAchievementsTotal(ach.length);
    }).catch(() => {});
  }, [name]);

  const handleToggleNotifPref = async (type: string, enabled: boolean) => {
    if (!name) return;
    const updated = { ...notifPrefs, [type]: enabled };
    setNotifPrefs(updated);
    await updateNotificationPreference(name, updated).catch(() => {});
  };

  const handleStatusChange = async (status: MemberStatus) => {
    if (!currentUser) return;
    try {
      await api.patch("/members/status", { memberName: name, status });
      setCurrentUser({ ...currentUser, status });
    } catch {}
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentUser?.collectiveCode) return;
    await api.post("/members/invite", {
      email: inviteEmail.trim(),
      collectiveCode: currentUser.collectiveCode,
    });
    setInviteEmail("");
    setInviteSent(true);
    setTimeout(() => setInviteSent(false), 3000);
  };

  const handleResetPassword = async () => {
    setPwError("");
    if (newPassword.length < 6) {
      setPwError(t("profile.errors.passwordTooShort"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError(t("profile.errors.passwordsMismatch"));
      return;
    }
    try {
      await api.patch(
        `/members/reset-password?memberName=${encodeURIComponent(name)}`,
        { newPassword },
      );
      setNewPassword("");
      setConfirmPassword("");
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (error: unknown) {
      setPwError(
        getUserMessage(error, t("profile.errors.passwordUpdateFailed")),
      );
    }
  };

  const addFriend = async () => {
    setFriendError("");
    const trimmed = friendName.trim();
    if (!trimmed || !currentUser) return;
    try {
      await api.post(
        `/members/friends/add?memberName=${encodeURIComponent(name)}`,
        { friendName: trimmed },
      );
      const refreshed = await api.get<AppUser>("/onboarding/me");
      setCurrentUser(refreshed);
      setFriendName("");
    } catch (error: unknown) {
      setFriendError(getUserMessage(error, t("profile.errors.addFriendFailed")));
    }
  };

  const removeFriend = async (friend: string) => {
    if (!currentUser) return;
    try {
      await api.delete(
        `/members/friends/remove?memberName=${encodeURIComponent(name)}&friendName=${encodeURIComponent(friend)}`,
      );
      const refreshed = await api.get<AppUser>("/onboarding/me");
      setCurrentUser(refreshed);
    } catch {}
  };

  const handleCopyCode = () => {
    if (!currentUser?.collectiveCode) return;
    void navigator.clipboard.writeText(currentUser.collectiveCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleLeave = async () => {
    if (!currentUser) return;
    try {
      await api.patch(
        `/members/leave-collective?memberName=${encodeURIComponent(name)}`,
      );
      setCurrentUser({ ...currentUser, collectiveCode: "" });
      navigate("/create-household");
    } catch {}
  };

  const handleDelete = async () => {
    if (!window.confirm(t("profile.deleteConfirm"))) return;
    setDeleting(true);
    try {
      await api.delete(`/members/delete?memberName=${encodeURIComponent(name)}`);
      await handleLogout();
      navigate("/login");
    } catch {
      setDeleting(false);
    }
  };

  const doLogout = async () => {
    await handleLogout();
    navigate("/login");
  };

  const unread = notifications.filter((notification) => !notification.read).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 pt-4 pb-8"
    >
      <div className="glass rounded-2xl p-5 glow-primary">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center text-2xl font-display font-bold text-primary-foreground shrink-0">
            {name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-xl font-bold">{name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {currentUser?.email}
            </p>
            <div className="flex gap-1.5 mt-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status.value}
                  onClick={() => handleStatusChange(status.value)}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${
                    currentUser?.status === status.value
                      ? status.value === "ACTIVE"
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "bg-secondary/20 text-secondary border border-secondary/30"
                      : "glass text-muted-foreground"
                  }`}
                >
                  {status.emoji}{" "}
                  {translateKey("common.memberStatus", status.value)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {currentUser?.collectiveCode && (
          <div className="mt-4 flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2">
            <div>
              <p className="text-[10px] text-muted-foreground">
                {t("profile.householdCode")}
              </p>
              <p className="font-display font-bold text-sm tracking-widest">
                {currentUser.collectiveCode}
              </p>
            </div>
            <button
              onClick={handleCopyCode}
              className="h-8 w-8 rounded-lg glass flex items-center justify-center"
              aria-label={t("profile.copyHouseholdCode")}
            >
              {codeCopied ? (
                <Check className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
          </div>
        )}
      </div>

      {myStats && (
        <div className="glass rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-background/30 rounded-lg p-2.5 text-center">
              <p className="font-display font-bold text-base">{myStats.xp}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">XP</p>
            </div>
            <div className="bg-background/30 rounded-lg p-2.5 text-center">
              <p className="font-display font-bold text-base">#{myStats.rank}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Rank</p>
            </div>
            <div className="bg-background/30 rounded-lg p-2.5 text-center">
              <p className="font-display font-bold text-base">{myStats.level}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Level</p>
            </div>
            <div className="bg-background/30 rounded-lg p-2.5 text-center">
              <p className="font-display font-bold text-base">{myStats.tasksCompleted}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Tasks done</p>
            </div>
            <div className="bg-background/30 rounded-lg p-2.5 text-center">
              <p className="font-display font-bold text-base">{myStats.streak}d</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Streak</p>
            </div>
            <div className="bg-background/30 rounded-lg p-2.5 text-center">
              <p className="font-display font-bold text-base">{achievementsUnlocked}/{achievementsTotal}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">Achievements</p>
            </div>
          </div>
        </div>
      )}

      <div className="glass rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpandNotifs((value) => !value)}
          className="w-full flex items-center gap-3 p-4"
        >
          <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center relative shrink-0">
            <Bell className="h-4 w-4 text-primary" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[9px] text-destructive-foreground font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">{t("profile.notifications.title")}</p>
            <p className="text-[10px] text-muted-foreground">
              {notificationsLoading
                ? t("profile.notifications.loading")
                : unread > 0
                  ? t("profile.notifications.unread", { count: unread })
                  : t("profile.notifications.allCaughtUp")}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${expandNotifs ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {expandNotifs && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                <div className="flex items-center gap-3">
                  {unread > 0 && (
                    <button
                      onClick={markAllNotificationsRead}
                      className="text-xs text-primary font-medium"
                    >
                      {t("profile.notifications.markAllAsRead")}
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={clearAllNotifications}
                      className="text-xs text-muted-foreground hover:text-destructive transition-colors font-medium ml-auto"
                    >
                      {t("header.clearAll")}
                    </button>
                  )}
                </div>
                {notifications.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    {t("profile.notifications.empty")}
                  </p>
                )}
                {notifications.slice(0, 8).map((notification) => (
                  <div
                    key={notification.id}
                    className={`group relative rounded-xl p-2.5 text-xs ${
                      notification.read
                        ? "bg-muted/20"
                        : "bg-primary/10 border border-primary/20"
                    }`}
                  >
                    <button
                      onClick={() => dismissNotification(notification.id)}
                      className="absolute top-2 right-2 h-4 w-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted/60"
                      aria-label={t("profile.notifications.dismiss")}
                    >
                      <X className="h-2.5 w-2.5 text-muted-foreground" />
                    </button>
                    <p className="pr-4">{notification.message}</p>
                    <p className="text-muted-foreground text-[9px] mt-0.5">
                      {formatDateTime(notification.timestamp)}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpandNotifPrefs((value) => !value)}
          className="w-full flex items-center gap-3 p-4"
        >
          <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <Settings className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">
              {t("profile.notificationPreferences.title")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("profile.notificationPreferences.subtitle")}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${expandNotifPrefs ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {expandNotifPrefs && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-1">
                {NOTIFICATION_TYPES.map((type) => {
                  const enabled = notifPrefs[type] !== false;
                  return (
                    <button
                      key={type}
                      onClick={() => handleToggleNotifPref(type, !enabled)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-sm text-left">
                        {translateKey("profile.notificationPreferences.types", type)}
                      </span>
                      <div
                        className={`h-5 w-9 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${
                          enabled ? "bg-primary" : "bg-muted"
                        }`}
                      >
                        <div
                          className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                            enabled ? "translate-x-4" : "translate-x-0"
                          }`}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpandInvite((value) => !value)}
          className="w-full flex items-center gap-3 p-4"
        >
          <div className="h-9 w-9 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
            <Mail className="h-4 w-4 text-accent" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">
              {t("profile.inviteRoommates.title")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("profile.inviteRoommates.subtitle")}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${expandInvite ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {expandInvite && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                <input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder={t("profile.inviteRoommates.emailPlaceholder")}
                  type="email"
                  className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleInvite}
                  className="w-full gradient-primary rounded-xl py-2 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2"
                >
                  {inviteSent ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t("profile.inviteRoommates.sent")}
                    </>
                  ) : (
                    t("profile.inviteRoommates.send")
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <button
          onClick={() => setExpandPassword((value) => !value)}
          className="w-full flex items-center gap-3 p-4"
        >
          <div className="h-9 w-9 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
            <Key className="h-4 w-4 text-secondary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">
              {t("profile.resetPassword.title")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("profile.resetPassword.subtitle")}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${expandPassword ? "rotate-180" : ""}`}
          />
        </button>

        <AnimatePresence>
          {expandPassword && (
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2">
                <input
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  type="password"
                  placeholder={t("profile.resetPassword.newPassword")}
                  className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  type="password"
                  placeholder={t("profile.resetPassword.confirmPassword")}
                  className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {pwError && <p className="text-xs text-destructive">{pwError}</p>}
                <button
                  onClick={handleResetPassword}
                  className="w-full gradient-primary rounded-xl py-2 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2"
                >
                  {pwSuccess ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t("profile.resetPassword.updated")}
                    </>
                  ) : (
                    t("profile.resetPassword.update")
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="w-full flex items-center gap-3 p-4">
          <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <UserPlus className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">{t("profile.friends.title")}</p>
            <p className="text-[10px] text-muted-foreground">
              {t("profile.friends.subtitle")}
            </p>
          </div>
        </div>
        <div className="px-4 pb-4 space-y-2">
          <div className="flex gap-2">
            <input
              value={friendName}
              onChange={(event) => setFriendName(event.target.value)}
              placeholder={t("profile.friends.placeholder")}
              className="flex-1 bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(event) => event.key === "Enter" && void addFriend()}
            />
            <button
              onClick={addFriend}
              className="px-3 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground"
            >
              {t("profile.friends.add")}
            </button>
          </div>
          {friendError && <p className="text-xs text-destructive">{friendError}</p>}
          {(currentUser?.friends?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground">
              {t("profile.friends.empty")}
            </p>
          )}
          {(currentUser?.friends ?? []).map((friend) => (
            <div
              key={friend.name}
              className="flex items-center gap-2 rounded-xl bg-muted/20 px-3 py-2"
            >
              <span className="flex-1 text-sm">{friend.name}</span>
              <button
                onClick={() => removeFriend(friend.name)}
                className="h-7 w-7 rounded-lg glass flex items-center justify-center"
                aria-label={t("profile.friends.remove", { name: friend.name })}
              >
                <UserMinus className="h-3.5 w-3.5 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-2xl p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          {t("profile.account")}
        </p>

        <button
          onClick={doLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors"
        >
          <LogOut className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{t("profile.logOut")}</span>
        </button>

        <button
          onClick={handleLeave}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors"
        >
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          <div className="text-left">
            <p className="text-sm font-medium">{t("profile.leaveHousehold")}</p>
            <p className="text-[10px] text-muted-foreground">
              {t("profile.leaveHouseholdSubtitle")}
            </p>
          </div>
        </button>

        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 transition-colors disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4 text-destructive" />
          <div className="text-left">
            <p className="text-sm font-medium text-destructive">
              {t("profile.deleteAccount")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t("profile.deleteAccountSubtitle")}
            </p>
          </div>
        </button>
      </div>
    </motion.div>
  );
}
