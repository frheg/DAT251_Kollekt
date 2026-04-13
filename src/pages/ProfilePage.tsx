import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Mail, Key, LogOut, Trash2, ArrowRightLeft, Copy, Check, ChevronDown, UserPlus, UserMinus } from 'lucide-react';
import { api } from '../lib/api';
import { connectCollectiveRealtime } from '../lib/realtime';
import { useUser } from '../context/UserContext';
import type { AppUser, MemberStatus } from '../lib/types';

interface Notification { id: number; userName: string; message: string; timestamp: string; read: boolean; }

const STATUS_OPTIONS: { value: MemberStatus; label: string; emoji: string }[] = [
  { value: 'ACTIVE', label: 'Active', emoji: '🟢' },
  { value: 'AWAY',   label: 'Away',   emoji: '🟡' },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, handleLogout } = useUser();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSent, setInviteSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [expandNotifs, setExpandNotifs] = useState(false);
  const [expandInvite, setExpandInvite] = useState(false);
  const [expandPassword, setExpandPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [friendError, setFriendError] = useState('');

  const name = currentUser?.name ?? '';

  useEffect(() => {
    if (!name) return;
    api.get<Notification[]>(`/notifications/${encodeURIComponent(name)}`)
      .then((res) => { setNotifications(res); setLoading(false); })
      .catch(() => setLoading(false));
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(name, (event) => {
      if (['TASK_UPDATED', 'TASK_CREATED', 'EXPENSE_CREATED', 'EVENT_CREATED', 'CHAT_MESSAGE'].includes(event.type)) {
        api.get<Notification[]>(`/notifications/${encodeURIComponent(name)}`)
          .then((res) => setNotifications(res))
          .catch(() => {});
      }
    });
    return disconnect;
  }, [name]);

  const handleMarkRead = async () => {
    if (!name) return;
    await api.post(`/notifications/${encodeURIComponent(name)}/read`, {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleStatusChange = async (status: MemberStatus) => {
    if (!currentUser) return;
    try {
      await api.patch('/members/status', { memberName: name, status });
      setCurrentUser({ ...currentUser, status });
    } catch {}
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !currentUser?.collectiveCode) return;
    await api.post('/members/invite', {
      email: inviteEmail.trim(),
      collectiveCode: currentUser.collectiveCode,
    });
    setInviteEmail('');
    setInviteSent(true);
    setTimeout(() => setInviteSent(false), 3000);
  };

  const handleResetPassword = async () => {
    setPwError('');
    if (newPassword.length < 6) { setPwError('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match'); return; }
    try {
      await api.patch(`/members/reset-password?memberName=${encodeURIComponent(name)}`, { newPassword });
      setNewPassword(''); setConfirmPassword('');
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch { setPwError('Failed to update password'); }
  };

  const addFriend = async () => {
    setFriendError('');
    const trimmed = friendName.trim();
    if (!trimmed || !currentUser) return;
    try {
      await api.post(`/members/friends/add?memberName=${encodeURIComponent(name)}`, { friendName: trimmed });
      const refreshed = await api.get<AppUser>('/onboarding/me');
      setCurrentUser(refreshed);
      setFriendName('');
    } catch (err: unknown) {
      setFriendError(err instanceof Error ? err.message : 'Could not add friend');
    }
  };

  const removeFriend = async (friend: string) => {
    if (!currentUser) return;
    try {
      await api.delete(`/members/friends/remove?memberName=${encodeURIComponent(name)}&friendName=${encodeURIComponent(friend)}`);
      const refreshed = await api.get<AppUser>('/onboarding/me');
      setCurrentUser(refreshed);
    } catch {}
  };

  const handleCopyCode = () => {
    if (!currentUser?.collectiveCode) return;
    navigator.clipboard.writeText(currentUser.collectiveCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleLeave = async () => {
    if (!currentUser) return;
    try {
      await api.patch(`/members/leave-collective?memberName=${encodeURIComponent(name)}`);
      setCurrentUser({ ...currentUser, collectiveCode: '' });
      navigate('/create-household');
    } catch {}
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete your account? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.delete(`/members/delete?memberName=${encodeURIComponent(name)}`);
      await handleLogout();
      navigate('/login');
    } catch { setDeleting(false); }
  };

  const doLogout = async () => {
    await handleLogout();
    navigate('/login');
  };

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4 pb-8">
      {/* Profile card */}
      <div className="glass rounded-2xl p-5 glow-primary">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center text-2xl font-display font-bold text-primary-foreground shrink-0">
            {name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display text-xl font-bold">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{currentUser?.email}</p>
            <div className="flex gap-1.5 mt-2">
              {STATUS_OPTIONS.map((s) => (
                <button key={s.value} onClick={() => handleStatusChange(s.value)}
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${
                    currentUser?.status === s.value
                      ? s.value === 'ACTIVE' ? 'bg-primary/20 text-primary border border-primary/30' : 'bg-secondary/20 text-secondary border border-secondary/30'
                      : 'glass text-muted-foreground'
                  }`}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Collective code */}
        {currentUser?.collectiveCode && (
          <div className="mt-4 flex items-center justify-between bg-muted/30 rounded-xl px-3 py-2">
            <div>
              <p className="text-[10px] text-muted-foreground">Household code</p>
              <p className="font-display font-bold text-sm tracking-widest">{currentUser.collectiveCode}</p>
            </div>
            <button onClick={handleCopyCode} className="h-8 w-8 rounded-lg glass flex items-center justify-center">
              {codeCopied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      <div className="glass rounded-2xl overflow-hidden">
        <button onClick={() => setExpandNotifs((v) => !v)}
          className="w-full flex items-center gap-3 p-4">
          <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center relative shrink-0">
            <Bell className="h-4 w-4 text-primary" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[9px] text-destructive-foreground font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-[10px] text-muted-foreground">{loading ? 'Loading...' : unread > 0 ? `${unread} unread` : 'All caught up'}</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandNotifs ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {expandNotifs && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-4 pb-4 space-y-2">
                {unread > 0 && (
                  <button onClick={handleMarkRead} className="text-xs text-primary font-medium">
                    Mark all as read
                  </button>
                )}
                {notifications.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">No notifications</p>
                )}
                {notifications.slice(0, 8).map((n) => (
                  <div key={n.id} className={`rounded-xl p-2.5 text-xs ${n.read ? 'bg-muted/20' : 'bg-primary/10 border border-primary/20'}`}>
                    <p>{n.message}</p>
                    <p className="text-muted-foreground text-[9px] mt-0.5">
                      {new Date(n.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Invite friends */}
      <div className="glass rounded-2xl overflow-hidden">
        <button onClick={() => setExpandInvite((v) => !v)}
          className="w-full flex items-center gap-3 p-4">
          <div className="h-9 w-9 rounded-xl bg-accent/20 flex items-center justify-center shrink-0">
            <Mail className="h-4 w-4 text-accent" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">Invite Roommates</p>
            <p className="text-[10px] text-muted-foreground">Send an email invite to join your household</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandInvite ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {expandInvite && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-4 pb-4 space-y-2">
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="friend@email.com"
                  type="email"
                  className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                <button onClick={handleInvite}
                  className="w-full gradient-primary rounded-xl py-2 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2">
                  {inviteSent ? <><Check className="h-4 w-4" /> Invite Sent!</> : 'Send Invite'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reset password */}
      <div className="glass rounded-2xl overflow-hidden">
        <button onClick={() => setExpandPassword((v) => !v)}
          className="w-full flex items-center gap-3 p-4">
          <div className="h-9 w-9 rounded-xl bg-secondary/20 flex items-center justify-center shrink-0">
            <Key className="h-4 w-4 text-secondary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">Reset Password</p>
            <p className="text-[10px] text-muted-foreground">Update your account password</p>
          </div>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandPassword ? 'rotate-180' : ''}`} />
        </button>

        <AnimatePresence>
          {expandPassword && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-4 pb-4 space-y-2">
                <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                  type="password" placeholder="New password"
                  className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                <input value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password" placeholder="Confirm password"
                  className="w-full bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                {pwError && <p className="text-xs text-destructive">{pwError}</p>}
                <button onClick={handleResetPassword}
                  className="w-full gradient-primary rounded-xl py-2 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2">
                  {pwSuccess ? <><Check className="h-4 w-4" /> Password Updated!</> : 'Update Password'}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Friends */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="w-full flex items-center gap-3 p-4">
          <div className="h-9 w-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
            <UserPlus className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-sm font-semibold">Friends</p>
            <p className="text-[10px] text-muted-foreground">Manage your friend list for household features</p>
          </div>
        </div>
        <div className="px-4 pb-4 space-y-2">
          <div className="flex gap-2">
            <input
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              placeholder="Friend username"
              className="flex-1 bg-muted/50 rounded-xl px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={(e) => e.key === 'Enter' && addFriend()}
            />
            <button
              onClick={addFriend}
              className="px-3 rounded-xl gradient-primary text-sm font-semibold text-primary-foreground"
            >
              Add
            </button>
          </div>
          {friendError && <p className="text-xs text-destructive">{friendError}</p>}
          {(currentUser?.friends?.length ?? 0) === 0 && (
            <p className="text-xs text-muted-foreground">No friends added yet.</p>
          )}
          {(currentUser?.friends ?? []).map((friend) => (
            <div key={friend.name} className="flex items-center gap-2 rounded-xl bg-muted/20 px-3 py-2">
              <span className="flex-1 text-sm">{friend.name}</span>
              <button
                onClick={() => removeFriend(friend.name)}
                className="h-7 w-7 rounded-lg glass flex items-center justify-center"
              >
                <UserMinus className="h-3.5 w-3.5 text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Danger zone */}
      <div className="glass rounded-2xl p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Account</p>

        <button onClick={doLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors">
          <LogOut className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Log Out</span>
        </button>

        <button onClick={handleLeave}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors">
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
          <div className="text-left">
            <p className="text-sm font-medium">Leave Household</p>
            <p className="text-[10px] text-muted-foreground">You can join or create a new one</p>
          </div>
        </button>

        <button onClick={handleDelete} disabled={deleting}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-destructive/10 transition-colors disabled:opacity-60">
          <Trash2 className="h-4 w-4 text-destructive" />
          <div className="text-left">
            <p className="text-sm font-medium text-destructive">Delete Account</p>
            <p className="text-[10px] text-muted-foreground">Permanently remove your account</p>
          </div>
        </button>
      </div>
    </motion.div>
  );
}
