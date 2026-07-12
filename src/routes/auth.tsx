import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  // REDIRECT LOGIC REMOVED TAAKI PAGE FLICKER NA HO
  beforeLoad: async () => {
    return;
  },
  component: AuthPage,
});

const OTP_LENGTH = 8;

function friendlyAuthError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const msg = raw.toLowerCase();
  if (msg.includes("invalid login credentials")) return "Incorrect email or password. Please double-check and try again.";
  if (msg.includes("email not confirmed")) return "Please verify your email first. Check your inbox for the code, or sign up again to get a new one.";
  if (msg.includes("user already registered") || msg.includes("already registered")) return "An account with this email already exists. Try logging in instead.";
  if (msg.includes("password should be at least") || msg.includes("password is too short")) return "Your password is too short. Please use at least 6 characters.";
  if (msg.includes("token has expired") || msg.includes("otp expired") || msg.includes("expired")) return "This code has expired. Please request a new one.";
  if (msg.includes("invalid otp") || msg.includes("invalid token") || msg.includes("token is invalid")) return "That code isn't right. Please check it and try again.";
  if (msg.includes("rate limit") || msg.includes("too many requests")) return "Too many attempts. Please wait a minute before trying again.";
  if (msg.includes("user not found") || msg.includes("unable to validate")) return "We couldn't find an account with that email.";
  if (msg.includes("network") || msg.includes("fetch failed") || msg.includes("failed to fetch")) return "Network error. Please check your internet connection and try again.";
  if (msg.includes("same password") || msg.includes("should be different from the old password")) return "Your new password must be different from your current password.";
  if (!raw) return "Something went wrong. Please try again.";
  return raw;
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"form" | "otp" | "reset">("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStep("reset");
      }
    });
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
              <p className="mt-1 text-sm text-muted-foreground">Choose a new password for your account.</p>
            </div>
            <form onSubmit={handleSetNewPassword} className="mt-6 space-y-3">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" required minLength={6} placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="glass border-0 pl-9" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="password" required minLength={6} placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="glass border-0 pl-9" />
              </div>
              <Button type="submit" disabled={loading} className="w-full rounded-2xl bg-gradient-to-br from-primary to-primary-glow py-6 text-base font-semibold shadow-elegant">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
              </Button>
            </form>
          </motion.div>
        </div>
      </Section>
    );
  }

  if (step === "otp") {
    return (
      <Section>
        <div className="mx-auto max-w-md">
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-8">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-
