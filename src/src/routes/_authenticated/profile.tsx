import { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Save, User, Phone, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const profileQuery = queryOptions({
  queryKey: ["my-profile"],
  queryFn: async () => {
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw new Error("Not signed in.");
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id,full_name,phone")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { userId: userData.user.id, email: userData.user.email ?? "", profile };
  },
});

function isValidPhone(p: string) {
  const digits = p.replace(/\D/g, "");
  return digits.length >= 10;
}

export const Route = createFileRoute("/_authenticated/profile")({
  validateSearch: (search: Record<string, unknown>) => ({
    setup: search.setup === "1",
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  component: ProfilePage,
});

function ProfilePage() {
  const { data } = useSuspenseQuery(profileQuery);
  const { setup } = Route.useSearch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(data.profile?.full_name ?? "");
  const [phone, setPhone] = useState(data.profile?.phone ?? "");

  useEffect(() => {
    setFullName(data.profile?.full_name ?? "");
    setPhone(data.profile?.phone ?? "");
  }, [data.profile?.full_name, data.profile?.phone]);

  const isIncomplete = !data.profile?.full_name?.trim() || !data.profile?.phone?.trim();
  const mustComplete = setup || isIncomplete;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = fullName.trim();
      const trimmedPhone = phone.trim();
      if (!trimmedName) throw new Error("Name can't be empty.");
      if (!isValidPhone(trimmedPhone)) throw new Error("Please enter a valid mobile number (at least 10 digits).");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: data.userId, full_name: trimmedName, phone: trimmedPhone });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Profile saved!");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
      if (mustComplete) {
        navigate({ to: "/dashboard" });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section>
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Account</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">
          {mustComplete ? "Complete your profile" : "My Profile"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mustComplete
            ? "Add your name and mobile number to continue."
            : "This name shows on the leaderboard and on your live class comments."}
        </p>
      </div>

      {mustComplete && (
        <div className="mx-auto mb-4 flex max-w-lg items-start gap-2 rounded-2xl bg-primary/10 p-4 text-sm text-primary">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Name and mobile number are required before you can access batches, tests and lectures.</span>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-lg">
        <div className="glass-strong rounded-3xl p-6 sm:p-8">
          <div className="space-y-5">
            <div>
              <Label className="mb-1.5 flex items-center gap-1.5 text-xs">
                <Mail className="h-3.5 w-3.5" /> Email
              </Label>
              <Input value={data.email} disabled className="bg-muted/50" />
              <p className="mt-1 text-[11px] text-muted-foreground">Email can't be changed here.</p>
            </div>

            <div>
              <Label className="mb-1.5 flex items-center gap-1.5 text-xs">
                <User className="h-3.5 w-3.5" /> Full name *
              </Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                maxLength={80}
              />
            </div>

            <div>
              <Label className="mb-1.5 flex items-center gap-1.5 text-xs">
                <Phone className="h-3.5 w-3.5" /> Mobile number *
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d+ ]/g, ""))}
                placeholder="10-digit mobile number"
                maxLength={15}
              />
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="w-full gap-2"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {mustComplete ? "Save & Continue" : "Save changes"}
            </Button>
          </div>
        </div>
      </motion.div>
    </Section>
  );
}
