import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Sparkles,
  Trophy,
  Users,
  BookOpen,
  GraduationCap,
  ArrowRight,
  Star,
  Calendar,
  Bell,
  Video,
  FileText,
  CheckCircle2,
  MapPin,
  Phone,
  MessageCircle,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Section } from "@/components/section";
import { InquiryForm } from "@/components/inquiry-form";
import { HeroSlider } from "@/components/hero-slider";
import { Button } from "@/components/ui/button";
import { SITE, whatsappHref, telHref } from "@/lib/site";

const landingQuery = queryOptions({
  queryKey: ["landing-data"],
  queryFn: async () => {
    const [batches, faculty, results, notifications, currentAffairs] = await Promise.all([
      supabase.from("batches").select("*").eq("is_active", true).eq("is_featured", true).limit(8),
      supabase.from("faculty").select("*").eq("is_active", true).order("sort_order").limit(6),
      supabase.from("results").select("*").order("sort_order").limit(8),
      supabase.from("notifications").select("*").eq("is_active", true).order("created_at", { ascending: false }).limit(5),
      supabase.from("current_affairs").select("*").eq("is_active", true).order("publish_date", { ascending: false }).limit(4),
    ]);
    return {
      batches: batches.data ?? [],
      faculty: faculty.data ?? [],
      results: results.data ?? [],
      notifications: notifications.data ?? [],
      currentAffairs: currentAffairs.data ?? [],
    };
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${SITE.name} — ${SITE.tagline}` },
      { name: "description", content: `${SITE.name}, Kasganj — premium coaching for UP Police, SSC, Banking, Railway, Teaching, UPSC/UPPSC and state-level competitive exams.` },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(landingQuery),
  component: Index,
});

function Index() {
  const { data } = useSuspenseQuery(landingQuery);

  return (
    <div className="perspective-1000">
      {/* PROMOTIONAL SLIDER — sits just below the header, admin-managed at /admin/hero-slides */}
      <HeroSlider />

      {/* HERO */}
      <section className="bg-white py-12 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
            <div className="flex-1">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.15] tracking-tight">
                Bharat's <span className="text-[#5B21B6]">Trusted &</span><br />
                <span className="text-[#5B21B6]">Affordable</span><br />
                Educational Platform
              </h1>
              <p className="mt-6 text-slate-600 text-lg sm:text-xl max-w-lg">
                Unlock your potential by signing up with {SITE.name} <br />
                The most affordable learning solution
              </p>
              <div className="mt-8">
                <Button asChild size="lg" className="rounded-md bg-[#5B21B6] hover:bg-[#4C1D95] text-white px-8 py-6 text-base shadow-md transition-all">
                  <Link to="/batches">Get Started</Link>
                </Button>
              </div>
            </div>
            <div className="flex-1 relative flex justify-center lg:justify-end">
               <div className="relative">
                  <div className="bg-white px-4 py-2 rounded-xl shadow-lg border border-slate-100 absolute -top-8 -left-12 z-10 hidden sm:block">
                     <div className="text-xs font-bold text-slate-700">Maths Se, WhatsApp Par!</div>
                     <div className="text-[10px] text-slate-500 mt-1">PW is WhatsApp ENABLED NOW with <br/>live and on-the-go guidance</div>
                  </div>
                  <div className="w-[300px] h-[300px] sm:w-[400px] sm:h-[400px] rounded-full bg-slate-50 border-4 border-dashed border-[#5B21B6]/20 relative flex items-center justify-center overflow-hidden">
                     <img src="https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=600&auto=format&fit=crop" alt="Teacher" className="object-cover w-full h-full opacity-90" />
                  </div>
               </div>
            </div>
          </div>

          {/* STATS ROW */}
          <div className="mt-16 sm:mt-24 border-t border-b border-slate-100 py-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 divide-x divide-slate-100">
               <div className="flex flex-col items-center text-center px-4">
                  <Video className="w-8 h-8 text-red-500 mb-3" />
                  <div className="font-bold text-slate-900 text-sm">Daily Live</div>
                  <div className="text-xs text-slate-500 mt-1">Interactive classes</div>
               </div>
               <div className="flex flex-col items-center text-center px-4">
                  <FileText className="w-8 h-8 text-blue-500 mb-3" />
                  <div className="font-bold text-slate-900 text-sm">10 Million +</div>
                  <div className="text-xs text-slate-500 mt-1">Tests, sample papers & notes</div>
               </div>
               <div className="flex flex-col items-center text-center px-4">
                  <Clock className="w-8 h-8 text-purple-500 mb-3" />
                  <div className="font-bold text-slate-900 text-sm">24 x 7</div>
                  <div className="text-xs text-slate-500 mt-1">Doubt solving sessions</div>
               </div>
               <div className="flex flex-col items-center text-center px-4">
                  <MapPin className="w-8 h-8 text-yellow-500 mb-3" />
                  <div className="font-bold text-slate-900 text-sm">100 +</div>
                  <div className="text-xs text-slate-500 mt-1">Offline centres</div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* EXAM CATEGORIES */}
      <section className="py-16 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Exam Categories</h2>
          <p className="text-slate-500 text-sm mb-12 max-w-2xl mx-auto">
            {SITE.name} is preparing students for all major competitive exams. Explore the categories below.
          </p>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
            {[
              { name: "UP Police", tabs: ["Constable", "SI", "Radio Opr"], icon: "👮", bg: "bg-orange-50", color: "text-orange-600" },
              { name: "SSC", tabs: ["CGL", "CHSL", "GD", "MTS"], icon: "🏢", bg: "bg-blue-50", color: "text-blue-600" },
              { name: "Banking", tabs: ["PO", "Clerk", "RRB"], icon: "🏦", bg: "bg-green-50", color: "text-green-600" },
              { name: "Teaching", tabs: ["TET", "CTET", "Super TET"], icon: "👩‍🏫", bg: "bg-yellow-50", color: "text-yellow-600" },
              { name: "Railway", tabs: ["NTPC", "Group D", "ALP"], icon: "🚆", bg: "bg-purple-50", color: "text-purple-600" },
              { name: "UPSC / UPPSC", tabs: ["Pre", "Mains"], icon: "🏛️", bg: "bg-pink-50", color: "text-pink-600" },
            ].map((cat, i) => (
              <div key={i} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-lg transition-shadow relative overflow-hidden group">
                <h3 className="text-xl font-bold text-slate-900 mb-4">{cat.name}</h3>
                <div className="flex flex-wrap gap-2 mb-8 relative z-10">
                   {cat.tabs.map(t => (
                     <span key={t} className="px-3 py-1 rounded-full border border-slate-200 text-xs text-slate-600 bg-white">
                       {t}
                     </span>
                   ))}
                </div>
                <Link to="/batches" className="inline-flex items-center text-sm font-semibold text-[#5B21B6] group-hover:text-[#4C1D95] relative z-10">
                  Explore Category <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
                
                <div className={`absolute bottom-0 right-0 w-24 h-24 ${cat.bg} rounded-tl-full flex items-center justify-center transition-transform group-hover:scale-110`}>
                  <span className={`text-4xl ${cat.color}`}>{cat.icon}</span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="mt-10">
            <Link to="/batches" className="inline-block border-b-2 border-dashed border-[#5B21B6] text-[#5B21B6] font-semibold text-sm pb-1">
              View All Categories (12+)
            </Link>
          </div>
        </div>
      </section>

      {/* OFFLINE CENTRES */}
      <section className="py-20 bg-[#1E293B] relative overflow-hidden text-center text-white">
        <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=1200&auto=format&fit=crop')] bg-cover bg-center" />
        
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6">
          <h2 className="text-3xl sm:text-4xl font-bold mb-3 tracking-tight">Explore Tech-Enabled Offline Centres</h2>
          <p className="text-slate-300 text-sm mb-10">Creating new benchmarks in learning experiences</p>
          
          <div className="bg-white text-slate-900 rounded-[2rem] p-8 max-w-4xl mx-auto shadow-2xl text-left border border-white/20 backdrop-blur-sm">
             <div className="text-center mb-8">
               <h3 className="font-bold text-lg tracking-tight">Find Centre in your city</h3>
               <p className="text-xs text-slate-500 mt-1 font-medium">Available in 1 city</p>
             </div>
             
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="flex items-center gap-3 border border-slate-200 p-3 rounded-xl cursor-pointer hover:border-[#5B21B6] transition-colors bg-slate-50">
                   <div className="w-10 h-10 rounded-lg bg-[#FFF6ED] flex items-center justify-center text-lg shadow-sm border border-orange-100">📍</div>
                   <div className="text-sm font-bold">Kasganj</div>
                </div>
                {/* Mock empty states for other cities just for UI look */}
                <div className="flex items-center gap-3 border border-slate-100 p-3 rounded-xl opacity-40 grayscale pointer-events-none bg-slate-50">
                   <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-lg">🏙️</div>
                   <div className="text-sm font-bold">Agra</div>
                </div>
                <div className="flex items-center gap-3 border border-slate-100 p-3 rounded-xl opacity-40 grayscale pointer-events-none bg-slate-50">
                   <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-lg">🏙️</div>
                   <div className="text-sm font-bold">Aligarh</div>
                </div>
                <div className="flex items-center gap-3 border border-slate-100 p-3 rounded-xl opacity-40 grayscale pointer-events-none bg-slate-50">
                   <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center text-lg">🏙️</div>
                   <div className="text-sm font-bold">Bareilly</div>
                </div>
             </div>
             
             <div className="text-center">
               <Button asChild className="bg-[#5B21B6] hover:bg-[#4C1D95] text-white px-10 py-5 rounded-md text-sm shadow-md transition-transform hover:scale-105">
                 <Link to="/contact">View More</Link>
               </Button>
             </div>
          </div>
        </div>
      </section>

      {/* STATS BLOCKS */}
      <section className="py-16 bg-white border-b border-slate-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">A Platform Trusted by Students Worldwide</h2>
          <p className="text-slate-500 text-sm mb-12 font-medium">Don't Just Take Our Word For It. Delve Into The Numbers And Witness The Excellence For Yourself!</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
             <div className="bg-[#FFF6ED] rounded-xl p-8 flex flex-col justify-center items-center h-40 transition-transform hover:-translate-y-1 hover:shadow-md cursor-default">
               <div className="text-3xl font-black text-slate-900">1K+</div>
               <div className="text-xs font-bold text-slate-600 mt-2 uppercase tracking-wider">Aspirants</div>
             </div>
             <div className="bg-[#FDF4FF] rounded-xl p-8 flex flex-col justify-center items-center h-40 transition-transform hover:-translate-y-1 hover:shadow-md cursor-default">
               <div className="text-3xl font-black text-slate-900">500+</div>
               <div className="text-xs font-bold text-slate-600 mt-2 uppercase tracking-wider">Selections</div>
             </div>
             <div className="bg-[#F0FDF4] rounded-xl p-8 flex flex-col justify-center items-center h-40 transition-transform hover:-translate-y-1 hover:shadow-md cursor-default">
               <div className="text-3xl font-black text-slate-900">13+</div>
               <div className="text-xs font-bold text-slate-600 mt-2 uppercase tracking-wider">Batches</div>
             </div>
             <div className="bg-[#EEF2FF] rounded-xl p-8 flex flex-col justify-center items-center h-40 transition-transform hover:-translate-y-1 hover:shadow-md cursor-default">
               <div className="text-3xl font-black text-slate-900">1000+</div>
               <div className="text-xs font-bold text-slate-600 mt-2 uppercase tracking-wider">Lectures</div>
             </div>
          </div>
          
          <div className="mt-12">
            <Button asChild className="bg-[#5B21B6] hover:bg-[#4C1D95] text-white px-10 py-6 rounded-md text-base shadow-md transition-transform hover:scale-105">
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* RESULTS SLIDER */}
      <section className="py-20 bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-2 tracking-tight">Academic Excellence : Results</h2>
          <p className="text-slate-500 text-sm mb-12 font-medium">Giving wings to a millions dreams, a million more to go</p>
          
          {/* Tabs mock */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {["UP Police 2024", "SSC GD 2023", "Super TET", "Banking"].map((t, i) => (
               <button key={t} className={`px-5 py-2 rounded-full text-[13px] font-bold transition-colors ${i === 0 ? 'bg-white shadow-sm border border-slate-200 text-[#5B21B6]' : 'text-slate-500 hover:text-slate-800'}`}>
                 {t}
               </button>
            ))}
          </div>

          <div className="bg-gradient-to-br from-[#EFF6FF] via-[#DBEAFE] to-[#BFDBFE] rounded-[2rem] p-8 sm:p-12 relative overflow-hidden shadow-sm border border-blue-100">
             {/* Background text decoration */}
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04]">
                <span className="text-[10rem] md:text-[14rem] font-black leading-none whitespace-nowrap text-blue-900/50">RESULTS</span>
             </div>
             
             <h3 className="text-3xl sm:text-5xl font-black text-[#1E3A8A] mb-12 relative z-10 drop-shadow-sm uppercase tracking-tighter">
                TOP SELECTIONS 2024
             </h3>
             
             <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-x-4 gap-y-10 relative z-10">
                {data.results.slice(0, 6).map((r) => (
                   <div key={r.id} className="flex flex-col items-center group">
                     <div className="w-[100px] h-[100px] rounded-full bg-white shadow-xl border-[5px] border-white overflow-hidden mb-4 relative transition-transform duration-300 group-hover:-translate-y-2 group-hover:shadow-2xl">
                       <div className="absolute bottom-0 w-full bg-[#1E3A8A] text-white text-[9px] font-black tracking-widest text-center py-1 z-10 uppercase">
                         {r.rank_or_marks || 'SELECTED'}
                       </div>
                       {r.photo_url ? (
                          <img src={r.photo_url} alt={r.student_name} className="w-full h-full object-cover" />
                       ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-blue-50 to-blue-200 text-3xl font-black text-blue-900">
                             {r.student_name.charAt(0)}
                          </div>
                       )}
                     </div>
                     <div className="text-[13px] font-bold text-slate-800 text-center leading-snug px-2">{r.student_name}</div>
                     <div className="text-[10px] text-[#1E3A8A] font-bold mt-1 uppercase tracking-widest">{r.exam_name}</div>
                   </div>
                ))}
             </div>
             
             {data.results.length > 6 && (
                <div className="mt-12 text-sm font-bold text-[#1E3A8A] uppercase tracking-widest relative z-10">
                   & many more...
                </div>
             )}
          </div>
        </div>
      </section>
    </div>
  );
}
