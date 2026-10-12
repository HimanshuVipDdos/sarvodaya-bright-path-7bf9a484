import { useState, useRef, useEffect } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Plus, Trash2, Pencil, CheckCircle2, Loader2,
  ChevronLeft, ChevronRight, Save, RotateCcw, Upload, ListChecks, ImageIcon,
  Lightbulb, Sparkles, Download, FileSpreadsheet, Zap, CheckSquare, Square,
  Check, FileText, X, Layers, Tag, HelpCircle, FileCode, Award,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AiQuestionParser } from "@/components/admin/ai-question-parser";
import { JsonQuestionImporter } from "@/components/admin/json-question-importer";
import { PyqBadge } from "@/components/cbt/pyq-badge";
import {
  extractPyqMetadata,
  buildFinalQuestionText,
} from "@/lib/cbt-pyq-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function ImageUploader({ onUpload, minimal }: { onUpload: (url: string) => void; minimal?: boolean }) {
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploading(true);
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
      
      const { error, data } = await supabase.storage.from("public").upload(path, file, { cacheControl: "3600", upsert: true });
      
      if (error) {
        // Fallback to base64 if storage fails
        const reader = new FileReader();
        reader.onload = (ev) => onUpload(ev.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        const { data: { publicUrl } } = supabase.storage.from("public").getPublicUrl(path);
        onUpload(publicUrl);
      }
    } catch (err: any) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <>
      <input type="file" accept="image/*" className="hidden" ref={ref} onChange={handleUpload} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={uploading}
        className={cn(
          "flex items-center justify-center transition-colors text-muted-foreground hover:text-primary",
          minimal ? "h-7 w-7 rounded hover:bg-slate-100" : "text-[10px] font-semibold gap-1 rounded bg-slate-100 px-2 py-1 hover:bg-slate-200"
        )}
        title="Upload Image"
      >
        {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className={minimal ? "h-3.5 w-3.5" : "h-3 w-3"} />}
        {!minimal && "Image"}
      </button>
    </>
  );
}

type QuestionRow = {
  id: string; test_id: string; question_text: string;
  option_a: string; option_b: string; option_c: string; option_d: string;
  correct_option: "a" | "b" | "c" | "d"; topic: string | null;
  marks: number; sort_order: number;
};

type DraftQuestion = Omit<QuestionRow, "id" | "test_id" | "sort_order"> & {
  explanation?: string;
  pyq_exam?: string;
  pyq_year?: string;
  pyq_shift?: string;
};

// Extract question statement and attached solution/explanation
function splitQuestionTextAndSolution(rawText: string) {
  if (!rawText) return { questionText: "", explanation: "" };
  const parts = rawText.split(/<!--\s*SOLUTION\s*-->|\[SOLUTION\]:|---SOLUTION---/i);
  if (parts.length > 1) {
    return {
      questionText: parts[0].trim(),
      explanation: parts.slice(1).join("\n").trim(),
    };
  }
  return { questionText: rawText.trim(), explanation: "" };
}

const emptyDraft = (): DraftQuestion => ({
  question_text: "", option_a: "", option_b: "", option_c: "", option_d: "",
  correct_option: "a", topic: "", marks: 1, explanation: "",
  pyq_exam: "", pyq_year: "", pyq_shift: "",
});

export const Route = createFileRoute("/_authenticated/admin/cbt/$testId/questions")({
  component: QuestionsAdmin,
});

