import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Clock3, Loader2, Pencil, Plus, Radio, TimerReset } from "lucide-react";
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
};
type Batch = { id: string; title: string };
type Form = Omit<LiveClass, "id" | "scheduled_at" | "end_at" | "duration_minutes" | "recorded_lecture_id"> & {
  date: string; startTime: string; startPeriod: "AM" | "PM"; endTime: string; endPeriod: "AM" | "PM";
};

const emptyForm = (): Form => ({ title: "", batch_id: null, description: "", date: new Date().toISOString().slice(0, 10), startTime: "04:00", startPeriod: "PM", endTime: "05:00", endPeriod: "PM", is_live: false, auto_start: true, auto_end: true, thumbnail_url: "", youtube_url: "", zoom_url: "", meet_url: "" });

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
  const { data: classes = [], isLoading } = useQuery({ queryKey: ["admin", "live_classes"], queryFn: async () => {
    const { data, error } = await supabase.from("live_classes").select("*").order("scheduled_at", { ascending: false }); if (error) throw error; return (data ?? []) as LiveClass[];
  }});
  const { data: batches = [] } = useQuery({ queryKey: ["admin", "batch-options"], queryFn: async () => {
    const { data, error } = await supabase.from("batches").select("id,title").order("title"); if (error) throw error; return (data ?? []) as Batch[];
  }});
  const save = useMutation({ mutationFn: async () => {
    const scheduledAt = makeIndiaIso(form.date, form.startTime, form.startPeriod);
    const endAt = makeIndiaIso(form.date, form.endTime, form.endPeriod);
    const duration = Math.round((new Date(endAt).getTime() - new Date(scheduledAt).getTime()) / 60000);
    if (!form.title.trim()) throw new Error("Class title is required.");
    if (duration <= 0) throw new Error("End time must be after start time. For an overnight class, choose the next date first.");
    const data = { title: form.title.trim(), batch_id: form.batch_id, description: form.description || null, scheduled_at: scheduledAt, duration_minutes: duration, is_live: form.is_live, auto_start: form.auto_start, auto_end: form.auto_end, thumbnail_url: form.thumbnail_url || null, youtube_url: form.youtube_url || null, zoom_url: form.zoom_url || null, meet_url: form.meet_url || null };
    const client = supabase as unknown as { from: (table: string) => any };
    const result = editing ? await client.from("live_classes").update(data).eq("id", editing.id) : await client.from("live_classes").insert(data);
    if (result.error) throw result.error;
  }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "live_classes"] }); setOpen(false); toast.success(editing ? "Class timing updated" : "Live class scheduled"); }, onError: (e: Error) => toast.error(e.message) });
  const endNow = useMutation({ mutationFn: async (id: string) => { const { error } = await supabase.rpc("end_live_class_now", { p_class_id: id }); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "live_classes"] }); qc.invalidateQueries({ queryKey: ["admin", "lectures"] }); toast.success("Class ended and moved to Recorded Lectures."); }, onError: (e: Error) => toast.error(e.message) });
  const extend = useMutation({ mutationFn: async (row: LiveClass) => {
    const currentEnd = new Date(row.end_at ?? row.scheduled_at).getTime(); const newDuration = Math.round((currentEnd + 15 * 60000 - new Date(row.scheduled_at).getTime()) / 60000);
    const client = supabase as unknown as { from: (table: string) => any }; const { error } = await client.from("live_classes").update({ duration_minutes: newDuration }).eq("id", row.id); if (error) throw error;
  }, onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "live_classes"] }); toast.success("15 minutes added to the class."); }, onError: (e: Error) => toast.error(e.message) });
  const openCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const openEdit = (row: LiveClass) => { const start = toLocalParts(row.scheduled_at); const end = toLocalParts(row.end_at ?? new Date(new Date(row.scheduled_at).getTime() + (row.duration_minutes ?? 60) * 60000).toISOString()); setEditing(row); setForm({ title: row.title, batch_id: row.batch_id, description: row.description ?? "", date: start.date, startTime: start.time, startPeriod: start.period, endTime: end.time, endPeriod: end.period, is_live: row.is_live, auto_start: row.auto_start, auto_end: row.auto_end, thumbnail_url: row.thumbnail_url ?? "", youtube_url: row.youtube_url ?? "", zoom_url: row.zoom_url ?? "", meet_url: row.meet_url ?? "" }); setOpen(true); };
  const status = (row: LiveClass) => row.is_live ? "Live now" : row.recorded_lecture_id ? "Recorded" : "Scheduled";
  return <Section><div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Admin</div><h1 className="mt-1 text-3xl font-bold tracking-tight">Live Classes</h1><p className="mt-1 text-sm text-muted-foreground">Set clear India-time schedules. Classes automatically become recordings when their end time is reached.</p></div><Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> Schedule class</Button></div><div className="glass-strong overflow-x-auto rounded-3xl p-4 sm:p-6"><table className="w-full text-sm"><thead><tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="py-2 pr-4">Class</th><th className="py-2 pr-4">Start</th><th className="py-2 pr-4">Fixed end</th><th className="py-2 pr-4">Status</th><th className="py-2 text-right">Actions</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={5} className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr> : classes.map((row) => <tr key={row.id} className="border-b border-border/40 last:border-0"><td className="py-3 pr-4 font-medium">{row.title}</td><td className="py-3 pr-4 whitespace-nowrap">{formatSchedule(row.scheduled_at)}</td><td className="py-3 pr-4 whitespace-nowrap">{row.end_at ? formatSchedule(row.end_at) : "—"}</td><td className="py-3 pr-4"><span className="rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">{status(row)}</span></td><td className="py-3 text-right"><div className="inline-flex gap-1"><Button size="sm" variant="ghost" onClick={() => openEdit(row)} aria-label="Edit timing"><Pencil className="h-4 w-4" /></Button>{row.is_live && <><Button size="sm" variant="ghost" onClick={() => extend.mutate(row)} disabled={extend.isPending} title="Add 15 minutes"><TimerReset className="h-4 w-4 text-primary" /></Button><Button size="sm" variant="ghost" onClick={() => endNow.mutate(row.id)} disabled={endNow.isPending} title="End now"><Radio className="h-4 w-4 text-red-600" /></Button></>}</div></td></tr>)}</tbody></table>{!isLoading && !classes.length && <p className="py-10 text-center text-sm text-muted-foreground">No live classes scheduled yet.</p>}</div><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Update class timing" : "Schedule a live class"}</DialogTitle><DialogDescription>All times use India Standard Time (IST). Select a calendar date and simple AM/PM times.</DialogDescription></DialogHeader><ClassForm form={form} setForm={setForm} batches={batches} /><DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editing ? "Save timing" : "Schedule class"}</Button></DialogFooter></DialogContent></Dialog></Section>;
}

