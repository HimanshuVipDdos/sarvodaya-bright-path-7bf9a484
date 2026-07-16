import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Trophy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatScore } from "@/lib/utils";
import { getCbtLeaderboard } from "@/lib/cbt.functions";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/cbt/$testId/leaderboard")({
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { testId } = useParams({ from: "/_authenticated/admin/cbt/$testId/leaderboard" });
  const fetchLeaderboard = useServerFn(getCbtLeaderboard);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "cbt_leaderboard", testId],
    queryFn: () => fetchLeaderboard({ data: { test_id: testId } }),
    refetchInterval: 10000, // near-live: re-check for new submissions every 10s
  });

  const attempts = data?.attempts ?? [];
  const top10 = attempts.slice(0, 10);

  function downloadImage() {
    const canvas = document.createElement("canvas");
    const rowH = 44, headerH = 96, width = 760;
    canvas.width = width;
    canvas.height = headerH + rowH * (top10.length || 1) + 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    const bg = ctx.createLinearGradient(0, 0, width, canvas.height);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#1e1b4b");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, canvas.height);

    // Header
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.fillText("🏆 Top 10 Ranking", 28, 44);
    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#c7d2fe";
    ctx.fillText(data?.test_title ?? "Test", 28, 70);

    // Table header
    let y = headerH;
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "#a5b4fc";
    ctx.fillText("RANK", 28, y);
    ctx.fillText("STUDENT", 100, y);
    ctx.fillText(`${formatScore(a.score)}/${a.max_score}`, 520, y);
    ctx.fillText("CORRECT", 620, y);
    y += 14;
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath(); ctx.moveTo(28, y); ctx.lineTo(width - 28, y); ctx.stroke();

    top10.forEach((a: any, i: number) => {
      y += rowH;
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
      ctx.font = "bold 18px sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(medal), 28, y);
      ctx.font = "16px sans-serif";
      ctx.fillText(a.profile?.full_name ?? "Student", 100, y);
      ctx.font = "bold 16px sans-serif";
      ctx.fillStyle = "#4ade80";
      ctx.fillText(`${a.score}/${a.max_score}`, 520, y);
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "16px sans-serif";
      ctx.fillText(`${a.correct_count}/${a.correct_count + a.wrong_count + a.unanswered_count}`, 620, y);
    });

    const link = document.createElement("a");
    link.download = `${(data?.test_title ?? "leaderboard").replace(/\s+/g, "-")}-top10.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Leaderboard image downloaded");
  }

  return (
    <Section>
      <Link to="/admin/cbt" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All Tests
      </Link>

      <div className="mt-4 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Admin · CBT</div>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{data?.test_title ?? "Leaderboard"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{attempts.length} student{attempts.length === 1 ? "" : "s"} attempted this test.</p>
        </div>
        <Button onClick={downloadImage} disabled={top10.length === 0} className="gap-2">
          <Download className="h-4 w-4" /> Download Top 10 as Image
        </Button>
      </div>

      <div className="glass-strong rounded-3xl p-4 sm:p-6">
        {isLoading && <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>}
        {!isLoading && attempts.length === 0 && (
          <div className="py-10 text-center text-muted-foreground">No students have submitted this test yet.</div>
        )}
        {!isLoading && attempts.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Rank</th>
                  <th className="py-2 pr-3 font-medium">Student</th>
                  <th className="py-2 pr-3 font-medium">Phone</th>
                  <th className="py-2 pr-3 font-medium">Score</th>
                  <th className="py-2 pr-3 font-medium">Correct</th>
                  <th className="py-2 pr-3 font-medium">Wrong</th>
                  <th className="py-2 pl-3 font-medium">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a: any, i: number) => (
                  <tr key={a.id} className={`border-b border-border/40 last:border-0 ${i < 3 ? "bg-primary/5" : ""}`}>
                    <td className="py-3 pr-3 align-top font-semibold">
                      {i === 0 ? <Trophy className="h-4 w-4 text-yellow-500 inline" /> : `#${i + 1}`}
                    </td>
                    <td className="py-3 pr-3 align-top">{a.profile?.full_name ?? "—"}</td>
                    <td className="py-3 pr-3 align-top text-muted-foreground">{a.profile?.phone ?? "—"}</td>
                    <td className="py-3 pr-3 align-top font-medium">{formatScore(a.score)}/{a.max_score}</td>
                    <td className="py-3 pr-3 align-top text-emerald-600">{a.correct_count}</td>
                    <td className="py-3 pr-3 align-top text-destructive">{a.wrong_count}</td>
                    <td className="py-3 pl-3 align-top text-muted-foreground">{new Date(a.submitted_at).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Section>
  );
}
