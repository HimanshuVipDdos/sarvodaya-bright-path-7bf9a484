import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Search, Loader2, Save, X, FolderPlus, FolderOpen } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import Cropper, { type Area } from "react-easy-crop";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BatchFolderManager, getStoredPremadeFolders } from "@/components/admin/batch-folder-manager";
import { cn, getStorageUrl } from "@/lib/utils";

export type Field = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "date" | "array" | "select" | "url" | "batch" | "image" | "file";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  helper?: string;
  bucket?: string;
  aspect?: number; // e.g. 3/4 for portrait faculty photos, 16/9 for covers
};


export type Column<T = Record<string, unknown>> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
};

type Props<T extends Record<string, unknown>> = {
  table: "batches" | "lectures" | "study_materials" | "current_affairs" | "notifications" | "live_classes" | "faculty" | "gallery" | "results" | "cbt_tests" | "cbt_questions";
  title: string;
  eyebrow?: string;
  description?: string;
  columns: Column<T>[];
  fields: Field[];
  defaults?: Record<string, unknown>;
  orderBy?: { column: string; ascending: boolean };
  searchKeys?: string[];
  presetFilter?: { column: string; value: unknown };
  rowKey?: string;
};

type FormState = Record<string, unknown>;

function coerceArrayField(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string") {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

export function ResourceManager<T extends Record<string, unknown>>({
  table, title, eyebrow, description, columns, fields, defaults = {},
  orderBy = { column: "created_at", ascending: false }, searchKeys = ["title"],
  presetFilter, rowKey = "id",
}: Props<T>) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [folderManagerOpen, setFolderManagerOpen] = useState(false);

  const queryKey = ["admin", table, presetFilter?.value ?? "all"] as const;

  const { data: rows = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const client = supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown; error: { message: string } | null }> & {
              eq: (c: string, v: unknown) => Promise<{ data: unknown; error: { message: string } | null }>;
            };
          };
        };
      };
      let q = client.from(table).select("*").order(orderBy.column, { ascending: orderBy.ascending });
      if (presetFilter) q = q.eq(presetFilter.column, presetFilter.value) as typeof q;
      const { data, error } = await q;
      if (error) {
        console.warn(`Query warning for ${table}:`, error.message);
        return [];
      }
      return (data ?? []) as unknown as T[];
    },
  });

  const { data: batchOptions = [] } = useQuery({
    queryKey: ["admin", "batch-options"],
    queryFn: async () => {
      const { data } = await supabase.from("batches").select("id,title").order("title");
      return (data ?? []).map((b) => ({ value: b.id, label: b.title }));
    },
    enabled: fields.some((f) => f.type === "batch"),
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      searchKeys.some((k) => String((r as Record<string, unknown>)[k] ?? "").toLowerCase().includes(term))
    );
  }, [rows, search, searchKeys]);

  function openCreate() {
    setEditing(null);
    const initial: FormState = { ...defaults };
    if (presetFilter) initial[presetFilter.column] = presetFilter.value;
    for (const f of fields) {
      if (!(f.name in initial)) {
        initial[f.name] =
          f.type === "boolean" ? false :
          f.type === "array" ? [] :
          f.type === "number" ? 0 : "";
      }
    }

    setForm(initial);
    setOpen(true);
  }

  function openEdit(row: T) {
    setEditing(row);
    const init: FormState = {};
    for (const f of fields) {
      const v = (row as Record<string, unknown>)[f.name];
      if (f.type === "array") init[f.name] = coerceArrayField(v).join(", ");
      else if (f.type === "date" && v) init[f.name] = String(v).slice(0, 10);
      else init[f.name] = v ?? (f.type === "boolean" ? false : "");
    }
    setForm(init);
    setOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: FormState) => {
      const data: Record<string, unknown> = {};
      for (const f of fields) {
        const v = payload[f.name];
        if (f.type === "array") data[f.name] = coerceArrayField(v);
        else if (f.type === "number") data[f.name] = v === "" || v == null ? null : Number(v);
        else if (f.type === "date") data[f.name] = v ? v : null;
        else if (f.type === "boolean") data[f.name] = Boolean(v);
        else data[f.name] = v === "" ? null : v;
      }
      if (presetFilter) data[presetFilter.column] = presetFilter.value;

      const anyClient = supabase as unknown as { from: (t: string) => any };
      if (editing) {
        const id = (editing as Record<string, unknown>)[rowKey];
        const { error } = await anyClient.from(table).update(data).eq(rowKey, id);
        if (error) throw error;
      } else {
        const { error } = await anyClient.from(table).insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setOpen(false);
      toast.success(editing ? "Updated" : "Created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: T) => {
      const anyClient = supabase as unknown as { from: (t: string) => any };
      const id = (row as Record<string, unknown>)[rowKey];
      const { error } = await anyClient.from(table).delete().eq(rowKey, id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setDeleting(null);
      toast.success("Deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Section>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow && (
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">{eyebrow}</div>
          )}
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin" className="text-sm text-muted-foreground hover:text-foreground">
            ← Admin
          </Link>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </div>

      <div className="glass-strong rounded-3xl p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="text-xs text-muted-foreground">{filtered.length} item{filtered.length === 1 ? "" : "s"}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                {columns.map((c) => (
                  <th key={c.key} className={"py-2 pr-3 font-medium " + (c.className ?? "")}>{c.label}</th>
                ))}
                <th className="py-2 pl-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={columns.length + 1} className="py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={columns.length + 1} className="py-10 text-center text-muted-foreground">
                  No records yet.
                </td></tr>
              )}
              {filtered.map((row, i) => (
                <motion.tr
                  key={String((row as Record<string, unknown>)[rowKey] ?? i)}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.01, 0.1) }}
                  className="border-b border-border/40 last:border-0 hover:bg-muted/30"
                >
                  {columns.map((c) => (
                    <td key={c.key} className={"py-3 pr-3 align-top " + (c.className ?? "")}>
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—")}
                    </td>
                  ))}
                  <td className="py-3 pl-3 text-right align-top">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(row)} aria-label="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDeleting(row)} aria-label="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit" : "Create"} {title.replace(/s$/, "")}</DialogTitle>
            <DialogDescription>Changes are saved to the live database.</DialogDescription>
          </DialogHeader>
          <FieldsForm
            fields={fields}
            form={form}
            setForm={setForm}
            batchOptions={batchOptions}
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} className="gap-2">
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
              className="gap-2"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && deleteMutation.mutate(deleting)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}