function ClassForm({ form, setForm, batches }: { form: Form; setForm: (value: Form) => void; batches: Batch[] }) {
  const duration = useMemo(() => { const start = new Date(makeIndiaIso(form.date, form.startTime, form.startPeriod)); const end = new Date(makeIndiaIso(form.date, form.endTime, form.endPeriod)); const minutes = Math.round((end.getTime() - start.getTime()) / 60000); return minutes > 0 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : "Choose an end time after start"; }, [form]);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm({ ...form, [key]: value });
  const timeInput = (key: "startTime" | "endTime") => <Input type="time" value={form[key]} onChange={(e) => set(key, e.target.value)} />;
  const period = (key: "startPeriod" | "endPeriod") => <Select value={form[key]} onValueChange={(v) => set(key, v as "AM" | "PM")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AM">AM</SelectItem><SelectItem value="PM">PM</SelectItem></SelectContent></Select>;
  return <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label>Class title *</Label><Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Maths – Algebra" /></div><div><Label>Batch</Label><Select value={form.batch_id ?? "none"} onValueChange={(v) => set("batch_id", v === "none" ? null : v)}><SelectTrigger><SelectValue placeholder="Optional batch" /></SelectTrigger><SelectContent><SelectItem value="none">No batch</SelectItem>{batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}</SelectContent></Select></div><div><Label className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" /> Class date</Label><Input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></div><div><Label className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Start time</Label><div className="grid grid-cols-[1fr_100px] gap-2">{timeInput("startTime")}{period("startPeriod")}</div></div><div><Label className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> Fixed end time</Label><div className="grid grid-cols-[1fr_100px] gap-2">{timeInput("endTime")}{period("endPeriod")}</div><p className="mt-1 text-[11px] text-muted-foreground">Duration: {duration}</p></div><div className="flex items-center justify-between rounded-xl border p-3"><div><Label>Start automatically</Label><p className="text-[11px] text-muted-foreground">Go live at the start time</p></div><Switch checked={form.auto_start} onCheckedChange={(v) => set("auto_start", v)} /></div><div className="flex items-center justify-between rounded-xl border p-3"><div><Label>Archive automatically</Label><p className="text-[11px] text-muted-foreground">Move to recorded after end time</p></div><Switch checked={form.auto_end} onCheckedChange={(v) => set("auto_end", v)} /></div><div className="sm:col-span-2"><Label>Live video URL</Label><Input value={form.youtube_url ?? ""} onChange={(e) => set("youtube_url", e.target.value)} placeholder="YouTube live / recording URL" /></div><div className="sm:col-span-2"><Label>Description</Label><Textarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={3} /></div></div>;
}
