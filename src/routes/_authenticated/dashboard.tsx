import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BookOpen,
  Video,
  FileText,
  Bell,
  User,
  Trophy,
  Clock,
  LogOut,
  Shield,
  MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: async () => {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return { profile: null, enrollments: [], roles: [], liveClasses: [] };

    const [profile, enrollments, roles] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("enrollments").select("*, batch:batches(*)").eq("user_id", userId),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      profile: profile.data,
      enrollments: enrollments.data ?? [],
      roles: (roles.data ?? []).map((r) => r.role),
    };
  },
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => context.queryClient.ensureQueryData(dashboardQuery),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(dashboardQuery);
  const isAdmin = (data.roles as string[]).includes("admin");

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    window.location.href = "/";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Header Area for XP/Coins - Mocked for PW look */}
      <div className="flex justify-between items-center mb-8">
         <h1 className="text-xl font-bold text-slate-800">Study</h1>
         <div className="flex items-center gap-3">
           <div className="flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1 text-sm font-semibold text-slate-600">
             <span className="text-yellow-500">🔥</span> 0
           </div>
           <div className="flex items-center gap-1.5 bg-slate-100 rounded-full px-3 py-1 text-sm font-semibold text-slate-600">
             <span className="text-blue-500">⚡</span> 0
           </div>
         </div>
      </div>

      <div className="mb-10">
        <h2 className="text-xl font-bold text-slate-800 mb-4 tracking-tight">My Learning</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Link to="/batches" className="bg-[#EEF2FF] hover:bg-[#E0E7FF] transition-colors rounded-xl p-5 border border-[#C7D2FE]/50 shadow-sm flex flex-col">
            <div className="bg-white w-10 h-10 rounded-lg flex items-center justify-center mb-3 shadow-sm border border-slate-100">
               <BookOpen className="h-5 w-5 text-slate-700" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">My Batches</h3>
            <p className="text-xs text-slate-500 leading-snug">View list of the batches in which you are enrolled</p>
          </Link>

          <Link to="/dashboard" className="bg-[#FFF7ED] hover:bg-[#FFEDD5] transition-colors rounded-xl p-5 border border-[#FED7AA]/50 shadow-sm flex flex-col">
            <div className="bg-white w-10 h-10 rounded-lg flex items-center justify-center mb-3 shadow-sm border border-slate-100">
               <Clock className="h-5 w-5 text-slate-700" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">Recent Learning</h3>
            <p className="text-xs text-slate-500 leading-snug">View your past learning history</p>
          </Link>

          <Link to="/dashboard" className="bg-[#F0FDF4] hover:bg-[#DCFCE7] transition-colors rounded-xl p-5 border border-[#BBF7D0]/50 shadow-sm flex flex-col">
            <div className="bg-white w-10 h-10 rounded-lg flex items-center justify-center mb-3 shadow-sm border border-slate-100">
               <MessageCircle className="h-5 w-5 text-slate-700" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">My Doubts</h3>
            <p className="text-xs text-slate-500 leading-snug">View the list of your asked doubts in the lectures</p>
          </Link>
        </div>
      </div>

      <div className="mb-10">
        <h2 className="text-xl font-bold text-slate-800 mb-4 tracking-tight">Explore</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link to="/free-study-material" className="bg-white hover:bg-slate-50 transition-colors rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col">
            <div className="bg-[#F8FAFC] w-10 h-10 rounded-lg flex items-center justify-center mb-3 border border-slate-100">
               <FileText className="h-5 w-5 text-blue-500" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">PDF Bank</h3>
            <p className="text-xs text-slate-500 leading-snug">Download your Study PDFs from one place</p>
          </Link>

          <Link to="/dashboard" className="bg-white hover:bg-slate-50 transition-colors rounded-xl p-5 border border-slate-200 shadow-sm flex flex-col">
            <div className="bg-[#F8FAFC] w-10 h-10 rounded-lg flex items-center justify-center mb-3 border border-slate-100">
               <BookOpen className="h-5 w-5 text-purple-500" />
            </div>
            <h3 className="font-semibold text-slate-800 mb-1">Bookmarks</h3>
            <p className="text-xs text-slate-500 leading-snug">View the list of your saved questions.</p>
          </Link>
        </div>
      </div>

      {/* Promotional Banner Area (Like VP-OP) */}
      <div className="mb-10 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 to-red-800 relative shadow-sm text-white">
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative px-6 py-10 sm:px-12 flex flex-col items-center text-center">
           <div className="inline-block bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest shadow-sm">
             Enroll Now
           </div>
           <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-wider mb-2">Introducing</h2>
           <h3 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-red-200 mb-4">
             SARVODAYA PRIME
           </h3>
           <p className="text-red-100 font-semibold mb-6 max-w-lg">TEST SERIES • DOUBTS • PREMIUM LECTURES</p>
           
           <div className="flex items-center gap-4">
              <button className="bg-white text-red-700 px-6 py-2.5 rounded-full font-bold shadow-lg hover:scale-105 transition-transform">
                Explore Plan
              </button>
           </div>
        </div>
      </div>
      
      {isAdmin && (
        <div className="mt-8">
           <Button asChild variant="outline" className="w-full sm:w-auto">
             <Link to="/admin"><Shield className="mr-2 h-4 w-4" /> Admin Panel</Link>
           </Button>
           <Button variant="ghost" onClick={handleSignOut} className="w-full sm:w-auto mt-2 sm:mt-0 sm:ml-2">
             <LogOut className="mr-2 h-4 w-4" /> Sign out
           </Button>
        </div>
      )}
      {!isAdmin && (
        <div className="mt-8 text-right">
          <Button variant="ghost" onClick={handleSignOut} className="text-slate-500 hover:text-slate-700">
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </Button>
        </div>
      )}
    </div>
  );
}
