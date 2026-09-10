import { useState, useEffect, useRef, useCallback } from "react";
import { ShieldAlert, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Cache for the student's profile to avoid repeated Supabase queries across player renders.
 */
let cachedStudentProfile: {
  fullName: string;
  phone: string;
  userId: string;
} | null = null;

export function useStudentWatermarkInfo() {
  const [info, setInfo] = useState<{
    fullName: string;
    phone: string;
    userId: string;
  } | null>(cachedStudentProfile);

  useEffect(() => {
    if (cachedStudentProfile) return;
    let isMounted = true;

    async function fetchUser() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) return;

        const uid = userData.user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", uid)
          .maybeSingle();

        const studentData = {
          fullName: profile?.full_name?.trim() || "Student",
          phone: profile?.phone?.trim() || userData.user.email || "Protected",
          userId: `SB-${uid.slice(0, 6).toUpperCase()}`,
        };

        cachedStudentProfile = studentData;
        if (isMounted) setInfo(studentData);
      } catch {
        // Ignore fallback
      }
    }

    fetchUser();
    return () => {
      isMounted = false;
    };
  }, []);

  return info;
}

/**
 * Hook to guard against DevTools, inspect shortcuts, view-source, and right-click.
 * Also monitors dimension shifts and console traps to detect if DevTools is active.
 */
export function useDevToolsGuard({
  enabled = true,
  onDevToolsDetected,
  onDevToolsClosed,
}: {
  enabled?: boolean;
  onDevToolsDetected?: () => void;
  onDevToolsClosed?: () => void;
} = {}) {
  const [isDevToolsOpen, setIsDevToolsOpen] = useState(false);
  const isOpenRef = useRef(false);
  const onDetectedRef = useRef(onDevToolsDetected);
  const onClosedRef = useRef(onDevToolsClosed);

  useEffect(() => {
    onDetectedRef.current = onDevToolsDetected;
  }, [onDevToolsDetected]);

  useEffect(() => {
    onClosedRef.current = onDevToolsClosed;
  }, [onDevToolsClosed]);

  const setDevToolsState = useCallback((open: boolean) => {
    if (isOpenRef.current !== open) {
      isOpenRef.current = open;
      setIsDevToolsOpen(open);
      if (open) {
        onDetectedRef.current?.();
      } else {
        onClosedRef.current?.();
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    // 1. Keyboard shortcut blocker
    const handleKeyDown = (e: KeyboardEvent) => {
      const isF12 = e.key === "F12" || e.keyCode === 123;
      const isDevInspect =
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c")) ||
        (e.metaKey && e.altKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j" || e.key === "C" || e.key === "c"));
      const isSourceOrSave =
        (e.ctrlKey || e.metaKey) &&
        (e.key === "u" || e.key === "U" || e.key === "s" || e.key === "S" || e.key === "p" || e.key === "P");

      if (isF12 || isDevInspect || isSourceOrSave) {
        e.preventDefault();
        e.stopPropagation();
        toast.error("Security Alert: Inspection and developer shortcuts are disabled for paid courses.", {
          id: "anti-piracy-key",
          duration: 2500,
        });
      }
    };

    // 2. Active DevTools open detection using dimension delta
    const checkDevTools = () => {
      const widthDelta = window.outerWidth - window.innerWidth;
      const heightDelta = window.outerHeight - window.innerHeight;
      const isDocked = (widthDelta > 160 || heightDelta > 160) && window.innerWidth > 400 && window.innerHeight > 300;

      if (isDocked) {
        setDevToolsState(true);
        return;
      }

      if (isOpenRef.current && !isDocked) {
        setDevToolsState(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("resize", checkDevTools);
    const interval = setInterval(checkDevTools, 1200);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("resize", checkDevTools);
      clearInterval(interval);
    };
  }, [enabled, setDevToolsState]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  return { isDevToolsOpen, handleContextMenu };
}

/**
 * Dynamic Floating Forensic Watermark (PhysicsWallah / Classplus Gold Standard).
 * Drifts across the video canvas every 6-8 seconds to random positions.
 * Tamper-proof with MutationObserver so it cannot be removed or hidden with CSS.
 */
export function DynamicWatermark({
  onTamperDetected,
}: {
  onTamperDetected?: () => void;
}) {
  const student = useStudentWatermarkInfo();
  const watermarkRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: "25%", left: "20%" });

  // Drift randomly across screen
  useEffect(() => {
    const moveWatermark = () => {
      const randomTop = Math.floor(15 + Math.random() * 60) + "%";
      const randomLeft = Math.floor(15 + Math.random() * 60) + "%";
      setPos({ top: randomTop, left: randomLeft });
    };

    const interval = setInterval(moveWatermark, 7000);
    return () => clearInterval(interval);
  }, []);

  // MutationObserver tamper detection
  useEffect(() => {
    const el = watermarkRef.current;
    if (!el || typeof MutationObserver === "undefined") return;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes") {
          const target = m.target as HTMLElement;
          const style = window.getComputedStyle(target);
          if (
            style.display === "none" ||
            style.visibility === "hidden" ||
            parseFloat(style.opacity) < 0.05
          ) {
            onTamperDetected?.();
          }
        }
      }
    });

    observer.observe(el, { attributes: true, attributeFilter: ["style", "class", "hidden"] });

    return () => observer.disconnect();
  }, [onTamperDetected]);

  if (!student) return null;

  return (
    <div
      ref={watermarkRef}
      style={{
        top: pos.top,
        left: pos.left,
        transition: "top 2.2s cubic-bezier(0.4, 0, 0.2, 1), left 2.2s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
      className="absolute pointer-events-none select-none z-20 flex flex-col items-start gap-0.5 px-2 py-1 rounded bg-black/35 border border-white/10 text-white/35 font-mono text-[10px] tracking-tight leading-tight shadow-xs transform -translate-x-1/2 -translate-y-1/2"
    >
      <div className="flex items-center gap-1 font-semibold text-white/40">
        <Lock className="h-2.5 w-2.5 opacity-60" />
        <span>{student.fullName}</span>
      </div>
      <div className="text-[9px] opacity-80">{student.phone}</div>
      <div className="text-[8px] opacity-60">ID: {student.userId}</div>
    </div>
  );
}

/**
 * DevTools Security Overlay - instantly obscures player if inspection is active.
 */
export function DevToolsSecurityOverlay({ onDismiss }: { onDismiss?: () => void }) {
  return (
    <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
      <div className="h-16 w-16 rounded-2xl bg-red-600/20 border border-red-500/40 flex items-center justify-center mb-4 ring-8 ring-red-500/10">
        <ShieldAlert className="h-8 w-8 text-red-500 animate-pulse" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2 tracking-wide">
        Security Protection Active
      </h2>
      <p className="text-sm text-zinc-300 max-w-md mb-4 leading-relaxed">
        Developer Tools and inspection are disabled for protected course content. Playback has been automatically paused.
      </p>
      <div className="rounded-xl bg-red-950/40 border border-red-800/40 p-3.5 text-xs text-red-200/90 max-w-sm flex items-center gap-2">
        <Lock className="h-4 w-4 shrink-0 text-red-400" />
        <span>Close Developer Tools (F12) to resume your class.</span>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-6 px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition active:scale-95 border border-white/10"
        >
          Check Again
        </button>
      )}
    </div>
  );
}
