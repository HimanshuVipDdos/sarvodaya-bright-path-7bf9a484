import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Clock3, Hash, Loader2, Pencil, Plus, Radio, TimerReset, Trash2, User, XCircle } from "lucide-react";
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

type LiveClass = {
  id: string; title: string; batch_id: string | null; description: string | null; scheduled_at: string;
  end_at: string | null; duration_minutes: number | null; is_live: boolean; auto_start: boolean;
  auto_end: boolean; recorded_lecture_id: string | null; thumbnail_url: string | null; youtube_url: string | null;
  zoom_url: string | null; meet_url: string | null;
  subject: string | null; chapter: string | null; lecture_number: number | null;
  faculty: string | null;
};
type Batch = { id: string; title: string };
type Form = Omit<LiveClass, "id" | "scheduled_at" | "end_at" | "duration_minutes" | "recorded_lecture_id"> & {
  date: string; startTime: string; startPeriod: "AM" | "PM"; endTime: string; endPeriod: "AM" | "PM";
  subject: string; chapter: string; lecture_number: string; faculty: string;
};

const emptyForm = (): Form => ({
  title: "", batch_id: null, description: "", date: new Date().toISOString().slice(0, 10),
  startTime: "04:00", startPeriod: "PM", endTime: "05:00", endPeriod: "PM",
  is_live: false, auto_start: true, auto_end: true,
  thumbnail_url: "", youtube_url: "", zoom_url: "", meet_url: "",
  subject: "", chapter: "", lecture_number: "", faculty: "",
});

