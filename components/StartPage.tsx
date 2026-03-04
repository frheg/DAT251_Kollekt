import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Home, KeyRound, LogIn, UserPlus, Users } from 'lucide-react';
import { api, setAccessToken, setRefreshToken } from '../lib/api';
import type { AppUser, AuthResponse } from '../lib/types';

interface CollectiveDto {
  id: number;
  name: string;
  joinCode: string;
}

interface StartPageProps {
  onAuthenticated: (user: AppUser) => void;
}

export function StartPage({ onAuthenticated }: StartPageProps) {
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [collectiveName, setCollectiveName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const login = async () => {
    const name = loginName.trim();
    if (!name || !loginPassword.trim()) {
      setError('Skriv inn navn og passord for å logge inn.');
      return;
    }
    try {
      const auth = await api.post<AuthResponse>('/onboarding/login', { name, password: loginPassword });
      setAccessToken(auth.accessToken);
      setRefreshToken(auth.refreshToken);
      setError('');
      setInfo('');
      setCurrentUser(auth.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke logge inn.');
    }
  };

  const createUser = async () => {
    const name = newUserName.trim();
    if (!name || !newUserPassword.trim()) {
      setError('Brukernavn og passord kan ikke være tomt.');
      return;
    }

    try {
      const auth = await api.post<AuthResponse>('/onboarding/users', { name, password: newUserPassword });
      setAccessToken(auth.accessToken);
      setRefreshToken(auth.refreshToken);
      setCurrentUser(auth.user);
      setNewUserName('');
      setNewUserPassword('');
      setError('');
      setInfo('Bruker opprettet.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke opprette bruker.');
    }
  };

  const createCollective = async () => {
    if (!currentUser) return;
    const name = collectiveName.trim();
    if (!name) {
      setError('Kollektivnavn kan ikke være tomt.');
      return;
    }

    try {
      const created = await api.post<CollectiveDto>('/onboarding/collectives', {
        name,
        ownerUserId: currentUser.id,
      });
      const updated = { ...currentUser, collectiveCode: created.joinCode };
      setCurrentUser(updated);
      setCollectiveName('');
      setError('');
      setInfo(`Kollektiv opprettet. Kode: ${created.joinCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke opprette kollektiv.');
    }
  };

  const joinCollective = async () => {
    if (!currentUser) return;
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError('Skriv inn en kollektivkode.');
      return;
    }

    try {
      const updated = await api.post<AppUser>('/onboarding/collectives/join', {
        userId: currentUser.id,
        joinCode: code,
      });
      setCurrentUser(updated);
      setJoinCode('');
      setError('');
      setInfo(`Du er med i kollektiv ${updated.collectiveCode}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kunne ikke joine kollektiv.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-cyan-50 to-emerald-100 p-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <Card className="p-6 bg-white/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-100">
              <Home className="w-6 h-6 text-sky-700" />
            </div>
            <div>
              <h1>Kollektiv Hub</h1>
              <p className="text-sm text-gray-600">Logg inn eller opprett en bruker for å starte.</p>
            </div>
          </div>
        </Card>

        {!currentUser && (
          <Card className="p-6 bg-white/90 space-y-4">
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Logg inn</TabsTrigger>
                <TabsTrigger value="create">Ny bruker</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-3 mt-4">
                <Input
                  placeholder="Navn"
                  value={loginName}
                  onChange={(e) => {
                    setError('');
                    setLoginName(e.target.value);
                  }}
                />
                <Input
                  type="password"
                  placeholder="Passord"
                  value={loginPassword}
                  onChange={(e) => {
                    setError('');
                    setLoginPassword(e.target.value);
                  }}
                />
                <Button className="w-full" onClick={() => void login()}>
                  <LogIn className="w-4 h-4 mr-2" />
                  Logg inn
                </Button>
              </TabsContent>

              <TabsContent value="create" className="space-y-3 mt-4">
                <Input
                  placeholder="Nytt navn"
                  value={newUserName}
                  onChange={(e) => {
                    setError('');
                    setNewUserName(e.target.value);
                  }}
                />
                <Input
                  type="password"
                  placeholder="Passord (minst 8 tegn)"
                  value={newUserPassword}
                  onChange={(e) => {
                    setError('');
                    setNewUserPassword(e.target.value);
                  }}
                />
                <Button className="w-full" onClick={() => void createUser()}>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Opprett bruker
                </Button>
              </TabsContent>
            </Tabs>
          </Card>
        )}

        {currentUser && !currentUser.collectiveCode && (
          <Card className="p-6 bg-white/90 space-y-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-cyan-700" />
              <h3>Hei {currentUser.name}, sett opp kollektiv</h3>
            </div>

            <div className="space-y-2">
              <Input
                placeholder="Nytt kollektivnavn"
                value={collectiveName}
                onChange={(e) => {
                  setError('');
                  setCollectiveName(e.target.value);
                }}
              />
              <Button className="w-full" onClick={() => void createCollective()}>
                Opprett kollektiv
              </Button>
            </div>

            <div className="h-px bg-gray-200" />

            <div className="space-y-2">
              <Input
                placeholder="Kollektivkode"
                value={joinCode}
                onChange={(e) => {
                  setError('');
                  setJoinCode(e.target.value);
                }}
              />
              <Button variant="outline" className="w-full" onClick={() => void joinCollective()}>
                <KeyRound className="w-4 h-4 mr-2" />
                Join med kode
              </Button>
            </div>
          </Card>
        )}

        {currentUser && currentUser.collectiveCode && (
          <Card className="p-6 bg-white/90 space-y-3">
            <p className="text-sm text-gray-600">
              Innlogget som <span className="font-medium text-gray-900">{currentUser.name}</span>
            </p>
            <p className="text-sm text-gray-600">
              Kollektivkode: <span className="font-medium text-gray-900">{currentUser.collectiveCode}</span>
            </p>
            <Button onClick={() => onAuthenticated(currentUser)} className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600">
              Gå til appen
            </Button>
          </Card>
        )}

        {error && <Card className="p-3 bg-red-50 text-red-700 border-red-200">{error}</Card>}
        {info && <Card className="p-3 bg-emerald-50 text-emerald-700 border-emerald-200">{info}</Card>}
      </div>
    </div>
  );
}
