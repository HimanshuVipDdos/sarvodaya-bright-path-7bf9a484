import { useState, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileText, Image, Loader2, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// Types for parsed questions
type ParsedQuestion = {
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: "a" | "b" | "c" | "d";
  topic?: string;
  marks: number;
};

type BulkUploaderProps = {
  testId: string;
  onSuccess: () => void;
};

export function BulkQuestionUploader({ testId, onSuccess }: BulkUploaderProps) {
  const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  // Step 1: Parse PDF/Image using AI
  const parseMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("testId", testId);

      // Use a parsing API - Option 1: OpenAI Vision API
      // Option 2: Free OCR + local parsing
      const response = await fetch("/api/parse-questions", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) throw new Error("Failed to parse file");
      return response.json() as Promise<{ questions: ParsedQuestion[] }>;
    },
    onSuccess: (data) => {
      setParsedQuestions(data.questions);
      toast.success(`${data.questions.length} questions parsed!`);
    },
    onError: (e) => toast.error(e.message),
  });

  // Step 2: Save to Supabase
  const saveMutation = useMutation({
    mutationFn: async () => {
      const questionsWithTestId = parsedQuestions.map((q, i) => ({
        ...q,
        test_id: testId,
        sort_order: i,
      }));
      
      const { error } = await supabase
        .from("cbt_questions")
        .insert(questionsWithTestId);
        
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${parsedQuestions.length} questions saved!`);
      setParsedQuestions([]);
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) parseMutation.mutate(file);
  }, []);

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-border/60 rounded-2xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => document.getElementById("file-input")?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && parseMutation.mutate(e.target.files[0])}
        />
        {parseMutation.isPending ? (
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        ) : (
          <>
            <div className="flex justify-center gap-3 mb-3">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <Image className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Drop PDF or Photo here, or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Supports: PDF, PNG, JPG</p>
          </>
        )}
      </div>

      {/* Parsed Questions Preview */}
      {parsedQuestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              <CheckCircle className="inline h-4 w-4 text-green-500 mr-1" />
              {parsedQuestions.length} questions ready to upload
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setParsedQuestions([])}
            >
              Clear
            </Button>
          </div>
          
          <div className="max-h-64 overflow-y-auto space-y-2 rounded-xl border border-border/60 p-3">
            {parsedQuestions.map((q, i) => (
              <div key={i} className="text-xs p-2 rounded-lg bg-muted/50">
                <span className="font-semibold">Q{i + 1}.</span> {q.question_text.substring(0, 80)}...
                <span className="ml-2 text-primary">Ans: {q.correct_option.toUpperCase()}</span>
              </div>
            ))}
          </div>

          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="w-full gap-2"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload {parsedQuestions.length} Questions
          </Button>
        </div>
      )}
    </div>
  );
}
