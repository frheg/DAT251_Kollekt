import { useState } from 'react';
import { Home, KeyRound, LogIn, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { Card } from './ui/card';
import { AnimatedButton } from './ui/AnimatedButton';
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
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [collectiveName, setCollectiveName] = useState('');
  const [rooms, setRooms] = useState<{ name: string; minutes: number }[]>([
    { name: '', minutes: 10 },
    { name: '', minutes: 10 },
  ]);
  const [residentNames, setResidentNames] = useState<string[]>([]);
  const [residentInput, setResidentInput] = useState('');
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
    const email = newUserEmail.trim().toLowerCase();

    if (!name || !email || !newUserPassword.trim()) {
      setError('Velg et navn, e-post og et passord for å opprette bruker.');
      return;
    }

    try {
      const auth = await api.post<AuthResponse>('/onboarding/users', {
        name,
        email,
        password: newUserPassword,
      });
      setAccessToken(auth.accessToken);
      setRefreshToken(auth.refreshToken);
      setCurrentUser(auth.user);
      setNewUserName('');
      setNewUserEmail('');
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
    if (rooms.length < 1 || rooms.some(r => !r.name.trim() || r.minutes < 1)) {
      setError('Legg til minst ett rom med navn og minutter.');
      return;
    }
    const residents = residentNames.filter(n => n.trim() && n !== currentUser.name);
    try {
      const created = await api.post<CollectiveDto>('/onboarding/collectives', {
        name,
        ownerUserId: currentUser.id,
        numRooms: rooms.length,
        rooms: rooms.map(r => ({ name: r.name, minutes: r.minutes })),
        residents,
      });

      const updatedUser = { ...currentUser, collectiveCode: created.joinCode };
      setCurrentUser(updatedUser);
      setCollectiveName('');
      setRooms([
        { name: '', minutes: 10 },
        { name: '', minutes: 10 },
      ]);
      setResidentNames([]);
      setResidentInput('');
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
        <Card className="overflow-hidden border-border bg-card text-foreground shadow-xl">
          <div className="flex h-full flex-col justify-between gap-8 p-6 sm:p-8">
            <div className="space-y-6">
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-background">
                <Home className="size-6" />
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Kollektiv Hub
                </p>
                <h1 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl text-foreground">
                  Hold styr på hverdagen uten rot og dobbeltarbeid.
                </h1>
                <p className="max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Samle oppgaver, kalender, fellesutgifter og meldinger på ett sted som er enkelt å bruke – enten du er på mobilen eller slapper av på sofaen.                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-muted p-4">
                <p className="text-sm font-medium text-foreground">1. Logg inn</p>
                <p className="mt-1 text-sm text-muted-foreground">Bruk eksisterende bruker eller opprett en ny på under ett minutt.</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted p-4">
                <p className="text-sm font-medium text-foreground">2. Samle gjengen</p>
                <p className="mt-1 text-sm text-muted-foreground">Opprett kollektiv eller bli med via koden du har fått.</p>
              </div>
              <div className="rounded-2xl border border-border bg-muted p-4">
                <p className="text-sm font-medium text-foreground">3. Kom i gang</p>
                <p className="mt-1 text-sm text-muted-foreground">Få oversikt over husarbeid, avtaler og felleskostnader med en gang.</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-border bg-card">
          <div className="space-y-6 p-6 sm:p-8">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Start her</p>
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">Kom inn i kollektivet</h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Først logger du inn. Deretter velger du hvilket kollektiv du vil bruke.
              </p>
            </div>

            {!currentUser && (
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Logg inn</TabsTrigger>
                  <TabsTrigger value="create" className="text-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Ny bruker</TabsTrigger>
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

                    <AnimatedButton className="w-full" type="submit">
                      <LogIn className="size-4" />
                      Logg inn
                    </AnimatedButton>
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
                      <Label htmlFor="new-user-email">E-post</Label>
                      <Input
                        id="new-user-email"
                        type="email"
                        placeholder="din@email.no"
                        value={newUserEmail}
                        onChange={(event) => {
                          clearMessages();
                          setNewUserEmail(event.target.value);
                        }}
                        required
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

                    <AnimatedButton className="w-full" type="submit">
                      <UserPlus className="size-4" />
                      Opprett bruker
                    </AnimatedButton>
                  </form>
                </TabsContent>
              </Tabs>
            )}

            {currentUser && !currentUser.collectiveCode && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-muted p-4 shadow-sm">
                  <p className="text-sm text-muted-foreground">Innlogget som</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{currentUser.name}</p>
                </div>

                <div className="rounded-2xl border border-border p-4 shadow-sm">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                      <Users className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Opprett et nytt kollektiv</h3>
                      <p className="text-sm leading-6 text-muted-foreground">
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
                    <div className="space-y-2">
                      <Label>Rom i kollektivet</Label>
                      <div className="flex flex-col gap-2">
                        {rooms.map((room, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <Input
                              placeholder="Navn på rom (f.eks. Kjøkken)"
                              value={room.name}
                              onChange={e => {
                                const updated = [...rooms];
                                updated[idx].name = e.target.value;
                                setRooms(updated);
                              }}
                            />
                            <Input
                              type="number"
                              min={1}
                              style={{ width: 80 }}
                              placeholder="Minutter"
                              value={room.minutes}
                              onChange={e => {
                                const updated = [...rooms];
                                updated[idx].minutes = Number(e.target.value);
                                setRooms(updated);
                              }}
                            />
                            <span className="text-xs text-muted-foreground">minutter</span>
                            <button
                              type="button"
                              className="text-rose-500 hover:text-rose-700"
                              onClick={() => setRooms(rooms.filter((_, i) => i !== idx))}
                              aria-label="Fjern rom"
                            >×</button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="text-blue-600 hover:underline text-sm mt-1 self-start"
                          onClick={() => setRooms([...rooms, { name: '', minutes: 10 }])}
                        >Legg til rom</button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="residents">Beboere (navn eller e-post, én per linje)</Label>
                      <div className="flex gap-2">
                        <Input
                          id="residents"
                          value={residentInput}
                          onChange={e => setResidentInput(e.target.value)}
                          placeholder="Navn eller e-post"
                          onKeyDown={e => {
                            if (e.key === 'Enter' && residentInput.trim()) {
                              setResidentNames(prev => [...prev, residentInput.trim()]);
                              setResidentInput('');
                              e.preventDefault();
                            }
                          }}
                        />
                        <AnimatedButton
                          onClick={() => {
                            if (residentInput.trim()) {
                              setResidentNames(prev => [...prev, residentInput.trim()]);
                              setResidentInput('');
                            }
                          }}
                          type="button"
                        >Legg til</AnimatedButton>
                      </div>
                      <ul className="mt-1 mb-2 flex flex-wrap gap-2">
                        {residentNames.map((name, idx) => (
                          <li key={idx} className="bg-slate-100 rounded px-2 py-1 text-xs flex items-center gap-1">
                            {name}
                            <button
                              type="button"
                              className="ml-1 text-rose-500 hover:text-rose-700"
                              onClick={() => setResidentNames(prev => prev.filter((_, i) => i !== idx))}
                              aria-label="Fjern beboer"
                            >×</button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <AnimatedButton className="w-full" type="submit">
                      Opprett kollektiv
                    </AnimatedButton>
                  </form>
                </div>

                <div className="rounded-2xl border border-border p-4 shadow-sm">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <KeyRound className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Bli med med kode</h3>
                      <p className="text-sm leading-6 text-muted-foreground">
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

                    <AnimatedButton className="w-full" type="submit">
                      <KeyRound className="size-4" />
                      Bli med i kollektiv
                    </AnimatedButton>
                  </form>
                </div>
              </div>
            )}

            {currentUser && currentUser.collectiveCode && (
              <div className="space-y-4">
                <div className="rounded-2xl border border-primary bg-primary/10 p-4 text-primary-foreground shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
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

                <AnimatedButton className="w-full" onClick={() => onAuthenticated(currentUser)}>
                  Gå til oversikten
                </AnimatedButton>
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
