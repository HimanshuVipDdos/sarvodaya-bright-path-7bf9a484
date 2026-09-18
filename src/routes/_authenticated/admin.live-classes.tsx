import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Clock3, Hash, Loader2, MessageSquare, Pencil, Plus, Radio, Save, TimerReset, Trash2, User, XCircle, Sparkles, Zap, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn, getStorageUrl } from "@/lib/utils";
import { VideoLinkInputWithPreview } from "@/components/admin/video-link-preview";
import { LectureLiveSwitcher } from "@/components/admin/lecture-live-switcher";

type LiveClass = {
  id: string; title: string; batch_id: string | null; description: string | null; scheduled_at: string;
  end_at: string | null; duration_minutes: number | null; is_live: boolean; auto_start: boolean;
  auto_end: boolean; recorded_lecture_id: string | null; thumbnail_url: string | null; youtube_url: string | null;
  zoom_url: string | null; meet_url: string | null;
  subject: string | null; chapter: string | null; lecture_number: number | null;
  faculty: string | null;
};
type Batch = { id: string; title: string };
type Form = Omit<LiveClass, "id" | "scheduled_at" | "end_at" | "duration_minutes" | "recorded_lecture_id" | "subject" | "chapter" | "lecture_number" | "faculty"> & {
  date: string; startTime: string; endTime: string;
  subject: string; chapter: string; lecture_number: string; faculty: string;
};

function getNowLocalParts() {
  const now = new Date();
  const start = toLocalParts(now.toISOString());
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
  const end = toLocalParts(oneHourLater.toISOString());
  return { date: start.date, startTime: start.time, endTime: end.time };
}

const emptyForm = (): Form => {
  const t = getNowLocalParts();
  return {
    title: "", batch_id: null, description: "", date: t.date,
    startTime: t.startTime, endTime: t.endTime,
    is_live: false, auto_start: true, auto_end: true,
    thumbnail_url: "", youtube_url: "", zoom_url: "", meet_url: "",
    subject: "", chapter: "", lecture_number: "", faculty: "",
  };
};

