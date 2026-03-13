import { useState } from 'react';
import { Home, KeyRound, LogIn, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Label } from './ui/label';
import { api, getUserMessage, setAccessToken, setRefreshToken } from '../lib/api';
import { StatusMessage } from './shared/page';
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

  const clearMessages = () => {
    setError('');
    setInfo('');
  };

  const login = async () => {
    const name = loginName.trim();

    if (!name || !loginPassword.trim()) {
      setError('Skriv inn navn og passord for å logge inn.');
      return;
    }

    try {
      const auth = await api.post<AuthResponse>('/onboarding/login', {
        name,
        password: loginPassword,
      });
      setAccessToken(auth.accessToken);
      setRefreshToken(auth.refreshToken);
      clearMessages();
      setCurrentUser(auth.user);
    } catch (err) {
      setError(getUserMessage(err, 'Kunne ikke logge inn akkurat nå.'));
    }
  };

  const createUser = async () => {
    const name = newUserName.trim();

    if (!name || !newUserPassword.trim()) {
      setError('Velg et navn og et passord for å opprette bruker.');
      return;
    }

    try {
      const auth = await api.post<AuthResponse>('/onboarding/users', {
        name,
        password: newUserPassword,
      });
      setAccessToken(auth.accessToken);
      setRefreshToken(auth.refreshToken);
      setCurrentUser(auth.user);
      setNewUserName('');
      setNewUserPassword('');
      clearMessages();
      setInfo('Brukeren er klar. Velg eller opprett et kollektiv videre nedenfor.');
    } catch (err) {
      setError(getUserMessage(err, 'Kunne ikke opprette bruker akkurat nå.'));
    }
  };

  const createCollective = async () => {
    if (!currentUser) return;

    const name = collectiveName.trim();
    if (!name) {
      setError('Gi kollektivet et navn før du fortsetter.');
      return;
    }

    try {
      const created = await api.post<CollectiveDto>('/onboarding/collectives', {
        name,
        ownerUserId: currentUser.id,
      });

      const updatedUser = { ...currentUser, collectiveCode: created.joinCode };
      setCurrentUser(updatedUser);
      setCollectiveName('');
      clearMessages();
      setInfo(`Kollektivet er opprettet. Del koden ${created.joinCode} med de andre.`);
    } catch (err) {
      setError(getUserMessage(err, 'Kunne ikke opprette kollektiv akkurat nå.'));
    }
  };

  const joinCollective = async () => {
    if (!currentUser) return;

    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setError('Skriv inn koden du har fått.');
      return;
    }

    try {
      const updatedUser = await api.post<AppUser>('/onboarding/collectives/join', {
        userId: currentUser.id,
        joinCode: code,
      });

      setCurrentUser(updatedUser);
      setJoinCode('');
      clearMessages();
      setInfo('Du er med. Fortsett til oversikten når du er klar.');
    } catch (err) {
      setError(getUserMessage(err, 'Kunne ikke bli med i kollektivet akkurat nå.'));
    }
  };

  return (
    <div className="min-h-dvh px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden border-slate-200/80 bg-slate-900 text-white shadow-xl">
          <div className="flex h-full flex-col justify-between gap-8 p-6 sm:p-8">
            <div className="space-y-6">
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-white/10">
                <Home className="size-6" />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                  Kollektiv Hub
                </p>
                <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
                  Hold styr på hverdagen uten rot og dobbeltarbeid.
                </h1>
                <p className="max-w-xl text-sm leading-7 text-slate-300 sm:text-base">
                  Samle oppgaver, kalender, fellesutgifter og meldinger i ett rolig grensesnitt som fungerer like godt fra mobilen som fra sofaen.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">1. Logg inn</p>
                <p className="mt-1 text-sm text-slate-300">Bruk eksisterende bruker eller opprett en ny på under ett minutt.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">2. Samle gjengen</p>
                <p className="mt-1 text-sm text-slate-300">Opprett kollektiv eller bli med via koden du har fått.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-medium text-white">3. Kom i gang</p>
                <p className="mt-1 text-sm text-slate-300">Få oversikt over husarbeid, avtaler og felleskostnader med en gang.</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-slate-200/80 bg-white/92">
          <div className="space-y-6 p-6 sm:p-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Start her</p>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Kom inn i kollektivet</h2>
              <p className="text-sm leading-6 text-slate-600">
                Først logger du inn. Deretter velger du hvilket kollektiv du vil bruke.
              </p>
            </div>

            {!currentUser && (
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Logg inn</TabsTrigger>
                  <TabsTrigger value="create">Ny bruker</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-4">
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void login();
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="login-name">Navn</Label>
                      <Input
                        id="login-name"
                        placeholder="For eksempel Magnus"
                        value={loginName}
                        onChange={(event) => {
                          clearMessages();
                          setLoginName(event.target.value);
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="login-password">Passord</Label>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="Skriv inn passordet ditt"
                        value={loginPassword}
                        onChange={(event) => {
                          clearMessages();
                          setLoginPassword(event.target.value);
                        }}
                      />
                    </div>

                    <Button className="w-full" type="submit">
                      <LogIn className="size-4" />
                      Logg inn
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="create" className="mt-4">
                  <form
                    className="space-y-4"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void createUser();
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="new-user-name">Navn</Label>
                      <Input
                        id="new-user-name"
                        placeholder="Hva vil du kalles?"
                        value={newUserName}
                        onChange={(event) => {
                          clearMessages();
                          setNewUserName(event.target.value);
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-user-password">Passord</Label>
                      <Input
                        id="new-user-password"
                        type="password"
                        placeholder="Minst 8 tegn"
                        value={newUserPassword}
                        onChange={(event) => {
                          clearMessages();
                          setNewUserPassword(event.target.value);
                        }}
                      />
                    </div>

                    <Button className="w-full" type="submit">
                      <UserPlus className="size-4" />
                      Opprett bruker
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            )}

            {currentUser && !currentUser.collectiveCode && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                  <p className="text-sm text-slate-600">Innlogget som</p>
                  <p className="mt-1 text-lg font-semibold text-slate-950">{currentUser.name}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-900 text-white">
                      <Users className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-950">Opprett et nytt kollektiv</h3>
                      <p className="text-sm leading-6 text-slate-600">
                        Du får en kode som du kan dele med resten av kollektivet.
                      </p>
                    </div>
                  </div>

                  <form
                    className="space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void createCollective();
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="collective-name">Navn på kollektivet</Label>
                      <Input
                        id="collective-name"
                        placeholder="For eksempel Parkveien 12"
                        value={collectiveName}
                        onChange={(event) => {
                          clearMessages();
                          setCollectiveName(event.target.value);
                        }}
                      />
                    </div>

                    <Button className="w-full" type="submit">
                      Opprett kollektiv
                    </Button>
                  </form>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4 shadow-sm">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                      <KeyRound className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-950">Bli med med kode</h3>
                      <p className="text-sm leading-6 text-slate-600">
                        Har noen allerede opprettet kollektivet? Skriv inn koden her.
                      </p>
                    </div>
                  </div>

                  <form
                    className="space-y-3"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void joinCollective();
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="join-code">Invitasjonskode</Label>
                      <Input
                        id="join-code"
                        placeholder="Skriv inn koden"
                        value={joinCode}
                        onChange={(event) => {
                          clearMessages();
                          setJoinCode(event.target.value);
                        }}
                      />
                    </div>

                    <Button className="w-full" variant="outline" type="submit">
                      <KeyRound className="size-4" />
                      Bli med i kollektiv
                    </Button>
                  </form>
                </div>
              </div>
            )}

            {currentUser && currentUser.collectiveCode && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                      <ShieldCheck className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Alt er klart</p>
                      <p className="text-sm leading-6">
                        Du er logget inn som <span className="font-semibold">{currentUser.name}</span> og bruker koden{' '}
                        <span className="font-semibold">{currentUser.collectiveCode}</span>.
                      </p>
                    </div>
                  </div>
                </div>

                <Button className="w-full" onClick={() => onAuthenticated(currentUser)}>
                  Gå til oversikten
                </Button>
              </div>
            )}

            {error && <StatusMessage tone="rose">{error}</StatusMessage>}
            {info && <StatusMessage tone="emerald">{info}</StatusMessage>}
          </div>
        </Card>
      </div>
    </div>
  );
}
