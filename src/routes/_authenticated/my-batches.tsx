import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStorageUrl } from "@/lib/utils";

const myBatchesQuery = queryOptions({
  queryKey: ["my-batches"],
  queryFn: async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return { enrollments: [] };
      const { data, error } = await supabase
        .from("enrollments")
        .select("*, batch:batches(*)")
        .eq("user_id", userId);
      if (error) {
        console.error("myBatches error:", error);
        return { enrollments: [] };
      }
      return { enrollments: data ?? [] };
    } catch (e) {
      console.error("myBatches catch:", e);
      return { enrollments: [] };
    }
  },
});

export const Route = createFileRoute("/_authenticated/my-batches")({
  loader: ({ context }) => context.queryClient.ensureQueryData(myBatchesQuery),
  component: MyBatches,
});

function MyBatches() {
  const { data } = useSuspenseQuery(myBatchesQuery);
  const enrollments = data.enrollments;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        to="/dashboard"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Study
      </Link>

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">My Batches</h1>
        {enrollments.length > 0 && (
          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-xs font-bold text-indigo-700">
            {enrollments.length} Enrolled
          </span>
        )}
      </div>

      {enrollments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 border border-indigo-100">
            <BookOpen className="h-9 w-9 text-indigo-400" />
          </div>
          <h2 className="mb-2 text-lg font-bold text-slate-800">No batches yet</h2>
          <p className="mb-6 max-w-xs text-sm text-slate-500">
            You are not enrolled in any batch yet. Browse our batches and enroll to start learning.
          </p>
          <Link
            to="/batches"
            className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-700 transition-colors"
          >
            Explore Batches
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {enrollments.map((e: any) => {
            const b = Array.isArray(e.batch) ? e.batch[0] : e.batch;
            if (!b) return null;
            return (
              <Link
                key={e.id}
                to="/my-batch/$slug"
                params={{ slug: b.slug }}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* Thumbnail */}
                {b.thumbnail_url ? (
                  <div className="aspect-[16/9] w-full overflow-hidden bg-slate-100">
                    <img
                      src={getStorageUrl(b.thumbnail_url) || b.thumbnail_url}
                      alt={b.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 border-b border-slate-100">
                    <BookOpen className="h-10 w-10 text-indigo-300" />
                  </div>
                )}

                {/* Card Body */}
                <div className="flex flex-1 flex-col p-4">
                  {b.exam_category && (
                    <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                      {b.exam_category}
                    </div>
                  )}
                  <h3 className="mb-1 line-clamp-2 text-sm font-bold text-slate-900 leading-snug">
                    {b.title}
                  </h3>
                  {b.subtitle && (
                    <p className="mb-2 line-clamp-2 text-[11px] text-slate-500 leading-relaxed">
                      {b.subtitle}
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between border-t border-slate-100/80 pt-3">
                    <span className="rounded-full border border-emerald-200/70 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                      Enrolled
                    </span>
                    <span className="flex items-center gap-1 text-xs font-bold text-indigo-600 group-hover:text-indigo-700 transition-colors">
                      <Play className="h-3.5 w-3.5" /> Resume
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}