import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Settings, User, Palette, Home, Users, Trash2, KeyRound, Plus } from "lucide-react";

const menuItems = [
  { icon: <User />, label: "Min profil", action: "profile" },
  { icon: <Palette />, label: "Farger & tema", action: "theme" },
  { icon: <Users />, label: "Legg til venner", action: "addFriends" },
  { icon: <KeyRound />, label: "Bytt passord", action: "resetPassword" },
  { icon: <Trash2 />, label: "Slett bruker", action: "deleteUser" },
  { icon: <Home />, label: "Forlat kollektiv", action: "leaveCollective" },
  { icon: <LogOut />, label: "Logg ut", action: "logout" },
];

export function UserMenu({ user, onAction }: { user: { name: string; avatarUrl?: string }; onAction: (action: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", zIndex: 50 }}>
      <motion.button
        whileHover={{ scale: 1.08, boxShadow: "0 2px 12px #a5b4fc55" }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-white font-semibold shadow-md border-2 border-white/70 hover:ring-2 hover:ring-slate-400 focus:outline-none"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white">
          <motion.img
            src={user.avatarUrl || `https://api.dicebear.com/7.x/thumbs/svg?seed=${user.name}`}
            alt={user.name}
            className="h-8 w-8 rounded-full border-2 border-indigo-400"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 18 }}
          />
          <motion.span
            className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-400"
            animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
            transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          />
        </span>
        <span className="hidden sm:block max-w-[7rem] truncate">{user.name}</span>
        <Settings className="ml-1 size-4 opacity-70" />
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="absolute right-0 mt-2 w-56 rounded-2xl bg-white shadow-xl ring-1 ring-slate-100 border border-slate-200 overflow-hidden"
          >
            {menuItems.map((item) => (
              <motion.button
                key={item.action}
                whileHover={{ scale: 1.04, backgroundColor: "#f3e8ff" }}
                whileTap={{ scale: 0.97 }}
                className="flex w-full items-center gap-3 px-5 py-3 text-left text-slate-800 hover:bg-indigo-50 focus:outline-none transition-colors"
                onClick={() => {
                  setOpen(false);
                  onAction(item.action);
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
