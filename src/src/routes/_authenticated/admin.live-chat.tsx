import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery, queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { MessageSquare, Loader2, Phone, Mail, BookOpen, ListChecks, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { LiveChat } from "@/components/live-chat";
import { getStudentDetails } from "@/lib/admin-student-details.functions";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const liveClassesQuery = queryOptions({
  queryKey: ["admin", "live-classes-list"],
  queryFn: async () => {
    const { data } = await supabase
      .from("live_classes")
      .select("id, title, scheduled_at, is_live, batches(title)")
      .order("scheduled_at", { ascending: false })
      .limit(50);
    return data ?? [];
  },
});

export const Route = createFileRoute("/_authenticated/admin/live-chat")({
  loader: ({ context }) => context.queryClient.ensureQueryData(liveClassesQuery),
  component: AdminLiveChatPage,
});

function AdminLiveChatPage() {
  const { data: liveClasses } = useSuspenseQuery(liveClassesQuery);
  const [selected, setSelected] = useState<string | null>(
    liveClasses.find((l: any) => l.is_live)?.id ?? liveClasses[0]?.id ?? null,
  );
  const [viewingStudent, setViewingStudent] = useState<{ id: string; name: string } | null>(null);
  const getDetails = useServerFn(getStudentDetails);

  const { data: details, isLoading: detailsLoading } = useQuery({
    queryKey: ["admin", "student-details", viewingStudent?.id],
    queryFn: () => getDetails({ data: { user_id: viewingStudent!.id } }),
    enabled: !!viewingStudent,
  });

  return (
    <Section>
      <div className="mb-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">Admin</div>
        <h1 className="mt-1 text-3xl font-bold">Live Comments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Watch and moderate student comments on any live class in real time.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="glass-strong rounded-3xl p-3 lg:col-span-1">
          <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Live classes
          </div>
          <div className="max-h-[560px] space-y-1 overflow-y-auto pr-1">
            {liveClasses.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No live classes yet.</div>
            )}
            {liveClasses.map((lc: any) => (
              <button
                key={lc.id}
                onClick={() => setSelected(lc.id)}
                className={`flex w-full items-start gap-3 rounded-2xl p-3 text-left transition ${
                  selected === lc.id ? "bg-primary/10" : "hover:bg-muted/60"
                }`}
              >
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {lc.is_live && <span className="mr-1 text-red-500">🔴</span>}
                    {lc.title}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {lc.batches?.title ?? "—"} · {new Date(lc.scheduled_at).toLocaleString("en-IN")}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="glass-strong rounded-3xl p-5 lg:col-span-2">
          {selected ? (
            <LiveChat
              liveClassId={selected}
              canModerate
              className="[&>div:first-child]:h-[500px]"
              onViewStudent={(userId, name) => setViewingStudent({ id: userId, name })}
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              Select a live class to view comments.
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!viewingStudent} onOpenChange={(o) => !o && setViewingStudent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewingStudent?.name ?? "Student"}</DialogTitle>
          </DialogHeader>
          {detailsLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : details ? (
            <div className="space-y-4 text-sm">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /> {details.phone || "Not provided"}</div>
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted-foreground" /> {details.email || "Not available"}</div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Last active: {details.last_sign_in_at ? new Date(details.last_sign_in_at).toLocaleString("en-IN") : "Never signed in"}
                </div>
                <div className="text-xs text-muted-foreground pl-6">
                  Joined: {details.joined_at ? new Date(details.joined_at).toLocaleDateString("en-IN") : "—"}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <BookOpen className="h-3.5 w-3.5" /> Batches
                </div>
                {details.batches.length === 0 ? (
                  <div className="text-muted-foreground">No batch taken yet.</div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {details.batches.map((b, i) => (
                      <Badge key={i} variant="secondary">
                        {b.title} · {b.payment_status}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5" /> Tests
                </div>
                <div>{details.tests_given} submitted{details.tests_in_progress > 0 ? `, ${details.tests_in_progress} in progress` : ""}</div>
                {details.last_test_at && (
                  <div className="text-xs text-muted-foreground">
                    Last test: {new Date(details.last_test_at).toLocaleDateString("en-IN")}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">Couldn't load details.</div>
          )}
        </DialogContent>
      </Dialog>
    </Section>
  );
}