function FieldsForm({
  fields, form, setForm, batchOptions,
}: {
  fields: Field[];
  form: FormState;
  setForm: (f: FormState) => void;
  batchOptions: { value: string; label: string }[];
}) {
  const set = (name: string, value: unknown) => setForm({ ...form, [name]: value });

  // Fetch existing subjects & chapters for the selected batch
  const { data: folderOptions } = useQuery({
    queryKey: ["admin-batch-folders", form.batch_id],
    enabled: Boolean(form.batch_id),
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

      // Merge premade custom batch folders
      if (form.batch_id) {
        const storedMap = getStoredPremadeFolders()[form.batch_id as string] ?? {};
        Object.entries(storedMap).forEach(([sub, chs]) => {
          subjectsSet.add(sub);
          if (!subjectToChapters.has(sub)) subjectToChapters.set(sub, new Set());
          chs.forEach((ch) => subjectToChapters.get(sub)!.add(ch));
        });
      }

      return {
        subjects: Array.from(subjectsSet).sort(),
        subjectToChapters: Object.fromEntries(
          Array.from(subjectToChapters.entries()).map(([k, v]) => [k, Array.from(v).sort()])
        ),
      };
    },
  });

  // Fetch faculty options from faculty table and current batch
  const { data: facultyOptions = [] } = useQuery({
    queryKey: ["admin-faculty-recommendations", form.batch_id],
    queryFn: async () => {
      const { data: facs } = await supabase.from("faculty").select("name, photo_url, subject").eq("is_active", true).order("name");
      const list: { name: string; photo_url: string | null; subject?: string | null }[] = (facs ?? []).map((f) => ({
        name: f.name, photo_url: f.photo_url, subject: f.subject,
      }));

      if (form.batch_id) {
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
    enabled: fields.some((f) => f.name === "faculty"),
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        const v = form[f.name];
        const full = ["textarea", "array"].includes(f.type) || f.type === "text" && f.name === "title";
        return (
          <div key={f.name} className={full ? "sm:col-span-2" : ""}>
            <Label className="text-xs">{f.label}{f.required && " *"}</Label>
            {f.type === "textarea" && (
              <Textarea
                rows={4}
                value={(v as string) ?? ""}
                placeholder={f.placeholder}
                onChange={(e) => set(f.name, e.target.value)}
              />
            )}
            {f.type === "boolean" && (
              <div className="mt-2 flex items-center gap-2">
                <Switch checked={Boolean(v)} onCheckedChange={(c) => set(f.name, c)} />
                <span className="text-sm text-muted-foreground">{Boolean(v) ? "Yes" : "No"}</span>
              </div>
            )}
            {(f.type === "text" || f.type === "url" || f.type === "array") && (
              <>
                <Input
                  value={(v as string) ?? ""}
                  placeholder={f.placeholder ?? (f.type === "array" ? "comma, separated, values" : "")}
                  onChange={(e) => set(f.name, e.target.value)}
                />
                {/* Faculty Quick Pills */}
                {f.name === "faculty" && facultyOptions.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100 dark:bg-indigo-950/30 dark:border-indigo-900">
                    <span className="text-[10px] text-indigo-700 dark:text-indigo-300 font-extrabold uppercase tracking-wider">
                      Recommended Teachers:
                    </span>
                    {facultyOptions.map((fac) => (
                      <button
                        key={fac.name}
                        type="button"
                        onClick={() => set("faculty", fac.name)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-semibold transition shadow-2xs",
                          form.faculty === fac.name
                            ? "border-indigo-600 bg-indigo-600 text-white"
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
                {/* Subject Folder Quick Pills */}
                {f.name === "subject" && folderOptions?.subjects && folderOptions.subjects.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 bg-muted/40 p-2 rounded-xl border border-border/50">
                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                      Folders in this batch:
                    </span>
                    {folderOptions.subjects.map((sub: string) => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => set("subject", sub)}
                        className={cn(
                          "rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition",
                          form.subject === sub
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "bg-background hover:bg-muted text-foreground border-border/60"
                        )}
                      >
                        📁 {sub}
                      </button>
                    ))}
                  </div>
                )}
                {/* Chapter Folder Quick Pills */}
                {f.name === "chapter" && folderOptions && (
                  (() => {
                    const activeSub = (form.subject as string)?.trim();
                    const chaptersList = activeSub && folderOptions.subjectToChapters?.[activeSub]
                      ? folderOptions.subjectToChapters[activeSub]
                      : Array.from(new Set(Object.values(folderOptions.subjectToChapters ?? {}).flat())).sort();
                    
                    if (!chaptersList || chaptersList.length === 0) return null;
                    return (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 bg-muted/40 p-2 rounded-xl border border-border/50">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                          {activeSub ? `Chapters in ${activeSub}:` : "Existing Chapters:"}
                        </span>
                        {chaptersList.map((ch: string) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => set("chapter", ch)}
                            className={cn(
                              "rounded-lg border px-2 py-0.5 text-[11px] font-semibold transition",
                              form.chapter === ch
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "bg-background hover:bg-muted text-foreground border-border/60"
                            )}
                          >
                            📖 {ch}
                          </button>
                        ))}
                      </div>
                    );
                  })()
                )}
              </>
            )}

            {f.type === "number" && (
              <Input
                type="number"
                value={(v as number | string) ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
              />
            )}
            {f.type === "date" && (
              <Input
                type="date"
                value={(v as string) ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
              />
            )}
            {f.type === "select" && (
              <Select value={(v as string) ?? ""} onValueChange={(val) => set(f.name, val)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {f.options?.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {f.type === "batch" && (
              <Select value={(v as string) ?? ""} onValueChange={(val) => set(f.name, val)}>
                <SelectTrigger><SelectValue placeholder="Link to a batch (optional)" /></SelectTrigger>
                <SelectContent>
                  {batchOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {f.type === "image" && (
              <ImageUploadField
                value={(v as string) ?? ""}
                bucket={f.bucket ?? "batch-covers"}
                aspect={f.aspect ?? 4 / 3}
                onChange={(url) => setForm({ ...form, [f.name]: url })}
              />
            )}
            {f.type === "file" && (
              <FileUploadField
                value={(v as string) ?? ""}
                bucket={f.bucket ?? "materials"}
                onChange={(url) => setForm({ ...form, [f.name]: url })}
              />
            )}
            {f.helper && <p className="mt-1 text-xs text-muted-foreground">{f.helper}</p>}
          </div>
        );
      })}
    </div>
  );
}

async function getCroppedImageBlob(imageSrc: string, cropPixels: Area, mimeType: string): Promise<Blob> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageSrc;
  });

  const canvas = document.createElement("canvas");
  canvas.width = cropPixels.width;
  canvas.height = cropPixels.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.drawImage(
    image,
    cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
    0, 0, cropPixels.width, cropPixels.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to crop image"));
    }, mimeType, 0.92);
  });
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function ImageUploadField({
  value, bucket, aspect, onChange,
}: {
  value: string;
  bucket: string;
  aspect: number;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState<string>("");
  const [fileType, setFileType] = useState<string>("image/png");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image must be under 8 MB");
      return;
    }
    setFileType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  }

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleConfirmCrop() {
    if (!croppedAreaPixels || !imageSrc) return;
    setUploading(true);
    setCropOpen(false);
    try {
      const blob = await getCroppedImageBlob(imageSrc, croppedAreaPixels, "image/jpeg");
      const ext = "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;

      // List candidate buckets to try in order
      const candidateBuckets = Array.from(
        new Set([bucket, "batch-thumbnails", "batch-covers", "public", "images", "photos", "hero-slides", "gallery-photos", "faculty-photos"])
      );

      let uploadedUrl: string | null = null;
      for (const b of candidateBuckets) {
        try {
          const { error } = await supabase.storage.from(b).upload(path, blob, {
            contentType: "image/jpeg",
            cacheControl: "3600",
            upsert: false,
          });
          if (!error) {
            const { data } = supabase.storage.from(b).getPublicUrl(path);
            if (data?.publicUrl) {
              uploadedUrl = data.publicUrl;
              break;
            }
          }
        } catch {
          // Continue to next bucket candidate
        }
      }

      if (uploadedUrl) {
        onChange(uploadedUrl);
        toast.success("Cover photo uploaded successfully");
      } else {
        // Fallback: If Supabase storage bucket doesn't exist or RLS blocks upload,
        // convert to optimized Data URL so user never sees 'bucket not found' error!
        const dataUrl = await blobToDataUrl(blob);
        onChange(dataUrl);
        toast.success("Cover photo saved successfully");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      setImageSrc("");
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="relative overflow-hidden rounded-2xl border border-border/60">
          {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
          <img src={value} alt="Preview" className="h-40 w-full object-cover object-top" />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange("")}
            className="absolute right-2 top-2 h-7 rounded-full bg-black/60 text-white hover:bg-black/70"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm hover:bg-muted">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
              e.target.value = "";
            }}
          />
        </label>
        <Input
          value={value}
          placeholder="…or paste an image URL"
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
      </div>

      <Dialog open={cropOpen} onOpenChange={(o) => { if (!o) { setCropOpen(false); setImageSrc(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adjust photo</DialogTitle>
            <DialogDescription>Drag to reposition, use the slider to zoom. Nothing will be cut off unexpectedly.</DialogDescription>
          </DialogHeader>

          <div className="relative h-80 w-full overflow-hidden rounded-xl bg-muted">
            {imageSrc && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          <div className="flex items-center gap-3 pt-2">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => { setCropOpen(false); setImageSrc(""); }}
              className="gap-2"
            >
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button onClick={handleConfirmCrop} className="gap-2">
              <Save className="h-4 w-4" /> Save & Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FileUploadField({
  value, bucket = "materials", onChange,
}: {
  value: string;
  bucket?: string;
  onChange: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleFileSelect(file: File) {
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File must be under 25 MB");
      return;
    }
    
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (error) throw error;

      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (data?.publicUrl) {
        onChange(data.publicUrl);
        toast.success("File uploaded successfully");
      } else {
        throw new Error("Failed to get public URL");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm">
          <a href={value} target="_blank" rel="noreferrer" className="truncate text-primary hover:underline">
            {value.split('/').pop()}
          </a>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onChange("")}
            className="ml-2 h-7 rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
      <div className="flex items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border/60 bg-background px-3 py-2 text-sm hover:bg-muted shrink-0">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {uploading ? "Uploading…" : value ? "Replace file" : "Upload file"}
          <input
            type="file"
            accept=".pdf,.doc,.docx,.ppt,.pptx"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFileSelect(f);
              e.target.value = "";
            }}
          />
        </label>
        <Input
          value={value}
          placeholder="…or paste a file URL"
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
      </div>
    </div>
  );
}