function toLocalParts(value: string) {
  const date = new Date(value);
  const formatted = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const part = (name: string) => formatted.find((p) => p.type === name)?.value ?? "";
  const hour = part("hour") === "24" ? "00" : part("hour");
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${hour}:${part("minute")}` };
}
function makeIndiaIso(date: string, time: string) { return `${date}T${time}:00+05:30`; }
function formatSchedule(value: string) { return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export const Route = createFileRoute("/_authenticated/admin/live-classes")({ component: LiveClassesAdmin });

function LiveClassesAdmin() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LiveClass | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["admin", "live_classes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("live_classes").select("*").order("scheduled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any as LiveClass[];
    },
  });
  const { data: batches = [] } = useQuery({
    queryKey: ["admin", "batch-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("batches").select("id,title").order("title");
      if (error) throw error;
      return (data ?? []) as Batch[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const scheduledAt = makeIndiaIso(form.date, form.startTime);
      const endAt = makeIndiaIso(form.date, form.endTime);
      const duration = Math.round((new Date(endAt).getTime() - new Date(scheduledAt).getTime()) / 60000);
      if (!form.title.trim()) throw new Error("Class title is required.");
      if (duration <= 0) throw new Error("End time must be after start time.");
      const lecNum = form.lecture_number.trim() ? parseInt(form.lecture_number, 10) : null;
      const payload = {
        title: form.title.trim(), batch_id: form.batch_id, description: form.description || null,
        scheduled_at: scheduledAt, duration_minutes: duration, is_live: form.is_live,
        auto_start: form.auto_start, auto_end: form.auto_end,
        thumbnail_url: form.thumbnail_url || null, youtube_url: form.youtube_url || null,
        zoom_url: form.zoom_url || null, meet_url: form.meet_url || null,
        subject: form.subject.trim() || null, chapter: form.chapter.trim() || null,
        lecture_number: (lecNum !== null && !isNaN(lecNum)) ? lecNum : null,
        faculty: form.faculty.trim() || null,
      };
      const client = supabase as unknown as { from: (table: string) => any };
      const result = editing
        ? await client.from("live_classes").update(payload).eq("id", editing.id)
        : await client.from("live_classes").insert(payload);
      if (result.error) throw result.error;

      if (form.faculty.trim()) {
        try {
          const raw = localStorage.getItem("sarvodaya_custom_faculties");
          const arr: string[] = raw ? JSON.parse(raw) : [];
          const name = form.faculty.trim();
          if (!arr.some((n) => n.toLowerCase() === name.toLowerCase())) {
            arr.unshift(name);
            localStorage.setItem("sarvodaya_custom_faculties", JSON.stringify(arr.slice(0, 50)));
          }
        } catch {}
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "live_classes"] });
      qc.invalidateQueries({ queryKey: ["admin-live-faculty-options"] });
      setOpen(false);
      toast.success(editing ? "Class timing updated" : "Live class scheduled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startLiveNow = useMutation({
    mutationFn: async (id: string) => {
      const nowIso = new Date().toISOString();
      const { error } = await (supabase as any)
        .from("live_classes")
        .update({
          is_live: true,
          status: "live",
          scheduled_at: nowIso,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "live_classes"] });
      toast.success("🔴 Class is now LIVE! Students have been notified.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const endNow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).rpc("end_live_class_now", { p_class_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "live_classes"] });
      qc.invalidateQueries({ queryKey: ["admin", "lectures"] });
      toast.success("Live class ended — recording archived to Lectures.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelClass = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("live_chat_messages").delete().eq("live_class_id", id);
      const { error } = await (supabase as any).from("live_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "live_classes"] });
      toast.success("Live class cancelled and removed.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const extend = useMutation({
    mutationFn: async (row: LiveClass) => {
      const currentEnd = new Date(row.end_at ?? row.scheduled_at).getTime();
      const newDuration = Math.round((currentEnd + 15 * 60000 - new Date(row.scheduled_at).getTime()) / 60000);
      const { error } = await (supabase as any).from("live_classes").update({ duration_minutes: newDuration }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "live_classes"] }); toast.success("15 minutes added."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteClass = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("live_chat_messages").delete().eq("live_class_id", id);
      const { error } = await (supabase as any).from("live_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "live_classes"] }); toast.success("Class deleted."); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (row: LiveClass) => {
    const start = toLocalParts(row.scheduled_at);
    const end = toLocalParts(row.end_at ?? new Date(new Date(row.scheduled_at).getTime() + (row.duration_minutes ?? 60) * 60000).toISOString());
    setEditing(row);
    setForm({
      title: row.title, batch_id: row.batch_id, description: row.description ?? "",
      date: start.date, startTime: start.time,
      endTime: end.time, is_live: row.is_live,
      auto_start: row.auto_start, auto_end: row.auto_end,
      thumbnail_url: row.thumbnail_url ?? "", youtube_url: row.youtube_url ?? "",
      zoom_url: row.zoom_url ?? "", meet_url: row.meet_url ?? "",
      subject: row.subject ?? "", chapter: row.chapter ?? "",
      lecture_number: row.lecture_number != null ? String(row.lecture_number) : "",
      faculty: row.faculty ?? "",
    });
    setOpen(true);
  };
  const status = (row: LiveClass) => row.is_live ? "Live now" : row.recorded_lecture_id ? "Recorded" : "Scheduled";

  return (
    <Section>
      <LectureLiveSwitcher current="live" onQuickAction={openCreate} quickActionLabel="Schedule / Start Live Class" />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Admin</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Live Classes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Schedule sessions with Subject/Chapter info. End a class to archive it as a recording.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setEditing(null);
              const f = emptyForm();
              f.is_live = true;
              setForm(f);
              setOpen(true);
            }}
            variant="outline"
            className="gap-2 border-red-500/40 text-red-600 hover:bg-red-500/10 dark:text-red-400"
          >
            <Radio className="h-4 w-4 animate-pulse text-red-500" /> 🔴 Start Live Now
          </Button>
          <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Schedule class</Button>
        </div>
      </div>

      <div className="glass-strong overflow-x-auto rounded-3xl p-4 sm:p-6">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-4">Class</th>
              <th className="py-2 pr-4">Subject / Chapter</th>
              <th className="py-2 pr-4">Start</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : classes.map((row) => (
              <tr key={row.id} className="border-b border-border/40 last:border-0">
                <td className="py-3 pr-4">
                  <div className="font-medium">{row.title}</div>
                  {row.lecture_number != null && (
                    <div className="text-[11px] text-muted-foreground">Lec #{row.lecture_number}</div>
                  )}
                </td>
                <td className="py-3 pr-4 text-[12px] text-muted-foreground">
                  {row.subject && <div className="font-medium text-foreground">{row.subject}</div>}
                  {row.chapter && <div>{row.chapter}</div>}
                  {!row.subject && !row.chapter && <span className="italic opacity-50">No chapter info</span>}
                </td>
                <td className="py-3 pr-4 whitespace-nowrap text-[12px]">{formatSchedule(row.scheduled_at)}</td>
                <td className="py-3 pr-4">
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    row.is_live
                      ? "bg-red-500/15 text-red-600 dark:text-red-400"
                      : row.recorded_lecture_id
                      ? "bg-emerald-500/15 text-emerald-600"
                      : "bg-primary/10 text-primary"
                  }`}>
                    {row.is_live ? "🔴 " : ""}{status(row)}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <div className="inline-flex flex-wrap justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(row)} aria-label="Edit">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!row.recorded_lecture_id && !row.is_live && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (window.confirm(`Start "${row.title}" right now as a LIVE class? Students will be notified.`)) {
                            startLiveNow.mutate(row.id);
                          }
                        }}
                        disabled={startLiveNow.isPending}
                        title="Go LIVE right now"
                        className="text-red-600 hover:bg-red-500/10 hover:text-red-700 font-semibold text-[11px] px-2"
                      >
                        <Radio className="h-3.5 w-3.5 animate-pulse text-red-500 mr-1" />
                        Go Live
                      </Button>
                    )}
                    {row.is_live && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          if (window.confirm(`End "${row.title}"? It will be automatically archived into Recorded Lectures under its Subject/Chapter.`)) {
                            endNow.mutate(row.id);
                          }
                        }}
                        disabled={endNow.isPending}
                        title="End live session and auto-archive to Lectures"
                        className="h-8 gap-1 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold"
                      >
                        <Radio className="h-3.5 w-3.5" />
                        <span className="text-[11px]">End Live</span>
                      </Button>
                    )}
                    {row.is_live && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => extend.mutate(row)} disabled={extend.isPending} title="Add 15 minutes">
                          <TimerReset className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                          title="Moderate Live Chat"
                          className="text-blue-600 hover:bg-blue-500/10 px-2"
                        >
                          <Link to="/admin/live-chat">
                            <MessageSquare className="h-4 w-4" />
                            <span className="ml-1 text-[11px] font-semibold hidden lg:inline">Chat</span>
                          </Link>
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm" variant="ghost"
                      onClick={() => { if (window.confirm(`Cancel "${row.title}"? No recording will be saved.`)) cancelClass.mutate(row.id); }}
                      disabled={cancelClass.isPending}
                      title="Cancel — delete without archiving"
                      className="text-orange-500 hover:bg-orange-500/10 hover:text-orange-600"
                    >
                      <XCircle className="h-4 w-4" />
                      <span className="ml-1 text-[11px] font-semibold hidden sm:inline">Cancel</span>
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing
                ? "Edit live class schedule"
                : form.is_live
                ? "🔴 Start Live Class Now (अभी तुरंत लाइव करें)"
                : "📅 Schedule New Live Class (लाइव क्लास शेड्यूल करें)"}
            </DialogTitle>
            <DialogDescription>
              {form.is_live
                ? "यूट्यूब लाइव लिंक डालें और शुरू करें। छात्र तुरंत लाइव देख पाएंगे।"
                : "Indian Standard Time (IST). क्लास खत्म होने पर रिकॉर्डेड सेक्शन में सेव हो जाएगी।"}
            </DialogDescription>
          </DialogHeader>
          <ClassForm form={form} setForm={setForm} batches={batches} />
          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t border-border/50 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className={cn(
                "gap-2",
                form.is_live && !editing ? "bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20" : ""
              )}
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : form.is_live && !editing ? <Radio className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
              {editing ? "Save changes" : form.is_live ? "Go Live Now (अभी लाइव शुरू करें)" : "Schedule Class (शेड्यूल करें)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function addMinutesToTime(timeStr: string, minutes: number) {
  if (!timeStr || !timeStr.includes(":")) return "00:00";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return "00:00";
  const total = (h * 60 + m + minutes) % (24 * 60);
  const newH = Math.floor(total / 60);
  const newM = total % 60;
  return `${String(newH).padStart(2, "0")}:${String(newM).padStart(2, "0")}`;
}

