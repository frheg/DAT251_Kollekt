import { useTheme } from "./ThemeProvider";
import { motion, AnimatePresence } from "framer-motion";

export function ThemeSelector({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { theme, setTheme, themes } = useTheme();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="rounded-2xl bg-card p-8 shadow-2xl border border-border min-w-[320px]"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="mb-4 text-lg font-semibold text-foreground">Velg tema eller farge</h2>
            <div className="grid gap-3">
              {themes.map((t) => (
                <button
                  key={t.value}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 font-medium transition border 
                    ${theme.value === t.value 
                      ? 'border-primary bg-primary/10' 
                      : 'border-border bg-card hover:bg-muted'}
                  `}
                  onClick={() => setTheme(t)}
                >
                  <span className="inline-block h-5 w-5 rounded-full" style={{ background: t.colors.accent }} />
                  <span className={theme.value === t.value ? 'text-foreground' : 'text-muted-foreground'}>{t.name}</span>
                  {theme.value === t.value && <span className="ml-auto text-xs text-primary">Valgt</span>}
                </button>
              ))}
            </div>
            <button className="mt-6 w-full rounded-xl bg-primary py-2 text-primary-foreground font-semibold shadow hover:bg-primary/90 transition" onClick={onClose}>
              Lukk
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
