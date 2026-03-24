
import { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';
import type { AppUser } from '../lib/types';
import { API_BASE } from '../lib/api';
function buildInvitationWsUrl(email: string): string {
  // Support both absolute and relative API bases (for example "/api" in production).
  const apiUrl = new URL(API_BASE, window.location.origin);
  const wsUrl = new URL('/ws/invitations', apiUrl.origin);
  wsUrl.protocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  wsUrl.searchParams.set('email', email);
  return wsUrl.toString();
}

interface Invitation {
  id: number;
  email: string;
  collectiveCode: string;
  invitedBy: string;
  createdAt: string;
  accepted: boolean;
  acceptedAt: string | null;
}

export function Notifications({ currentUser }: { currentUser: AppUser }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [open, setOpen] = useState(false);

  // Fetch invitations and set up WebSocket for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closedManually = false;

    async function fetchInvites() {
      if (!currentUser || !currentUser.email) return;
      try {
        const invites = await api.get<Invitation[]>(`/invitations?email=${encodeURIComponent(currentUser.email)}`);
        setInvitations(invites.filter((i) => !i.accepted));
      } catch {
        setInvitations([]);
      }
    }

    fetchInvites();

    if (currentUser && currentUser.email) {
      ws = new WebSocket(buildInvitationWsUrl(currentUser.email));
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'INVITATION_CREATED' || data.type === 'INVITATION_ACCEPTED') {
            fetchInvites();
          }
        } catch {}
      };
      ws.onerror = () => {
        ws?.close();
      };
      ws.onclose = () => {
        if (!closedManually) {
          setTimeout(() => {
            if (!closedManually) {
              ws = new WebSocket(buildInvitationWsUrl(currentUser.email));
            }
          }, 2000);
        }
      };
    }

    return () => {
      closedManually = true;
      ws?.close();
    };
  }, [currentUser]);

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-full p-2 hover:bg-slate-100"
        onClick={() => setOpen((v) => !v)}
        aria-label="Varsler"
      >
        <Bell className="size-5" />
        {invitations.length > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-3 w-3 rounded-full bg-red-500" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl bg-white shadow-lg ring-1 ring-slate-200 border border-slate-100 z-50">
          <div className="p-4">
            <h4 className="mb-2 text-base font-semibold">Varsler</h4>
            {invitations.length > 0 ? (
              <>
                <ul className="space-y-2">
                  {invitations.map((invite) => (
                    <li key={invite.id} className="text-sm text-slate-800">
                      Du er invitert til kollektiv med kode <b>{invite.collectiveCode}</b> av <b>{invite.invitedBy}</b>.<br />
                      <span className="text-xs text-slate-400 mt-1 block">{new Date(invite.createdAt).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 text-xs text-slate-500">Bruk invitasjonskoden for å bli med.</div>
              </>
            ) : (
              <div className="text-sm text-slate-500 py-6 text-center">Ingen varsler akkurat nå.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
