import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';
import AppLayout from './components/AppLayout';
import LoginPage from './pages/LoginPage';
import CreateHouseholdPage from './pages/CreateHouseholdPage';
import DashboardPage from './pages/DashboardPage';
import TasksPage from './pages/TasksPage';
import CalendarPage from './pages/CalendarPage';
import ChatPage from './pages/ChatPage';
import EconomyPage from './pages/EconomyPage';
import PantTrackerPage from './pages/PantTrackerPage';
import LeaderboardPage from './pages/LeaderboardPage';
import GamesPage from './pages/GamesPage';
import CollektGamePage from './pages/CollektGamePage';
import ProfilePage from './pages/ProfilePage';

// Guard for auth-only pages that don't need a collective (create-household)
function AuthOnlyRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useUser();
  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full gradient-primary animate-pulse" />
    </div>
  );
  if (!currentUser) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Guard for login page: redirect already-authed users
function GuestOnlyRoute({ children }: { children: React.ReactNode }) {
  const { currentUser, isLoading } = useUser();
  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full gradient-primary animate-pulse" />
    </div>
  );
  if (currentUser) {
    return <Navigate to={currentUser.collectiveCode ? '/' : '/create-household'} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnlyRoute><LoginPage /></GuestOnlyRoute>} />
      <Route
        path="/create-household"
        element={<AuthOnlyRoute><CreateHouseholdPage /></AuthOnlyRoute>}
      />
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/economy" element={<EconomyPage />} />
        <Route path="/economy/pant" element={<PantTrackerPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/games/kollekt" element={<CollektGamePage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <UserProvider>
        <AppRoutes />
      </UserProvider>
    </BrowserRouter>
  );
}
