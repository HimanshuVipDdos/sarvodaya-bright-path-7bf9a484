import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, User, ChevronLeft, ShieldCheck, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/section";
import { SITE } from "@/lib/site";
import { toast } from "sonner";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: `Student Login — ${SITE.name}` },
      { name: "description", content: "Sign in to your student dashboard." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    // Don't bounce recovery links (password reset) away to the dashboard.
    // Implicit flow puts "type=recovery" in the hash; PKCE flow puts "?code=..." in the query.
    if (window.location.hash.includes("type=recovery")) return;
    if (new URLSearchParams(window.location.search).has("code")) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

const OTP_LENGTH = 8;

// Turn raw Supabase error messages into clear, human-friendly copy.
function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const msg = raw.toLowerCase();

  if (msg.includes("invalid login credentials")) {
    return "Incorrect email or password. Please double-check and try again.";
  }
  if (msg.includes("email not confirmed")) {
    return "Please verify your email first. Check your inbox for the code, or sign up again to get a new one.";
  }
  if (msg.includes("user already registered") || msg.includes("already registered")) {
    return "An account with this email already exists. Try logging in instead.";
  }
  if (msg.includes("password should be at least") || msg.includes("password is too short")) {
    return "Your password is too short. Please use at least 6 characters.";
  }
  if (msg.includes("token has expired") || msg.includes("otp expired") || msg.includes("expired")) {
    return "This code has expired. Please request a new one.";
  }
  if (msg.includes("invalid otp") || msg.includes("invalid token") || msg.includes("token is invalid")) {
    return "That code isn't right. Please check it and try again.";
  }
  if (msg.includes("rate limit") || msg.includes("too many requests")) {
    return "Too many attempts. Please wait a minute before trying again.";
  }
  if (msg.includes("user not found") || msg.includes("unable to validate")) {
    return "We couldn't find an account with that email.";
  }
  if (msg.includes("network") || msg.includes("fetch failed") || msg.includes("failed to fetch")) {
    return "Network error. Please check your internet connection and try again.";
  }
  if (msg.includes("same password") || msg.includes("should be different from the old password")) {
    return "Your new password must be different from your current password.";
  }
  if (!raw) return "Something went wrong. Please try again.";
  return raw;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [loading, setLoading] = useState(false);

  // step: "form" (login/signup/forgot form) -> "otp" (email verification after signup)
  // -> "reset" (set a new password, entered via the recovery email link)
  const [step, setStep] = useState<"form" | "otp" | "reset">("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // If the user arrived here via the "reset password" email link, Supabase
  // fires a PASSWORD_RECOVERY event once it reads the token from the URL.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStep("reset");
      }
    });

    // Fallback for the PKCE flow: the code exchange can finish before this
    // listener mounts, so if we landed with "?code=" and end up with a
    // session, show the reset form directly.
    const hasRecoveryCode =
      new URLSearchParams(window.location.search).has("code") ||
      window.location.hash.includes("type=recovery");
    if (hasRecoveryCode) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) setStep("reset");
      });
    }

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    const full_name = String(fd.get("full_name") || "").trim();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { full_name },
            emailRedirectTo: window.location.origin + "/dashboard",
          },
        });
        if (error) throw error;
        // Don't log the user in yet — they must verify the OTP sent to their email first.
        setPendingEmail(email);
        setOtp("");
        setStep("otp");
        toast.success(`We've sent a ${OTP_LENGTH}-digit code to your email.`);
      } else if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/auth",
        });
        if (error) throw error;
        toast.success("If an account exists for that email, a reset link has been sent.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp() {
    if (otp.length !== OTP_LENGTH) {
      toast.error(`Enter the ${OTP_LENGTH}-digit code sent to your email.`);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: pendingEmail,
        token: otp,
        type: "signup",
      });
      if (error) throw error;
      toast.success("Email verified! Welcome to Sarvodaya Adhyeta.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: pendingEmail,
      });
      if (error) throw error;
      toast.success("New code sent.");
      setResendCooldown(30);
      const interval = setInterval(() => {
        setResendCooldown((s) => {
          if (s <= 1) {
            clearInterval(interval);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/dashboard",
      },
    });
    if (error) {
      toast.error(friendlyAuthError(error));
      setLoading(false);
    }
  }

  async function handleSetNewPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match. Please re-enter them.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated! You're now logged in.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  // ---- Set a new password (after clicking the reset-password email link) ----
  if (step === "reset") {
    return (
      <Section>
        <div className="mx-auto max-w-md">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-8">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <KeyRound className="h-6 w-6" />
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight">Set a new password</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a new password for your account.
              </p>
            </div>

            <form onSubmit={handleSetNewPassword} className="mt-6 space-y-3">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  required
                  minLength={6}
                  placeholder="New password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="glass border-0 pl-9"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="glass border-0 pl-9"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-br from-primary to-primary-glow py-6 text-base font-semibold shadow-elegant"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
              </Button>
            </form>
          </motion.div>
        </div>
      </Section>
    );
  }

  // ---- OTP verification (after signup) ----
  if (step === "otp") {
    return (
      <Section>
        <div className="mx-auto max-w-md">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-8">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight">Verify your email</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter the {OTP_LENGTH}-digit code sent to <span className="font-medium text-foreground">{pendingEmail}</span>
              </p>
            </div>

            <div className="mt-6 flex justify-center">
              <InputOTP maxLength={OTP_LENGTH} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="button"
              disabled={loading || otp.length !== OTP_LENGTH}
              onClick={handleVerifyOtp}
              className="mt-6 w-full rounded-2xl bg-gradient-to-br from-primary to-primary-glow py-6 text-base font-semibold shadow-elegant"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & continue"}
            </Button>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              Didn't get the code?{" "}
              <button
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || loading}
                className="font-medium text-primary disabled:opacity-50"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </button>
            </div>

            <div className="mt-2 text-center">
              <button
                onClick={() => { setStep("form"); setOtp(""); }}
                className="inline-flex items-center text-xs text-muted-foreground hover:text-primary"
              >
                <ChevronLeft className="mr-1 h-3 w-3" /> Use a different email
              </button>
            </div>
          </motion.div>
        </div>
      </Section>
    );
  }

  // ---- Login / Signup / Forgot password form ----
  return (
    <Section>
      <div className="mx-auto max-w-md">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-8">
          <div className="text-center">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
              {mode === "login" ? "Welcome back" : mode === "signup" ? "Create account" : "Reset password"}
            </div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              {mode === "login" ? "Student Login" : mode === "signup" ? "Sign Up" : "Forgot Password"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login"
                ? "Access your dashboard, classes and notes."
                : mode === "signup"
                ? "Join Sarvodaya Adhyeta to start preparing."
                : "Enter your email and we'll send you a reset link."}
            </p>
          </div>

          {mode !== "forgot" && (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={loading}
                onClick={handleGoogle}
                className="mt-6 w-full rounded-2xl glass py-6 text-base"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09a6.97 6.97 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </Button>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                or
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === "signup" && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input name="full_name" required placeholder="Full name" className="glass border-0 pl-9" />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="email" name="email" required placeholder="Email" className="glass border-0 pl-9" />
            </div>
            {mode !== "forgot" && (
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" name="password" required minLength={6} placeholder="Password" className="glass border-0 pl-9" />
              </div>
            )}

            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full rounded-2xl bg-gradient-to-br from-primary to-primary-glow py-6 text-base font-semibold shadow-elegant">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "login" ? (
                "Login"
              ) : mode === "signup" ? (
                "Create account"
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            {mode === "login" && (
              <>
                New here?{" "}
                <button onClick={() => setMode("signup")} className="font-medium text-primary">
                  Create an account
                </button>
              </>
            )}
            {mode === "signup" && (
              <>
                Already a member?{" "}
                <button onClick={() => setMode("login")} className="font-medium text-primary">
                  Login
                </button>
              </>
            )}
            {mode === "forgot" && (
              <button
                onClick={() => setMode("login")}
                className="inline-flex items-center font-medium text-primary"
              >
                <ChevronLeft className="mr-1 h-3 w-3" /> Back to login
              </button>
            )}
          </div>
        </motion.div>

        <div className="mt-4 text-center">
          <a href="/" className="inline-flex items-center text-xs text-muted-foreground hover:text-primary">
            <ChevronLeft className="mr-1 h-3 w-3" /> Back to home
          </a>
        </div>
      </div>
    </Section>
  );
}
