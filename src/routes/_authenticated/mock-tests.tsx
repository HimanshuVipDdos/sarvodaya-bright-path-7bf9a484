import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Award, CheckCircle2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";

// Free tests (access_mode = 'free') are visible to every logged-in student
// via RLS regardless of whether they've enrolled in any batch. This page is
// the "Mock Test" destination students without a batch land on — previously
// free tests only ever showed up inside a paid batch's own Test tab, so
// students with no batch had nowhere to actually take them.
const mockTestsQuery = queryOptions({
  queryKey: ["mock-tests"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return { tests: [] as any[] };

    const [{ data: tests }, { data: attempts }] = await Promise.all([
      supabase
        .from("cbt_tests")
        .select("id,title,description,duration_minutes")
        .eq("access_mode", "free")
        .eq("is_published", true)
        .order("created_at", { ascending: false }),
      supabase
        .from("cbt_attempts")
        .select("test_id,id,status,score,max_score")
        .eq("user_id", userId),
    ]);

    const testIds = (tests ?? []).map((t) => t.id);
    const { data: allAttempts } = await supabase
      .from("cbt_attempts")
      .select("test_id, user_id, score")
      .eq("status", "submitted")
      .in("test_id", testIds);

    const attemptByTest = new Map((attempts ?? []).map((a) => {
       // calculate rank if submitted
       let rank = 1;
       if (a.status === "submitted" && allAttempts) {
         const others = allAttempts.filter(x => x.test_id === a.test_id);
         others.sort((x, y) => (y.score || 0) - (x.score || 0));
         const myIdx = others.findIndex(x => x.user_id === userId);
         if (myIdx >= 0) rank = myIdx + 1;
       }
       return [a.test_id, { ...a, rank }];
    }));

    return {
      tests: (tests ?? []).map((t) => ({ ...t, attempt: attemptByTest.get(t.id) ?? null })),
    };
  },
});

export const Route = createFileRoute("/_authenticated/mock-tests")({
  loader: ({ context }) => context.queryClient.ensureQueryData(mockTestsQuery),
  component: MockTestsPage,
});

