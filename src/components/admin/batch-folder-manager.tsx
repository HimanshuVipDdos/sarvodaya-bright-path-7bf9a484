import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Plus, Trash2, FolderPlus, Sparkles, X, Check, BookOpen, Layers } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// Local storage key for custom premade batch folders
const PREMADE_FOLDERS_STORAGE_KEY = "adhyeta_premade_batch_folders_v1";

export type PremadeFoldersMap = Record<
  string, // batch_id
  Record<
    string, // subject_name
    string[] // chapter_names
  >
>;

export function getStoredPremadeFolders(): PremadeFoldersMap {
  try {
    const raw = localStorage.getItem(PREMADE_FOLDERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveStoredPremadeFolders(map: PremadeFoldersMap) {
  try {
    localStorage.setItem(PREMADE_FOLDERS_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultBatchId?: string;
  defaultSubject?: string;
  onFoldersUpdated?: () => void;
};

export function BatchFolderManager({
  open,
  onOpenChange,
  defaultBatchId,
  defaultSubject,
  onFoldersUpdated,
}: Props) {
  const qc = useQueryClient();
  const [selectedBatchId, setSelectedBatchId] = useState<string>(defaultBatchId || "");
  const [selectedSubject, setSelectedSubject] = useState<string>(defaultSubject || "");
  const [newSubjectInput, setNewSubjectInput] = useState("");
  const [newChapterInput, setNewChapterInput] = useState("");
  const [premadeMap, setPremadeMap] = useState<PremadeFoldersMap>(getStoredPremadeFolders());

  useEffect(() => {
    if (defaultBatchId) setSelectedBatchId(defaultBatchId);
  }, [defaultBatchId]);

  useEffect(() => {
    if (defaultSubject) setSelectedSubject(defaultSubject);
  }, [defaultSubject]);

  // Fetch batches
  const { data: batches = [] } = useQuery({
    queryKey: ["admin", "batch-folder-batches"],
    queryFn: async () => {
      const { data } = await supabase.from("batches").select("id,title,subjects").order("title");
      return data ?? [];
    },
  });

  // Auto select first batch if none selected
  useEffect(() => {
    if (!selectedBatchId && batches.length > 0) {
      setSelectedBatchId(batches[0].id);
    }
  }, [batches, selectedBatchId]);

  // Query existing database subjects & chapters for selected batch
  const { data: existingData, refetch: refetchExisting } = useQuery({
    queryKey: ["batch-existing-folders", selectedBatchId],
    enabled: Boolean(selectedBatchId),
    queryFn: async () => {
      const [lecturesRes, materialsRes, liveRes] = await Promise.all([
        supabase.from("lectures").select("subject,chapter").eq("batch_id", selectedBatchId),
        supabase.from("study_materials").select("subject,chapter").eq("batch_id", selectedBatchId),
        supabase.from("live_classes").select("subject,chapter").eq("batch_id", selectedBatchId),
      ]);

      const subSet = new Set<string>();
      const subToCh = new Map<string, Set<string>>();

      const addPair = (s: string | null, c: string | null) => {
        if (!s?.trim()) return;
        const sub = s.trim();
        subSet.add(sub);
        if (!subToCh.has(sub)) subToCh.set(sub, new Set());
        if (c?.trim()) subToCh.get(sub)!.add(c.trim());
      };

      (lecturesRes.data ?? []).forEach((l: any) => addPair(l.subject, l.chapter));
      (materialsRes.data ?? []).forEach((m: any) => addPair(m.subject, m.chapter));
      (liveRes.data ?? []).forEach((lc: any) => addPair(lc.subject, lc.chapter));

      // Merge subjects from batch record
      const activeBatch = batches.find((b) => b.id === selectedBatchId);
      if (activeBatch?.subjects) {
        activeBatch.subjects.forEach((sub) => {
          if (sub?.trim()) {
            subSet.add(sub.trim());
            if (!subToCh.has(sub.trim())) subToCh.set(sub.trim(), new Set());
          }
        });
      }

      // Merge custom premade map
      const customBatchMap = premadeMap[selectedBatchId] ?? {};
      Object.entries(customBatchMap).forEach(([sub, chapters]) => {
        subSet.add(sub);
        if (!subToCh.has(sub)) subToCh.set(sub, new Set());
        chapters.forEach((ch) => subToCh.get(sub)!.add(ch));
      });

      return {
        subjects: Array.from(subSet).sort(),
        subjectToChapters: Object.fromEntries(
          Array.from(subToCh.entries()).map(([k, v]) => [k, Array.from(v).sort()])
        ),
      };
    },
  });

  const activeSubjects = existingData?.subjects ?? [];
  const activeChapters = selectedSubject
    ? existingData?.subjectToChapters?.[selectedSubject] ?? []
    : [];

  // Add a new Subject folder
  function handleAddSubject() {
    const trimmed = newSubjectInput.trim();
    if (!trimmed || !selectedBatchId) return;

    const nextMap = { ...premadeMap };
    if (!nextMap[selectedBatchId]) nextMap[selectedBatchId] = {};
    if (!nextMap[selectedBatchId][trimmed]) nextMap[selectedBatchId][trimmed] = [];

    setPremadeMap(nextMap);
    saveStoredPremadeFolders(nextMap);

    // Also sync subjects array to batch record in Supabase
    const activeBatch = batches.find((b) => b.id === selectedBatchId);
    const updatedSubjects = Array.from(new Set([...(activeBatch?.subjects ?? []), trimmed]));
    supabase.from("batches").update({ subjects: updatedSubjects }).eq("id", selectedBatchId).then(() => {
      qc.invalidateQueries({ queryKey: ["admin", "batch-folder-batches"] });
    });

    setSelectedSubject(trimmed);
    setNewSubjectInput("");
    toast.success(`Subject folder "${trimmed}" created!`);
    refetchExisting();
    onFoldersUpdated?.();
  }

  // Add a new Chapter folder to selected Subject
  function handleAddChapter() {
    const trimmed = newChapterInput.trim();
    if (!trimmed || !selectedBatchId || !selectedSubject) {
      toast.error("Please select a subject folder first.");
      return;
    }

    const nextMap = { ...premadeMap };
    if (!nextMap[selectedBatchId]) nextMap[selectedBatchId] = {};
    if (!nextMap[selectedBatchId][selectedSubject]) nextMap[selectedBatchId][selectedSubject] = [];

    if (!nextMap[selectedBatchId][selectedSubject].includes(trimmed)) {
      nextMap[selectedBatchId][selectedSubject].push(trimmed);
    }

    setPremadeMap(nextMap);
    saveStoredPremadeFolders(nextMap);
    setNewChapterInput("");
    toast.success(`Chapter folder "${trimmed}" added under ${selectedSubject}!`);
    refetchExisting();
    onFoldersUpdated?.();
  }

  // Delete a Chapter folder from local premade map
  function handleDeleteChapter(ch: string) {
    if (!selectedBatchId || !selectedSubject) return;
    const nextMap = { ...premadeMap };
    if (nextMap[selectedBatchId]?.[selectedSubject]) {
      nextMap[selectedBatchId][selectedSubject] = nextMap[selectedBatchId][selectedSubject].filter(
        (c) => c !== ch
      );
    }
    setPremadeMap(nextMap);
    saveStoredPremadeFolders(nextMap);
    toast.success(`Chapter folder removed`);
    refetchExisting();
    onFoldersUpdated?.();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto font-sans">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-black">
            <FolderPlus className="h-6 w-6 text-indigo-600" />
            Premade Batch Folder Creator
          </DialogTitle>
          <DialogDescription>
            Create subject and chapter folders for your batches. When you upload lectures, PDFs, or DPPs, these premade folders will appear in dropdowns automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Step 1: Select Batch */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Select Batch
            </Label>
            <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
              <SelectTrigger className="h-10 rounded-xl font-bold text-sm">
                <SelectValue placeholder="Choose a batch..." />
              </SelectTrigger>
              <SelectContent>
                {batches.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="font-semibold text-xs">
                    {b.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Subject Folders Section */}
          {selectedBatchId && (
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-indigo-700 flex items-center gap-1.5">
                  <FolderOpen className="h-4 w-4" /> 2. Subject Folders ({activeSubjects.length})
                </Label>
              </div>

              {/* Add New Subject Input */}
              <div className="flex items-center gap-2">
                <Input
                  value={newSubjectInput}
                  onChange={(e) => setNewSubjectInput(e.target.value)}
                  placeholder="e.g. Physics, Chemistry, Mathematics, Biology..."
                  onKeyDown={(e) => e.key === "Enter" && handleAddSubject()}
                  className="h-9 text-xs rounded-xl bg-white border-slate-300"
                />
                <Button
                  size="sm"
                  onClick={handleAddSubject}
                  disabled={!newSubjectInput.trim()}
                  className="h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shrink-0 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Subject
                </Button>
              </div>

              {/* Subject Pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeSubjects.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2">No subject folders created yet. Add one above!</div>
                ) : (
                  activeSubjects.map((sub) => (
                    <button
                      key={sub}
                      onClick={() => setSelectedSubject(sub)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition shadow-2xs",
                        selectedSubject === sub
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-100"
                      )}
                    >
                      <span>📁 {sub}</span>
                      {selectedSubject === sub && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Step 3: Chapter Folders for Selected Subject */}
          {selectedBatchId && selectedSubject && (
            <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                  <Layers className="h-4 w-4" /> 3. Chapters inside "{selectedSubject}" ({activeChapters.length})
                </Label>
              </div>

              {/* Add New Chapter Input */}
              <div className="flex items-center gap-2">
                <Input
                  value={newChapterInput}
                  onChange={(e) => setNewChapterInput(e.target.value)}
                  placeholder={`Add a chapter for ${selectedSubject} (e.g. Chapter 01: Kinematics)...`}
                  onKeyDown={(e) => e.key === "Enter" && handleAddChapter()}
                  className="h-9 text-xs rounded-xl bg-white border-slate-300"
                />
                <Button
                  size="sm"
                  onClick={handleAddChapter}
                  disabled={!newChapterInput.trim()}
                  className="h-9 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 gap-1"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Chapter
                </Button>
              </div>

              {/* Chapter Items List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {activeChapters.length === 0 ? (
                  <div className="col-span-full text-xs text-slate-400 py-3 text-center">
                    No chapters created for <strong>{selectedSubject}</strong> yet. Type one above!
                  </div>
                ) : (
                  activeChapters.map((ch) => (
                    <div
                      key={ch}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs font-semibold text-slate-800"
                    >
                      <span className="truncate pr-2">📂 {ch}</span>
                      <button
                        onClick={() => handleDeleteChapter(ch)}
                        title="Remove chapter"
                        className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto rounded-xl bg-slate-900 text-white font-bold text-xs"
          >
            Done & Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
