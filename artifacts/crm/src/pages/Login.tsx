import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { Phone, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const loginMutation = useLogin({
    mutation: {
      onSuccess(data) {
        login(data.user as Parameters<typeof login>[0], data.token);
        if (data.user.role === "admin") {
          setLocation("/admin/dashboard");
        } else {
          setLocation("/agent/dashboard");
        }
        toast.success(`Welcome back, ${data.user.name}!`);
      },
      onError(err) {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? "Login failed";
        toast.error(msg);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Email and password are required"); return; }
    loginMutation.mutate({ data: { email, password } });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center">
            <Phone size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg text-sidebar-foreground">SalesPulse CRM</span>
        </div>

        <div>
          <blockquote className="text-sidebar-foreground/70 text-xl font-light leading-relaxed italic">
            "The platform that turned our team of 8 agents into a revenue machine. $2.4M closed in 90 days."
          </blockquote>
          <div className="mt-6 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary font-bold">R</div>
            <div>
              <div className="text-sidebar-foreground text-sm font-semibold">Raj Mehta</div>
              <div className="text-sidebar-foreground/50 text-xs">VP Sales, TechCorp India</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 text-center">
          {[["10k+", "Leads Managed"], ["98%", "Uptime"], ["3.2x", "Avg. Conversion"]].map(([val, label]) => (
            <div key={label}>
              <div className="text-sidebar-primary text-2xl font-bold">{val}</div>
              <div className="text-sidebar-foreground/50 text-xs mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <div className="lg:hidden flex items-center gap-2.5 mb-6">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Phone size={16} className="text-white" />
              </div>
              <span className="font-bold text-base">SalesPulse CRM</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Sign in to your account</h1>
            <p className="text-muted-foreground text-sm mt-1">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3.5 py-2.5 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-shadow"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-shadow"
                  autoComplete="current-password"
                />
                <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 px-4 rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loginMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
              Sign In
            </button>
          </form>

          <div className="mt-8 p-4 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground font-medium mb-2">Demo credentials — click to fill:</p>
            <div className="space-y-1.5">
              {[
                { label: "Admin", email: "admin@demo.com", password: "demo1234" },
                { label: "Agent", email: "agent@demo.com", password: "demo1234" },
              ].map(c => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => { setEmail(c.email); setPassword(c.password); }}
                  className="w-full flex items-center justify-between px-3 py-1.5 rounded-md hover:bg-background transition-colors text-xs text-muted-foreground group"
                >
                  <span className="font-medium group-hover:text-foreground transition-colors">{c.label}</span>
                  <span className="font-mono group-hover:text-foreground transition-colors">{c.email} / {c.password}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
