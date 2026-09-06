import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { MessageCircle, Clock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/my-doubts")({
  component: MyDoubts,
});

function MyDoubts() {
  const { data: doubts, isLoading } = useQuery({
    queryKey: ["my-doubts"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];
      
      const { data, error } = await supabase
        .from("live_chat_messages")
        .select("*, live_classes(title, batches(title))")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: false });
        
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">My Doubts</h1>
        <p className="text-sm text-slate-500">View all the doubts you've asked in live classes.</p>
      </div>

      {isLoading ? (
        <div className="text-center py-10">Loading...</div>
      ) : doubts?.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
          <MessageCircle className="mx-auto h-12 w-12 text-slate-300 mb-3" />
          <h3 className="font-semibold text-slate-700">No doubts asked yet</h3>
          <p className="text-sm text-slate-500">Your questions during live classes will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {doubts?.map((d: any) => (
            <div key={d.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4">
               <div className="bg-blue-50 w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                  <MessageCircle className="h-5 w-5 text-blue-600" />
               </div>
               <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between mb-1 gap-2">
                     <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
                        {d.live_classes?.title || "Unknown Class"}
                     </div>
                     <div className="flex items-center text-xs text-slate-400 font-medium">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        {new Date(d.created_at).toLocaleString()}
                     </div>
                  </div>
                  <p className="text-slate-800 text-sm mt-3 font-medium bg-slate-50 p-3 rounded-xl">{d.message}</p>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-3">
                    Batch: {d.live_classes?.batches?.title || "N/A"}
                  </p>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
