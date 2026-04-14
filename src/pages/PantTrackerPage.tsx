import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Recycle, Target, Edit3, Check, X, Plus } from "lucide-react";
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
  const [addAmount, setAddAmount] = useState("");
  const [editingTotal, setEditingTotal] = useState(false);
  const [editTotalValue, setEditTotalValue] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [editGoalValue, setEditGoalValue] = useState("");
  const [showAllHistory, setShowAllHistory] = useState(false);

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

  const handleAdd = async () => {
    const parsed = Math.round(Number(addAmount));
    if (!Number.isFinite(parsed) || parsed === 0) return;
    await api.post("/economy/pant", {
      bottles: parsed,
      amount: parsed,
      addedBy: name,
      date: new Date().toISOString().split("T")[0],
    });
    setAddAmount("");
    fetchPant();
  };

  const handleEditTotal = async () => {
    const newTotal = Math.round(Number(editTotalValue));
    if (!Number.isFinite(newTotal)) return;
    const diff = newTotal - earned;
    if (diff !== 0) {
      await api.post("/economy/pant", {
        bottles: diff,
        amount: diff,
        addedBy: name,
        date: new Date().toISOString().split("T")[0],
      });
      fetchPant();
    }
    setEditingTotal(false);
  };

  const handleEditGoal = async () => {
    const newGoal = Math.round(Number(editGoalValue));
    if (!Number.isFinite(newGoal) || newGoal <= 0) return;
    await api.patch("/economy/pant/goal", { memberName: name, goal: newGoal });
    fetchPant();
    setEditingGoal(false);
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

        {editingTotal ? (
          <div className="flex items-center justify-center gap-2 mt-3">
            <input
              type="number"
              value={editTotalValue}
              onChange={(e) => setEditTotalValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleEditTotal();
                if (e.key === "Escape") setEditingTotal(false);
              }}
              className="w-28 bg-muted/50 rounded-lg px-3 py-2 text-sm text-center placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
              autoFocus
            />
            <button
              onClick={() => void handleEditTotal()}
              className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shrink-0"
            >
              <Check className="h-3.5 w-3.5 text-primary-foreground" />
            </button>
            <button
              onClick={() => setEditingTotal(false)}
              className="h-8 w-8 rounded-lg glass flex items-center justify-center shrink-0"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 mt-2">
            <p className="font-display text-xl font-bold text-primary">
              {formatCurrency(earned)}
            </p>
            <button
              onClick={() => { setEditTotalValue(String(earned)); setEditingTotal(true); }}
              className="h-6 w-6 rounded-md glass flex items-center justify-center"
            >
              <Edit3 className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-0.5">{t('pant.earnedSoFar')}</p>

        <div className="flex items-center justify-center gap-2 mt-4">
          <input
            type="number"
            value={addAmount}
            onChange={(e) => setAddAmount(e.target.value)}
            placeholder={t('pant.customAmount')}
            onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
            className="w-36 bg-muted/50 rounded-lg px-3 py-2 text-sm text-center placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
          />
          <button
            onClick={() => void handleAdd()}
            className="h-9 w-9 rounded-xl gradient-primary flex items-center justify-center shrink-0"
            aria-label={t('pant.addAmount')}
          >
            <Plus className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>

      {/* Goal */}
      <div className="glass rounded-2xl p-4 glow-accent">
        <div className="flex items-center gap-2 mb-3">
          <Target className="h-4 w-4 text-accent" />
          <p className="text-sm font-semibold flex-1">{t("pant.savingGoal")}</p>
          {!editingGoal && (
            <button
              onClick={() => { setEditGoalValue(String(goal)); setEditingGoal(true); }}
              className="h-6 w-6 rounded-md glass flex items-center justify-center"
            >
              <Edit3 className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
        {editingGoal ? (
          <div className="flex items-center gap-2 mb-3">
            <input
              type="number"
              value={editGoalValue}
              onChange={(e) => setEditGoalValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleEditGoal();
                if (e.key === "Escape") setEditingGoal(false);
              }}
              className="flex-1 bg-muted/50 rounded-lg px-3 py-1.5 text-sm text-center placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary [color-scheme:dark]"
              autoFocus
            />
            <button
              onClick={() => void handleEditGoal()}
              className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center shrink-0"
            >
              <Check className="h-3.5 w-3.5 text-primary-foreground" />
            </button>
            <button
              onClick={() => setEditingGoal(false)}
              className="h-8 w-8 rounded-lg glass flex items-center justify-center shrink-0"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <p className="font-display font-bold text-lg">
            {t("pant.goalTitle")} 🎉
          </p>
        )}
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
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {t("pant.collectionHistory")}
            </h3>
            {pantSummary.entries.length > 2 && (
              <button onClick={() => setShowAllHistory((v) => !v)} className="text-xs text-primary font-medium">
                {showAllHistory ? t('common.showLess') : t('common.seeAll')}
              </button>
            )}
          </div>
          <div className="space-y-2">
            {(showAllHistory ? pantSummary.entries : pantSummary.entries.slice(0, 2)).map((entry, i) => (
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
