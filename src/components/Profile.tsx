import { useState } from 'react';
import { api, getUserMessage } from '../lib/api';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';

export function Profile({ user, onStatusChange }: { user: { name: string; status?: string }, onStatusChange?: (status: string) => void }) {
  const [status, setStatus] = useState(user.status || 'ACTIVE');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const updateStatus = async (newStatus: string) => {
    try {
      await api.patch('/members/status', { memberName: user.name, status: newStatus });
      setStatus(newStatus);
      setInfo('Status oppdatert!');
      setError('');
      onStatusChange?.(newStatus);
    } catch (err) {
      setError(getUserMessage(err, 'Kunne ikke oppdatere status.'));
      setInfo('');
    }
  };
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Min status</h2>
      <Label>Status:</Label>
      <div className="flex gap-2">
        <Button variant={status === 'ACTIVE' ? 'default' : 'outline'} onClick={() => updateStatus('ACTIVE')}>Til stede</Button>
        <Button variant={status === 'AWAY' ? 'default' : 'outline'} onClick={() => updateStatus('AWAY')}>Borte</Button>
      </div>
      {info && <div className="text-green-600 text-sm">{info}</div>}
      {error && <div className="text-rose-600 text-sm">{error}</div>}
    </div>
  );
}