function to24Hour(time: string, period: "AM" | "PM") {
  const [hourText, minute = "00"] = time.split(":");
  let hour = Number(hourText) % 12;
  if (period === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}
function toLocalParts(value: string) {
  const date = new Date(value);
  const formatted = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: true }).formatToParts(date);
  const part = (name: string) => formatted.find((p) => p.type === name)?.value ?? "";
  const hour = Number(part("hour"));
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${String(hour).padStart(2, "0")}:${part("minute")}`, period: part("dayPeriod").toUpperCase() as "AM" | "PM" };
}
function makeIndiaIso(date: string, time: string, period: "AM" | "PM") { return `${date}T${to24Hour(time, period)}:00+05:30`; }
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
      return (data ?? []) as LiveClass[];
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
      const scheduledAt = makeIndiaIso(form.date, form.startTime, form.startPeriod);
      const endAt = makeIndiaIso(form.date, form.endTime, form.endPeriod);
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
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "live_classes"] });
      setOpen(false);
      toast.success(editing ? "Class timing updated" : "Live class scheduled");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const endNow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("end_live_class_now", { p_class_id: id });
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
      date: start.date, startTime: start.time, startPeriod: start.period,
      endTime: end.time, endPeriod: end.period, is_live: row.is_live,
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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Admin</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Live Classes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Schedule sessions with Subject/Chapter info. End a class to archive it as a recording.</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Schedule class</Button>
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
            ) : classes.map((row) => {
              const b = batches.find((x) => x.id === row.batch_id);
              const nowTime = new Date().getTime();
              const startTime = new Date(row.scheduled_at).getTime();
              const diffMins = (startTime - nowTime) / 60000;
              const isStartingSoon = !row.is_live && !row.recorded_lecture_id && diffMins > 0 && diffMins <= 15;

              return (
                <tr key={row.id} className="group border-b border-border/40 hover:bg-muted/30">
                  <td className="py-3 pr-4">
                    <div className="font-semibold text-foreground">{row.title}</div>
                    <div className="text-[11px] text-muted-foreground">{b?.title ?? "No batch"}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">{row.subject || "—"}</span>
                    </div>
                    {row.chapter && <div className="text-[11px] text-muted-foreground mt-0.5">{row.chapter}</div>}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{formatSchedule(row.scheduled_at)}</div>
                    <div className="text-[11px] text-muted-foreground">{row.duration_minutes} min</div>
                  </td>
                  <td className="py-3 pr-4">
                    {row.is_live ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                        </span>
                        LIVE
                      </span>
                    ) : row.recorded_lecture_id ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        <XCircle className="h-3 w-3 hidden" /> COMPLETED
                      </span>
                    ) : isStartingSoon ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <Clock3 className="h-3 w-3" /> STARTING IN {Math.ceil(diffMins)}m
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
                        <CalendarDays className="h-3 w-3" /> SCHEDULED
                      </span>
                    )}
                  </td>
                  <td className="py-3 text-right align-top">
                    <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {row.is_live ? (
                        <>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => extend.mutate(row)} disabled={extend.isPending} title="Add 15 min">
                            +15m
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] text-red-600 border-red-200 hover:bg-red-50" onClick={() => { if (confirm("End class & save recording?")) endNow.mutate(row.id); }} disabled={endNow.isPending}>
                            End Now
                          </Button>
                        </>
                      ) : !row.recorded_lecture_id && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { if (confirm("Cancel this scheduled class?")) cancelClass.mutate(row.id); }} disabled={cancelClass.isPending}>
                          <XCircle className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(row)} title="Edit settings"><Pencil className="h-3.5 w-3.5 text-slate-500" /></Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit live class schedule" : "Schedule new live class"}</DialogTitle>
            <DialogDescription>Timing is in Indian Standard Time (IST).</DialogDescription>
          </DialogHeader>
          <ClassForm form={form} setForm={setForm} batches={batches} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editing ? "Save changes" : "Schedule class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function ClassForm({ form, setForm, batches }: { form: Form; setForm: (value: Form) => void; batches: Batch[] }) {
  const duration = useMemo(() => {
    const start = new Date(makeIndiaIso(form.date, form.startTime, form.startPeriod));
    const end = new Date(makeIndiaIso(form.date, form.endTime, form.endPeriod));
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    return minutes > 0 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : "Choose an end time after start";
  }, [form]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm({ ...form, [key]: value });
  const timeInput = (key: "startTime" | "endTime") => <Input type="time" value={form[key]} onChange={(e) => set(key, e.target.value)} />;
  const period = (key: "startPeriod" | "endPeriod") => (
    <Select value={form[key]} onValueChange={(v) => set(key, v as "AM" | "PM")}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent>
    </Select>
  );

  const { data: batchFolders } = useQuery({
    queryKey: ["admin-live-batch-folders", form.batch_id],
    enabled: Boolean(form.batch_id && form.batch_id !== "none"),
    queryFn: async () => {
      const [lecturesRes, materialsRes, liveRes] = await Promise.all([
        supabase.from("lectures").select("subject,chapter").eq("batch_id", form.batch_id as string),
        supabase.from("study_materials").select("subject,chapter").eq("batch_id", form.batch_id as string),
        supabase.from("live_classes").select("subject,chapter").eq("batch_id", form.batch_id as string),
      ]);
      const subjectsSet = new Set<string>();
      const subjectToChapters = new Map<string, Set<string>>();

      const addPair = (sub: string | null, ch: string | null) => {
        if (!sub?.trim()) return;
        const s = sub.trim();
        subjectsSet.add(s);
        if (!subjectToChapters.has(s)) subjectToChapters.set(s, new Set());
        if (ch?.trim()) subjectToChapters.get(s)!.add(ch.trim());
      };

      (lecturesRes.data ?? []).forEach((l: any) => addPair(l.subject, l.chapter));
      (materialsRes.data ?? []).forEach((m: any) => addPair(m.subject, m.chapter));
      (liveRes.data ?? []).forEach((lc: any) => addPair(lc.subject, lc.chapter));

      return {
        subjects: Array.from(subjectsSet).sort(),
        subjectToChapters: Object.fromEntries(
          Array.from(subjectToChapters.entries()).map(([k, v]) => [k, Array.from(v).sort()])
        ),
      };
    },
  });

  const { data: facultyList = [] } = useQuery({
    queryKey: ["admin-live-faculty-options", form.batch_id],
    queryFn: async () => {
      const { data: facs } = await supabase.from("faculty").select("name, photo_url, subject").eq("is_active", true).order("name");
      const list: { name: string; photo_url: string | null; subject?: string | null }[] = (facs ?? []).map((f) => ({
        name: f.name, photo_url: f.photo_url, subject: f.subject,
      }));

      if (form.batch_id && form.batch_id !== "none") {
        const { data: b } = await supabase.from("batches").select("faculty").eq("id", form.batch_id as string).maybeSingle();
        if (b?.faculty && Array.isArray(b.faculty)) {
          b.faculty.forEach((name: string) => {
            if (name && !list.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
              list.push({ name, photo_url: null });
            }
          });
        }
      }
      return list;
    },
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label>Class title *</Label>
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Maths – Algebra" />
      </div>

      <div className="sm:col-span-2">
        <Label>Batch</Label>
        <Select value={form.batch_id ?? "none"} onValueChange={(v) => set("batch_id", v === "none" ? null : v)}>
          <SelectTrigger><SelectValue placeholder="Select target batch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No batch</SelectItem>
            {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="sm:col-span-2">
        <Label className="flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-indigo-600" /> Faculty / Teacher Name
        </Label>
        <Input
          value={form.faculty}
          onChange={(e) => set("faculty", e.target.value)}
          placeholder="Select or type teacher name (e.g. Anurag Sir)"
        />
        {facultyList.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-1.5 bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900">
            <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-extrabold uppercase tracking-wider">
              Recommended Teachers:
            </span>
            {facultyList.map((fac) => (
              <button
                key={fac.name}
                type="button"
                onClick={() => set("faculty", fac.name)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition shadow-2xs",
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
      </div>

      <div className="sm:col-span-2 rounded-2xl border border-border/60 bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" /> Target Chapter & Folder
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Subject</Label>
            <Input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Mathematics" />
            {batchFolders?.subjects && batchFolders.subjects.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {batchFolders.subjects.map((sub: string) => (
                  <button
                    key={sub}
                    type="button"
                    onClick={() => set("subject", sub)}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-medium border transition",
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
            <Label>Chapter</Label>
            <Input value={form.chapter} onChange={(e) => set("chapter", e.target.value)} placeholder="e.g. Algebra" />
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
                        "px-1.5 py-0.5 rounded text-[10px] font-medium border transition",
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

          <div>
            <Label className="flex items-center gap-1"><Hash className="h-3 w-3" /> Lecture #</Label>
            <Input type="number" min={1} value={form.lecture_number} onChange={(e) => set("lecture_number", e.target.value)} placeholder="e.g. 12" />
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          When this live class ends, it will automatically land in this exact subject & chapter folder!
        </p>
      </div>

      <div>
        <Label className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Class date</Label>
        <Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} />
      </div>
      <div>
        <Label className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Start time</Label>
        <div className="grid grid-cols-[1fr_100px] gap-2">{timeInput("startTime")}{period("startPeriod")}</div>
      </div>
      <div>
        <Label className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Fixed end time</Label>
        <div className="grid grid-cols-[1fr_100px] gap-2">{timeInput("endTime")}{period("endPeriod")}</div>
        <p className="mt-1 text-[11px] text-muted-foreground">Duration: {duration}</p>
      </div>
      <div className="flex items-center justify-between rounded-xl border p-3">
        <div><Label>Start automatically</Label><p className="text-[11px] text-muted-foreground">Go live at the start time</p></div>
        <Switch checked={form.auto_start} onCheckedChange={(v) => set("auto_start", v)} />
      </div>
      <div className="flex items-center justify-between rounded-xl border p-3">
        <div><Label>Archive automatically</Label><p className="text-[11px] text-muted-foreground">Move to recorded after end time</p></div>
        <Switch checked={form.auto_end} onCheckedChange={(v) => set("auto_end", v)} />
      </div>
      <div className="sm:col-span-2">
        <Label>Live video URL</Label>
        <Input value={form.youtube_url ?? ""} onChange={(e) => set("youtube_url", e.target.value)} placeholder="YouTube live / recording URL" />
      </div>
      <div className="sm:col-span-2">
        <Label>Description</Label>
        <Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} />
      </div>
    </div>
  );
}
