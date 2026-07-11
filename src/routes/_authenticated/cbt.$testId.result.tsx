import { z } from "zod";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Loader2, Trophy, Download, Search, ArrowLeft, Award } from "lucide-react";
import { toast } from "sonner";
import { getCbtAttemptResult } from "@/lib/cbt.functions";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/cbt/$testId/result")({
  validateSearch: z.object({ attempt: z.string() }),
  component: ResultPage,
});

function ResultPage() {
  const { testId } = Route.useParams();
  const { attempt: attemptId } = Route.useSearch();
  const fetchResult = useServerFn(getCbtAttemptResult);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cbt-result", attemptId],
    queryFn: () => fetchResult({ data: { attempt_id: attemptId } }),
  });

  function downloadCertificate() {
    if (!data) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 700;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    const bg = ctx.createLinearGradient(0, 0, 1000, 700);
    bg.addColorStop(0, "#fffdf7");
    bg.addColorStop(1, "#fef3e2");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 1000, 700);

    // Border
    ctx.strokeStyle = "#b45309";
    ctx.lineWidth = 10;
    ctx.strokeRect(24, 24, 952, 652);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.strokeRect(42, 42, 916, 616);

    ctx.textAlign = "center";
    ctx.fillStyle = "#92400e";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("SARVODAYA ADHYETA", 500, 110);

    ctx.fillStyle = "#78350f";
    ctx.font = "bold 40px serif";
    ctx.fillText("Certificate of Achievement", 500, 175);

    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#57534e";
    ctx.fillText("This certifies that", 500, 240);

    ctx.font = "bold 44px serif";
    ctx.fillStyle = "#1c1917";
    ctx.fillText(data.student_name, 500, 305);

    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#57534e";
    ctx.fillText("has successfully completed the test", 500, 350);

    ctx.font = "bold 26px sans-serif";
    ctx.fillStyle = "#b45309";
    ctx.fillText(`"${data.attempt.test?.title ?? "CBT Test"}"`, 500, 395);

    ctx.font = "bold 22px sans-serif";
    ctx.fillStyle = "#1c1917";
    ctx.fillText(
      `Score: ${data.attempt.score} / ${data.attempt.max_score}   •   Rank #${data.rank} of ${data.total_participants}`,
      500, 445,
    );

    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#78716c";
    ctx.fillText(new Date(data.attempt.submitted_at ?? Date.now()).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }), 500, 600);

    const link = document.createElement("a");
    link.download = `Certificate-${data.student_name.replace(/\s+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Certificate downloaded");
  }

  if (isLoading) {
    return <Section><div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div></Section>;
  }
  if (error || !data) {
    return (
      <Section>
        <div className="mx-auto max-w-md glass-strong rounded-3xl p-10 text-center">
          <h1 className="text-xl font-bold">Result not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">{(error as Error)?.message}</p>
          <Link to="/dashboard" className="mt-6 inline-block text-sm font-medium text-primary">Back to dashboard</Link>
        </div>
      </Section>
    );
  }

  const a = data.attempt;
  const percent = a.max_score > 0 ? Math.round((a.score / a.max_score) * 100) : 0;

  return (
    <Section>
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mt-6 max-w-xl">
        <div className="glass-strong rounded-3xl p-8 text-center">
          <Trophy className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="mt-3 text-2xl font-bold">{a.test?.title}</h1>
          <div className="mt-1 text-sm text-muted-foreground">Report Card</div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="Score" value={`${a.score}/${a.max_score}`} />
            <Stat label="Percentage" value={`${percent}%`} />
            <Stat label="Rank" value={`#${data.rank} / ${data.total_participants}`} />
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
            <Stat label="Correct" value={String(a.correct_count)} accent="text-emerald-600" />
            <Stat label="Wrong" value={String(a.wrong_count)} accent="text-destructive" />
            <Stat label="Unanswered" value={String(a.unanswered_count)} accent="text-muted-foreground" />
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button onClick={downloadCertificate} className="gap-2">
              <Award className="h-4 w-4" /> Download Certificate
            </Button>
            <Link to="/cbt/$testId/mistakes" params={{ testId }} search={{ attempt: attemptId }}>
              <Button variant="outline" className="gap-2">
                <Search className="h-4 w-4" /> Review My Mistakes
              </Button>
            </Link>
            <Link to="/cbt/$testId/leaderboard" params={{ testId }}>
              <Button variant="outline" className="gap-2">
                <Trophy className="h-4 w-4" /> Leaderboard
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </Section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 p-3">
      <div className={`text-lg font-bold ${accent ?? ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
