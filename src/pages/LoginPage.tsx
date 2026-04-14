import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { api, getUserMessage, setAccessToken, setRefreshToken } from '../lib/api';
import { useUser } from '../context/UserContext';
import type { AuthResponse, AppUser, Invitation } from '../lib/types';

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { setCurrentUser } = useUser();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const tryJoinFromInvitation = async (user: AppUser) => {
    if (user.collectiveCode) return user;

    const invites = await api.get<Invitation[]>(`/invitations?email=${encodeURIComponent(user.email)}`);
    const pending = invites.find((invite) => !invite.accepted);
    if (!pending) return user;

    const joined = await api.post<AppUser>('/onboarding/collectives/join', {
      userId: user.id,
      joinCode: pending.collectiveCode,
    });
    return joined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.post<AuthResponse>('/onboarding/login', { name: loginName, password });
        setAccessToken(res.accessToken);
        setRefreshToken(res.refreshToken);
        const userWithInvite = await tryJoinFromInvitation(res.user);
        setCurrentUser(userWithInvite);
        navigate(userWithInvite.collectiveCode ? '/' : '/create-household', { replace: true });

      } else if (mode === 'register') {
        const res = await api.post<AuthResponse>('/onboarding/users', { name, email, password });
        setAccessToken(res.accessToken);
        setRefreshToken(res.refreshToken);
        const userWithInvite = await tryJoinFromInvitation(res.user);
        setCurrentUser(userWithInvite);
        navigate(userWithInvite.collectiveCode ? '/' : '/create-household', { replace: true });

      }
    } catch (err: unknown) {
      setError(getUserMessage(err, t('errors.generic')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-background flex flex-col items-center justify-center px-6">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm space-y-8"
      >
        {/* Logo */}
        <div className="text-center">
          <h1 className="font-display text-4xl font-bold text-gradient">Kollekt</h1>
          <p className="text-sm text-muted-foreground mt-2">{t('app.tagline')}</p>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 glass rounded-xl p-1">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                mode === m ? 'gradient-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {m === 'login' ? t('auth.loginTab') : t('auth.signUpTab')}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <AnimatePresence mode="wait">
            <motion.div
              key="auth"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              {mode === 'register' && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                  <div className="glass rounded-xl flex items-center gap-3 px-4">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t('auth.fullName')}
                      className="w-full bg-transparent py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
                      required
                    />
                  </div>
                </motion.div>
              )}

              {mode === 'login' ? (
                <div className="glass rounded-xl flex items-center gap-3 px-4">
                  <User className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="text"
                    value={loginName}
                    onChange={(e) => setLoginName(e.target.value)}
                    placeholder={t('auth.username')}
                    className="w-full bg-transparent py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
                    required
                  />
                </div>
              ) : (
                <div className="glass rounded-xl flex items-center gap-3 px-4">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('auth.emailAddress')}
                    className="w-full bg-transparent py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
                    required
                  />
                </div>
              )}

              <div className="glass rounded-xl flex items-center gap-3 px-4">
                <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.password')}
                  className="w-full bg-transparent py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword
                    ? <EyeOff className="h-4 w-4 text-muted-foreground" />
                    : <Eye className="h-4 w-4 text-muted-foreground" />}
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {error && (
            <p className="text-xs text-destructive text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-primary rounded-xl py-3 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? t('auth.pleaseWait') : (
              <>
                {mode === 'login' ? t('auth.logIn') : t('auth.createAccount')}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          {t('auth.inviteHint')}
        </p>
      </motion.div>
    </div>
  );
}
