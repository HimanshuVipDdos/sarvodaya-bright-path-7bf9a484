/**
 * AI Question Parser
 * Uses Google Gemini API (free tier) (via Supabase Edge Function "parse-questions") for real AI-based
 * extraction from PDF text, photos (vision), or pasted text.
 * Supports: PDF, Images (PNG/JPG), Direct Text Paste
 */

import { useState, useCallback, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Upload,
  FileText,
  Image,
  Loader2,
  CheckCircle,
  AlertTriangle,
  X,
  Edit3,
  Save,
  Camera,
  Type,
  Brain,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  parseFromDelimited,
  parseFromLabeledFormat,
  validateQuestions,
  toSupabaseFormat,
  type ParsedQuestion,
} from "@/lib/ocr";

type InputMode = "upload" | "paste" | "camera";
type ParserMode = "auto" | "delimited" | "labeled";

interface AiQuestionParserProps {
  testId: string;
  testTitle?: string;
  onSuccess: () => void;
}

export function AiQuestionParser({ testId, testTitle, onSuccess }: AiQuestionParserProps) {
  const [open, setOpen] = useState(false);
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [parserMode, setParserMode] = useState<ParserMode>("auto");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState("");
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [bulkText, setBulkText] = useState("");
  const [defaultTopic, setDefaultTopic] = useState("");
  const [defaultMarks, setDefaultMarks] = useState(1);
  // Only used as guidance when the source turns out to be pure theory/notes
  // (no ready-made questions) — the AI writes fresh MCQs from that theory.
  const [targetQuestionCount, setTargetQuestionCount] = useState(10);
  const [showValidation, setShowValidation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Call the Gemini-powered edge function to parse questions from text or an image
  const callParseQuestionsAPI = useCallback(
    async (
      payload:
        | { mode: "text"; content: string }
        | { mode: "image"; content: string; mimeType: string }
    ): Promise<ParsedQuestion[]> => {
      const { data, error } = await supabase.functions.invoke("parse-questions", {
        body: {
          ...payload,
          defaultTopic: defaultTopic || null,
          defaultMarks,
          targetQuestionCount: targetQuestionCount || null,
        },
      });

      if (error) {
        throw new Error(error.message || "AI parsing request failed");
      }
      if (data?.error) {
        throw new Error(data.error);
      }
      return (data?.questions || []) as ParsedQuestion[];
    },
    [defaultTopic, defaultMarks, targetQuestionCount]
  );

  const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // strip the "data:<mime>;base64," prefix
        resolve(result.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  // Process image/PDF using the AI (Gemini) edge function
  const processFile = useCallback(
    async (file: File) => {
      setIsProcessing(true);
      setProcessingStep("Reading file...");

      try {
        let questions: ParsedQuestion[] = [];

        if (file.type === "application/pdf") {
          // Extract raw text from the PDF client-side, then let Gemini parse it
          setProcessingStep("Extracting text from PDF...");
          const text = await extractTextFromPDF(file);

          setProcessingStep("Asking AI to extract questions...");
          questions = await callParseQuestionsAPI({ mode: "text", content: text });
        } else if (file.type.startsWith("image/")) {
          // Send the image straight to Gemini's vision - far more reliable than local OCR
          setProcessingStep("Asking AI to read the image...");
          const base64 = await fileToBase64(file);
          questions = await callParseQuestionsAPI({
            mode: "image",
            content: base64,
            mimeType: file.type,
          });
        } else {
          throw new Error("Unsupported file type. Use PDF or image (PNG/JPG).");
        }

        setParsedQuestions(questions);
        setShowValidation(true);

        if (questions.length === 0) {
          toast.warning("No questions found. Try 'Text Paste' mode and paste manually.");
        } else {
          toast.success(`Found ${questions.length} questions! Review and save.`);
        }
      } catch (e: any) {
        toast.error(e.message || "Failed to process file");
      } finally {
        setIsProcessing(false);
        setProcessingStep("");
      }
    },
    [callParseQuestionsAPI]
  );

  // Process pasted text - fast local path for clean structured formats,
  // AI fallback (and default "auto" mode) for everything else
  const processPastedText = useCallback(async () => {
    if (!bulkText.trim()) {
      toast.error("Please paste some text first");
      return;
    }

    setIsProcessing(true);
    setProcessingStep("Parsing questions from text...");

    try {
      let questions: ParsedQuestion[] = [];

      if (parserMode === "delimited") {
        questions = parseFromDelimited(bulkText, "|", {
          defaultTopic: defaultTopic || null,
          defaultMarks,
        });
      } else if (parserMode === "labeled") {
        questions = parseFromLabeledFormat(bulkText, {
          defaultTopic: defaultTopic || null,
          defaultMarks,
        });
      }

      if (questions.length === 0) {
        setProcessingStep("Asking AI to extract questions...");
        questions = await callParseQuestionsAPI({ mode: "text", content: bulkText });
      }

      setParsedQuestions(questions);
      setShowValidation(true);

      if (questions.length === 0) {
        toast.warning("No questions parsed. Check the format and try again.");
      } else {
        toast.success(`Parsed ${questions.length} questions!`);
      }
    } catch (e: any) {
      toast.error(e.message || "Parsing failed");
    } finally {
      setIsProcessing(false);
      setProcessingStep("");
    }
  }, [bulkText, parserMode, defaultTopic, defaultMarks, callParseQuestionsAPI]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (e) {
      toast.error("Camera access denied. Check permissions.");
    }
  }, []);

  // Capture from camera
  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0);

    // Stop camera
    cameraStream?.getTracks().forEach((t) => t.stop());
    setCameraStream(null);

    // Convert to blob and process
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
      await processFile(file);
    }, "image/jpeg");
  }, [cameraStream, processFile]);

  // Save to Supabase
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { valid } = validateQuestions(parsedQuestions);
      if (valid.length === 0) throw new Error("No valid questions to save");

      const toInsert = toSupabaseFormat(valid, testId);

      // Insert in batches of 50 (Supabase limit)
      const batchSize = 50;
      for (let i = 0; i < toInsert.length; i += batchSize) {
        const batch = toInsert.slice(i, i + batchSize);
        const { error } = await supabase.from("cbt_questions").insert(batch);
        if (error) throw error;
      }

      return valid.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} questions saved successfully!`);
      setParsedQuestions([]);
      setBulkText("");
      setShowValidation(false);
      setOpen(false);
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Update a question during editing
  const updateQuestion = (index: number, updates: Partial<ParsedQuestion>) => {
    setParsedQuestions((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updates };
      return next;
    });
  };

  // Remove a question
  const removeQuestion = (index: number) => {
    setParsedQuestions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Re-assign sort_order
      return next.map((q, i) => ({ ...q, sort_order: i }));
    });
  };

  // Validation stats
  const { valid, invalid, stats } = validateQuestions(parsedQuestions);

  // Drag & drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.add("border-primary", "bg-primary/5");
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("border-primary", "bg-primary/5");
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.currentTarget.classList.remove("border-primary", "bg-primary/5");
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  return (
    <>
      {/* Trigger Button */}
      <Button onClick={() => setOpen(true)} className="gap-2" variant="outline">
        <Brain className="h-4 w-4" /> AI Upload
      </Button>

      {/* Main Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              AI Question Parser
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Upload PDF/Photo or paste text. Gemini AI reads it — if it already has questions
              it extracts them (filling in any missing options), and if it's just theory/notes
              it writes fresh MCQs from that content automatically.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {/* Settings */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-xl">
              <div>
                <Label className="text-xs">Default Topic (optional)</Label>
                <Input
                  value={defaultTopic}
                  onChange={(e) => setDefaultTopic(e.target.value)}
                  placeholder="e.g. Maths, GK, Reasoning"
                  className="h-8 text-sm mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Default Marks</Label>
                <Input
                  type="number"
                  value={defaultMarks}
                  onChange={(e) => setDefaultMarks(Number(e.target.value))}
                  className="h-8 text-sm mt-1"
                  min={1}
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">
                  Questions to generate, if content is theory/notes (no ready-made questions found)
                </Label>
                <Input
                  type="number"
                  value={targetQuestionCount}
                  onChange={(e) => setTargetQuestionCount(Number(e.target.value))}
                  className="h-8 text-sm mt-1"
                  min={1}
                  max={50}
                />
              </div>
            </div>

            {/* Input Mode Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {([
                { key: "upload", label: "Upload File", icon: Upload },
                { key: "paste", label: "Paste Text", icon: Type },
                { key: "camera", label: "Camera", icon: Camera },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setInputMode(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-md transition-all ${
                    inputMode === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Upload Mode */}
            {inputMode === "upload" && (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  isProcessing
                    ? "border-muted bg-muted/50 cursor-not-allowed"
                    : "border-border hover:border-primary/50 hover:bg-primary/5"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                  disabled={isProcessing}
                />
                {isProcessing ? (
                  <div className="space-y-2">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">{processingStep}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center gap-3 mb-3">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <Image className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-medium">
                      Drop PDF or Photo here, or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Supports: PDF, PNG, JPG (Max 10MB)
                    </p>
                    <p className="text-[10px] text-primary mt-2">
                      Powered by Gemini AI
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Paste Mode */}
            {inputMode === "paste" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Paste questions text</Label>
                  <Select
                    value={parserMode}
                    onValueChange={(v) => setParserMode(v as ParserMode)}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto Detect</SelectItem>
                      <SelectItem value="delimited">Pipe | Format</SelectItem>
                      <SelectItem value="labeled">Q:/A: Format</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Paste questions in any format:

Format 1 (Natural):
Q1. What is 2+2?
A) 3
B) 4
C) 5
D) 6
Ans: B

Format 2 (Pipe-separated):
What is 2+2? | 3 | 4 | 5 | 6 | B | Maths | 1

Format 3 (Labeled):
Q: What is 2+2?
A: 3
B: 4
C: 5
D: 6
Answer: B`}
                  className="min-h-[200px] text-xs font-mono"
                />

                <div className="flex gap-2">
                  <Button
                    onClick={processPastedText}
                    disabled={isProcessing || !bulkText.trim()}
                    className="gap-2"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}
                    Parse Questions
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setBulkText("")}
                    disabled={!bulkText}
                  >
                    Clear
                  </Button>
                </div>

                {isProcessing && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> {processingStep}
                  </p>
                )}
              </div>
            )}

            {/* Camera Mode */}
            {inputMode === "camera" && (
              <div className="space-y-3">
                {!cameraStream ? (
                  <div className="text-center p-8 border-2 border-dashed rounded-2xl">
                    <Camera className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-3">
                      Take a photo of your question paper
                    </p>
                    <Button onClick={startCamera} className="gap-2">
                      <Camera className="h-4 w-4" /> Open Camera
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full rounded-xl border"
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="flex gap-2">
                      <Button onClick={capturePhoto} className="flex-1 gap-2">
                        <Camera className="h-4 w-4" /> Capture & Parse
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          cameraStream?.getTracks().forEach((t) => t.stop());
                          setCameraStream(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Validation Stats */}
            {showValidation && parsedQuestions.length > 0 && (
              <div className="p-3 bg-muted/30 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-1">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Parsed {parsedQuestions.length} Questions
                  </h4>
                  <Badge variant={valid.length === parsedQuestions.length ? "default" : "destructive"}>
                    {valid.length} valid
                    {invalid.length > 0 && `, ${invalid.length} need fix`}
                  </Badge>
                </div>

                {invalid.length > 0 && (
                  <div className="flex items-start gap-1.5 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                    <span>{invalid.length} questions have issues. Edit them below before saving.</span>
                  </div>
                )}
              </div>
            )}

            {/* Questions Preview & Editor */}
            {parsedQuestions.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Preview & Edit
                  </h4>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setParsedQuestions((prev) =>
                          prev.map((q, i) => ({
                            ...q,
                            correct_option: (() => {
                              const opts = ["a", "b", "c", "d"] as const;
                              return opts[i % 4];
                            })(),
                          }))
                        )
                      }
                      className="h-7 text-xs gap-1"
                    >
                      <RefreshCw className="h-3 w-3" /> Reset Answers
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setParsedQuestions([])}
                      className="h-7 text-xs text-destructive gap-1"
                    >
                      <Trash2 className="h-3 w-3" /> Clear All
                    </Button>
                  </div>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-2">
                  {parsedQuestions.map((q, i) => {
                    const isInvalid = invalid.some((inv) => inv.index === i);
                    const isEditing = editingIndex === i;

                    return (
                      <div
                        key={i}
                        className={`border rounded-xl p-3 transition-all ${
                          isInvalid
                            ? "border-amber-400 bg-amber-50/30"
                            : "border-border bg-card"
                        }`}
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary">
                              Q{i + 1}
                            </span>
                            {isInvalid && (
                              <Badge variant="outline" className="text-[10px] h-5 border-amber-400 text-amber-600">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                Needs fix
                              </Badge>
                            )}
                            {!isInvalid && (
                              <Badge variant="outline" className="text-[10px] h-5 text-green-600 border-green-300">
                                <CheckCircle className="h-2.5 w-2.5 mr-0.5" />
                                Valid
                              </Badge>
                            )}
                            {q.source === "generated" && (
                              <Badge variant="outline" className="text-[10px] h-5 text-purple-600 border-purple-300">
                                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                AI-written — verify facts
                              </Badge>
                            )}
                            {q.source === "options_filled" && (
                              <Badge variant="outline" className="text-[10px] h-5 text-blue-600 border-blue-300">
                                <Sparkles className="h-2.5 w-2.5 mr-0.5" />
                                AI-filled options
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                setEditingIndex(isEditing ? null : i)
                              }
                              className="p-1 rounded-md hover:bg-muted transition-colors"
                              title="Edit"
                            >
                              {isEditing ? (
                                <Save className="h-3.5 w-3.5 text-green-600" />
                              ) : (
                                <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                            <button
                              onClick={() => removeQuestion(i)}
                              className="p-1 rounded-md hover:bg-destructive/10 transition-colors"
                              title="Remove"
                            >
                              <X className="h-3.5 w-3.5 text-destructive" />
                            </button>
                          </div>
                        </div>

                        {/* Edit Mode */}
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea
                              value={q.question_text}
                              onChange={(e) =>
                                updateQuestion(i, {
                                  question_text: e.target.value,
                                })
                              }
                              className="text-xs min-h-[60px]"
                              placeholder="Question text"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              {(["a", "b", "c", "d"] as const).map((opt) => (
                                <Input
                                  key={opt}
                                  value={q[`option_${opt}`]}
                                  onChange={(e) =>
                                    updateQuestion(i, {
                                      [`option_${opt}`]: e.target.value,
                                    })
                                  }
                                  className="text-xs h-7"
                                  placeholder={`Option ${opt.toUpperCase()}`}
                                />
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Select
                                value={q.correct_option}
                                onValueChange={(v) =>
                                  updateQuestion(i, {
                                    correct_option: v as "a" | "b" | "c" | "d",
                                  })
                                }
                              >
                                <SelectTrigger className="h-7 w-24 text-xs">
                                  <SelectValue placeholder="Answer" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="a">A</SelectItem>
                                  <SelectItem value="b">B</SelectItem>
                                  <SelectItem value="c">C</SelectItem>
                                  <SelectItem value="d">D</SelectItem>
                                </SelectContent>
                              </Select>
                              <Input
                                value={q.topic || ""}
                                onChange={(e) =>
                                  updateQuestion(i, { topic: e.target.value })
                                }
                                className="h-7 text-xs flex-1"
                                placeholder="Topic"
                              />
                              <Input
                                type="number"
                                value={q.marks}
                                onChange={(e) =>
                                  updateQuestion(i, {
                                    marks: Number(e.target.value),
                                  })
                                }
                                className="h-7 text-xs w-16"
                                placeholder="Marks"
                              />
                            </div>
                          </div>
                        ) : (
                          /* View Mode */
                          <div className="space-y-1">
                            <p className="text-xs font-medium line-clamp-2">
                              {q.question_text}
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                              {(["a", "b", "c", "d"] as const).map((opt) => (
                                <span
                                  key={opt}
                                  className={
                                    q.correct_option === opt
                                      ? "text-green-600 font-semibold"
                                      : ""
                                  }
                                >
                                  {opt.toUpperCase()}) {q[`option_${opt}`]}
                                  {q.correct_option === opt && " ✓"}
                                </span>
                              ))}
                            </div>
                            {(q.topic || q.marks > 1) && (
                              <div className="flex gap-2 mt-1">
                                {q.topic && (
                                  <Badge variant="secondary" className="text-[9px] h-4">
                                    {q.topic}
                                  </Badge>
                                )}
                                {q.marks > 1 && (
                                  <Badge variant="outline" className="text-[9px] h-4">
                                    {q.marks} marks
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t mt-2">
            <div className="flex-1 text-xs text-muted-foreground">
              {valid.length > 0 && `${valid.length} questions ready to save`}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={valid.length === 0 || saveMutation.isPending}
                className="gap-2"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Save {valid.length > 0 && `(${valid.length})`} Questions
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Extract text from PDF using PDF.js (free)
 */
async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const pdfjs = await import("pdfjs-dist");
    // Use CDN worker (free)
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }

    return fullText;
  } catch (e: any) {
    // Fallback: try to read as text
    try {
      const text = await file.text();
      if (text.length > 100) return text;
    } catch {
      // ignore
    }
    throw new Error(
      "Failed to extract text from PDF. Try converting to image or use text paste mode."
    );
  }
}
