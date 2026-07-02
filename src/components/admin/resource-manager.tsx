import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Search, Loader2, Save, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
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

export type Field = {
  name: string;
  label: string;
  type: "text" | "textarea" | "number" | "boolean" | "date" | "array" | "select" | "url" | "batch" | "image";
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  helper?: string;
  bucket?: string;
};


export type Column<T = Record<string, unknown>> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  className?: string;
};

type Props<T extends Record<string, unknown>> = {
  table: "batches" | "lectures" | "study_materials" | "current_affairs" | "notifications" | "live_classes";
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
      if (error) throw error;
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
  useEffect(() => { /* keep stable */ }, []);
  const set = (name: string, value: unknown) => setForm({ ...form, [name]: value });

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
              <Input
                value={(v as string) ?? ""}
                placeholder={f.placeholder ?? (f.type === "array" ? "comma, separated, values" : "")}
                onChange={(e) => set(f.name, e.target.value)}
              />
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
            {f.helper && <p className="mt-1 text-[11px] text-muted-foreground">{f.helper}</p>}
          </div>
        );
      })}
    </div>
  );
}
