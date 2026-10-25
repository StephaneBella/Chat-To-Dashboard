import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="app-bg flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-[12px] text-on-surface-variant">
          <span className="material-symbols-outlined animate-spin text-[18px]">
            progress_activity
          </span>
          Chargement...
        </div>
      </div>
    );
  }

  if (status === "anon") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
