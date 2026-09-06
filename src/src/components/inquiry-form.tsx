import { useState } from "react";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, Send, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const schema = z.object({
  full_name: z.string().trim().min(2, "Enter your full name").max(100),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(20),
  class_level: z.string().trim().max(50).optional().or(z.literal("")),
  exam_target: z.string().trim().max(120).optional().or(z.literal("")),
  message: z.string().trim().max(1000).optional().or(z.literal("")),
});

export function InquiryForm() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("inquiries").insert({
      full_name: parsed.data.full_name,
      phone: parsed.data.phone,
      class_level: parsed.data.class_level || null,
      exam_target: parsed.data.exam_target || null,
      message: parsed.data.message || null,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Couldn't submit. Please try again.");
      return;
    }
    setDone(true);
    toast.success("Thanks! We'll reach out shortly.");
    (e.target as HTMLFormElement).reset();
    setTimeout(() => setDone(false), 4000);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input name="full_name" placeholder="Full name" required className="glass border-0" />
        <Input name="phone" placeholder="Mobile number" required className="glass border-0" />
        <Input name="class_level" placeholder="Class / Education" className="glass border-0" />
        <Input name="exam_target" placeholder="Exam preparing for" className="glass border-0" />
      </div>
      <Textarea name="message" placeholder="Your message (optional)" rows={4} className="glass border-0" />
      <motion.div whileTap={{ scale: 0.98 }}>
        <Button
          type="submit"
          disabled={submitting || done}
          className="w-full rounded-2xl bg-gradient-to-br from-primary to-primary-glow py-6 text-base font-semibold shadow-elegant"
        >
          {submitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…</>
          ) : done ? (
            <><CheckCircle2 className="mr-2 h-4 w-4" /> Sent</>
          ) : (
            <><Send className="mr-2 h-4 w-4" /> Submit Inquiry</>
          )}
        </Button>
      </motion.div>
    </form>
  );
}
