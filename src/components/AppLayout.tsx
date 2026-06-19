import { Outlet, Navigate } from 'react-router-dom';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';
import { useUser } from '../context/UserContext';

export default function AppLayout() {
  const { currentUser, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="app-viewport bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full gradient-primary animate-pulse" />
      </div>
    );
  }

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!currentUser.collectiveCode) return <Navigate to="/create-household" replace />;

  return (
    <div className="app-viewport bg-background max-w-lg mx-auto relative">
      <AppHeader />
      <main className="safe-content-bottom px-4 pt-2">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
