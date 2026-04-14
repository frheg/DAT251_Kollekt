import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Minus, Recycle, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";
import { connectCollectiveRealtime } from "../lib/realtime";
import { useUser } from "../context/UserContext";
import { formatCurrency, formatDate } from "../i18n/helpers";
import type { PantSummary } from "../lib/types";

export default function PantTrackerPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { currentUser } = useUser();
  const [pantSummary, setPantSummary] = useState<PantSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState("");

  const name = currentUser?.name ?? "";

  const fetchPant = async () => {
    if (!name) return;
    const res = await api.get<PantSummary>(
      `/economy/pant?memberName=${encodeURIComponent(name)}`,
    );
    setPantSummary(res);
    setLoading(false);
  };

  useEffect(() => {
    fetchPant();
  }, [name]);

  useEffect(() => {
    if (!name) return;
    const disconnect = connectCollectiveRealtime(name, (event) => {
      if (event.type === "PANT_ADDED") {
        fetchPant();
      }
    });
    return disconnect;
  }, [name]);

  const addBottles = async (count: number) => {
    if (count === 0) return;
    const amount = count * 1; // 1 kr per bottle standard
    await api.post("/economy/pant", {
      bottles: count,
      amount,
      addedBy: name,
      date: new Date().toISOString().split("T")[0],
    });
    fetchPant();
  };

  const addCustomAmount = async () => {
    const parsed = Math.round(Number(customAmount));
    if (!Number.isFinite(parsed) || parsed === 0) return;
    await api.post("/economy/pant", {
      bottles: parsed,
      amount: parsed,
      addedBy: name,
      date: new Date().toISOString().split("T")[0],
    });
    setCustomAmount("");
    fetchPant();
  };

  if (loading || !pantSummary) {
    return (
      <div className="space-y-4 pt-4 animate-pulse">
        <div className="glass rounded-2xl h-48" />
        <div className="glass rounded-2xl h-32" />
      </div>
    );
  }

  const totalBottles = pantSummary.entries.reduce((s, e) => s + e.bottles, 0);
  const earned = pantSummary.currentAmount;
  const goal = pantSummary.goalAmount;
  const progress = Math.min((earned / goal) * 100, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 pt-4"
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/economy")}
          className="h-9 w-9 rounded-xl glass flex items-center justify-center"
          aria-label={t("common.back")}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h2 className="font-display text-xl font-bold">{t("pant.title")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("pant.subtitle", { goal: formatCurrency(goal) })}
          </p>
        </div>
      </div>

      {/* Counter */}
      <div className="glass rounded-2xl p-5 text-center glow-primary">
        <Recycle className="h-8 w-8 text-primary mx-auto mb-2" />
        <p className="font-display text-5xl font-bold">{totalBottles}</p>
        <p className="text-sm text-muted-foreground mt-1">
          {t('pant.bottlesCollected')}
        </p>
        <p className="font-display text-xl font-bold text-primary mt-2">
          {formatCurrency(earned)}
        </p>
        <p className="text-xs text-muted-foreground">{t('pant.earnedSoFar')}</p>
        <div className="flex items-center gap-2 mt-4 justify-center">
          <button
            onClick={() =>
              setCustomAmount((v) =>
                String(Math.max(0, (parseInt(v) || 0) - 1)),
              )
            }
            className="h-9 w-9 rounded-xl glass flex items-center justify-center hover:bg-muted/40 transition-colors shrink-0"
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => setCustomAmount(e.target.value)}
            placeholder={t('pant.customAmount')}
            onKeyDown={(e) => e.key === "Enter" && addCustomAmount()}
            className="w-24 bg-muted/50 rounded-lg px-3 py-2 text-sm text-center placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
          />
          <button
            onClick={() =>
              setCustomAmount((v) => String((parseInt(v) || 0) + 1))
            }
            className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shrink-0"
          >
            <Plus className="h-4 w-4 text-primary-foreground" />
          </button>
          <button
            onClick={addCustomAmount}
            className="px-3 py-2 rounded-xl glass text-xs font-medium hover:bg-muted/40 transition-colors"
          >
            {t('pant.addAmount')}
          </button>
        </div>
        <div className="flex gap-2 mt-3 justify-center">
          {[5, 10, 24].map((n) => (
            <button
              key={n}
              onClick={() => addBottles(n)}
              className="px-3 py-1 rounded-full glass text-xs font-medium hover:bg-muted/40 transition-colors"
            >
              +{n}
            </button>
          ))}
        </div>
      </div>

      {/* Goal */}
      <div className="glass rounded-2xl p-4 glow-accent">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold flex-1">{t("pant.savingGoal")}</p>
        </div>
        <p className="font-display font-bold text-lg">
          {t("pant.goalTitle")} 🎉
        </p>
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1 mb-2">
          <span>{t("pant.saved", { amount: formatCurrency(earned) })}</span>
          <span>{t("pant.goal", { amount: formatCurrency(goal) })}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full gradient-primary rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {progress >= 100
            ? `🎉 ${t("pant.goalReached")}`
            : t("pant.bottlesToGo", { count: Math.ceil((goal - earned) / 1) })}
        </p>
      </div>

      {/* History */}
      {pantSummary.entries.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">
            {t("pant.collectionHistory")}
          </h3>
          <div className="space-y-2">
            {pantSummary.entries.map((entry, i) => (
              <motion.div
                key={entry.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-3 flex items-center gap-3"
              >
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Recycle className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {t("pant.historyEntry", {
                      name: entry.addedBy,
                      count: entry.bottles,
                    })}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(entry.date)}
                  </p>
                </div>
                <p className="text-sm font-bold text-primary">
                  +{formatCurrency(entry.amount)}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
