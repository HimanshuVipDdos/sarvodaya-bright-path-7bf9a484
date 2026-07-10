import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Mail, ChevronLeft, Phone, KeyRound, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/section";
import { SITE } from "@/lib/site";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: `Student Login — ${SITE.name}` },
      { name: "description", content: "Sign in to your student dashboard with a one-time password." },
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
  const [loading, setLoading] = useState(false);

  // Email OTP state
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");

  // Phone OTP state
  const [phone, setPhone] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState("");

  function normalizePhone(raw: string) {
    const digits = raw.replace(/[^\d+]/g, "");
    if (digits.startsWith("+")) return digits;
    if (digits.length === 10) return `+91${digits}`;
    return `+${digits}`;
  }

  async function sendEmailOtp() {
    if (!email.trim()) return toast.error("Enter your email");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          data: fullName.trim() ? { full_name: fullName.trim() } : undefined,
          emailRedirectTo: window.location.origin + "/dashboard",
        },
      });
      if (error) throw error;
      setEmailOtpSent(true);
      toast.success("OTP sent! Check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyEmailOtp() {
    if (!emailOtp.trim()) return toast.error("Enter the OTP");
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: emailOtp.trim(),
        type: "email",
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

  async function sendPhoneOtp() {
    if (!phone.trim()) return toast.error("Enter mobile number");
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: normalizePhone(phone) });
      if (error) throw error;
      setPhoneOtpSent(true);
      toast.success("OTP sent! Check your SMS.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function verifyPhoneOtp() {
    if (!phoneOtp.trim()) return toast.error("Enter OTP");
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: normalizePhone(phone),
        token: phoneOtp.trim(),
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
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Welcome</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">Student Login</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with a one-time password — no need to remember any password.
            </p>
          </div>

          <div className="mb-4 mt-6 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setMethod("email"); setPhoneOtpSent(false); }}
              className={`rounded-2xl py-2 text-xs font-semibold transition ${method === "email" ? "bg-primary text-primary-foreground" : "glass"}`}
            >
              <Mail className="mr-1 inline h-3.5 w-3.5" /> Email OTP
            </button>
            <button
              type="button"
              onClick={() => { setMethod("phone"); setEmailOtpSent(false); }}
              className={`rounded-2xl py-2 text-xs font-semibold transition ${method === "phone" ? "bg-primary text-primary-foreground" : "glass"}`}
            >
              <Phone className="mr-1 inline h-3.5 w-3.5" /> Mobile OTP
            </button>
          </div>

          {method === "email" && (
            <div className="space-y-3">
              {!emailOtpSent && (
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full name (only for new accounts)"
                    className="glass border-0 pl-9"
                  />
                </div>
              )}
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  disabled={emailOtpSent}
                  className="glass border-0 pl-9"
                />
              </div>
              {emailOtpSent && (
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    inputMode="numeric"
                    value={emailOtp}
                    onChange={(e) => setEmailOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="glass border-0 pl-9 tracking-widest"
                  />
                </div>
              )}
              <Button
                type="button"
                onClick={emailOtpSent ? verifyEmailOtp : sendEmailOtp}
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-br from-primary to-primary-glow py-6 text-base font-semibold shadow-elegant"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : emailOtpSent ? "Verify OTP & Login" : "Send OTP to email"}
              </Button>
              {emailOtpSent && (
                <button
                  type="button"
                  onClick={() => { setEmailOtpSent(false); setEmailOtp(""); }}
                  className="w-full text-center text-xs text-muted-foreground hover:text-primary"
                >
                  Change email
                </button>
              )}
              <p className="text-center text-[10px] text-muted-foreground">
                We'll email you a 6-digit code. New here? Just enter your name and email — account is created automatically.
              </p>
            </div>
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
                  disabled={phoneOtpSent}
                  className="glass border-0 pl-9"
                />
              </div>
              {phoneOtpSent && (
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    inputMode="numeric"
                    value={phoneOtp}
                    onChange={(e) => setPhoneOtp(e.target.value)}
                    placeholder="Enter 6-digit OTP"
                    className="glass border-0 pl-9 tracking-widest"
                  />
                </div>
              )}
              <Button
                type="button"
                onClick={phoneOtpSent ? verifyPhoneOtp : sendPhoneOtp}
                disabled={loading}
                className="w-full rounded-2xl bg-gradient-to-br from-primary to-primary-glow py-6 text-base font-semibold shadow-elegant"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : phoneOtpSent ? "Verify OTP & Login" : "Send OTP"}
              </Button>
              {phoneOtpSent && (
                <button
                  type="button"
                  onClick={() => { setPhoneOtpSent(false); setPhoneOtp(""); }}
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
