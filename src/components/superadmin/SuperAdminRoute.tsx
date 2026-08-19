import { Navigate } from 'react-router-dom';
import { useSuperAdmin } from '../../contexts/SuperAdminContext';
import { useAuth } from '../../contexts/AuthContext';

export default function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { loading: authLoading } = useAuth();
  const { isSuperAdmin, loading } = useSuperAdmin();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
