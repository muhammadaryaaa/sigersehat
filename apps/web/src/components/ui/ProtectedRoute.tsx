import { Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import type { ReactNode } from "react";
// Proteksi halaman per role (diperkuat penegakan server di API — ini lapisan tampilan).
export function ProtectedRoute({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <main className="p-6" aria-live="polite">Memuat…</main>;
  if (!me) return <Navigate to="/masuk" replace />;
  if (!roles.includes(me.user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