function MockTestsPage() {
  const { data } = useSuspenseQuery(mockTestsQuery);

  return (
    <div className="flex flex-col min-h-[calc(100vh-72px)] bg-[#F8FAFC]">
      {data.tests.length === 0 ? (
        // IMAGE 2: EMPTY STATE ("My Tests")
        <div className="flex-1 px-4 py-8 sm:px-6 lg:px-8">
           <h1 className="text-2xl font-bold text-slate-800 mb-6">My Tests</h1>
           <div className="bg-gradient-to-b from-[#E6F8ED] to-white rounded-3xl p-10 flex flex-col items-center justify-center min-h-[60vh] border border-slate-100 shadow-sm text-center">
              <div className="relative w-24 h-24 mb-6">
                 {/* Mocking the icon from Image 2 */}
                 <div className="absolute inset-0 bg-blue-100 rounded-full opacity-50" />
                 <ClipboardList className="absolute inset-0 m-auto w-12 h-12 text-blue-500" />
                 <div className="absolute -bottom-2 -right-2 bg-orange-500 text-white w-8 h-8 rounded-full flex items-center justify-center font-bold border-2 border-white">
                   ?
                 </div>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">No Test Pass Purchased!</h2>
              <p className="text-sm text-slate-500 mb-6 max-w-sm">
                 Your purchased Test Pass will appear here. Start your prep by choosing one!
              </p>
              <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-md px-8 py-5 text-sm font-semibold shadow-md">
                 Explore Test Pass
              </Button>
           </div>
        </div>
      ) : (
        // IMAGE 3: POPULATED STATE ("Test Series")
        <div>
          {/* Yellow Banner */}
          <div className="bg-[#FDE68A] w-full pt-12 pb-24 px-4 text-center relative overflow-hidden border-b border-[#FCD34D]">
             {/* Simple decorative marks */}
             <div className="absolute top-1/2 left-10 w-4 h-4 text-orange-400 rotate-45 hidden md:block">✦</div>
             <div className="absolute top-1/3 right-20 w-3 h-3 text-orange-400 hidden md:block">✦</div>
             
             <div className="inline-flex items-center justify-center w-12 h-12 bg-slate-800 rounded-full mb-4 text-white">
                <Award className="w-6 h-6" />
             </div>
             <div className="flex items-center justify-center gap-4 mb-2">
                <div className="h-px w-8 bg-slate-800/20" />
                <h1 className="text-4xl sm:text-6xl font-black text-slate-800 tracking-tight uppercase">
                   TEST PASS
                </h1>
                <div className="h-px w-8 bg-slate-800/20" />
             </div>
             <p className="text-slate-700 font-medium tracking-widest uppercase text-sm">Target • Score • Achieve</p>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 pb-20 relative z-10">
            <div className="grid md:grid-cols-2 gap-6">
              {data.tests.map((t: any) => (
                <div key={t.id} className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-lg border border-slate-100 flex flex-col">
                   <div className="flex justify-between items-start mb-6">
                      <h2 className="text-lg sm:text-xl font-bold text-slate-800 max-w-[80%]">{t.title}</h2>
                      <div className="flex -space-x-2">
                        <div className="w-8 h-8 rounded-full bg-green-100 border-2 border-white flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
                        <div className="w-8 h-8 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center"><ClipboardList className="w-4 h-4 text-orange-600" /></div>
                      </div>
                   </div>

                   <div className="bg-[#FFF8F1] rounded-2xl p-5 mb-6 flex-1 border border-orange-50/50">
                      <ul className="space-y-4">
                         <li className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                            <div>
                               <div className="text-sm font-bold text-slate-800">CBT - REAL Test Interface</div>
                               <div className="text-xs text-slate-500 mt-1">{t.duration_minutes} minutes duration</div>
                            </div>
                         </li>
                         {t.description && (
                           <li className="flex items-start gap-3">
                              <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                              <div>
                                 <div className="text-sm font-bold text-slate-800">Detailed Analytics</div>
                                 <div className="text-xs text-slate-500 mt-1">{t.description}</div>
                              </div>
                           </li>
                         )}
                      </ul>
                      <div className="mt-6">
                         <button className="text-sm font-bold text-slate-800 underline underline-offset-4 decoration-slate-300 hover:decoration-slate-800">
                           Explore benefits
                         </button>
                      </div>
                   </div>

                   <div className="flex items-center justify-between pt-2">
                      <div>
                         {t.attempt?.status === "submitted" ? (
                           <div>
                             <div className="flex items-end gap-2 mb-1">
                                <span className="text-xl font-black text-slate-900">{t.attempt.score} <span className="text-sm font-semibold text-slate-500">/ {t.attempt.max_score}</span></span>
                             </div>
                             <div className="text-xs font-bold text-blue-600">Rank: #{t.attempt.rank}</div>
                           </div>
                         ) : (
                           <div>
                             <div className="flex items-end gap-2 mb-1">
                                <span className="text-2xl font-black text-slate-900">Free</span>
                                <span className="text-sm text-slate-400 line-through mb-1">₹1499</span>
                             </div>
                             <div className="text-xs font-bold text-green-600">100% OFF</div>
                           </div>
                         )}
                      </div>
                      
                      {t.attempt?.status === "submitted" ? (
                        <div className="flex items-center gap-2">
                          <Link to="/cbt/$testId/mistakes" params={{ testId: t.id }} search={{ attempt: t.attempt.id } as any}>
                            <Button variant="outline" className="rounded-md h-10 px-4 text-sm font-semibold">Mistakes</Button>
                          </Link>
                          <Link to="/cbt/$testId/result" params={{ testId: t.id }} search={{ attempt: t.attempt.id } as any}>
                            <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-md h-10 px-4 text-sm font-semibold">Result</Button>
                          </Link>
                        </div>
                      ) : (
                        <Link to="/cbt/$testId" params={{ testId: t.id }}>
                          <Button className="bg-slate-900 hover:bg-slate-800 text-white rounded-md px-8 py-6 font-bold shadow-md hover:scale-105 transition-transform">
                             {t.attempt?.status === "in_progress" ? "Resume Now" : "Start Now"}
                          </Button>
                        </Link>
                      )}
                   </div>
                </div>
              ))}
            </div>
            
            <div className="mt-8 text-center text-sm text-slate-500 font-medium">
              Still confused? <a href="#compare" className="text-blue-600 underline">Compare Passes</a>
            </div>
            
            {/* Take a Free sample test block mock */}
            <div className="mt-12 bg-white rounded-xl p-6 shadow-sm border border-slate-100 flex items-center justify-between">
               <h3 className="text-lg font-bold text-slate-800">Take a Free sample test</h3>
               <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-xl shadow-sm border border-red-100">🎁</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