function ClassForm({ form, setForm, batches }: { form: Form; setForm: (value: Form) => void; batches: Batch[] }) {
  const duration = useMemo(() => {
    const start = new Date(makeIndiaIso(form.date, form.startTime));
    const end = new Date(makeIndiaIso(form.date, form.endTime));
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    return minutes > 0 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : "Choose an end time after start";
  }, [form]);

  const currentDurationMinutes = useMemo(() => {
    try {
      const start = new Date(makeIndiaIso(form.date, form.startTime));
      const end = new Date(makeIndiaIso(form.date, form.endTime));
      const mins = Math.round((end.getTime() - start.getTime()) / 60000);
      return mins > 0 ? mins : 0;
    } catch {
      return 0;
    }
  }, [form.date, form.startTime, form.endTime]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm({ ...form, [key]: value });

  const applyDuration = (mins: number) => {
    const newEnd = addMinutesToTime(form.startTime || "10:00", mins);
    set("endTime", newEnd);
  };

  const autoGenerateTitle = () => {
    const parts: string[] = [];
    if (form.subject?.trim()) parts.push(form.subject.trim());
    if (form.chapter?.trim()) parts.push(form.chapter.trim());
    if (form.lecture_number) parts.push(`Lecture ${form.lecture_number}`);
    if (parts.length > 0) {
      set("title", parts.join(" – "));
    } else {
      set("title", `Live Class – ${form.date}`);
    }
  };

  const { data: batchFolders } = useQuery({
    queryKey: ["admin-live-batch-folders", form.batch_id],
    enabled: Boolean(form.batch_id && form.batch_id !== "none"),
    queryFn: async () => {
      const [lecturesRes, materialsRes, liveRes] = await Promise.all([
        supabase.from("lectures").select("subject,chapter,lecture_number").eq("batch_id", form.batch_id as string),
        supabase.from("study_materials").select("subject,chapter").eq("batch_id", form.batch_id as string),
        supabase.from("live_classes").select("subject,chapter,lecture_number").eq("batch_id", form.batch_id as string),
      ]);
      const subjectsSet = new Set<string>();
      const subjectToChapters = new Map<string, Set<string>>();
      const maxLectureByFolder = new Map<string, number>();

      const addPair = (sub: string | null, ch: string | null) => {
        if (!sub?.trim()) return;
        const s = sub.trim();
        subjectsSet.add(s);
        if (!subjectToChapters.has(s)) subjectToChapters.set(s, new Set());
        if (ch?.trim()) subjectToChapters.get(s)!.add(ch.trim());
      };
      const trackLectureNumber = (sub: string | null, ch: string | null, num: number | null) => {
        if (!sub?.trim() || !ch?.trim() || num == null) return;
        const key = `${sub.trim()}|||${ch.trim()}`;
        maxLectureByFolder.set(key, Math.max(maxLectureByFolder.get(key) ?? 0, num));
      };

      (lecturesRes.data ?? []).forEach((l: any) => { addPair(l.subject, l.chapter); trackLectureNumber(l.subject, l.chapter, l.lecture_number); });
      (materialsRes.data ?? []).forEach((m: any) => addPair(m.subject, m.chapter));
      (liveRes.data ?? []).forEach((lc: any) => { addPair(lc.subject, lc.chapter); trackLectureNumber(lc.subject, lc.chapter, lc.lecture_number); });

      return {
        subjects: Array.from(subjectsSet).sort(),
        subjectToChapters: Object.fromEntries(
          Array.from(subjectToChapters.entries()).map(([k, v]) => [k, Array.from(v).sort()])
        ),
        nextLectureByFolder: Object.fromEntries(
          Array.from(maxLectureByFolder.entries()).map(([k, v]) => [k, v + 1])
        ) as Record<string, number>,
      };
    },
  });

  const suggestedLectureNumber = (() => {
    const sub = form.subject?.trim();
    const ch = form.chapter?.trim();
    if (!sub || !ch || !batchFolders) return null;
    return batchFolders.nextLectureByFolder?.[`${sub}|||${ch}`] ?? 1;
  })();

  const { data: facultyList = [] } = useQuery({
    queryKey: ["admin-live-faculty-options", form.batch_id],
    queryFn: async () => {
      const list: { name: string; photo_url: string | null; subject?: string | null }[] = [];
      const seenNames = new Set<string>();

      const addName = (name: string, photo_url: string | null = null, subject: string | null = null) => {
        const trimmed = name?.trim();
        if (!trimmed) return;
        const lower = trimmed.toLowerCase();
        if (seenNames.has(lower)) return;
        seenNames.add(lower);
        list.push({ name: trimmed, photo_url, subject });
      };

      // 1. Registered active faculty
      const { data: facs } = await supabase.from("faculty").select("name, photo_url, subject").eq("is_active", true).order("name");
      (facs ?? []).forEach((f) => addName(f.name, f.photo_url, f.subject));

      // 2. Batch faculty array
      if (form.batch_id && form.batch_id !== "none") {
        const { data: b } = await supabase.from("batches").select("faculty").eq("id", form.batch_id as string).maybeSingle();
        if (b?.faculty && Array.isArray(b.faculty)) {
          b.faculty.forEach((name: string) => addName(name));
        }
      }

      // 3. Previously entered live class faculty names
      try {
        const { data: pastLive } = await supabase.from("live_classes").select("faculty").not("faculty", "is", null).limit(100);
        (pastLive ?? []).forEach((row: any) => {
          if (row.faculty) addName(row.faculty);
        });
      } catch {}

      // 4. Previously entered lecture faculty names
      try {
        const { data: pastLec } = await supabase.from("lectures").select("faculty").not("faculty", "is", null).limit(100);
        (pastLec ?? []).forEach((row: any) => {
          if (row.faculty) addName(row.faculty);
        });
      } catch {}

      // 5. Custom faculty stored in localStorage
      try {
        const raw = localStorage.getItem("sarvodaya_custom_faculties");
        if (raw) {
          const arr: string[] = JSON.parse(raw);
          arr.forEach((n) => addName(n));
        }
      } catch {}

      return list;
    },
  });

  return (
    <div className="space-y-4">
      {/* STEP 1: Video Link & Live Preview */}
      <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-b from-primary/5 via-background to-background p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
            <Radio className="h-3.5 w-3.5 animate-pulse text-red-500" />
            Step 1: YouTube Live / Video Link
          </span>
          {form.youtube_url && (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="h-3 w-3" /> Link Detected
            </span>
          )}
        </div>
        <VideoLinkInputWithPreview
          value={form.youtube_url ?? ""}
          onChange={(url, autoThumb) => {
            set("youtube_url", url);
            if (autoThumb && (!form.thumbnail_url || form.thumbnail_url.includes("img.youtube.com"))) {
              set("thumbnail_url", autoThumb);
            }
          }}
          label="YouTube Live Stream Link (यूट्यूब लाइव लिंक डालें)"
          helper="यूट्यूब पर Live stream create करें और उसका लिंक यहाँ पेस्ट करें। थंबनेल अपने आप लग जाएगा!"
          placeholder="https://youtu.be/... ya https://youtube.com/live/..."
        />
      </div>

      {/* STEP 2: When to Go Live */}
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5 text-primary" /> Step 2: Live Timing & Schedule (समय चुनें)
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={() => {
              const t = getNowLocalParts();
              setForm({
                ...form,
                is_live: true,
                auto_start: true,
                date: t.date,
                startTime: t.startTime,
                endTime: t.endTime,
              });
            }}
            className={cn(
              "flex flex-col items-start p-3.5 rounded-xl border-2 transition text-left cursor-pointer",
              form.is_live
                ? "border-red-500 bg-red-500/10 shadow-sm"
                : "border-border/60 hover:border-border hover:bg-muted/40"
            )}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              🔴 अभी तुरंत लाइव करें
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              Start immediately right now. Students will receive instant notification!
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setForm({
                ...form,
                is_live: false,
              });
            }}
            className={cn(
              "flex flex-col items-start p-3.5 rounded-xl border-2 transition text-left cursor-pointer",
              !form.is_live
                ? "border-primary bg-primary/10 shadow-sm"
                : "border-border/60 hover:border-border hover:bg-muted/40"
            )}
          >
            <div className="flex items-center gap-2 font-bold text-sm text-foreground">
              <CalendarDays className="h-4 w-4 text-primary" />
              📅 बाद के लिए शेड्यूल करें
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
              Schedule for today evening or future date/time.
            </p>
          </button>
        </div>

        {/* Timing inputs */}
        <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t border-border/50">
          <div>
            <Label className="text-xs font-semibold flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-primary" /> Class Date (तारीख)
            </Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5 text-primary" /> Start Time (शुरू होने का समय)
            </Label>
            <Input
              type="time"
              value={form.startTime}
              onChange={(e) => {
                const newStart = e.target.value;
                set("startTime", newStart);
                if (currentDurationMinutes > 0) {
                  set("endTime", addMinutesToTime(newStart, currentDurationMinutes));
                }
              }}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-semibold flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5 text-primary" /> End Time (खत्म होने का समय)
            </Label>
            <Input
              type="time"
              value={form.endTime}
              onChange={(e) => set("endTime", e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        {/* Quick Duration Pills */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-muted-foreground">
            ⏱️ Quick Duration (क्लास कितनी देर की है?):
          </span>
          {[
            { label: "45 Min", mins: 45 },
            { label: "1 Hour", mins: 60 },
            { label: "1.5 Hours", mins: 90 },
            { label: "2 Hours", mins: 120 },
          ].map((d) => (
            <button
              key={d.mins}
              type="button"
              onClick={() => applyDuration(d.mins)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer",
                currentDurationMinutes === d.mins
                  ? "border-primary bg-primary text-primary-foreground shadow-xs"
                  : "border-border/70 bg-background hover:bg-muted text-foreground"
              )}
            >
              {d.label}
            </button>
          ))}
          <span className="ml-auto text-xs font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded">
            Duration: {duration}
          </span>
        </div>
      </div>

      {/* STEP 3: Batch, Subject, Chapter & Lecture # */}
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> Step 3: Class Subject & Chapter (बैच और चैप्टर)
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="text-xs font-semibold">Target Batch (किस बैच के लिए है?)</Label>
            <Select value={form.batch_id ?? "none"} onValueChange={(v) => set("batch_id", v === "none" ? null : v)}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select target batch" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No batch (All Students)</SelectItem>
                {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold">Subject (सब्जेक्ट)</Label>
            <Input
              value={form.subject}
              onChange={(e) => set("subject", e.target.value)}
              placeholder="e.g. Mathematics"
              className="mt-1"
            />
            {batchFolders?.subjects && batchFolders.subjects.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {batchFolders.subjects.map((sub: string) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => set("subject", sub)}
                    className={cn(
                      "px-2 py-0.5 rounded text-[11px] font-medium border transition cursor-pointer",
                      form.subject === sub ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted text-foreground border-border/60"
                    )}
                  >
                    📁 {sub}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="text-xs font-semibold">Chapter (चैप्टर)</Label>
            <Input
              value={form.chapter}
              onChange={(e) => set("chapter", e.target.value)}
              placeholder="e.g. Algebra"
              className="mt-1"
            />
            {batchFolders && (() => {
              const activeSub = form.subject?.trim();
              const list = activeSub && batchFolders.subjectToChapters?.[activeSub]
                ? batchFolders.subjectToChapters[activeSub]
                : Array.from(new Set(Object.values(batchFolders.subjectToChapters ?? {}).flat())).sort();
              if (!list || list.length === 0) return null;
              return (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {list.map((ch: string) => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => set("chapter", ch)}
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-medium border transition cursor-pointer",
                        form.chapter === ch ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted text-foreground border-border/60"
                      )}
                    >
                      📖 {ch}
                    </button>
                  ))}
                </div>
              );
            })()}
          </div>

          <div className="sm:col-span-2 grid gap-3 sm:grid-cols-2 pt-2 border-t border-border/40">
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1">
                <Hash className="h-3 w-3 text-primary" /> Lecture # (लेक्चर नंबर)
              </Label>
              <Input
                type="number"
                min={1}
                value={form.lecture_number}
                onChange={(e) => set("lecture_number", e.target.value)}
                placeholder="e.g. 1"
                className="mt-1"
              />
              {suggestedLectureNumber != null && form.lecture_number !== String(suggestedLectureNumber) && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => set("lecture_number", String(suggestedLectureNumber))}
                    className="px-2 py-0.5 rounded-md text-[11px] font-bold border transition bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 cursor-pointer"
                  >
                    🔢 Auto-Next: Lecture #{suggestedLectureNumber}
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Class Title (क्लास का नाम) *</Label>
                <button
                  type="button"
                  onClick={autoGenerateTitle}
                  className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="h-3 w-3" /> Auto-Fill Title
                </button>
              </div>
              <Input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="e.g. Maths – Algebra – Lecture 01"
                className="mt-1 font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* STEP 4: Faculty / Teacher Name */}
      <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-primary" /> Step 4: Faculty / Teacher Name (पढ़ाने वाले शिक्षक)
        </div>

        {facultyList.length > 0 && (
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5 bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900">
            <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-extrabold uppercase tracking-wider">
              Quick Pick Teacher:
            </span>
            {facultyList.map((fac) => (
              <button
                key={fac.name}
                type="button"
                onClick={() => set("faculty", fac.name)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition shadow-2xs cursor-pointer",
                  form.faculty === fac.name
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                    : "bg-background hover:bg-muted text-foreground border-border/60"
                )}
              >
                {fac.photo_url ? (
                  <img src={getStorageUrl(fac.photo_url) || fac.photo_url} alt="" className="w-4 h-4 rounded-full object-cover" />
                ) : (
                  <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[9px] font-bold">
                    {fac.name[0]}
                  </span>
                )}
                {fac.name} {fac.subject ? `(${fac.subject})` : ""}
              </button>
            ))}
          </div>
        )}

        <Input
          list="recommended-faculty-list"
          value={form.faculty}
          onChange={(e) => set("faculty", e.target.value)}
          placeholder="Select or type teacher name (e.g. Anurag Sir)"
        />
        <datalist id="recommended-faculty-list">
          {facultyList.map((fac) => (
            <option key={fac.name} value={fac.name}>
              {fac.subject ? `${fac.name} (${fac.subject})` : fac.name}
            </option>
          ))}
        </datalist>
      </div>

      {/* STEP 5: Automation & Description */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/10">
          <div>
            <Label className="text-xs font-semibold">Start automatically</Label>
            <p className="text-[11px] text-muted-foreground">समय होते ही लाइव चालू करें</p>
          </div>
          <Switch checked={form.auto_start} onCheckedChange={(v) => set("auto_start", v)} />
        </div>

        <div className="flex items-center justify-between rounded-xl border p-3 bg-muted/10">
          <div>
            <Label className="text-xs font-semibold">Auto-archive recording</Label>
            <p className="text-[11px] text-muted-foreground">खत्म होने पर रिकॉर्डेड में सेव करें</p>
          </div>
          <Switch checked={form.auto_end} onCheckedChange={(v) => set("auto_end", v)} />
        </div>

        <div className="sm:col-span-2">
          <Label className="text-xs font-semibold">Description (Optional)</Label>
          <Textarea
            value={form.description ?? ""}
            onChange={(e) => set("description", e.target.value)}
            rows={2}
            placeholder="क्लास के बारे में कोई अतिरिक्त जानकारी (वैकल्पिक)..."
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}
