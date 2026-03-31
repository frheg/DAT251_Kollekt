
import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';
import type { AppUser } from '../lib/types';
import { connectCollectiveRealtime } from '../lib/realtime';
export function Notifications({ currentUser }: { currentUser: AppUser }) {



  const [open, setOpen] = useState(false);
  const [notis, setNotis] = useState<any[]>([]);

  // Listen for real-time task notifications
  useEffect(() => {
    if (!currentUser?.name) return;
    const disconnect = connectCollectiveRealtime(currentUser.name, (event) => {
      if (event.type === 'TASK_DEADLINE_SOON' || event.type === 'TASK_PENALTY_APPLIED') {
        setNotis((prev) => [event, ...prev]);
      }
    });
    return disconnect;
  }, [currentUser]);

  const handleLateApproval = async (taskId: number) => {
    await api.post(`/tasks/${taskId}/regret`, {}); // Adjust endpoint as needed
    setNotis((prev) => prev.filter((n) => n.payload?.taskId !== taskId));
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-full p-2 hover:bg-slate-100"
        onClick={() => setOpen((v) => !v)}
        aria-label="Varsler"
      >
        <Bell className="size-5" />
        {notis.length > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-3 w-3 rounded-full bg-red-500" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-96 rounded-xl bg-white shadow-lg ring-1 ring-slate-200 border border-slate-100 z-50">
          <div className="p-4">
            <h4 className="mb-2 text-base font-semibold">Varsler</h4>
            {notis.length === 0 && <div className="text-sm text-slate-500 py-6 text-center">Ingen varsler akkurat nå.</div>}
            <ul className="space-y-2">
              {notis.map((n, i) => (
                <li key={i} className="text-sm text-slate-800">
                  {n.type === 'TASK_DEADLINE_SOON' && (
                    <>
                      <b>Oppgave snart forfall:</b> {n.payload?.title} (frist: {n.payload?.dueDate})
                    </>
                  )}
                  {n.type === 'TASK_PENALTY_APPLIED' && (
                    <>
                      <b>-XP for glemt oppgave:</b> {n.payload?.title} ({n.payload?.penaltyXp} XP)
                      {n.payload?.lateApprovalAvailable && (
                        <button
                          className="ml-2 px-2 py-1 text-xs bg-blue-100 rounded hover:bg-blue-200"
                          onClick={() => handleLateApproval(n.payload.taskId)}
                        >
                          Jeg gjorde den likevel!
                        </button>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}