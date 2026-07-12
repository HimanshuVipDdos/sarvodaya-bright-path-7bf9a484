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
  if (msg.includes("user already registered")) return "An account with this email already exists. Try logging in instead.";
  if (msg.includes("password should be at least") || msg.includes("password is too short")) return "Your password is too short. Please use at least 6 characters.";
  if (msg.includes("token has expired")) return "This code has expired. Please request a new one.";
  if (msg.includes("invalid otp")) return "That code isn't right. Please check it and try again.";
  if (msg.includes("rate limit")) return "Too many attempts. Please wait a minute before trying again.";
  if (msg.includes("user not found")) return "We couldn't find an account with that email.";
  if (msg.includes("network")) return "Network error. Please check your internet connection and try again.";
  if (msg.includes("same password")) return "Your new password must be different from your current password.";
  return raw || "Something went wrong. Please try again.";
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
      toast.success("Email verified!");
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
      toast.error("Passwords don't match.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated!");
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
            <h1 className="text-3xl font-bold tracking-tight text-center">Set a new password</h1>
            <form onSubmit={handleSetNewPassword} className="mt-6 space-y-3">
              <Input type="password" required placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="glass border-0" />
              <Input type="password" required placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="glass border-0" />
              <Button type="submit" disabled={loading} className="w-full">Update password</Button>
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
            <h1 className="text-3xl font-bold tracking-tight text-center">Verify your email</h1>
            <div className="mt-6 flex justify-center">
              <InputOTP maxLength={OTP_LENGTH} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }).map((_, i) => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button onClick={handleVerifyOtp} disabled={loading} className="mt-6 w-full">Verify</Button>
          </motion.div>
        </div>
      </Section>
    );
  }

  return (
    <Section>
      <div className="mx-auto max-w-md">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="glass-strong rounded-3xl p-8">
          <h1 className="text-3xl font-bold tracking-tight text-center">{mode === "login" ? "Student Login" : "Sign Up"}</h1>
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            {mode === "signup" && <Input name="full_name" required placeholder="Full name" className="glass border-0" />}
            <Input type="email" name="email" required placeholder="Email" className="glass border-0" />
            <Input type="password" name="password" required minLength={6} placeholder="Password" className="glass border-0" />
            <Button type="submit" className="w-full">{mode === "login" ? "Login" : "Create account"}</Button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-sm text-primary">
              {mode === "login" ? "Create an account" : "Login instead"}
            </button>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}
