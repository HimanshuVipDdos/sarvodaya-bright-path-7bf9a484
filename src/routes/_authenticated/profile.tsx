import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Loader2, Save, User, Phone, Mail } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/profile")({
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  component: ProfilePage,
});

function ProfilePage() {
  const { data } = useSuspenseQuery(profileQuery);
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(data.profile?.full_name ?? "");
  const [phone, setPhone] = useState(data.profile?.phone ?? "");

  useEffect(() => {
    setFullName(data.profile?.full_name ?? "");
    setPhone(data.profile?.phone ?? "");
  }, [data.profile?.full_name, data.profile?.phone]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = fullName.trim();
      if (!trimmedName) throw new Error("Name can't be empty.");
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: data.userId, full_name: trimmedName, phone: phone.trim() || null });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Profile updated. Your new name will show on future comments.");
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section>
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Account</div>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This name shows on the leaderboard and on your live class comments.
        </p>
      </div>

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
                <User className="h-3.5 w-3.5" /> Full name
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
                <Phone className="h-3.5 w-3.5" /> Mobile number
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
              Save changes
            </Button>
          </div>
        </div>
      </motion.div>
    </Section>
  );
}
