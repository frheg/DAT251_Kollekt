import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home, Users, MapPin, ArrowRight, ArrowLeft, Plus, X, DoorOpen, Copy, Check, KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import { useUser } from '../context/UserContext';
import type { AppUser } from '../lib/types';

export default function CreateHouseholdPage() {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser, handleLogout } = useUser();

  const [setupMode, setSetupMode] = useState<'create' | 'join'>('create');
  const [step, setStep] = useState(1);
  const [houseName, setHouseName] = useState('');
  const [address, setAddress] = useState('');
  const [rooms, setRooms] = useState([{ name: '', minutes: '30' }]);
  const [invites, setInvites] = useState<string[]>(['']);
  const [createdCode, setCreatedCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);

  const addInvite = () => setInvites((p) => [...p, '']);
  const removeInvite = (i: number) => setInvites((p) => p.filter((_, idx) => idx !== i));
  const updateInvite = (i: number, val: string) =>
    setInvites((p) => p.map((v, idx) => (idx === i ? val : v)));
  const addRoom = () => setRooms((p) => [...p, { name: '', minutes: '30' }]);
  const removeRoom = (i: number) => setRooms((p) => p.length === 1 ? p : p.filter((_, idx) => idx !== i));
  const updateRoomName = (i: number, val: string) =>
    setRooms((p) => p.map((room, idx) => (idx === i ? { ...room, name: val } : room)));
  const updateRoomMinutes = (i: number, val: string) =>
    setRooms((p) => p.map((room, idx) => (idx === i ? { ...room, minutes: val } : room)));

  const handleCopy = () => {
    navigator.clipboard.writeText(createdCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateCollective = async () => {
    if (!currentUser) return;
    setError('');
    setLoading(true);
    try {
      const roomConfigs = rooms
        .map((room) => ({
          name: room.name.trim(),
          minutes: Math.max(1, parseInt(room.minutes) || 30),
        }))
        .filter((room) => room.name);

      if (roomConfigs.length === 0) {
        setError('Add at least one room');
        setLoading(false);
        return;
      }

      const res = await api.post<{ joinCode: string }>('/onboarding/collectives', {
        name: houseName || address || 'My Household',
        ownerUserId: currentUser.id,
        numRooms: roomConfigs.length,
        residents: [currentUser.name],
        rooms: roomConfigs,
      });
      setCreatedCode(res.joinCode);
      // Update user with new collective code
      const updated: AppUser = { ...currentUser, collectiveCode: res.joinCode };
      setCurrentUser(updated);
      setStep(3);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create household');
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvites = async () => {
    if (!currentUser) return;
    const validEmails = invites.filter((e) => e.trim());
    await Promise.allSettled(
      validEmails.map((email) =>
        api.post('/members/invite', { email, collectiveCode: createdCode })
      )
    );
    navigate('/', { replace: true });
  };

  const handleJoinCollective = async () => {
    if (!currentUser || !joinCode.trim()) return;
    setError('');
    setJoining(true);
    try {
      const joined = await api.post<AppUser>('/onboarding/collectives/join', {
        userId: currentUser.id,
        joinCode: joinCode.trim().toUpperCase(),
      });
      setCurrentUser(joined);
      navigate('/', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not join household');
    } finally {
      setJoining(false);
    }
  };

  const goBackToAuth = async () => {
    await handleLogout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-6"
      >
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold">Create Your Household</h1>
          <p className="text-sm text-muted-foreground mt-1">Step {step} of 3</p>
        </div>

        <div className="flex gap-1 glass rounded-xl p-1">
          <button
            onClick={() => setSetupMode('create')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              setupMode === 'create' ? 'gradient-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Create Home
          </button>
          <button
            onClick={() => setSetupMode('join')}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
              setupMode === 'join' ? 'gradient-primary text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Join Home
          </button>
        </div>

        {setupMode === 'create' && (
          <div className="flex gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className={`flex-1 h-1 rounded-full ${step >= s ? 'gradient-primary' : 'bg-muted'}`} />
            ))}
          </div>
        )}

        {setupMode === 'join' && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/5 flex items-center justify-center mx-auto">
                <KeyRound className="h-7 w-7 text-foreground" />
              </div>
              <p className="text-sm text-center text-muted-foreground">Join an existing household with invite code</p>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter invite code"
                className="w-full bg-muted/50 rounded-lg px-3 py-2.5 text-sm font-mono tracking-wider placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {error && <p className="text-xs text-destructive text-center">{error}</p>}
            <button
              onClick={handleJoinCollective}
              disabled={joining || !joinCode.trim()}
              className="w-full gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {joining ? 'Joining...' : <>Join Home <ArrowRight className="h-4 w-4" /></>}
            </button>
          </motion.div>
        )}

        {/* Step 1: Name & Address */}
        {setupMode === 'create' && step === 1 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="h-14 w-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto">
                <Home className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Household Name</label>
                <input
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                  placeholder="e.g. Guttas Hus"
                  className="w-full bg-muted/50 rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Address</label>
                <div className="glass rounded-lg flex items-center gap-3 px-3">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street address: e.g. Strandgaten 42"
                    className="w-full bg-transparent py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={!houseName.trim() && !address.trim()}
              className="w-full gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
            >
              Next <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {/* Step 2: Rooms & Residents */}
        {setupMode === 'create' && step === 2 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-secondary/30 to-secondary/5 flex items-center justify-center mx-auto">
                <DoorOpen className="h-7 w-7 text-foreground" />
              </div>
              <p className="text-sm text-center text-muted-foreground">Add shared rooms and how long they usually take to clean — these become collective tasks for everyone. Private spaces like your own bedroom are not included.</p>
              <div className="space-y-3">
                {rooms.map((room, i) => (
                  <div key={i} className="glass rounded-xl p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-muted-foreground">Room {i + 1}</span>
                      {rooms.length > 1 && (
                        <button onClick={() => removeRoom(i)} className="h-8 w-8 rounded-lg bg-muted/40 flex items-center justify-center">
                          <X className="h-4 w-4 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Room name</label>
                        <input
                          value={room.name}
                          onChange={(e) => updateRoomName(i, e.target.value)}
                          placeholder="e.g. Kitchen"
                          className="w-full bg-muted/50 rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Minutes to clean</label>
                        <input
                          type="number"
                          min="1"
                          max="240"
                          value={room.minutes}
                          onChange={(e) => updateRoomMinutes(i, e.target.value)}
                          className="w-full bg-muted/50 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={addRoom}
                className="w-full glass rounded-xl py-3 text-sm font-medium text-muted-foreground flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Add room
              </button>
            </div>
            {error && <p className="text-xs text-destructive text-center">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 glass rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <button
                onClick={handleCreateCollective}
                disabled={loading}
                className="flex-1 gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {loading ? 'Creating...' : <> Next <ArrowRight className="h-4 w-4" /></>}
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Invite */}
        {setupMode === 'create' && step === 3 && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
            <div className="glass rounded-2xl p-5 space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-accent/30 to-accent/5 flex items-center justify-center mx-auto">
                <Users className="h-7 w-7 text-foreground" />
              </div>

              <div className="bg-muted/30 rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground mb-1">Share this code with roommates</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="font-mono text-lg font-bold tracking-widest text-primary">{createdCode}</span>
                  <button onClick={handleCopy} className="h-8 w-8 rounded-lg glass flex items-center justify-center">
                    {copied
                      ? <Check className="h-3.5 w-3.5 text-primary" />
                      : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-muted-foreground">or invite by email</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {invites.map((email, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => updateInvite(i, e.target.value)}
                    placeholder={`Roommate ${i + 1} email`}
                    className="flex-1 bg-muted/50 rounded-lg px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {invites.length > 1 && (
                    <button onClick={() => removeInvite(i)} className="h-10 w-10 rounded-lg glass flex items-center justify-center">
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={addInvite}
                className="w-full glass rounded-lg py-2 text-xs font-medium text-muted-foreground flex items-center justify-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add another
              </button>
            </div>

            <button
              onClick={handleSendInvites}
              className="w-full gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2"
            >
              Create <ArrowRight className="h-4 w-4" />
            </button>

            <button
              onClick={() => navigate('/', { replace: true })}
              className="w-full text-center text-xs text-muted-foreground"
            >
              Skip for now
            </button>
          </motion.div>
        )}

        <button
          onClick={goBackToAuth}
          className="w-full text-center text-xs text-muted-foreground"
        >
          Back to login/sign up
        </button>
      </motion.div>
    </div>
  );
}
