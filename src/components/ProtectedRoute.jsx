import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDataStore } from '../store/dataStore';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { bootstrapped, bootstrap } = useDataStore();

  const approved = user?.approval_status === 'approved' && !user?.cloud_blocked;

  useEffect(() => {
    if (approved && !bootstrapped) {
      bootstrap().catch(() => {});
    }
  }, [approved, bootstrapped, bootstrap]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!approved) {
    return <Navigate to="/pending-approval" replace />;
  }

  if (!bootstrapped) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading store data…</div>;
  }

  return children;
}
