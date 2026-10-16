import { useState, useMemo, useEffect } from "react";
import {
  Palette,
  Sparkles,
  Zap,
  Triangle,
  Compass,
  Layers,
  Check,
  Download,
  Copy,
  Eye,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
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
  detectDiagramNeeds,
  svgToDataUrl,
  generateVennDiagramSvg,
  generateCircuitDiagramSvg,
  generateParallelLinesSvg,
  generateTriangleSvg,
  generateDirectionPathSvg,
  VennDiagramOptions,
  CircuitDiagramOptions,
  ParallelLinesOptions,
  TriangleOptions,
  DirectionPathOptions,
} from "@/lib/diagram-generator";
import { cn } from "@/lib/utils";

interface DiagramStudioProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsertDiagram: (markdownImageTag: string) => void;
  questionTextContext?: string;
  questionIndex?: number;
}

export function DiagramStudio({
  open,
  onOpenChange,
  onInsertDiagram,
  questionTextContext = "",
  questionIndex,
}: DiagramStudioProps) {
  // Smart detection based on question text
  const detection = useMemo(
    () => detectDiagramNeeds(questionTextContext),
    [questionTextContext]
  );

  const [activeTab, setActiveTab] = useState<
    "venn" | "circuit" | "parallel" | "triangle" | "direction"
  >("venn");

  // Automatically switch tab if detection recommends a specific category
  useEffect(() => {
    if (detection.needsDiagram && detection.suggestedType) {
      if (detection.suggestedType === "venn") setActiveTab("venn");
      else if (detection.suggestedType === "circuit") setActiveTab("circuit");
      else if (detection.suggestedType === "geometry_parallel")
        setActiveTab("parallel");
      else if (detection.suggestedType === "geometry_triangle")
        setActiveTab("triangle");
      else if (detection.suggestedType === "direction")
        setActiveTab("direction");
    }
  }, [detection]);

  // 1. Venn state
  const [vennType, setVennType] = useState<"2_set" | "3_set">("2_set");
  const [vennLabelA, setVennLabelA] = useState("Doctors (डॉक्टर)");
  const [vennLabelB, setVennLabelB] = useState("Teachers (शिक्षक)");
  const [vennLabelC, setVennLabelC] = useState("Lawyers (वकील)");
  const [vennCountA, setVennCountA] = useState("15");
  const [vennCountB, setVennCountB] = useState("20");
  const [vennCountAB, setVennCountAB] = useState("8");

  // 2. Circuit state
  const [circuitType, setCircuitType] = useState<
    "parallel" | "series"
  >("parallel");
  const [r1, setR1] = useState("4 Ω");
  const [r2, setR2] = useState("8 Ω");
  const [voltage, setVoltage] = useState("12 V");

  // 3. Parallel lines state
  const [line1, setLine1] = useState("AB");
  const [line2, setLine2] = useState("CD");
  const [angleKnown, setAngleKnown] = useState("115°");
  const [angleTarget, setAngleTarget] = useState("x°");

  // 4. Triangle state
  const [triType, setTriType] = useState<"right_angled" | "general">(
    "right_angled"
  );
  const [sideAB, setSideAB] = useState("3 cm");
  const [sideBC, setSideBC] = useState("4 cm");
  const [sideCA, setSideCA] = useState("5 cm");

  // 5. Direction sense state
  const [dirTitle, setDirTitle] = useState("Direction & Distance Path");

  // Active Generated SVG String
  const currentSvg = useMemo(() => {
    switch (activeTab) {
      case "venn":
        return generateVennDiagramSvg({
          type: vennType,
          labelA: vennLabelA,
          labelB: vennLabelB,
          labelC: vennLabelC,
          countA: vennCountA,
          countB: vennCountB,
          countAB: vennCountAB,
        });
      case "circuit":
        return generateCircuitDiagramSvg({
          type: circuitType,
          r1Label: `R₁ = ${r1}`,
          r2Label: `R₂ = ${r2}`,
          voltageLabel: `V = ${voltage}`,
        });
      case "parallel":
        return generateParallelLinesSvg({
          line1Label: line1,
          line2Label: line2,
          angleKnown,
          angleTarget,
        });
      case "triangle":
        return generateTriangleSvg({
          type: triType,
          sideAB,
          sideBC,
          sideCA,
        });
      case "direction":
        return generateDirectionPathSvg({
          title: dirTitle,
        });
      default:
        return "";
    }
  }, [
    activeTab,
    vennType,
    vennLabelA,
    vennLabelB,
    vennLabelC,
    vennCountA,
    vennCountB,
    vennCountAB,
    circuitType,
    r1,
    r2,
    voltage,
    line1,
    line2,
    angleKnown,
    angleTarget,
    triType,
    sideAB,
    sideBC,
    sideCA,
    dirTitle,
  ]);

  const handleInsert = () => {
    if (!currentSvg) return;
    const dataUrl = svgToDataUrl(currentSvg);
    const alt =
      activeTab === "venn"
        ? "Venn Diagram"
        : activeTab === "circuit"
        ? "Circuit Diagram"
        : activeTab === "parallel"
        ? "Parallel Lines Diagram"
        : activeTab === "triangle"
        ? "Triangle Diagram"
        : "Direction Map";

    const markdown = `![${alt}](${dataUrl})`;
    onInsertDiagram(markdown);
    toast.success("Diagram inserted into question text!");
    onOpenChange(false);
  };

  const handleDownloadSvg = () => {
    if (!currentSvg) return;
    const blob = new Blob([currentSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sarvodaya_diagram_${activeTab}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("SVG diagram downloaded!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-3xl border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50/80 via-purple-50/50 to-slate-50">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Auto Diagram Studio & Visualizer{" "}
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">
                    STEM & Reasoning
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Generate crystal-clear, high-contrast vector diagrams for Physics circuits, Geometry, Venn diagrams & Direction sense in 1 click.
                </DialogDescription>
              </div>
            </div>

            {detection.needsDiagram && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100/80 border border-amber-300 px-3 py-1 rounded-xl">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Detected: {detection.detectedReason}</span>
              </div>
            )}
          </div>

          {/* Navigation Category Tabs */}
          <div className="mt-4 flex flex-wrap gap-1.5 bg-slate-200/60 p-1 rounded-2xl">
            {[
              { id: "venn", label: "⭕ Venn Diagram (वेन आरेख)", icon: Layers },
              { id: "circuit", label: "⚡ Physics Circuit (विद्युत परिपथ)", icon: Zap },
              { id: "parallel", label: "📏 Parallel Lines (समानांतर रेखाएँ)", icon: Sparkles },
              { id: "triangle", label: "📐 Triangle (त्रिभुज)", icon: Triangle },
              { id: "direction", label: "🧭 Direction Sense (दिशा व दूरी)", icon: Compass },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                    isActive
                      ? "bg-white text-indigo-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/40"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Studio Body: Split View (Controls Left, Live Preview Right) */}
        <div className="grid grid-cols-1 md:grid-cols-[340px_1fr] flex-1 overflow-y-auto divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Controls Column */}
          <div className="p-5 space-y-4 overflow-y-auto bg-slate-50/30">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span>Configuration Parameters</span>
            </h3>

            {/* Tab 1: Venn Controls */}
            {activeTab === "venn" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Venn Structure</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setVennType("2_set")}
                      className={cn(
                        "p-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center",
                        vennType === "2_set"
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                          : "bg-white border-slate-200 text-slate-600"
                      )}
                    >
                      2 Sets (2 गोले)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVennType("3_set")}
                      className={cn(
                        "p-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center",
                        vennType === "3_set"
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                          : "bg-white border-slate-200 text-slate-600"
                      )}
                    >
                      3 Sets (3 गोले)
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-600">Group A Label (पहला वर्ग)</Label>
                    <Input
                      value={vennLabelA}
                      onChange={(e) => setVennLabelA(e.target.value)}
                      className="h-8 text-xs rounded-xl mt-1 bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-600">Group B Label (दूसरा वर्ग)</Label>
                    <Input
                      value={vennLabelB}
                      onChange={(e) => setVennLabelB(e.target.value)}
                      className="h-8 text-xs rounded-xl mt-1 bg-white"
                    />
                  </div>
                  {vennType === "3_set" && (
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-600">Group C Label (तीसरा वर्ग)</Label>
                      <Input
                        value={vennLabelC}
                        onChange={(e) => setVennLabelC(e.target.value)}
                        className="h-8 text-xs rounded-xl mt-1 bg-white"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  <div>
                    <Label className="text-[10px] text-slate-500 font-bold">Only A</Label>
                    <Input
                      value={vennCountA}
                      onChange={(e) => setVennCountA(e.target.value)}
                      className="h-7 text-xs rounded-lg mt-0.5 bg-white text-center font-bold"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500 font-bold">Both A & B</Label>
                    <Input
                      value={vennCountAB}
                      onChange={(e) => setVennCountAB(e.target.value)}
                      className="h-7 text-xs rounded-lg mt-0.5 bg-white text-center font-bold text-purple-600"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-500 font-bold">Only B</Label>
                    <Input
                      value={vennCountB}
                      onChange={(e) => setVennCountB(e.target.value)}
                      className="h-7 text-xs rounded-lg mt-0.5 bg-white text-center font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Circuit Controls */}
            {activeTab === "circuit" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Connection Mode</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setCircuitType("parallel")}
                      className={cn(
                        "p-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center",
                        circuitType === "parallel"
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                          : "bg-white border-slate-200 text-slate-600"
                      )}
                    >
                      Parallel (समानांतर)
                    </button>
                    <button
                      type="button"
                      onClick={() => setCircuitType("series")}
                      className={cn(
                        "p-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center",
                        circuitType === "series"
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                          : "bg-white border-slate-200 text-slate-600"
                      )}
                    >
                      Series (श्रेणीक्रम)
                    </button>
                  </div>
                </div>

                <div>
                  <Label className="text-[11px] font-semibold text-slate-600">Resistor 1 (R₁)</Label>
                  <Input
                    value={r1}
                    onChange={(e) => setR1(e.target.value)}
                    placeholder="e.g. 4 Ω"
                    className="h-8 text-xs rounded-xl mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600">Resistor 2 (R₂)</Label>
                  <Input
                    value={r2}
                    onChange={(e) => setR2(e.target.value)}
                    placeholder="e.g. 8 Ω"
                    className="h-8 text-xs rounded-xl mt-1 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600">Voltage Source (V)</Label>
                  <Input
                    value={voltage}
                    onChange={(e) => setVoltage(e.target.value)}
                    placeholder="e.g. 12 V"
                    className="h-8 text-xs rounded-xl mt-1 bg-white"
                  />
                </div>
              </div>
            )}

            {/* Tab 3: Parallel Lines Controls */}
            {activeTab === "parallel" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-600">Line 1</Label>
                    <Input
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      className="h-8 text-xs rounded-xl mt-1 bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-600">Line 2</Label>
                    <Input
                      value={line2}
                      onChange={(e) => setLine2(e.target.value)}
                      className="h-8 text-xs rounded-xl mt-1 bg-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600">Known Angle (ज्ञात कोण)</Label>
                  <Input
                    value={angleKnown}
                    onChange={(e) => setAngleKnown(e.target.value)}
                    placeholder="e.g. 115°"
                    className="h-8 text-xs rounded-xl mt-1 bg-white font-bold"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600">Target Angle (अज्ञात कोण x)</Label>
                  <Input
                    value={angleTarget}
                    onChange={(e) => setAngleTarget(e.target.value)}
                    placeholder="e.g. x°"
                    className="h-8 text-xs rounded-xl mt-1 bg-white font-bold text-amber-600"
                  />
                </div>
              </div>
            )}

            {/* Tab 4: Triangle Controls */}
            {activeTab === "triangle" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Triangle Type</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setTriType("right_angled")}
                      className={cn(
                        "p-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center",
                        triType === "right_angled"
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                          : "bg-white border-slate-200 text-slate-600"
                      )}
                    >
                      Right Angled (समकोण)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTriType("general")}
                      className={cn(
                        "p-2 rounded-xl text-xs font-bold border transition cursor-pointer text-center",
                        triType === "general"
                          ? "bg-indigo-50 border-indigo-500 text-indigo-700"
                          : "bg-white border-slate-200 text-slate-600"
                      )}
                    >
                      General (सामान्य)
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-600">Side AB / Height</Label>
                    <Input
                      value={sideAB}
                      onChange={(e) => setSideAB(e.target.value)}
                      className="h-8 text-xs rounded-xl mt-1 bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-600">Side BC / Base</Label>
                    <Input
                      value={sideBC}
                      onChange={(e) => setSideBC(e.target.value)}
                      className="h-8 text-xs rounded-xl mt-1 bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-[11px] font-semibold text-slate-600">Side CA / Hypotenuse</Label>
                    <Input
                      value={sideCA}
                      onChange={(e) => setSideCA(e.target.value)}
                      className="h-8 text-xs rounded-xl mt-1 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab 5: Direction Controls */}
            {activeTab === "direction" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-[11px] font-semibold text-slate-600">Diagram Header</Label>
                  <Input
                    value={dirTitle}
                    onChange={(e) => setDirTitle(e.target.value)}
                    className="h-8 text-xs rounded-xl mt-1 bg-white"
                  />
                </div>
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 text-xs text-indigo-900 leading-snug">
                  ✨ Generates standard 4-way compass rose with start/end nodes, dotted path legs, and displacement hypotenuse.
                </div>
              </div>
            )}
          </div>

          {/* Live Vector SVG Preview Column */}
          <div className="p-6 flex flex-col items-center justify-center bg-slate-100/50 min-h-[360px]">
            <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200/90 shadow-md p-4 flex flex-col items-center justify-center">
              <div
                className="w-full aspect-[4/3] flex items-center justify-center"
                dangerouslySetInnerHTML={{ __html: currentSvg }}
              />
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 font-medium">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span>Real-time vector rendering (100% crisp at any zoom level)</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-slate-100 bg-white flex flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadSvg}
              className="rounded-xl text-xs h-9 gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" /> Download .svg
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="rounded-xl text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleInsert}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold gap-1.5 shadow-md shadow-indigo-500/20 h-9 px-5"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              Insert Diagram into Question
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
