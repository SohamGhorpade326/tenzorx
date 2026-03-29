import { motion } from "framer-motion";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Mail, Lock, Github, Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";

// Hardcoded credentials (demo purposes)
const DEMO_CREDENTIALS = {
  email: "demo@workstream.io",
  password: "demo123"
};

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  // Pre-fill with demo credentials
  const [email, setEmail] = useState(DEMO_CREDENTIALS.email);
  const [password, setPassword] = useState(DEMO_CREDENTIALS.password);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Check hardcoded credentials
    if (
      email === DEMO_CREDENTIALS.email &&
      password === DEMO_CREDENTIALS.password
    ) {
      // Use auth context to login
      login(email);
      navigate("/dashboard");
    } else {
      setError("Invalid email or password. Use demo@workstream.io / demo123");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left Panel - Branding & Value Proposition */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-12 flex-col justify-between relative overflow-hidden"
      >
        {/* Animated background blobs */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Workstream AI</h1>
              <p className="text-sm text-slate-300 font-medium">Enterprise Workflows</p>
            </div>
          </div>
        </div>

        {/* Value Proposition */}
        <div className="relative z-10 space-y-8">
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-4xl font-bold text-white leading-tight tracking-tight"
            >
              Automate Your
              <br />
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Enterprise Workflows</span>
              <br />
              with AI Agents
            </motion.h2>
          </div>

          {/* Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-4"
          >
            <div className="flex gap-3">
              <div className="flex h-8 w-8 rounded-lg bg-blue-500/20 items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Smart Automation</h3>
                <p className="text-sm text-slate-400">AI-powered agents handle meetings, procurement, contracts & onboarding</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-8 w-8 rounded-lg bg-purple-500/20 items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Real-time Collaboration</h3>
                <p className="text-sm text-slate-400">Stay synced with team activities and decisions across workflows</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex h-8 w-8 rounded-lg bg-blue-500/20 items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Enterprise Security</h3>
                <p className="text-sm text-slate-400">SOC 2 Compliant • 99.9% Uptime • Role-based access control</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Footer text */}
        <div className="relative z-10">
          <p className="text-xs text-slate-400 font-medium">
            ✨ Demo Account Pre-Filled • Sign In Now to Explore
          </p>
        </div>
      </motion.div>

      {/* Right Panel - Login Form */}
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6 }}
        className="flex-1 flex items-center justify-center p-8 bg-background"
      >
        <div className="w-full max-w-md">
          <Card className="p-8 border-0 shadow-lg bg-card">
            {/* Header */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">Welcome Back</h2>
              <p className="text-sm text-muted-foreground">Sign in to your Workstream AI account</p>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-foreground">Password</label>
                  <a href="#" className="text-xs text-primary hover:underline">Forgot password?</a>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive"
                >
                  {error}
                </motion.div>
              )}

              {/* Login Button */}
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold h-10"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {/* Divider */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground font-medium">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* SSO Buttons with Clerk Integration */}
            <div className="space-y-3">
              <button className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 border border-slate-700 text-white font-medium flex items-center justify-center gap-2 transition-all hover:shadow-lg">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3.03-.405 1.05 0 2.07.135 3.03.405 2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.003 12.003 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>Continue with GitHub</span>
              </button>
              <button className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium flex items-center justify-center gap-2 transition-all hover:shadow-lg">
                <Chrome className="h-4 w-4" />
                <span>Continue with Google</span>
              </button>
            </div>

            {/* Clerk Auth Section */}
            <div className="mt-6 pt-6 border-t border-border">
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-1">
                      Enterprise Single Sign-On
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mb-3">
                      Clerk provides secure authentication with support for multiple OAuth providers, passwordless login, and multi-factor authentication.
                    </p>
                    <button className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">
                      Learn about Clerk → 
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sign Up Link */}
            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Demo credentials are pre-filled.{" "}
                <a href="#" className="text-primary font-medium hover:underline">
                  Create an account
                </a>
              </p>
            </div>
          </Card>

          {/* Trust Signals */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-8 text-center"
          >
            <p className="text-xs text-muted-foreground font-medium">
              🔒 Enterprise security • SOC 2 Type II • GDPR Compliant • Clerk Authentication
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
