import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft, Video, FileText, ClipboardList, Radio, Clock, Calendar,
  BookOpen, Bell, ExternalLink, PlayCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/video-player";
import { LiveChat } from "@/components/live-chat";

const batchPortalQuery = (slug: string) =>
  queryOptions({
    queryKey: ["my-batch", slug],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Not signed in");

      const { data: batch } = await supabase
        .from("batches").select("*").eq("slug", slug).maybeSingle();
      if (!batch) throw notFound();

      const { data: enrollment } = await supabase
        .from("enrollments").select("*")
        .eq("user_id", userId).eq("batch_id", batch.id).maybeSingle();

      const { data: roles } = await supabase
        .from("user_roles").select("role