function QuestionsAdmin() {
  const { testId } = useParams({ from: "/_authenticated/admin/cbt/$testId/questions" });
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DraftQuestion>(emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savingNext, setSavingNext] = useState(false);
  const [isJsonBulkOpen, setIsJsonBulkOpen] = useState(false);
  const topRef = useRef<HTMLDivElement>(null);

  const { data: test } = useQuery({
    queryKey: ["admin", "cbt_test_meta", testId],
    queryFn: async () => {
      const { data } = await supabase.from("cbt_tests").select("title,marks_per_question").eq("id", testId).maybeSingle();
      return data;
    },
  });

  const { data: questions = [], isLoading } = useQuery({
    queryKey: ["admin", "cbt_questions", testId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cbt_questions").select("*")
        .eq("test_id", testId).order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as QuestionRow[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin", "cbt_questions", testId] });

  const saveMutation = useMutation({
    mutationFn: async (andNext: boolean) => {
      setSavingNext(andNext);
      if (!draft.question_text.trim()) throw new Error("Question text is required");
      if (!draft.option_a.trim() || !draft.option_b.trim() || !draft.option_c.trim() || !draft.option_d.trim())
        throw new Error("All 4 options are required");

      const { questionText } = splitQuestionTextAndSolution(draft.question_text);
      const cleanBaseText = questionText || draft.question_text.trim();
      const pyqData =
        draft.pyq_exam?.trim() || draft.pyq_year?.trim() || draft.pyq_shift?.trim()
          ? {
              exam: draft.pyq_exam?.trim() || undefined,
              year: draft.pyq_year?.trim() || undefined,
              shift: draft.pyq_shift?.trim() || undefined,
              is_pyq: true,
            }
          : null;

      const finalQuestionText = buildFinalQuestionText(
        cleanBaseText,
        draft.explanation?.trim(),
        pyqData
      );

      const payload = {
        question_text: finalQuestionText,
        option_a: draft.option_a.trim(),
        option_b: draft.option_b.trim(),
        option_c: draft.option_c.trim(),
        option_d: draft.option_d.trim(),
        correct_option: draft.correct_option,
        test_id: testId,
        marks: Number(draft.marks) || (test?.marks_per_question ?? 1),
        topic: draft.topic?.trim() || null,
        sort_order: editingId
          ? (questions.find(q => q.id === editingId)?.sort_order ?? questions.length)
          : questions.length,
      };

      if (editingId) {
        const { error } = await supabase.from("cbt_questions").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cbt_questions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_, andNext) => {
      invalidate();
      if (editingId) {
        toast.success("Question updated!");
        setEditingId(null);
      } else {
        toast.success(`Q${questions.length + 1} saved!`);
      }
      setDraft(emptyDraft());
      if (!andNext) topRef.current?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cbt_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Teacher Empowerment: Bulk Selection & Operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showRapidKeyModal, setShowRapidKeyModal] = useState(false);
  const [rapidKeyInput, setRapidKeyInput] = useState("");
  const [showBulkTopicModal, setShowBulkTopicModal] = useState(false);
  const [bulkTopicInput, setBulkTopicInput] = useState("");
  const [showBulkMarksModal, setShowBulkMarksModal] = useState(false);
  const [bulkMarksInput, setBulkMarksInput] = useState(1);
  const [bulkUploadMode, setBulkUploadMode] = useState<"upload" | "paste" | "csv" | null>(null);
  const [isBulkOpen, setIsBulkOpen] = useState(false);

  // Download Sample Excel/CSV Template with bilingual questions & solutions
  function downloadSampleCSV() {
    const csvContent = `Question,Option A,Option B,Option C,Option D,Correct Option,Topic,Marks,Explanation
"Which law of thermodynamics states that energy cannot be created or destroyed?","First Law","Second Law","Third Law","Zeroth Law","a","Physics",4,"The First Law of Thermodynamics is the law of conservation of energy."
"What is the pH of pure water at 25°C?","5","7","9","14","b","Chemistry",4,"At 25°C (298 K), the concentration of H+ and OH- in pure water is 10^-7 M, so pH = 7."
"यदि sin θ = 3/5 है, तो cos θ का मान क्या होगा? (If sin θ = 3/5, find cos θ)","4/5","5/4","3/4","1/2","a","Mathematics",4,"cos θ = √(1 - sin²θ) = √(1 - 9/25) = √(16/25) = 4/5."
"Which Indian state has the longest coastline?","Tamil Nadu","Maharashtra","Gujarat","Kerala","c","General Knowledge",2,"Gujarat has the longest coastline in India, extending about 1,600 km."
"Choose the correctly spelt word:","Accomodate","Accommodate","Acommodate","Acomodate","b","English",2,"The correct spelling is 'Accommodate' with double 'c' and double 'm'."`;

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sarvodaya_cbt_questions_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Excel/CSV template downloaded with bilingual sample questions & solutions!");
  }

  // Keyboard Ctrl+V listener on empty page opens smart paste
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        const target = e.target as HTMLElement;
        const isInput = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
        if (!isInput && !isBulkOpen) {
          navigator.clipboard.readText().then((clipText) => {
            if (clipText && clipText.length > 20) {
              setBulkUploadMode("paste");
              setIsBulkOpen(true);
              toast.info("Copied questions detected! Opening Smart Importer...");
            }
          }).catch(() => {});
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isBulkOpen]);

  // Bulk Delete Mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("cbt_questions").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setSelectedIds([]);
      toast.success("Selected questions deleted!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Bulk Topic Mutation
  const bulkTopicMutation = useMutation({
    mutationFn: async ({ ids, topic }: { ids: string[]; topic: string }) => {
      const { error } = await supabase.from("cbt_questions").update({ topic: topic.trim() || null }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setShowBulkTopicModal(false);
      setSelectedIds([]);
      toast.success("Subject/Topic updated for selected questions!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Bulk Marks Mutation
  const bulkMarksMutation = useMutation({
    mutationFn: async ({ ids, marks }: { ids: string[]; marks: number }) => {
      const { error } = await supabase.from("cbt_questions").update({ marks }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      setShowBulkMarksModal(false);
      setSelectedIds([]);
      toast.success("Marks updated for selected questions!");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Rapid Answer Key Matrix Mutation
  const rapidKeyMutation = useMutation({
    mutationFn: async (keyStr: string) => {
      const cleaned = keyStr.trim();
      if (!cleaned) throw new Error("Please enter answer keys");

      const keyMap: Record<number, "a" | "b" | "c" | "d"> = {};
      const validLetters = new Set(["a", "b", "c", "d"]);

      // Pattern 1: Indexed format "1:B 2:C" or "1.B 2.C" or "1-B, 2-C"
      const pairMatches = [...cleaned.matchAll(/(?:Q\.?|Q)?(\d+)[\:\.\-\s\=]+([a-dA-D])/gi)];
      if (pairMatches.length > 0) {
        for (const m of pairMatches) {
          const qNum = parseInt(m[1], 10);
          const opt = m[2].toLowerCase() as "a" | "b" | "c" | "d";
          if (validLetters.has(opt)) keyMap[qNum] = opt;
        }
      } else {
        // Pattern 2: Continuous string "BCAD..." or space/comma separated letters
        const tokens = cleaned.replace(/[^a-zA-Z]/g, "").toLowerCase().split("");
        tokens.forEach((char, idx) => {
          if (validLetters.has(char)) {
            keyMap[idx + 1] = char as "a" | "b" | "c" | "d";
          }
        });
      }

      if (Object.keys(keyMap).length === 0) {
        throw new Error("No valid keys found. Use format like '1:B 2:C 3:A' or continuous 'BCAD...'");
      }

      let count = 0;
      for (const [qNumStr, opt] of Object.entries(keyMap)) {
        const qIdx = parseInt(qNumStr, 10) - 1;
        const targetQ = questions[qIdx];
        if (targetQ && targetQ.correct_option !== opt) {
          const { error } = await supabase.from("cbt_questions").update({ correct_option: opt }).eq("id", targetQ.id);
          if (!error) count++;
        }
      }
      return count;
    },
    onSuccess: (cnt) => {
      invalidate();
      setShowRapidKeyModal(false);
      setRapidKeyInput("");
      toast.success(`Successfully updated answer keys for ${cnt} questions!`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSelectAll = () => {
    if (selectedIds.length === questions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(questions.map((q) => q.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  function startEdit(q: QuestionRow) {
    setEditingId(q.id);
    const { questionText, explanation } = splitQuestionTextAndSolution(q.question_text);
    const { pyq, cleanText } = extractPyqMetadata(questionText, q.topic);
    setDraft({
      question_text: cleanText,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_option: q.correct_option,
      topic: q.topic ?? "",
      marks: q.marks,
      explanation,
      pyq_exam: pyq?.exam ?? "",
      pyq_year: pyq?.year ? String(pyq.year) : "",
      pyq_shift: pyq?.shift ?? "",
    });
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  const OPT_COLORS: Record<string, string> = {
    a: "border-blue-400 bg-blue-50 text-blue-700",
    b: "border-emerald-400 bg-emerald-50 text-emerald-700",
    c: "border-amber-400 bg-amber-50 text-amber-700",
    d: "border-red-400 bg-red-50 text-red-700",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8" ref={topRef}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/admin/cbt" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> All Tests
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-bold text-slate-900 truncate max-w-xs">{test?.title ?? "…"}</h1>
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
            {questions.length} Q
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setIsJsonBulkOpen(true)}
            className="h-8 rounded-xl text-xs font-bold text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100 gap-1.5 shadow-2xs"
          >
            <FileCode className="w-3.5 h-3.5 text-amber-600" /> Bulk JSON (PYQ/Diagram)
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={downloadSampleCSV}
            className="h-8 rounded-xl text-xs font-bold text-emerald-700 border-emerald-300 bg-emerald-50 hover:bg-emerald-100 gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" /> Sample Template (.csv)
          </Button>
          <AiQuestionParser testId={testId} testTitle={test?.title} onSuccess={() => { invalidate(); window.scrollTo(0, 0); }} />
        </div>
      </div>

      {/* ── TEACHER RAPID UPLOAD STUDIO (HERO HUB) ── */}
      <div className="mb-6 rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-purple-50/40 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100/80 pb-3.5 mb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                Teacher Rapid Upload Studio <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-full">Fast Bulk Ingestion</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Upload 50–100 questions in 2 minutes using JSON (PYQ & diagrams), Word, WhatsApp, Excel, or Rapid Key Matrix. No manual 1-by-1 typing!
              </p>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-medium hidden md:block">
            Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] font-mono text-slate-700">Ctrl + V</kbd> anytime to paste questions
          </div>
        </div>

        {/* 5 Ingestion Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Card 1: JSON Bulk Importer (PYQ & Diagrams) */}
          <div
            onClick={() => setIsJsonBulkOpen(true)}
            className="group relative cursor-pointer rounded-2xl border border-amber-300/80 bg-gradient-to-b from-amber-50/50 to-white p-3.5 shadow-2xs hover:shadow-md hover:border-amber-500 transition-all flex flex-col justify-between"
          >
            <div className="space-y-1">
              <div className="w-7 h-7 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-2xs">
                <FileCode className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-amber-700 transition-colors flex items-center gap-1.5">
                JSON Bulk Importer
                <span className="text-[9px] font-black uppercase text-amber-800 bg-amber-200/70 px-1 py-0.2 rounded">PYQ</span>
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug">
                Upload question bank JSON with PYQ exam/year tags, diagrams, and full solutions in 1 click.
              </p>
            </div>
            <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 group-hover:translate-x-0.5 transition-transform">
              Open JSON Importer →
            </span>
          </div>

          {/* Card 2: Word / Text Smart Paste */}
          <div
            onClick={() => { setBulkUploadMode("paste"); setIsBulkOpen(true); }}
            className="group relative cursor-pointer rounded-2xl border border-blue-200/80 bg-white p-3.5 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all flex flex-col justify-between"
          >
            <div className="space-y-1">
              <div className="w-7 h-7 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                <FileText className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-blue-600 transition-colors">
                Smart Paste (Word / WhatsApp)
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug">
                Paste raw questions from Word, WhatsApp, or Telegram. Auto-detects options, keys & solutions.
              </p>
            </div>
            <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
              Open Smart Paste →
            </span>
          </div>

          {/* Card 2: Excel / CSV Import */}
          <div
            onClick={() => { setBulkUploadMode("csv"); setIsBulkOpen(true); }}
            className="group relative cursor-pointer rounded-2xl border border-emerald-200/80 bg-white p-3.5 shadow-2xs hover:shadow-md hover:border-emerald-400 transition-all flex flex-col justify-between"
          >
            <div className="space-y-1">
              <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                <FileSpreadsheet className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-emerald-700 transition-colors">
                Excel / CSV Sheet Import
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug">
                Upload spreadsheets or paste tabular Excel columns directly. Solutions & marks included.
              </p>
            </div>
            <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 group-hover:translate-x-0.5 transition-transform">
              Upload Sheet →
            </span>
          </div>

          {/* Card 3: Rapid Answer Key Matrix */}
          <div
            onClick={() => setShowRapidKeyModal(true)}
            className="group relative cursor-pointer rounded-2xl border border-amber-200/80 bg-white p-3.5 shadow-2xs hover:shadow-md hover:border-amber-400 transition-all flex flex-col justify-between"
          >
            <div className="space-y-1">
              <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-amber-700 transition-colors">
                Rapid Answer Key (60s)
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug">
                Have a printed test? Enter answers like <code>1:B 2:C</code> or continuous <code>BCAD...</code> in seconds.
              </p>
            </div>
            <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 group-hover:translate-x-0.5 transition-transform">
              Open Rapid Key-In →
            </span>
          </div>

          {/* Card 4: AI Vision / Scanned Paper OCR */}
          <div
            onClick={() => { setBulkUploadMode("upload"); setIsBulkOpen(true); }}
            className="group relative cursor-pointer rounded-2xl border border-purple-200/80 bg-white p-3.5 shadow-2xs hover:shadow-md hover:border-purple-400 transition-all flex flex-col justify-between"
          >
            <div className="space-y-1">
              <div className="w-7 h-7 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                <Upload className="w-3.5 h-3.5" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-xs sm:text-sm group-hover:text-purple-700 transition-colors">
                PDF / Photo OCR
              </h3>
              <p className="text-[11px] text-slate-500 leading-snug">
                Upload scanned question paper PDF or mobile camera photos. Automatic text extraction.
              </p>
            </div>
            <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 group-hover:translate-x-0.5 transition-transform">
              Upload PDF/Photo →
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* ── LEFT: Question Editor ── */}
        <div className="order-2 lg:order-1">
          {/* Header Controls for Question List */}
          {questions.length > 0 && (
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-indigo-600 cursor-pointer"
                >
                  {selectedIds.length === questions.length && questions.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-indigo-600" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Select All ({questions.length})</span>
                </button>
                {selectedIds.length > 0 && (
                  <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    {selectedIds.length} Selected
                  </span>
                )}
              </div>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowBulkTopicModal(true)}
                    className="h-7 text-xs rounded-lg gap-1 border-slate-300"
                  >
                    <Tag className="w-3 h-3 text-slate-600" /> Set Topic
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowBulkMarksModal(true)}
                    className="h-7 text-xs rounded-lg gap-1 border-slate-300"
                  >
                    Set Marks
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`Delete ${selectedIds.length} selected questions?`)) {
                        bulkDeleteMutation.mutate(selectedIds);
                      }
                    }}
                    className="h-7 text-xs rounded-lg gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Delete ({selectedIds.length})
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Questions list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
              <ListChecks className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">No questions yet</p>
              <p className="text-xs text-slate-400 mt-1">Add your first question from the form or use Quick Upload above ↑</p>
            </div>
          ) : (
            <div className="space-y-2">
              {questions.map((q, i) => {
                const { questionText: cleanQText, explanation: hasSolution } = splitQuestionTextAndSolution(q.question_text);
                return (
                  <div
                    key={q.id}
                    className={cn(
                      "group rounded-2xl border bg-white p-4 transition-all hover:shadow-sm",
                      editingId === q.id ? "border-primary ring-2 ring-primary/20" : "border-slate-200",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => toggleSelectOne(q.id)}
                          className="mt-1 p-0.5 rounded hover:bg-slate-100 cursor-pointer text-slate-400 hover:text-indigo-600 shrink-0"
                          title="Select question"
                        >
                          {selectedIds.includes(q.id) ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900 leading-snug line-clamp-2">
                            {cleanQText}
                          </p>
                          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
                            {(["a", "b", "c", "d"] as const).map((opt) => (
                              <span
                                key={opt}
                                className={cn(
                                  "text-[11px] leading-relaxed",
                                  q.correct_option === opt ? "font-bold text-emerald-600" : "text-slate-500",
                                )}
                              >
                                {opt.toUpperCase()}) {q[`option_${opt}`]}
                                {q.correct_option === opt && " ✓"}
                              </span>
                            ))}
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <PyqBadge rawText={q.question_text} topic={q.topic} mode="admin" />
                            {q.topic && (
                              <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                {q.topic}
                              </span>
                            )}
                            {q.question_text.includes("![") && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                                <ImageIcon className="w-2.5 h-2.5 text-indigo-600" /> Diagram
                              </span>
                            )}
                            {hasSolution && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                <Lightbulb className="w-2.5 h-2.5 text-amber-600" /> Solution
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(q)}
                          className="rounded-lg p-1.5 hover:bg-slate-100 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5 text-slate-500" />
                        </button>
                        <button
                          onClick={() => { if (confirm("Delete this question?")) deleteMutation.mutate(q.id); }}
                          className="rounded-lg p-1.5 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: Add / Edit Form (Mathango style) ── */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-4 self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">
                {editingId ? "✏️ Edit Question" : `➕ Add Question ${questions.length > 0 ? `#${questions.length + 1}` : ""}`}
              </h2>
              {editingId && (
                <button onClick={cancelEdit} className="text-xs text-muted-foreground hover:text-slate-700 flex items-center gap-1">
                  <RotateCcw className="h-3 w-3" /> Cancel
                </button>
              )}
            </div>

            {/* Question Text */}
            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Question *
                </label>
                <ImageUploader onUpload={(url) => setDraft((d) => ({ ...d, question_text: d.question_text + (d.question_text ? "\n" : "") + `![image](${url})` }))} />
              </div>
              <Textarea
                value={draft.question_text}
                onChange={(e) => setDraft((d) => ({ ...d, question_text: e.target.value }))}
                placeholder="Type the question here or upload an image..."
                className="min-h-[80px] text-sm resize-none rounded-xl"
                autoFocus
              />
            </div>

            {/* Options — Mathango style: click to mark correct */}
            <div className="mb-3 space-y-2">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                Options — <span className="text-emerald-600 normal-case font-normal">Click a circle to mark it correct ✓</span>
              </label>
              {(["a", "b", "c", "d"] as const).map((opt) => (
                <div key={opt} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, correct_option: opt }))}
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-all",
                      draft.correct_option === opt
                        ? OPT_COLORS[opt] + " scale-110 shadow-sm"
                        : "border-slate-200 text-slate-400 hover:border-slate-300",
                    )}
                    title={`Mark ${opt.toUpperCase()} as correct`}
                  >
                    {draft.correct_option === opt ? <CheckCircle2 className="h-4 w-4" /> : opt.toUpperCase()}
                  </button>
                  <div className="relative flex-1">
                    <Input
                      value={draft[`option_${opt}`]}
                      onChange={(e) => setDraft((d) => ({ ...d, [`option_${opt}`]: e.target.value }))}
                      placeholder={`Option ${opt.toUpperCase()}`}
                      className={cn(
                        "h-9 text-sm rounded-xl transition-all pr-8",
                        draft.correct_option === opt && "border-emerald-400 bg-emerald-50/50 font-medium",
                      )}
                    />
                    <div className="absolute right-1 top-1">
                       <ImageUploader onUpload={(url) => setDraft((d) => ({ ...d, [`option_${opt}`]: url }))} minimal />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Topic + Marks */}
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Topic / Subject</label>
                <Input
                  value={draft.topic ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, topic: e.target.value }))}
                  placeholder="GK, Maths, Reasoning..."
                  className="h-8 text-xs rounded-xl"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600 uppercase tracking-wide">Marks</label>
                <Input
                  type="number" min={1}
                  value={draft.marks}
                  onChange={(e) => setDraft((d) => ({ ...d, marks: Number(e.target.value) }))}
                  className="h-8 text-xs rounded-xl"
                />
              </div>
            </div>

            {/* PYQ Tag (Optional Previous Year Question) */}
            <div className="mb-3.5 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-amber-600" />
                  PYQ Tag (Optional)
                </label>
                <span className="text-[10px] text-amber-700/80 font-medium">Exam • Year • Shift</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Input
                  value={draft.pyq_exam ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, pyq_exam: e.target.value }))}
                  placeholder="UP Police, JEE"
                  className="h-7 text-xs rounded-lg bg-white placeholder:text-slate-400"
                />
                <Input
                  value={draft.pyq_year ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, pyq_year: e.target.value }))}
                  placeholder="Year (2024)"
                  className="h-7 text-xs rounded-lg bg-white placeholder:text-slate-400"
                />
                <Input
                  value={draft.pyq_shift ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, pyq_shift: e.target.value }))}
                  placeholder="Shift 1 / Tier 1"
                  className="h-7 text-xs rounded-lg bg-white placeholder:text-slate-400"
                />
              </div>
            </div>

            {/* Solution / Explanation (हल व व्याख्या - Optional) */}
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold text-amber-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                  Solution / Explanation (हल - Optional)
                </label>
                <span className="text-[10px] text-slate-400">Shown in test analysis</span>
              </div>
              <Textarea
                value={draft.explanation ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, explanation: e.target.value }))}
                placeholder="Step-by-step solution or formula explanation for students..."
                className="min-h-[70px] text-xs resize-none rounded-xl bg-amber-50/20 border-amber-200/60 focus:border-amber-400"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              {editingId ? (
                <Button
                  onClick={() => saveMutation.mutate(false)}
                  disabled={saveMutation.isPending}
                  className="flex-1 gap-2 rounded-xl"
                >
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Update Question
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => saveMutation.mutate(true)}
                    disabled={saveMutation.isPending}
                    className="flex-1 gap-1.5 rounded-xl"
                    variant="default"
                  >
                    {saveMutation.isPending && savingNext ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Save & Add Next
                  </Button>
                  <Button
                    onClick={() => saveMutation.mutate(false)}
                    disabled={saveMutation.isPending}
                    variant="outline"
                    className="rounded-xl px-3"
                    title="Save & scroll to list"
                  >
                    {saveMutation.isPending && !savingNext ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  </Button>
                </>
              )}
            </div>

            {/* Quick stats */}
            {questions.length > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <span className="text-xs text-slate-500">Total questions</span>
                <span className="text-sm font-bold text-primary">{questions.length}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── CONTROLLED AI BULK QUESTION PARSER ── */}
      <AiQuestionParser
        testId={testId}
        testTitle={test?.title}
        open={isBulkOpen}
        onOpenChange={setIsBulkOpen}
        initialMode={bulkUploadMode || "upload"}
        trigger={null}
        onSuccess={() => { invalidate(); window.scrollTo(0, 0); }}
      />

      {/* ── JSON BULK IMPORTER (PYQ & DIAGRAMS) ── */}
      <JsonQuestionImporter
        testId={testId}
        testTitle={test?.title}
        open={isJsonBulkOpen}
        onOpenChange={setIsJsonBulkOpen}
        currentQuestionCount={questions.length}
        onSuccess={() => { invalidate(); window.scrollTo(0, 0); }}
      />

      {/* ── RAPID ANSWER KEY MATRIX MODAL (60s FAST KEY-IN) ── */}
      <Dialog open={showRapidKeyModal} onOpenChange={setShowRapidKeyModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-black">
              <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
              Rapid Answer Key Matrix (60s Fast Entry)
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Paste or type answer keys directly. Compatible with formats: <br />
              <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">1:B 2:C 3:A 4:D</code> or continuous string <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono text-[10px]">BCADDABC...</code>
            </p>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-bold text-slate-700">Paste Answer Key String</Label>
              <Textarea
                value={rapidKeyInput}
                onChange={(e) => setRapidKeyInput(e.target.value)}
                placeholder="e.g. 1:B 2:C 3:A 4:D 5:A... or BCADDABCAD..."
                className="font-mono text-sm min-h-[120px] rounded-xl mt-1.5"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/60">
              <span className="font-semibold">Test Total: {questions.length} Questions</span>
              <span className="font-mono font-bold text-amber-900">
                Detected Keys: {
                  (() => {
                    const cleaned = rapidKeyInput.trim();
                    if (!cleaned) return 0;
                    const pairMatches = [...cleaned.matchAll(/(?:Q\.?|Q)?(\d+)[\:\.\-\s\=]+([a-dA-D])/gi)];
                    if (pairMatches.length > 0) return pairMatches.length;
                    return cleaned.replace(/[^a-zA-Z]/g, "").toLowerCase().split("").filter(t => ["a","b","c","d"].includes(t)).length;
                  })()
                }
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => { setShowRapidKeyModal(false); setRapidKeyInput(""); }}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={rapidKeyMutation.isPending || !rapidKeyInput.trim()}
              onClick={() => rapidKeyMutation.mutate(rapidKeyInput)}
              className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold gap-1.5"
            >
              {rapidKeyMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Apply Keys to Questions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BULK TOPIC MODAL ── */}
      <Dialog open={showBulkTopicModal} onOpenChange={setShowBulkTopicModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Tag className="w-4 h-4 text-indigo-600" /> Set Subject / Topic ({selectedIds.length} Questions)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Subject / Portion Name</Label>
            <Input
              value={bulkTopicInput}
              onChange={(e) => setBulkTopicInput(e.target.value)}
              placeholder="e.g. Physics, Quantitative Aptitude, GK, Hindi"
              className="rounded-xl text-sm"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowBulkTopicModal(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={bulkTopicMutation.isPending || !bulkTopicInput.trim()}
              onClick={() => bulkTopicMutation.mutate({ ids: selectedIds, topic: bulkTopicInput })}
              className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {bulkTopicMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply Topic"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── BULK MARKS MODAL ── */}
      <Dialog open={showBulkMarksModal} onOpenChange={setShowBulkMarksModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <Layers className="w-4 h-4 text-indigo-600" /> Set Marks ({selectedIds.length} Questions)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Marks per Question</Label>
            <Input
              type="number"
              value={bulkMarksInput}
              onChange={(e) => setBulkMarksInput(Number(e.target.value))}
              min={1}
              className="rounded-xl text-sm"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowBulkMarksModal(false)} className="rounded-xl text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={bulkMarksMutation.isPending || bulkMarksInput < 1}
              onClick={() => bulkMarksMutation.mutate({ ids: selectedIds, marks: bulkMarksInput })}
              className="rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {bulkMarksMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply Marks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}