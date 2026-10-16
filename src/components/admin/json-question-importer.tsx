import { useState, useRef, useMemo } from "react";
import {
  FileCode,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Award,
  ImageIcon,
  Copy,
  Layers,
  ArrowRight,
  Eye,
  Palette,
  Check,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  parseTeacherJsonQuestions,
  buildFinalQuestionText,
  formatPyqLabel,
  NormalizedQuestionPayload,
} from "@/lib/cbt-pyq-utils";
import { detectDiagramNeeds } from "@/lib/diagram-generator";
import { DiagramStudio } from "@/components/admin/diagram-studio";
import { cn } from "@/lib/utils";

interface UploadedDiagram {
  name: string;
  url: string;
  matchedQ?: number;
}

interface JsonQuestionImporterProps {
  testId: string;
  testTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  currentQuestionCount: number;
}

export function JsonQuestionImporter({
  testId,
  testTitle,
  open,
  onOpenChange,
  onSuccess,
  currentQuestionCount,
}: JsonQuestionImporterProps) {
  const [jsonText, setJsonText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Multi-image upload states
  const [uploadedImages, setUploadedImages] = useState<UploadedDiagram[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  // Diagram Studio state
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioContext, setStudioContext] = useState<{
    text: string;
    qIndex: number;
  } | null>(null);

  // Pre-flight parsing & validation
  const parseResult = useMemo(() => {
    if (!jsonText.trim()) return null;
    return parseTeacherJsonQuestions(jsonText);
  }, [jsonText]);

  // Sample JSON Template Generator
  const downloadSampleJson = () => {
    const sample = {
      exam: "UP Police Constable",
      year: 2024,
      shift: "17 Feb Shift 1",
      topic: "General Knowledge & Science",
      questions: [
        {
          question:
            "उत्तर प्रदेश में 'कुंभ मेला' प्रत्येक कितने वर्षों के अंतराल पर आयोजित किया जाता है?\n(At what interval is the Kumbh Mela held in Uttar Pradesh?)",
          options: {
            A: "6 वर्ष (6 Years)",
            B: "12 वर्ष (12 Years)",
            C: "10 वर्ष (10 Years)",
            D: "14 वर्ष (14 Years)",
          },
          correct_answer: "B",
          explanation:
            "प्रयागराज में महाकुंभ मेला प्रत्येक 12 वर्ष के अंतराल पर तथा अर्धकुंभ 6 वर्ष के अंतराल पर आयोजित किया जाता है। (Maha Kumbh is held every 12 years and Ardh Kumbh every 6 years in Prayagraj.)",
          topic: "UP GK",
          marks: 2,
          is_pyq: true,
          pyq_exam: "UP Police Constable",
          pyq_year: "2024",
          pyq_shift: "17 Feb Shift 1",
        },
        {
          question:
            "नीचे दिए गए विद्युत परिपथ (circuit diagram) में A और B के बीच तुल्य प्रतिरोध (Equivalent Resistance) ज्ञात कीजिए:\n\n![Circuit Diagram](https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80)",
          options: {
            A: "4 Ω",
            B: "8 Ω",
            C: "12 Ω",
            D: "16 Ω",
          },
          correct_answer: "A",
          explanation:
            "समानांतर क्रम में जुड़े दो 8 Ω के प्रतिरोधकों का तुल्य प्रतिरोध:\n$$R_{eq} = \\frac{R_1 \\times R_2}{R_1 + R_2} = \\frac{8 \\times 8}{8 + 8} = 4\\ \\Omega$$\nअतः सही विकल्प (A) है।",
          topic: "Physics",
          marks: 4,
          is_pyq: true,
          pyq_exam: "JEE Main",
          pyq_year: "2024",
          pyq_shift: "27 Jan Shift 1",
        },
        {
          question:
            "यदि $\\sqrt{x} + \\frac{1}{\\sqrt{x}} = 3$ है, तो $x^2 + \\frac{1}{x^2}$ का मान क्या होगा?",
          options: {
            A: "47",
            B: "49",
            C: "51",
            D: "53",
          },
          correct_answer: "A",
          explanation:
            "दोनों पक्षों का वर्ग करने पर:\n$$x + \\frac{1}{x} + 2 = 9 \\implies x + \\frac{1}{x} = 7$$\nपुनः वर्ग करने पर:\n$$x^2 + \\frac{1}{x^2} + 2 = 49 \\implies x^2 + \\frac{1}{x^2} = 47$$\nसही उत्तर (A) है।",
          topic: "Mathematics",
          marks: 4,
          is_pyq: true,
          pyq_exam: "SSC CGL",
          pyq_year: "2023",
          pyq_shift: "Tier 1",
        },
      ],
    };

    const blob = new Blob([JSON.stringify(sample, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sarvodaya_cbt_pyq_sample.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Sample JSON template downloaded with PYQ & Diagram examples!");
  };

  // Load from File picker
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (content) {
        setJsonText(content);
        toast.info(`Loaded JSON file: ${file.name}`);
      }
    };
    reader.onerror = () => toast.error("Could not read file");
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Batch Image Uploader & Auto-Mapping
  const handleImageFilesUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    toast.info(`Uploading ${files.length} diagram image(s) to cloud storage...`);

    const newUploaded: UploadedDiagram[] = [];
    let updatedJsonText = jsonText;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const ext = file.name.split(".").pop() || "png";
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `cbt_diagrams/${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 7)}_${cleanName}`;

        const { error } = await supabase.storage
          .from("public")
          .upload(path, file, { cacheControl: "3600", upsert: true });

        let publicUrl = "";
        if (error) {
          // Fallback to Data URL if storage quota is constrained
          publicUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (ev) => resolve(ev.target?.result as string);
            reader.readAsDataURL(file);
          });
        } else {
          const {
            data: { publicUrl: url },
          } = supabase.storage.from("public").getPublicUrl(path);
          publicUrl = url;
        }

        // Check if filename references a question number: e.g. "1.png", "q1.png", "question_2.jpg"
        let matchedQ: number | undefined;
        const numMatch = file.name.match(/^(?:q(?:uestion)?[_-]?)?(\d+)/i);
        if (numMatch) {
          matchedQ = parseInt(numMatch[1], 10);
        }

        // If JSON references this filename directly (e.g. "circuit.png" or "q1.png"), replace with public URL!
        if (updatedJsonText.includes(file.name)) {
          updatedJsonText = updatedJsonText.split(file.name).join(publicUrl);
        }

        newUploaded.push({ name: file.name, url: publicUrl, matchedQ });
      } catch (err: any) {
        console.error("Failed uploading image:", file.name, err);
      }
    }

    // Auto-attach matched images to corresponding questions in JSON if available
    if (updatedJsonText) {
      try {
        const parsed = JSON.parse(updatedJsonText);
        const targetList = Array.isArray(parsed)
          ? parsed
          : parsed.questions || parsed.data || parsed.items;

        if (Array.isArray(targetList)) {
          let changed = false;
          newUploaded.forEach((img) => {
            if (img.matchedQ && img.matchedQ <= targetList.length) {
              const qObj = targetList[img.matchedQ - 1];
              const qText = qObj.question || qObj.question_text || "";
              if (!qText.includes(img.url)) {
                const updated = qText.trim() + `\n\n![Diagram](${img.url})`;
                if (qObj.question) qObj.question = updated;
                if (qObj.question_text) qObj.question_text = updated;
                changed = true;
              }
            }
          });
          if (changed) {
            updatedJsonText = JSON.stringify(parsed, null, 2);
          }
        }
      } catch {
        // Ignore JSON syntax error if teacher is still typing
      }
    }

    setJsonText(updatedJsonText);
    setUploadedImages((prev) => [...prev, ...newUploaded]);
    setIsUploadingImages(false);

    const autoMatchedCount = newUploaded.filter(
      (img) => img.matchedQ !== undefined
    ).length;
    toast.success(
      `Uploaded ${newUploaded.length} diagram(s)! ${
        autoMatchedCount > 0
          ? `(${autoMatchedCount} auto-mapped to questions by filename)`
          : ""
      }`
    );
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  // Manually Assign an Uploaded Image to Question #
  const assignImageToQuestion = (imageUrl: string, qIndex: number) => {
    try {
      const parsed = JSON.parse(jsonText);
      const targetList = Array.isArray(parsed)
        ? parsed
        : parsed.questions || parsed.data || parsed.items;

      if (Array.isArray(targetList) && targetList[qIndex]) {
        const qObj = targetList[qIndex];
        const qText = qObj.question || qObj.question_text || "";
        if (!qText.includes(imageUrl)) {
          const updated = qText.trim() + `\n\n![Diagram](${imageUrl})`;
          if (qObj.question) qObj.question = updated;
          if (qObj.question_text) qObj.question_text = updated;
          setJsonText(JSON.stringify(parsed, null, 2));
          toast.success(`Assigned diagram to Question #${qIndex + 1}!`);
        } else {
          toast.info(`Diagram is already attached to Question #${qIndex + 1}.`);
        }
      }
    } catch {
      toast.error("Please ensure JSON syntax is valid before assigning diagrams.");
    }
  };

  // Handle Diagram Studio Insert
  const handleInsertStudioDiagram = (markdownTag: string) => {
    if (!studioContext) return;
    const targetIdx = studioContext.qIndex;

    try {
      const parsed = JSON.parse(jsonText);
      const targetList = Array.isArray(parsed)
        ? parsed
        : parsed.questions || parsed.data || parsed.items;

      if (Array.isArray(targetList) && targetList[targetIdx]) {
        const qObj = targetList[targetIdx];
        const currentQText = qObj.question || qObj.question_text || "";
        const updatedQText = currentQText.trim() + "\n\n" + markdownTag;
        if (qObj.question) qObj.question = updatedQText;
        if (qObj.question_text) qObj.question_text = updatedQText;
        setJsonText(JSON.stringify(parsed, null, 2));
        toast.success(`Auto-generated diagram added to Question #${targetIdx + 1}!`);
      }
    } catch {
      // If raw text
      setJsonText(
        (prev) => prev + `\n\n// Added Diagram for Q#${targetIdx + 1}:\n${markdownTag}`
      );
    }
  };

  // Execute Bulk Import to Database
  const handleImport = async () => {
    if (!parseResult || !parseResult.success || parseResult.questions.length === 0) {
      toast.error("Please fix JSON errors before importing.");
      return;
    }

    try {
      setIsImporting(true);

      const rowsToInsert = parseResult.questions.map((q, idx) => {
        const finalQuestionText = buildFinalQuestionText(
          q.question_text,
          q.explanation,
          q.pyq
        );

        return {
          test_id: testId,
          question_text: finalQuestionText,
          option_a: q.option_a,
          option_b: q.option_b,
          option_c: q.option_c,
          option_d: q.option_d,
          correct_option: q.correct_option,
          topic: q.topic || null,
          marks: q.marks || 1,
          sort_order: currentQuestionCount + idx,
        };
      });

      // Insert in chunks of 50 to avoid network payload limits
      const chunkSize = 50;
      for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
        const chunk = rowsToInsert.slice(i, i + chunkSize);
        const { error } = await supabase.from("cbt_questions").insert(chunk);
        if (error) throw error;
      }

      toast.success(
        `Successfully imported ${rowsToInsert.length} questions (${parseResult.summary.pyqCount} PYQs, ${parseResult.summary.diagramCount} diagrams)!`
      );
      setJsonText("");
      setUploadedImages([]);
      onOpenChange(false);
      onSuccess();
    } catch (err: any) {
      toast.error(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[94vh] flex flex-col p-0 overflow-hidden rounded-3xl border-slate-200">
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-slate-100 bg-gradient-to-r from-amber-50/70 via-indigo-50/40 to-slate-50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20 shrink-0">
                  <FileCode className="w-5 h-5" />
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    JSON Bulk Importer{" "}
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      PYQ, Multi-Images & Auto-Diagram
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-slate-500 mt-0.5">
                    Import full test papers with diagrams, auto-match multiple images at once, or auto-generate vector diagrams for questions that need figures.
                  </DialogDescription>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadSampleJson}
                  className="text-xs font-bold text-amber-800 border-amber-300 bg-amber-50 hover:bg-amber-100 gap-1.5 rounded-xl h-8 shrink-0 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" /> Sample JSON Template
                </Button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
            {/* Action Row: Load JSON file, Load Multiple Images, Open Auto-Visualizer */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Upload .json File */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-8 text-xs rounded-xl gap-1.5 border-slate-300 bg-white shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-600" />
                  Load .json File
                </Button>

                {/* 2. Upload Multiple Diagram Images */}
                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageFilesUpload}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploadingImages}
                  onClick={() => imageInputRef.current?.click()}
                  className="h-8 text-xs font-bold rounded-xl gap-1.5 border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 shadow-2xs"
                >
                  {isUploadingImages ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  Upload Multiple Images (Auto-Map)
                </Button>

                {/* 3. Open Diagram Studio */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setStudioContext({ text: jsonText, qIndex: 0 });
                    setStudioOpen(true);
                  }}
                  className="h-8 text-xs font-bold rounded-xl gap-1.5 border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 shadow-2xs"
                >
                  <Palette className="w-3.5 h-3.5 text-purple-600" />
                  Auto Diagram Studio
                </Button>
              </div>

              {jsonText && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                  className="h-8 text-xs rounded-xl gap-1 text-slate-600 hover:text-slate-900"
                >
                  <Eye className="w-3.5 h-3.5" />
                  {showPreview ? "Hide Live Preview" : "View Live Preview"}
                </Button>
              )}
            </div>

            {/* Visual Image Tray: If multiple images uploaded */}
            {uploadedImages.length > 0 && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-950">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                    Uploaded Diagram Images ({uploadedImages.length}):
                  </span>
                  <span className="text-[11px] text-slate-500 font-normal">
                    Tip: Name images <code>1.png</code>, <code>2.jpg</code> to auto-attach to Question 1, 2...
                  </span>
                </div>

                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {uploadedImages.map((img, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1.5 shadow-2xs shrink-0"
                    >
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-8 h-8 rounded-lg object-contain bg-slate-50 border border-slate-100"
                      />
                      <div className="text-[11px] leading-tight">
                        <p className="font-semibold text-slate-800 max-w-[110px] truncate" title={img.name}>
                          {img.name}
                        </p>
                        <div className="flex items-center gap-1 mt-0.5">
                          {img.matchedQ ? (
                            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1 rounded">
                              Q#{img.matchedQ} ✓
                            </span>
                          ) : (
                            parseResult?.questions && parseResult.questions.length > 0 && (
                              <select
                                onChange={(e) => {
                                  const val = parseInt(e.target.value, 10);
                                  if (!isNaN(val)) assignImageToQuestion(img.url, val - 1);
                                }}
                                defaultValue=""
                                className="text-[10px] bg-slate-50 border rounded px-1 py-0.5 text-slate-700 font-medium"
                              >
                                <option value="" disabled>Assign to Q#</option>
                                {parseResult.questions.map((_, idx) => (
                                  <option key={idx} value={idx + 1}>Q#{idx + 1}</option>
                                ))}
                              </select>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Textarea */}
            <div className="relative">
              <Textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder={`Paste your question bank JSON here...\n\nExample:\n[\n  {\n    "question": "In the circuit below, find equivalent resistance:\\n\\n![Diagram](https://example.com/circuit.png)",\n    "options": { "A": "4 Ω", "B": "8 Ω", "C": "12 Ω", "D": "16 Ω" },\n    "correct_answer": "A",\n    "explanation": "Formula: R_eq = (R1*R2)/(R1+R2)",\n    "is_pyq": true,\n    "pyq_exam": "UP Police Constable",\n    "pyq_year": "2024",\n    "pyq_shift": "17 Feb Shift 1"\n  }\n]`}
                className="font-mono text-xs min-h-[190px] max-h-[320px] rounded-2xl resize-y border-slate-200 focus:border-amber-400 bg-slate-50/50"
                spellCheck={false}
              />
            </div>

            {/* Live Validation & Diagnostics Card */}
            {parseResult && (
              <div className="rounded-2xl border p-4 transition-all duration-200 bg-white shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                  <div className="flex items-center gap-2">
                    {parseResult.success ? (
                      <div className="flex items-center gap-1.5 text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Ready to Ingest ({parseResult.summary.total} Questions)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-black text-red-700 bg-red-50 px-2.5 py-1 rounded-xl border border-red-200">
                        <AlertCircle className="w-4 h-4 text-red-600" />
                        <span>Syntax / Format Issues Found</span>
                      </div>
                    )}
                  </div>

                  {/* Badges Count */}
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <span className="flex items-center gap-1 text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg">
                      <Layers className="w-3 h-3 text-slate-500" />
                      {parseResult.summary.total} Questions
                    </span>
                    <span className="flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-lg">
                      <Award className="w-3 h-3 text-amber-600" />
                      {parseResult.summary.pyqCount} PYQs
                    </span>
                    <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2.5 py-0.5 rounded-lg">
                      <ImageIcon className="w-3 h-3 text-indigo-600" />
                      {parseResult.summary.diagramCount} Diagrams
                    </span>
                  </div>
                </div>

                {/* Errors List */}
                {parseResult.errors.length > 0 && (
                  <div className="mt-3 space-y-1.5 text-xs text-red-600 bg-red-50/60 p-3 rounded-xl border border-red-100 max-h-36 overflow-y-auto">
                    <div className="font-bold flex items-center gap-1 text-red-800">
                      <AlertCircle className="w-3.5 h-3.5" /> Please correct the following issues:
                    </div>
                    {parseResult.errors.map((err, i) => (
                      <div key={i} className="font-mono text-[11px] pl-4">
                        • {err}
                      </div>
                    ))}
                  </div>
                )}

                {/* Live Preview List with Diagram Auto-Generator buttons */}
                {showPreview && parseResult.questions.length > 0 && (
                  <div className="mt-4 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                      <span>Questions Preview & Diagram Assistance:</span>
                      <span className="text-[10px] text-slate-400">Total: {parseResult.questions.length}</span>
                    </div>

                    {parseResult.questions.map((q, idx) => {
                      const diagDetect = detectDiagramNeeds(q.question_text);

                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border border-slate-100 bg-slate-50/60 text-xs space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-bold text-slate-800 line-clamp-2">
                              Q{idx + 1}. {q.question_text.replace(/!\[.*?\]\(.*?\)/g, "[🖼️ Diagram]")}
                            </span>
                            {q.pyq && (
                              <span className="shrink-0 text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                                PYQ: {formatPyqLabel(q.pyq)}
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-600">
                            <span>A: {q.option_a}</span>
                            <span>B: {q.option_b}</span>
                            <span>C: {q.option_c}</span>
                            <span>D: {q.option_d}</span>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[10px] font-bold">
                            <div className="flex items-center gap-2">
                              <span className="text-emerald-700">Correct: Option {q.correct_option.toUpperCase()}</span>
                              {q.has_diagram ? (
                                <span className="text-indigo-600 flex items-center gap-1">
                                  <ImageIcon className="w-3 h-3" /> Diagram Attached ✓
                                </span>
                              ) : diagDetect.needsDiagram ? (
                                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                                  Needs Diagram ({diagDetect.suggestedType})
                                </span>
                              ) : null}
                            </div>

                            {/* Auto-Generate Diagram Button for this Question */}
                            {!q.has_diagram && (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setStudioContext({
                                    text: q.question_text,
                                    qIndex: idx,
                                  });
                                  setStudioOpen(true);
                                }}
                                className="h-6 text-[10px] font-bold rounded-lg border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 gap-1"
                              >
                                <Palette className="w-3 h-3 text-purple-600" />
                                {diagDetect.needsDiagram
                                  ? `🎨 Auto-Generate ${diagDetect.suggestedType} Diagram`
                                  : "🎨 Add Diagram"}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50 flex flex-row items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs h-9"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleImport}
              disabled={
                !parseResult ||
                !parseResult.success ||
                parseResult.questions.length === 0 ||
                isImporting
              }
              className="bg-gradient-to-r from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white rounded-xl text-xs font-bold gap-1.5 shadow-md shadow-orange-500/20 h-9 px-5"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Importing Questions...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Import {parseResult?.questions.length || 0} Questions
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embedded Diagram Studio Modal */}
      <DiagramStudio
        open={studioOpen}
        onOpenChange={setStudioOpen}
        onInsertDiagram={handleInsertStudioDiagram}
        questionTextContext={studioContext?.text || ""}
        questionIndex={studioContext?.qIndex}
      />
    </>
  );
}
