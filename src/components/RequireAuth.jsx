import { Link } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { LogIn } from "lucide-react";

export default function RequireAuth({ children, message = "Sign in to access this feature" }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return children;

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center max-w-sm mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto mb-5">
          <LogIn size={28} className="text-slate-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Sign in required</h2>
        <p className="text-slate-400 mb-6">{message}</p>
        <Link
          to="/login"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#10b981] text-white font-semibold hover:bg-[#059669] transition-colors"
        >
          <LogIn size={16} />
          Sign In
        </Link>
      </div>
    </div>
  );
}
