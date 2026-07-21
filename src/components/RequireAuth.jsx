import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { LogIn } from "lucide-react";

export default function RequireAuth({ children, message = "Sign in to access this feature" }) {
  const { isAuthenticated, isLoadingAuth } = useAuth();
  const location = useLocation();
  const loginHref = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`;

  if (isLoadingAuth) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div
          className="w-10 h-10 border-2 border-[#106B49]/30 border-t-[#106B49] rounded-full animate-spin"
          role="status"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (isAuthenticated) return children;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-[#14192E] flex items-center justify-center mx-auto mb-5">
          <LogIn size={28} className="text-slate-300" aria-hidden />
        </div>
        <h1 className="text-xl font-bold text-[#14192E] mb-2">Sign in required</h1>
        <p className="text-slate-600 mb-6">{message}</p>
        <Link
          to={loginHref}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#0C4F37] text-white font-semibold hover:bg-[#065f46] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0C4F37] focus-visible:ring-offset-2"
        >
          <LogIn size={16} aria-hidden />
          Sign In
        </Link>
      </div>
    </div>
  );
}
