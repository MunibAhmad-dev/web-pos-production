import { Navigate, Outlet } from 'react-router-dom';
import { useMfgAuth } from '../../context/ManufacturingAuthContext';

export default function ManufacturingProtectedRoute() {
  const { mfgUser } = useMfgAuth();
  if (!mfgUser) return <Navigate to="/manufacturing/login" replace />;
  if (mfgUser.approval_status !== 'approved') return <Navigate to="/manufacturing/pending" replace />;
  return <Outlet />;
}
