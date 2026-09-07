import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { 
  BookOpen, 
  Library, 
  Layers, 
  FileText, 
  MapPin, 
  Users, 
  Trophy, 
  Image as ImageIcon,
  GraduationCap,
  Bell,
  Search,
  Menu,
  X,
  Shield,
  Moon,
  Sun,
  ChevronDown,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark";
    }
    return false;
  });

  // Apply / remove dark class on <html> whenever `dark` changes
  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  // Check if current logged-in user is a registered admin
  const { data: isAdmin = false } = useQuery({
    queryKey: ["auth", "is-admin-layout"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return false;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      return roles?.some((r) => r.role === "admin") ?? false;
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch student's real name
  const { data: studentName = "" } = useQuery({
    queryKey: ["auth", "student-name-layout"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return "";
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userData.user.id)
        .maybeSingle();
      return profile?.full_name || userData.user.user_metadata?.full_name || userData.user.email?.split("@")[0] || "Student";
    },
    staleTime: 1000 * 60 * 5,
  });

  // First name only for display
  const firstName = (studentName as string).split(" ")[0] || "Student";

  // Goal/exam selection - stored in profile
  const GOALS = [
    "UP Police",
    "SSC CGL",
    "SSC CHSL",
    "SSC MTS",
    "Railway NTPC",
    "Railway Group D",
    "UPSC CSE",
    "UP PCS",
    "Defence (NDA/CDS)",
    "Banking (IBPS/SBI)",
    "UP Lekhpal",
    "Other",
  ];

  const [goalOpen, setGoalOpen] = useState(false);
  const [studentGoal, setStudentGoal] = useState<string | null>(null);
  const goalRef = useRef<HTMLDivElement>(null);

  // Load goal from profile
  const { data: profileGoal } = useQuery({
    queryKey: ["auth", "student-goal-layout"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("exam_goal")
        .eq("id", userData.user.id)
        .maybeSingle();
      return (profile as { exam_goal?: string } | null)?.exam_goal || null;
    },
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (profileGoal !== undefined) setStudentGoal(profileGoal);
  }, [profileGoal]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (goalRef.current && !goalRef.current.contains(e.target as Node)) {
        setGoalOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const saveGoal = useCallback(async (goal: string) => {
    setStudentGoal(goal);
    setGoalOpen(false);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;
    await supabase
      .from("profiles")
      .update({ exam_goal: goal } as Record<string, string>)
      .eq("id", userData.user.id);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] dark:bg-slate-950">
      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 flex-col bg-white dark:bg-slate-900 border-r border-border/50 dark:border-slate-800 shadow-[4px_0_24px_rgba(0,0,0,0.02)] transition-transform duration-300 md:flex md:translate-x-0",
        sidebarOpen ? "flex translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex h-[72px] shrink-0 items-center justify-between px-6 border-b border-border/40 dark:border-slate-800">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 shadow-md shadow-slate-900/20">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <div className="text-[17px] font-black tracking-tight text-slate-900 leading-none">
              {SITE.name}
            </div>
          </Link>
          <button 
            className="md:hidden text-slate-500 hover:text-slate-700" 
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto py-5 px-4 custom-scrollbar">
          <div className="mb-7">
            <div className="px-3 mb-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Learn Online
            </div>
            <nav className="space-y-0.5">
              <NavItem to="/dashboard" icon={BookOpen} label="Study" active={pathname === "/dashboard"} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/my-batches" icon={Layers} label="My Batches" active={pathname.startsWith("/my-batches") || pathname.startsWith("/my-batch")} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/free-study-material" icon={Library} label="Library" active={pathname.startsWith("/free-study-material")} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/current-affairs" icon={Bell} label="Current Affairs" active={pathname.startsWith("/current-affairs")} onClick={() => setSidebarOpen(false)} />
            </nav>
          </div>

          <div className="mb-7">
            <div className="px-3 mb-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Study Packs
            </div>
            <nav className="space-y-0.5">
              <NavItem to="/batches" icon={Layers} label="Batches" active={pathname.startsWith("/batches") || pathname.startsWith("/my-batch")} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/mock-tests" icon={FileText} label="Test Series" active={pathname.startsWith("/mock-tests")} onClick={() => setSidebarOpen(false)} />
            </nav>
          </div>

          <div className="mb-7">
            <div className="px-3 mb-2.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              Explore
            </div>
            <nav className="space-y-0.5">
              <NavItem to="/faculty" icon={Users} label="Faculty" active={pathname.startsWith("/faculty")} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/results" icon={Trophy} label="Results" active={pathname.startsWith("/results")} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/gallery" icon={ImageIcon} label="Gallery" active={pathname.startsWith("/gallery")} onClick={() => setSidebarOpen(false)} />
              <NavItem to="/contact" icon={MapPin} label="Centres" active={pathname.startsWith("/contact")} onClick={() => setSidebarOpen(false)} />
            </nav>
          </div>

          {/* ADMIN PORTAL: VISIBLE ONLY TO REGISTERED ADMINS */}
          {isAdmin && (
            <div className="mb-7 pt-4 border-t border-slate-200/80">
              <div className="px-3 mb-2.5 text-[11px] font-bold uppercase tracking-widest text-red-600 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" /> Registered Admin
              </div>
              <nav className="space-y-0.5">
                <NavItem to="/admin" icon={Shield} label="Admin Dashboard" active={pathname === "/admin"} onClick={() => setSidebarOpen(false)} />
                <NavItem to="/admin/students" icon={Users} label="Student Directory" active={pathname.startsWith("/admin/students")} onClick={() => setSidebarOpen(false)} />
                <NavItem to="/admin/batches" icon={Layers} label="Manage Batches" active={pathname.startsWith("/admin/batches")} onClick={() => setSidebarOpen(false)} />
                <NavItem to="/admin/enrollments" icon={BookOpen} label="Grant Batch Access" active={pathname.startsWith("/admin/enrollments")} onClick={() => setSidebarOpen(false)} />
              </nav>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN WRAPPER */}
      <div className="flex flex-1 flex-col md:pl-64 min-w-0">
        {/* HEADER */}
        <header className="sticky top-0 z-30 flex h-[72px] shrink-0 items-center gap-x-4 border-b border-border/40 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 px-4 backdrop-blur-xl sm:gap-x-6 sm:px-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <button 
            type="button" 
            className="-m-2.5 p-2.5 text-slate-600 md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <span className="sr-only">Open sidebar</span>
            <Menu className="h-6 w-6" aria-hidden="true" />
          </button>

          <div className="flex flex-1 items-center justify-between gap-x-4 lg:gap-x-6">
            {/* Left Header Area */}
            <div className="flex items-center gap-3">
              {/* Goal selector - shows "Select Goal" until student picks */}
              <div ref={goalRef} className="relative hidden md:block">
                <button
                  type="button"
                  onClick={() => setGoalOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-slate-100/80 px-4 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  {studentGoal ? (
                    <>
                      <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                      {studentGoal}
                    </>
                  ) : (
                    <>
                      <Target className="h-3.5 w-3.5 text-slate-400" />
                      <span className="text-slate-400">Select Goal</span>
                    </>
                  )}
                  <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", goalOpen && "rotate-180")} />
                </button>

                {goalOpen && (
                  <div className="absolute left-0 top-full mt-2 z-50 w-52 rounded-2xl border border-slate-200 bg-white py-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    <p className="px-3 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Select Your Exam Goal</p>
                    {GOALS.map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => saveGoal(g)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors",
                          studentGoal === g ? "text-amber-600 font-bold" : "text-slate-700 dark:text-slate-300"
                        )}
                      >
                        {studentGoal === g && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />}
                        {g}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Admin Badge button if admin */}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-50 hover:bg-red-100 border border-red-200/80 px-3.5 py-1 text-xs font-bold text-red-700 transition-colors shadow-sm"
                >
                  <Shield className="h-3.5 w-3.5 text-red-600" />
                  Admin Panel
                </Link>
              )}
            </div>

            {/* Right Header Area */}
            <div className="flex items-center gap-x-3 lg:gap-x-4">
              <div className="relative hidden w-full max-w-[280px] lg:block">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search for batches..."
                  className="h-10 w-full rounded-full border border-slate-200 bg-slate-50/50 pl-10 pr-4 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all"
                />
              </div>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDark((d) => !d)}
                aria-label="Toggle dark mode"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 shadow-sm transition-all hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* Student Avatar + Name */}
              <Link to="/profile" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity pl-3 lg:border-l lg:border-slate-200">
                {/* Cartoon student avatar using DiceBear adventurer style */}
                <div className="relative h-9 w-9 shrink-0 rounded-full overflow-hidden border-2 border-white shadow-md bg-gradient-to-br from-amber-300 to-orange-400">
                  <img
                    src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(firstName)}&backgroundColor=ffd700,ffb300,ff8c00&backgroundType=gradientLinear&radius=50`}
                    alt={firstName}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="hidden sm:flex flex-col leading-tight">
                  <span className="text-[11px] text-slate-400 font-medium">Hi,</span>
                  <span className="text-[13px] font-bold text-slate-800 truncate max-w-[80px]">{firstName}</span>
                </div>
              </Link>
            </div>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, active, onClick }: { to: string, icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3.5 rounded-xl px-3 py-3 text-[14px] font-semibold transition-all duration-200",
        active
          ? "bg-[#F3F0FF] text-[#5B21B6]"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <Icon className={cn("h-[20px] w-[20px] shrink-0 transition-colors", active ? "text-[#7C3AED]" : "text-slate-400 group-hover:text-slate-600")} strokeWidth={active ? 2.5 : 2} />
      {label}
      {active && (
        <div className="ml-auto flex items-center">
           <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
        </div>
      )}
    </Link>
  );
}
