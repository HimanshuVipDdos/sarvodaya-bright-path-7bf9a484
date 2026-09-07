import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CalendarDays, Clock3, Hash, Loader2, Pencil, Plus, Radio, TimerReset, Trash2, XCircle } from "lucide-react";
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

type LiveClass = {
  id: string; title: string; batch_id: string | null; description: string | null; scheduled_at: string;
  end_at: string | null; duration_minutes: number | null; is_live: boolean; auto_start: boolean;
  auto_end: boolean; recorded_lecture_id: string | null; thumbnail_url: string | null; youtube_url: string | null;
  zoom_url: string | null; meet_url: string | null;
  subject: string | null; chapter: string | null; lecture_number: number | null;
};
type Batch = { id: string; title: string; subjects?: string[] | null };
type Form = Omit<LiveClass, "id" | "scheduled_at" | "end_at" | "duration_minutes" | "recorded_lecture_id"> & {
  date: string; startTime: string; startPeriod: "AM" | "PM"; endTime: string; endPeriod: "AM" | "PM";
  subject: string; chapter: string; lecture_number: string;
};

const emptyForm = (): Form => ({
  title: "", batch_id: null, description: "", date: new Date().toISOString().slice(0, 10),
  startTime: "04:00", startPeriod: "PM", endTime: "05:00", endPeriod: "PM",
  is_live: false, auto_start: true, auto_end: true,
  thumbnail_url: "", youtube_url: "", zoom_url: "", meet_url: "",
  subject: "", chapter: "", lecture_number: "1",
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

  const { data: lectures = [] } = useQuery({
    queryKey: ["admin", "lectures-for-tracking"],
    queryFn: async () => {
      const { data } = await supabase.from("lectures").select("batch_id, subject, chapter, lecture_number, created_at");
      return (data ?? []) as { batch_id: string | null; subject: string | null; chapter: string | null; lecture_number: number | null }[];
    },
  });

  const { data: batches = [] } = useQuery({
    queryKey: ["admin", "batch-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("batches").select("id,title,subjects").order("title");
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
      };

      if (form.subject.trim()) localStorage.setItem("last_live_subject", form.subject.trim());
      if (form.chapter.trim()) localStorage.setItem("last_live_chapter", form.chapter.trim());
      if (form.batch_id) localStorage.setItem("last_live_batch", form.batch_id);

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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "live_classes"] }); toast.success("Class extended by 15 mins"); },
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

  const openCreate = () => {
    setEditing(null);
    const lastSubject = localStorage.getItem("last_live_subject") || classes[0]?.subject || "";
    const lastChapter = localStorage.getItem("last_live_chapter") || classes[0]?.chapter || "";
    const lastBatchId = localStorage.getItem("last_live_batch") || classes[0]?.batch_id || null;

    let nextLec = "1";
    if (lastSubject && lastChapter) {
      const matchClasses = classes.filter(
        (c) =>
          c.subject?.trim().toLowerCase() === lastSubject.trim().toLowerCase() &&
          c.chapter?.trim().toLowerCase() === lastChapter.trim().toLowerCase()
      );
      const matchLectures = lectures.filter(
        (l) =>
          l.subject?.trim().toLowerCase() === lastSubject.trim().toLowerCase() &&
          l.chapter?.trim().toLowerCase() === lastChapter.trim().toLowerCase()
      );
      const maxNum = Math.max(
        0,
        ...matchClasses.map((c) => c.lecture_number || 0),
        ...matchLectures.map((l) => l.lecture_number || 0)
      );
      nextLec = String(maxNum + 1);
    }

    setForm({
      ...emptyForm(),
      batch_id: lastBatchId,
      subject: lastSubject,
      chapter: lastChapter,
      lecture_number: nextLec,
    });
    setOpen(true);
  };
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
                    {row.is_live && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => extend.mutate(row)} disabled={extend.isPending} title="Add 15 minutes">
                          <TimerReset className="h-4 w-4 text-primary" />
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => { if (window.confirm(`End "${row.title}" and archive as recording?`)) endNow.mutate(row.id); }}
                          disabled={endNow.isPending}
                          title="End Live Class — archives to Lectures"
                          className="text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                        >
                          <Radio className="h-4 w-4" />
                          <span className="ml-1 text-[11px] font-semibold hidden sm:inline">End</span>
                        </Button>
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
                      </>
                    )}
                    {!row.is_live && (
                      <Button
                        size="sm" variant="ghost"
                        onClick={() => { if (window.confirm(`Delete "${row.title}"?`)) deleteClass.mutate(row.id); }}
                        disabled={deleteClass.isPending}
                        aria-label="Delete"
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && !classes.length && <p className="py-10 text-center text-sm text-muted-foreground">No live classes scheduled yet.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Update class timing" : "Schedule a live class"}</DialogTitle>
            <DialogDescription>All times use India Standard Time (IST).</DialogDescription>
          </DialogHeader>
          <ClassForm form={form} setForm={setForm} batches={batches} classes={classes} lectures={lectures} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save timing" : "Schedule class"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function ClassForm({
  form,
  setForm,
  batches,
  classes,
  lectures,
}: {
  form: Form;
  setForm: (value: Form) => void;
  batches: Batch[];
  classes: LiveClass[];
  lectures: { batch_id: string | null; subject: string | null; chapter: string | null; lecture_number: number | null }[];
}) {
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

  // 1. Available subjects
  const availableSubjects = useMemo(() => {
    const sSet = new Set<string>();
    const b = batches.find((item) => item.id === form.batch_id);
    if (b?.subjects && Array.isArray(b.subjects)) {
      b.subjects.forEach((s) => s && sSet.add(s.trim()));
    }
    classes.forEach((c) => {
      if (c.subject && (!form.batch_id || c.batch_id === form.batch_id)) sSet.add(c.subject.trim());
    });
    lectures.forEach((l) => {
      if (l.subject && (!form.batch_id || l.batch_id === form.batch_id)) sSet.add(l.subject.trim());
    });
    return Array.from(sSet);
  }, [batches, classes, lectures, form.batch_id]);

  // 2. Available chapters for current subject
  const availableChapters = useMemo(() => {
    if (!form.subject.trim()) return [];
    const cSet = new Set<string>();
    const lowerS = form.subject.trim().toLowerCase();
    classes.forEach((c) => {
      if (c.subject?.trim().toLowerCase() === lowerS && c.chapter) cSet.add(c.chapter.trim());
    });
    lectures.forEach((l) => {
      if (l.subject?.trim().toLowerCase() === lowerS && l.chapter) cSet.add(l.chapter.trim());
    });
    return Array.from(cSet);
  }, [classes, lectures, form.subject]);

  // 3. Helper to compute next lecture number
  const getNextLectureNumber = (subj: string, ch: string) => {
    if (!subj.trim() || !ch.trim()) return 1;
    const s = subj.trim().toLowerCase();
    const c = ch.trim().toLowerCase();
    const matchC = classes.filter((cl) => cl.subject?.trim().toLowerCase() === s && cl.chapter?.trim().toLowerCase() === c);
    const matchL = lectures.filter((le) => le.subject?.trim().toLowerCase() === s && le.chapter?.trim().toLowerCase() === c);
    const maxNum = Math.max(0, ...matchC.map((cl) => cl.lecture_number || 0), ...matchL.map((le) => le.lecture_number || 0));
    return maxNum + 1;
  };

  const handleSelectSubject = (s: string) => {
    const lowerS = s.trim().toLowerCase();
    const chaps: string[] = [];
    classes.forEach((c) => {
      if (c.subject?.trim().toLowerCase() === lowerS && c.chapter && !chaps.includes(c.chapter.trim())) chaps.push(c.chapter.trim());
    });
    lectures.forEach((l) => {
      if (l.subject?.trim().toLowerCase() === lowerS && l.chapter && !chaps.includes(l.chapter.trim())) chaps.push(l.chapter.trim());
    });
    const chosenChapter = chaps[0] || form.chapter;
    const nextLec = getNextLectureNumber(s, chosenChapter);
    setForm({
      ...form,
      subject: s,
      chapter: chosenChapter,
      lecture_number: String(nextLec),
    });
  };

  const handleSelectChapter = (c: string) => {
    const nextLec = getNextLectureNumber(form.subject, c);
    setForm({
      ...form,
      chapter: c,
      lecture_number: String(nextLec),
    });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Label>Class title *</Label>
        <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Maths – Algebra" />
      </div>

      <div className="sm:col-span-2 rounded-2xl border border-border/60 bg-muted/30 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5" /> Chapter & Lecture Info (Smart Tracked)
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Subject</Label>
            <Input
              value={form.subject}
              onChange={(e) => {
                const s = e.target.value;
                const nextLec = getNextLectureNumber(s, form.chapter);
                setForm({ ...form, subject: s, lecture_number: String(nextLec) });
              }}
              placeholder="e.g. OC, Maths, Physics"
            />
            {availableSubjects.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                <span className="text-[10px] text-muted-foreground font-semibold">Suggestions:</span>
                {availableSubjects.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSelectSubject(s)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
                      form.subject.toLowerCase() === s.toLowerCase()
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground/80 hover:bg-muted border-border"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Chapter</Label>
            <Input
              value={form.chapter}
              onChange={(e) => {
                const c = e.target.value;
                const nextLec = getNextLectureNumber(form.subject, c);
                setForm({ ...form, chapter: c, lecture_number: String(nextLec) });
              }}
              placeholder="e.g. GOC ONE SHOT, Algebra"
            />
            {availableChapters.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                <span className="text-[10px] text-muted-foreground font-semibold">Chapters:</span>
                {availableChapters.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleSelectChapter(c)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
                      form.chapter.toLowerCase() === c.toLowerCase()
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-foreground/80 hover:bg-muted border-border"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="flex items-center gap-1"><Hash className="h-3 w-3" /> Lecture #</Label>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 font-bold"
                onClick={() => {
                  const curr = parseInt(form.lecture_number, 10) || 1;
                  set("lecture_number", String(Math.max(1, curr - 1)));
                }}
              >
                -
              </Button>
              <Input
                type="number"
                min={1}
                value={form.lecture_number}
                onChange={(e) => set("lecture_number", e.target.value)}
                placeholder="e.g. 1"
                className="text-center font-bold"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 font-bold"
                onClick={() => {
                  const curr = parseInt(form.lecture_number, 10) || 0;
                  set("lecture_number", String(curr + 1));
                }}
              >
                +
              </Button>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Auto-increments by chapter history</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Automatically groups this class into students' PW subject & chapter portals.</p>
      </div>

      <div>
        <Label>Batch</Label>
        <Select value={form.batch_id ?? "none"} onValueChange={(v) => set("batch_id", v === "none" ? null : v)}>
          <SelectTrigger><SelectValue placeholder="Optional batch" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No batch</SelectItem>
            {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}
          </SelectContent>
        </Select>
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
