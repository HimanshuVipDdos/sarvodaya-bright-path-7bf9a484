import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Send,
  Trash2,
  Shield,
  MessageCircle,
  ArrowDown,
  Pin,
  PinOff,
  Smile,
  Lock,
  Unlock,
  UserX,
  UserCheck,
  MoreVertical,
  X,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export type ChatMessage = {
  id: string;
  live_class_id: string;
  user_id: string;
  user_name: string | null;
  message: string;
  created_at: string;
  is_moderator?: boolean;
  is_pinned?: boolean;
};

type Props = {
  liveClassId: string;
  canModerate?: boolean;
  className?: string;
  onViewStudent?: (userId: string, name: string) => void;
  onClose?: () => void;
};

const MAX_RENDERED = 300;
const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "🙏", "🔥", "💯", "👏", "😮", "❓"];

export function LiveChat({ liveClassId, canModerate = false, className, onViewStudent, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinned, setPinned] = useState<{ id: string; text: string; name: string } | null>(null);
  const [isChatLocked, setIsChatLocked] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [globalBlockedUsers, setGlobalBlockedUsers] = useState<Record<string, string>>({});

  // Local/individual student-level blocked users (persisted in localStorage)
  const [localBlockedUsers, setLocalBlockedUsers] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = localStorage.getItem(`sarvodaya_blocked_students_${liveClassId}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [targetBlockUser, setTargetBlockUser] = useState<{ id: string; name: string } | null>(null);
  const [showBlockedUsersList, setShowBlockedUsersList] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [chatFilter, setChatFilter] = useState<"top" | "live">("live");

  const listRef = useRef<HTMLDivElement>(null);
  const programmaticScroll = useRef(false);

  // Check auth and admin status
  useEffect(() => {
    async function checkAuth() {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id || null;
      setCurrentUserId(uid);

      if (uid) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .eq("role", "admin");
        setIsCurrentUserAdmin((roles && roles.length > 0) || canModerate);
      }
    }
    checkAuth();
  }, [canModerate]);

  const effectiveModerator = isCurrentUserAdmin || canModerate;

  // Load messages and system moderation state
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from("live_chat_messages")
        .select("*")
        .eq("live_class_id", liveClassId)
        .order("created_at", { ascending: true })
        .limit(300);

      if (cancelled) return;
      if (error) {
        setLoading(false);
        return;
      }

      const rows = (data as ChatMessage[]) ?? [];
      const regularMessages: ChatMessage[] = [];
      let latestPin: { id: string; text: string; name: string } | null = null;
      let lockedState = false;
      const blockedSet = new Set<string>();
      const globalBlockedMap: Record<string, string> = {};

      for (const row of rows) {
        // System state messages
        if (row.user_id === "SYSTEM_PIN") {
          try {
            latestPin = JSON.parse(row.message);
          } catch {
            latestPin = null;
          }
        } else if (row.user_id === "SYSTEM_LOCK") {
          try {
            const parsed = JSON.parse(row.message);
            lockedState = Boolean(parsed.isLocked);
          } catch {}
        } else if (row.user_id === "SYSTEM_BLOCK") {
          try {
            const parsed = JSON.parse(row.message);
            if (parsed.unblock) {
              blockedSet.delete(parsed.userId);
              delete globalBlockedMap[parsed.userId];
            } else if (parsed.userId) {
              blockedSet.add(parsed.userId);
              if (parsed.userName) {
                globalBlockedMap[parsed.userId] = parsed.userName;
              }
            }
          } catch {}
        } else if (!row.user_id.startsWith("SYSTEM_")) {
          regularMessages.push(row);
        }
      }

      setMessages(regularMessages);
      setPinned(latestPin);
      setIsChatLocked(lockedState);
      setBlockedUserIds(Array.from(blockedSet));
      setGlobalBlockedUsers(globalBlockedMap);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel(`live-chat-${liveClassId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `live_class_id=eq.${liveClassId}` },
        (payload) => {
          const incoming = payload.new as ChatMessage;

          // Handle system control messages
          if (incoming.user_id === "SYSTEM_PIN") {
            try {
              setPinned(JSON.parse(incoming.message));
            } catch {
              setPinned(null);
            }
            return;
          }
          if (incoming.user_id === "SYSTEM_LOCK") {
            try {
              const p = JSON.parse(incoming.message);
              setIsChatLocked(Boolean(p.isLocked));
            } catch {}
            return;
          }
          if (incoming.user_id === "SYSTEM_BLOCK") {
            try {
              const p = JSON.parse(incoming.message);
              if (p.unblock) {
                setBlockedUserIds((prev) => prev.filter((id) => id !== p.userId));
                setGlobalBlockedUsers((prev) => {
                  const next = { ...prev };
                  delete next[p.userId];
                  return next;
                });
              } else if (p.userId) {
                setBlockedUserIds((prev) => Array.from(new Set([...prev, p.userId])));
                setGlobalBlockedUsers((prev) => ({
                  ...prev,
                  [p.userId]: p.userName || "Student",
                }));
              }
            } catch {}
            return;
          }

          if (incoming.user_id.startsWith("SYSTEM_")) return;

          setMessages((prev) => {
            const next = [...prev, incoming];
            return next.length > MAX_RENDERED ? next.slice(next.length - MAX_RENDERED) : next;
          });
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "live_chat_messages", filter: `live_class_id=eq.${liveClassId}` },
        (payload) => {
          const deletedId = (payload.old as ChatMessage).id;
          setMessages((prev) => prev.filter((m) => m.id !== deletedId));
          setPinned((prev) => (prev?.id === deletedId ? null : prev));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [liveClassId]);

  // Auto-scroll logic
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (autoScroll) {
      programmaticScroll.current = true;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      setUnseenCount(0);
    } else {
      setUnseenCount((c) => c + 1);
    }
  }, [messages.length, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    if (programmaticScroll.current) {
      programmaticScroll.current = false;
      return;
    }
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottom = distanceFromBottom < 60;
    setAutoScroll(nearBottom);
    if (nearBottom) setUnseenCount(0);
  }, []);

  function jumpToLatest() {
    setAutoScroll(true);
    const el = listRef.current;
    if (el) {
      programmaticScroll.current = true;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
    setUnseenCount(0);
  }

  // Check if current user is blocked
  const isCurrentUserBlocked = currentUserId ? blockedUserIds.includes(currentUserId) : false;

  // Send message
  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    if (isCurrentUserBlocked) {
      toast.error("You are blocked from sending messages in this live chat.");
      return;
    }

    if (isChatLocked && !effectiveModerator) {
      toast.error("Live chat is paused by the moderator.");
      return;
    }

    setSending(true);
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      const user = userData.user;
      if (authError || !user) {
        toast.error("Please log in to chat.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      const name = profile?.full_name || user.email?.split("@")[0] || "Student";

      const { error } = await supabase.from("live_chat_messages").insert({
        live_class_id: liveClassId,
        user_id: user.id,
        user_name: name,
        message: trimmed.slice(0, 500),
      } as never);

      if (error) {
        toast.error(error.message || "Failed to send message.");
      } else {
        setText("");
        setShowEmoji(false);
        setAutoScroll(true);
      }
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  // Delete message
  async function deleteMessage(id: string) {
    try {
      const { error } = await supabase.from("live_chat_messages").delete().eq("id", id);
      if (error) throw error;
      setMessages((prev) => prev.filter((m) => m.id !== id));
      toast.success("Message deleted");
    } catch {
      toast.error("Could not delete message");
    }
  }

  // Pin / Unpin message
  async function togglePinMessage(m: ChatMessage) {
    if (!effectiveModerator) return;
    const isCurrentlyPinned = pinned?.id === m.id;
    const newPin = isCurrentlyPinned ? null : { id: m.id, text: m.message, name: m.user_name || "Student" };

    try {
      await supabase.from("live_chat_messages").insert({
        live_class_id: liveClassId,
        user_id: "SYSTEM_PIN",
        user_name: "SYSTEM",
        message: JSON.stringify(newPin),
      } as never);

      setPinned(newPin);
      toast.success(newPin ? "Message pinned to top" : "Message unpinned");
    } catch {
      toast.error("Failed to update pinned message");
    }
  }

  // Unpin directly
  async function unpin() {
    if (!effectiveModerator) return;
    try {
      await supabase.from("live_chat_messages").insert({
        live_class_id: liveClassId,
        user_id: "SYSTEM_PIN",
        user_name: "SYSTEM",
        message: JSON.stringify(null),
      } as never);
      setPinned(null);
      toast.success("Message unpinned");
    } catch {
      toast.error("Failed to unpin");
    }
  }

  // Local student block/mute
  function handleBlockLocal(targetId: string, targetName: string) {
    if (targetId === currentUserId) {
      toast.error("You cannot block yourself.");
      return;
    }
    setLocalBlockedUsers((prev) => {
      const next = { ...prev, [targetId]: targetName };
      try {
        localStorage.setItem(`sarvodaya_blocked_students_${liveClassId}`, JSON.stringify(next));
      } catch {}
      return next;
    });
    setTargetBlockUser(null);
    toast.success(`Messages from ${targetName} are now hidden for you.`);
  }

  function handleUnblockLocal(targetId: string) {
    setLocalBlockedUsers((prev) => {
      const next = { ...prev };
      delete next[targetId];
      try {
        localStorage.setItem(`sarvodaya_blocked_students_${liveClassId}`, JSON.stringify(next));
      } catch {}
      return next;
    });
    toast.success("Student unblocked. Messages will now be visible.");
  }

  // Moderator global ban/block
  async function handleBlockGlobal(targetId: string, targetName: string) {
    if (!effectiveModerator) return;
    if (targetId === currentUserId) {
      toast.error("You cannot block yourself.");
      return;
    }

    try {
      await supabase.from("live_chat_messages").insert({
        live_class_id: liveClassId,
        user_id: "SYSTEM_BLOCK",
        user_name: "SYSTEM",
        message: JSON.stringify({ userId: targetId, userName: targetName, unblock: false }),
      } as never);

      setBlockedUserIds((prev) => Array.from(new Set([...prev, targetId])));
      setGlobalBlockedUsers((prev) => ({ ...prev, [targetId]: targetName }));
      setTargetBlockUser(null);
      toast.success(`Student ${targetName} has been banned from chat.`);
    } catch {
      toast.error("Failed to block user");
    }
  }

  async function handleUnblockGlobal(targetId: string) {
    if (!effectiveModerator) return;
    try {
      await supabase.from("live_chat_messages").insert({
        live_class_id: liveClassId,
        user_id: "SYSTEM_BLOCK",
        user_name: "SYSTEM",
        message: JSON.stringify({ userId: targetId, unblock: true }),
      } as never);

      setBlockedUserIds((prev) => prev.filter((id) => id !== targetId));
      setGlobalBlockedUsers((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      toast.success("Student unbanned from live chat.");
    } catch {
      toast.error("Failed to unblock user");
    }
  }

  // Toggle entire chat lock
  async function toggleLockChat() {
    if (!effectiveModerator) return;
    const nextLocked = !isChatLocked;

    try {
      await supabase.from("live_chat_messages").insert({
        live_class_id: liveClassId,
        user_id: "SYSTEM_LOCK",
        user_name: "SYSTEM",
        message: JSON.stringify({ isLocked: nextLocked }),
      } as never);

      setIsChatLocked(nextLocked);
      setShowAdminMenu(false);
      toast.success(nextLocked ? "Live chat locked for students" : "Live chat unlocked");
    } catch {
      toast.error("Failed to toggle chat lock");
    }
  }

  const avatarColors = [
    "bg-red-500", "bg-orange-500", "bg-amber-500", "bg-emerald-500",
    "bg-sky-500", "bg-blue-600", "bg-indigo-600", "bg-violet-600", "bg-pink-600",
  ];
  function colorFor(id: string) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return avatarColors[h % avatarColors.length];
  }

  const visibleMessages = useMemo(() => {
    // Hide messages from blocked users (moderator banned OR locally muted)
    return messages.filter((m) => !blockedUserIds.includes(m.user_id) && !localBlockedUsers[m.user_id]);
  }, [messages, blockedUserIds, localBlockedUsers]);

  const totalBlockedCount = Object.keys(localBlockedUsers).length + (effectiveModerator ? blockedUserIds.length : 0);

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f0f] text-white shadow-2xl ${
        className ?? "h-full min-h-[420px]"
      }`}
    >
      {/* YouTube Style Chat Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-[#181818]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChatFilter(chatFilter === "top" ? "live" : "top")}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-200 hover:text-white transition"
          >
            <MessageCircle className="h-4 w-4 text-red-500" />
            <span>{chatFilter === "top" ? "Top chat" : "Live chat"}</span>
            <span className="text-[10px] text-slate-400">▾</span>
          </button>
          <span className="inline-flex items-center gap-1 rounded-full bg-red-600/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
            Live
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {totalBlockedCount > 0 && (
            <button
              onClick={() => setShowBlockedUsersList(true)}
              title="View & manage blocked/muted students"
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-bold transition border border-red-500/30"
            >
              <UserX className="h-3 w-3" />
              <span>{totalBlockedCount} Blocked</span>
            </button>
          )}

          {effectiveModerator && (
            <div className="relative">
              <button
                onClick={() => setShowAdminMenu((s) => !s)}
                title="Moderation Tools"
                className={`rounded-full p-1.5 transition ${
                  isChatLocked ? "bg-red-500/20 text-red-400" : "text-slate-400 hover:bg-white/10 hover:text-white"
                }`}
              >
                {isChatLocked ? <Lock className="h-4 w-4" /> : <MoreVertical className="h-4 w-4" />}
              </button>

              {showAdminMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-white/10 bg-[#1f1f1f] p-1.5 shadow-2xl z-30 text-xs">
                  <div className="px-3 py-2 font-bold text-slate-300 border-b border-white/10 flex items-center justify-between">
                    <span>Moderator Tools</span>
                    <Shield className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <button
                    onClick={toggleLockChat}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10 transition mt-1"
                  >
                    {isChatLocked ? (
                      <>
                        <Unlock className="h-4 w-4 text-emerald-400" />
                        <span>Unlock Entire Chat</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-4 w-4 text-red-400" />
                        <span>Block Entire Chat (Lock)</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setShowBlockedUsersList(true);
                      setShowAdminMenu(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10 transition text-red-400 font-medium"
                  >
                    <UserX className="h-4 w-4" />
                    <span>Manage Blocked Students ({totalBlockedCount})</span>
                  </button>

                  {pinned && (
                    <button
                      onClick={() => { unpin(); setShowAdminMenu(false); }}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left hover:bg-white/10 transition text-amber-400"
                    >
                      <PinOff className="h-4 w-4" />
                      <span>Unpin Message</span>
                    </button>
                  )}

                  {blockedUserIds.length > 0 && (
                    <div className="px-3 py-1.5 text-[10px] text-slate-400 border-t border-white/10 mt-1">
                      {blockedUserIds.length} user(s) currently banned
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {onClose && (
            <button
              onClick={onClose}
              title="Close chat"
              className="rounded-full p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Pinned Message Banner (YouTube Style) */}
      {pinned && (
        <div className="flex items-start gap-2.5 border-b border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5">
          <div className="bg-amber-500/20 p-1.5 rounded-full text-amber-400 shrink-0 mt-0.5">
            <Pin className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
              <span>Pinned Message</span>
              <span className="text-slate-400 font-normal">· {pinned.name}</span>
            </div>
            <p className="text-xs text-slate-200 mt-0.5 break-words [overflow-wrap:anywhere] leading-snug">
              {pinned.text}
            </p>
          </div>
          {effectiveModerator && (
            <button
              onClick={unpin}
              title="Unpin message"
              className="shrink-0 p-1 rounded hover:bg-amber-500/20 text-amber-400 transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Chat Locked Announcement Banner */}
      {isChatLocked && (
        <div className="flex items-center gap-2 bg-red-950/60 border-b border-red-500/30 px-3.5 py-2 text-xs text-red-200">
          <Lock className="h-3.5 w-3.5 shrink-0 text-red-400" />
          <span>Chat has been paused by the moderator. Only teachers can send messages.</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto overflow-x-hidden px-3.5 py-3"
        >
          {loading && (
            <div className="text-xs text-slate-400 text-center py-6">Connecting to live chat…</div>
          )}

          {!loading && visibleMessages.length === 0 && (
            <div className="text-xs text-slate-400 text-center py-10 space-y-2">
              <MessageCircle className="mx-auto h-8 w-8 text-slate-600 opacity-50" />
              <p>Welcome to live chat! Say hello 👋</p>
            </div>
          )}

          {visibleMessages.map((m) => {
            const name = m.user_name || "Student";
            const initial = name.trim().charAt(0).toUpperCase() || "S";
            const isSelf = m.user_id === currentUserId;

            return (
              <div
                key={m.id}
                className="group relative flex items-start gap-2.5 text-xs hover:bg-white/[0.04] -mx-2 px-2 py-1 rounded-lg transition"
              >
                {/* Avatar */}
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black text-white shadow-sm ${colorFor(
                    m.user_id
                  )}`}
                >
                  {initial}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1 leading-snug break-words [overflow-wrap:anywhere]">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {effectiveModerator && onViewStudent ? (
                      <button
                        onClick={() => onViewStudent(m.user_id, name)}
                        className="font-bold text-slate-300 hover:text-white hover:underline text-[11px]"
                      >
                        {name}
                      </button>
                    ) : !isSelf ? (
                      <button
                        onClick={() => setTargetBlockUser({ id: m.user_id, name })}
                        className="font-bold text-slate-300 hover:text-red-300 hover:underline text-[11px] text-left cursor-pointer"
                        title={`Click to block or hide ${name}`}
                      >
                        {name}
                      </button>
                    ) : (
                      <span className="font-bold text-slate-300 text-[11px]">{name}</span>
                    )}

                    {m.is_moderator && (
                      <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/20 px-1.5 py-0.2 text-[9px] font-bold text-blue-400">
                        <Shield className="h-2.5 w-2.5" /> Teacher
                      </span>
                    )}

                    <span className="text-[10px] text-slate-500 font-normal">
                      {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <p className="mt-0.5 text-slate-100 text-[13px] leading-relaxed break-words [overflow-wrap:anywhere]">
                    {m.message}
                  </p>
                </div>

                {/* Moderator / Self / Student Actions */}
                <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition focus-within:opacity-100">
                  {effectiveModerator && (
                    <button
                      onClick={() => togglePinMessage(m)}
                      title="Pin this message"
                      className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-white/10 transition"
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {!isSelf && (
                    <button
                      onClick={() => setTargetBlockUser({ id: m.user_id, name })}
                      title={effectiveModerator ? "Block / Ban student" : `Hide messages from ${name}`}
                      className="p-1 rounded text-slate-400 hover:text-red-400 hover:bg-white/10 transition"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {(effectiveModerator || isSelf) && (
                    <button
                      onClick={() => deleteMessage(m.id)}
                      title="Delete message"
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-white/10 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Jump to Latest Floating Pill */}
        {!autoScroll && unseenCount > 0 && (
          <button
            onClick={jumpToLatest}
            className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xl transition hover:bg-blue-500"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {unseenCount} new messages
          </button>
        )}
      </div>

      {/* Bottom Chat Input Bar */}
      <div className="relative border-t border-white/10 p-2.5 bg-[#181818]">
        {/* Blocked Notice for Student */}
        {isCurrentUserBlocked ? (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-2.5 text-center text-xs text-red-400 flex items-center justify-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>You have been blocked from commenting by the moderator.</span>
          </div>
        ) : isChatLocked && !effectiveModerator ? (
          <div className="rounded-xl bg-slate-800 p-2.5 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Lock className="h-3.5 w-3.5" />
            <span>Chat is currently paused by moderator.</span>
          </div>
        ) : (
          <div>
            {showEmoji && (
              <div className="absolute bottom-full left-2 mb-2 flex gap-1 rounded-2xl border border-white/10 bg-[#212121] p-2 shadow-2xl z-20">
                {QUICK_EMOJI.map((e) => (
                  <button
                    key={e}
                    onClick={() => setText((t) => (t + e).slice(0, 500))}
                    className="rounded-lg p-1 text-lg hover:bg-white/10 transition"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowEmoji((s) => !s)}
                title="Add emoji"
                className="shrink-0 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                <Smile className="h-5 w-5" />
              </button>

              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                maxLength={500}
                placeholder={effectiveModerator && isChatLocked ? "Chat (Teacher Mode)..." : "Chat..."}
                className="min-w-0 flex-1 rounded-full border border-white/10 bg-[#2b2b2b] px-4 py-2 text-sm text-white placeholder-slate-400 outline-none focus:border-blue-500 transition"
              />

              <Button
                size="icon"
                onClick={send}
                disabled={sending || !text.trim()}
                className="h-9 w-9 shrink-0 rounded-full bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 shadow-sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Block Single Student Confirmation Modal */}
      {targetBlockUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-zinc-900 p-5 shadow-2xl text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-red-500/20 text-red-400">
                  <UserX className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm">Block Student</h3>
              </div>
              <button
                onClick={() => setTargetBlockUser(null)}
                className="p-1 rounded-full text-slate-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4">
              <p className="text-xs text-slate-300 leading-relaxed">
                Choose what to do with <span className="font-bold text-white">"{targetBlockUser.name}"</span>:
              </p>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => handleBlockLocal(targetBlockUser.id, targetBlockUser.name)}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition text-left text-xs font-semibold cursor-pointer"
                >
                  <div>
                    <div className="text-white font-bold">Mute for me only</div>
                    <div className="text-[11px] text-slate-400 font-normal mt-0.5">Hide their messages on your screen only</div>
                  </div>
                  <UserX className="h-4 w-4 text-amber-400 shrink-0 ml-2" />
                </button>

                {effectiveModerator && (
                  <button
                    type="button"
                    onClick={() => handleBlockGlobal(targetBlockUser.id, targetBlockUser.name)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 transition text-left text-xs font-semibold text-red-200 cursor-pointer"
                  >
                    <div>
                      <div className="text-red-400 font-bold">Ban from Live Chat (Moderator)</div>
                      <div className="text-[11px] text-red-300/70 font-normal mt-0.5">Block student from commenting for everyone</div>
                    </div>
                    <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 ml-2" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-white/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTargetBlockUser(null)}
                className="text-xs border-white/15 bg-transparent hover:bg-white/10 text-white"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Blocked Students List Modal */}
      {showBlockedUsersList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-zinc-900 p-5 shadow-2xl text-white max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-full bg-red-500/20 text-red-400">
                  <UserX className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm">Blocked Students ({totalBlockedCount})</h3>
              </div>
              <button
                onClick={() => setShowBlockedUsersList(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-4 overflow-y-auto space-y-2 flex-1 min-h-0 divide-y divide-white/5">
              {totalBlockedCount === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  No blocked students yet.
                </div>
              ) : (
                <>
                  {/* Locally muted by current student */}
                  {Object.entries(localBlockedUsers).map(([uid, uname]) => (
                    <div key={uid} className="flex items-center justify-between py-2.5 px-2">
                      <div className="min-w-0 pr-2">
                        <div className="font-semibold text-xs text-white truncate">{uname}</div>
                        <div className="text-[10px] text-amber-400 font-medium">Muted for you</div>
                      </div>
                      <button
                        onClick={() => handleUnblockLocal(uid)}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-slate-200 transition cursor-pointer"
                      >
                        Unblock
                      </button>
                    </div>
                  ))}

                  {/* Moderator banned students (visible to moderator) */}
                  {effectiveModerator &&
                    blockedUserIds.map((uid) => (
                      <div key={uid} className="flex items-center justify-between py-2.5 px-2">
                        <div className="min-w-0 pr-2">
                          <div className="font-semibold text-xs text-white truncate">
                            {globalBlockedUsers[uid] || `Student (${uid.slice(0, 8)})`}
                          </div>
                          <div className="text-[10px] text-red-400 font-medium">Banned by Moderator</div>
                        </div>
                        <button
                          onClick={() => handleUnblockGlobal(uid)}
                          className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-xs font-semibold text-red-300 transition cursor-pointer"
                        >
                          Unban
                        </button>
                      </div>
                    ))}
                </>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-white/10 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBlockedUsersList(false)}
                className="text-xs border-white/15 bg-transparent hover:bg-white/10 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
