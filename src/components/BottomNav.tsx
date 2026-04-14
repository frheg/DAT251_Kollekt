import { useLocation, useNavigate } from 'react-router-dom';
import { Home, CheckSquare, Calendar, MessageCircle, Wallet, Trophy, Gamepad2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const tabs = [
  { labelKey: 'bottomNav.home', icon: Home, path: '/' },
  { labelKey: 'bottomNav.tasks', icon: CheckSquare, path: '/tasks' },
  { labelKey: 'bottomNav.calendar', icon: Calendar, path: '/calendar' },
  { labelKey: 'bottomNav.chat', icon: MessageCircle, path: '/chat' },
  { labelKey: 'bottomNav.economy', icon: Wallet, path: '/economy' },
  { labelKey: 'bottomNav.board', icon: Trophy, path: '/leaderboard' },
  { labelKey: 'bottomNav.games', icon: Gamepad2, path: '/games' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong safe-bottom">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const isActive =
            tab.path === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(tab.path);
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="relative flex flex-col items-center gap-0.5 py-1 px-2 rounded-xl transition-colors"
              aria-label={t(tab.labelKey)}
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute -top-1 w-6 h-1 rounded-full gradient-primary"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <tab.icon
                className={`h-5 w-5 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {t(tab.labelKey)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
