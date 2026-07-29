import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDataStore } from '../store/dataStore';
import LoadingScreen from './LoadingScreen';

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
    return <LoadingScreen message="Verifying session…" submessage="Checking your account status" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!approved) {
    return <Navigate to="/pending-approval" replace />;
  }

  if (!bootstrapped) {
    return <LoadingScreen message="Loading store data…" submessage="Syncing products, customers & sales" />;
  }

  return children;
}
