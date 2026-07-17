import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, User, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/section";
import { SITE } from "@/lib/site";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: `Login — ${SITE.name}` }],
  }),
  beforeLoad: async () => {},
  component: AuthPage,
});

function isValidPhone(p: string) {
  return p.replace(/\D/g, "").length >= 10;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
      else navigate({ to: "/dashboard" });
    } else if (mode === "signup") {
      const fullName = String(fd.get("full_name") ?? "").trim();
      const phone = String(fd.get("phone") ?? "").trim();
      if (!isValidPhone(phone)) {
        toast.error("Please enter a valid mobile number (at least 10 digits).");
        setLoading(false);
        return;
      }
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, phone } },
      });
      if (error) toast.error(error.message);
      else toast.success("Check your email to verify account.");
    } else if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + "/reset-password",
      });
      if (error) toast.error(error.message);
      else {
        setSentTo(email);
        toast.success("Password reset link sent! Check your email.");
      }
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/dashboard" },
    });
    if (error) {
      toast.error(error.message);
      setLoading(false);
    }
  }

  function switchMode(next: "login" | "signup" | "forgot") {
    setMode(next);
    setSentTo(null);
  }

  return (
    <Section className="flex min-h-[80vh] items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md glass-strong rounded-3xl p-8 shadow-2xl"
      >
        <div className="text-center space-y-2 mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            {mode === "login" ? "Student Login" : mode === "signup" ? "Create Account" : "Reset Password"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {mode === "login"
              ? "Access your dashboard, classes and notes."
              : mode === "signup"
              ? "Join our community and start preparing."
              : "Enter your email and we'll send you a reset link."}
          </p>
        </div>

        {/* Google Login Button */}
        {mode !== "forgot" && (
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            className="w-full mb-4 glass hover:bg-background/80"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09a6.97 6.97 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>
        )}

        {mode !== "forgot" && (
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">Or</span></div>
          </div>
        )}

        {mode === "forgot" && sentTo ? (
          <div className="text-center space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              We've sent a password reset link to <span className="font-medium text-foreground">{sentTo}</span>.
              Click the link in the email to set a new password.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => switchMode("login")}
            >
              Back to Sign In
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input name="full_name" placeholder="Full Name" className="pl-9 glass" required />
              </div>
            )}
            {mode === "signup" && (
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  type="tel"
                  name="phone"
                  placeholder="Mobile number"
                  className="pl-9 glass"
                  maxLength={15}
                  required
                  onChange={(e) => {
                    e.currentTarget.value = e.currentTarget.value.replace(/[^\d+ ]/g, "");
                  }}
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input type="email" name="email" placeholder="Email address" className="pl-9 glass" required />
            </div>
            {mode !== "forgot" && (
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input type="password" name="password" placeholder="Password" className="pl-9 glass" required />
              </div>
            )}

            {mode === "login" && (
              <div className="text-right -mt-2">
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs text-muted-foreground hover:text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button type="submit" className="w-full rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-all">
              {loading ? <Loader2 className="animate-spin" /> : (mode === "login" ? "Sign In" : mode === "signup" ? "Sign Up" : "Send Reset Link")}
            </Button>
          </form>
        )}

        <div className="mt-6 text-center text-sm">
          {mode === "forgot" ? (
            !sentTo && (
              <button
                onClick={() => switchMode("login")}
                className="text-primary font-medium hover:underline"
              >
                Back to Sign In
              </button>
            )
          ) : (
            <button
              onClick={() => switchMode(mode === "login" ? "signup" : "login")}
              className="text-primary font-medium hover:underline"
            >
              {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
            </button>
          )}
        </div>
      </motion.div>
    </Section>
  );
}
