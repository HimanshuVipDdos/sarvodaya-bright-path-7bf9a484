import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, Lock, User, ChevronLeft, Phone, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/section";
import { SITE } from "@/lib/site";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: `Student Login — ${SITE.name}` },
      { name: "description", content: "Sign in to your student dashboard." },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

type Method = "email" | "phone";

function AuthPage() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<Method>("email");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);

  // phone otp state
  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");

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
        toast.success("Account created! Check your email if confirmation is required.");
        navigate({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/dashboard" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (res.error) {
      toast.error(res.error.message ?? "Google sign-in failed");
      setLoading(false);
      return;
    }
    if (res.redirected) return;
    navigate({ to: "/dashboard" });
  }

  async function handleForgotPassword() {
    const email = prompt("Enter your email to receive a password reset link:");
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + "/reset-password",
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset email sent!");
  }

  function normalizePhone(raw: string) {
    const digits = raw.replace(/[^\d+]/g, "");
    if (digits.startsWith("+")) return digits;
    if (digits.length === 10) return `+91${digits}`;
    return `+${digits}`;
  }

  async function sendOtp() {
    if (!phone.trim()) return toast.error("Enter mobile number");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: normalizePhone(phone) });
      if (error) throw error;
      setOtpSent(true);
      toast.success("OTP sent! Check your SMS.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    if (!otp.trim()) return toast.error("Enter OTP");
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizePhone(phone),
        token: otp.trim(),
        type: "sms",
      });
      if (error) throw error;
      toast.success("Signed in!");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Section>
      <div className="mx-auto max-w-md">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-8">
          <div className="text-center">
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">{mode === "login" ? "Welcome back" : "Create account"}</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{mode === "login" ? "Student Login" : "Sign Up"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {mode === "login" ? "Access your dashboard, classes and notes." : "Join Sarvodaya Adhyeta to start preparing."}
            </p>
          </div>

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

          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setMethod("email"); setOtpSent(false); }}
              className={`rounded-2xl py-2 text-xs font-semibold transition ${method === "email" ? "bg-primary text-primary-foreground" : "glass"}`}
            >
              <Mail className="mr-1 inline h-3.5 w-3.5" /> Email
            </button>
            <button
              type="button"
              onClick={() => setMethod("phone")}
              className={`rounded-2xl py-2 text-xs font-semibold transition ${method === "phone" ? "bg-primary text-primary-foreground" : "glass"}`}
            >
              <Phone className="mr-1 inline h-3.5 w-3.5" /> Mobile OTP
            </button>
          </div>

          {method === "email" && (
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
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" name="password" required minLength={6} placeholder="Password" className="glass border-0 pl-9" />
              </div>
              <Button type="submit" disabled={loading} className="w-full rounded-2xl bg-gradient-to-br from-primary to-primary-glow py-6 text-base font-semibold shadow-elegant">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "login" ? "Login" : "Create account"}
              </Button>
              {mode === "login" && (
                <button type="button" onClick={handleForgotPassword} className="mt-1 w-full text-center text-xs text-muted-foreground hover:text-primary">
                  Forgot password?
                </button>
              )}
            </form>
          )}

          {method === "phone" && (
            <div className="space-y-3">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Mobile number (10 digits)"
                  disabled={otpSent}
                  className="glass border-0 pl-9"
                />
              </div>
              {otpSent && (
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="glass border-0 pl-9 tracking-widest"
                  />
                </div>
              )}
              <Button
                type="button"
                onClick={otpSent ? verifyOtp : sendOtp}
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-br from-primary to-primary-glow py-6 text-base font-semibold shadow-elegant"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : otpSent ? "Verify OTP & Login" : "Send OTP"}
              </Button>
              {otpSent && (
                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(""); }}
                  className="w-full text-center text-xs text-muted-foreground hover:text-primary"
                >
                  Change number
                </button>
              )}
              <p className="text-center text-[10px] text-muted-foreground">
                We'll send you a one-time password via SMS.
              </p>
            </div>
          )}

          {method === "email" && (
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "login" ? "New here?" : "Already a member?"}{" "}
              <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="font-medium text-primary">
                {mode === "login" ? "Create an account" : "Login"}
              </button>
            </div>
          )}
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

