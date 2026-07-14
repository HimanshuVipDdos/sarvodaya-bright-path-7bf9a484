import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { Send, Trash2, Shield, MessageCircle, ArrowDown, Pin, PinOff, Smile } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type ChatMessage = {
  id: string;
  live_class_id: string;
  user_id: string;
  user_name: string | null;
  message: string;
  created_at: string;
  is_moderator: boolean;
  is_pinned?: boolean;
};

type Props = {
  liveClassId: string;
  /** Show a delete button on every message (admin monitor view). */
  canModerate?: boolean;
  /** Fixed height for the scrollable message list. */
  className?: string;
  /** Admin-only: called with (user_id, name) when the name/details icon is clicked. */
  onViewStudent?: (userId: string, name: string) => void;
};

// Only this many messages are ever mounted in the DOM at once. Older ones
// are simply dropped from the live view (not from the database) once the
// chat has moved on, the same way YouTube Live itself doesn't keep infinite
// scrollback in the live panel. This is what keeps the chat smooth even
// across a multi-hour class with 50,000+ messages — the DOM node count is
// bounded no matter how long the class runs.
const MAX_RENDERED = 300;
const QUICK_EMOJI = ["👍", "❤️", "😂", "🎉", "🙏", "🔥", "😮", "❓"];

// Live comments for a single live class. Backed by the `live_chat_messages`
// table + Supabase Realtime — new messages appear instantly for everyone
// watching, no page refresh needed.
export function LiveChat({ liveClassId, canModerate = false, className, onViewStudent }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pinned, setPinned] = useState<ChatMessage | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [unseenCount, setUnseenCount] = useState(0);
  const [showEmoji, setShowEmoji] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // Tracks whether the *user* just caused a scroll (so our own auto-scroll
  // effect doesn't get mistaken for the user scrolling up to read history).
  const programmaticScroll = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("live_chat_messages")
        .select("*")
        .eq("live_class_id", liveClassId)
        .order("created_at", { ascending: true })
        .limit(200);
      if (!cancelled) {
        const rows = (data as ChatMessage[]) ?? [];
        setMessages(rows);
        setPinned(rows.find((m) => m.is_pinned) ?? null);
        setLoading(false);
      }
    }
    load();

    const channel = supabase
      .channel(`live-chat-${liveClassId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_chat_messages", filter: `live_class_id=eq.${liveClassId}` },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          setMessages((prev) => {
            const next = [...prev, incoming];
            // Keep DOM size bounded — drop from the front once we're over
            // the cap. Safe to do unconditionally: anything trimmed here
            // still exists in the database, it just isn't re-rendered live.
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_chat_messages", filter: `live_class_id=eq.${liveClassId}` },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          setPinned((prev) => {
            if (updated.is_pinned) return updated;
            return prev?.id === updated.id ? null : prev;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [liveClassId]);

  // Auto-scroll, but only while the student is already at (or near) the
  // bottom. The moment they scroll up to read older comments, auto-scroll
  // pauses so new messages don't yank them back down — exactly like
  // YouTube Live. A "Jump to latest" pill appears instead, with a live
  // unseen-count badge.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

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

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      const user = userData.user;
      if (authError || !user) {
        toast.error("Please log in to comment.");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const name = profile?.full_name || user.email?.split("@")[0] || "Student";

      const { data: roleRows } = await supabase
        .from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
      const isAdmin = (roleRows?.length ?? 0) > 0;

      const { error } = await supabase.from("live_chat_messages").insert({
        live_class_id: liveClassId,
        user_id: user.id,
        user_name: name,
        message: trimmed.slice(0, 500),
        is_moderator: isAdmin,
      } as never);
      if (error) {
        toast.error(error.message || "Comment could not be sent. Try again.");
      } else {
        setText("");
        setShowEmoji(false);
        // Sending your own message should always snap you back to live.
        setAutoScroll(true);
      }
    } catch (e) {
      toast.error("Comment could not be sent. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    await supabase.from("live_chat_messages").delete().eq("id", id);
  }

  async function togglePin(m: ChatMessage) {
    const nextPinned = !m.is_pinned;
    // Only one pinned message at a time — unpin whatever was pinned before.
    if (nextPinned && pinned && pinned.id !== m.id) {
      await supabase.from("live_chat_messages").update({ is_pinned: false } as never).eq("id", pinned.id);
    }
    const { error } = await supabase.from("live_chat_messages").update({ is_pinned: nextPinned } as never).eq("id", m.id);
    if (error) {
      toast.error("Couldn't update pin. Does the is_pinned column exist yet?");
      return;
    }
    setPinned(nextPinned ? { ...m, is_pinned: true } : null);
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_pinned: nextPinned } : x)));
  }

  const avatarColors = [
    "bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500",
    "bg-violet-500", "bg-pink-500", "bg-teal-500", "bg-orange-500",
  ];
  function colorFor(id: string) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return avatarColors[h % avatarColors.length];
  }

  const visibleMessages = useMemo(
    () => (pinned ? messages.filter((m) => m.id !== pinned.id) : messages),
    [messages, pinned],
  );

  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/60 ${className ?? ""}`}>
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
        </span>
        <MessageCircle className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wide text-foreground/80">
          Live comments
        </span>
        {messages.length > 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground">{messages.length}</span>
        )}
      </div>

      {pinned && (
        <div className="flex items-start gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2">
          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Pinned by {pinned.is_moderator ? "Teacher" : pinned.user_name ?? "Admin"}
            </div>
            <p className="break-words text-xs text-foreground/85">{pinned.message}</p>
          </div>
          {canModerate && (
            <button
              onClick={() => togglePin(pinned)}
              aria-label="Unpin message"
              className="shrink-0 rounded p-1 text-amber-700 hover:bg-amber-500/20"
            >
              <PinOff className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={listRef}
          onScroll={handleScroll}
          className="flex h-64 min-h-0 w-full flex-col gap-2.5 overflow-y-auto overflow-x-hidden px-3 py-2.5"
        >
          {loading && <div className="text-xs text-muted-foreground">Loading comments…</div>}
          {!loading && messages.length === 0 && (
            <div className="text-xs text-muted-foreground">No comments yet. Say hi 👋</div>
          )}
          {visibleMessages.map((m) => {
            const name = m.user_name || "Student";
            const initial = name.trim().charAt(0).toUpperCase() || "S";
            return (
              <div key={m.id} className="group flex items-start gap-2 text-sm">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${colorFor(m.user_id)}`}
                  aria-hidden
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1 leading-snug break-words">
                  {canModerate && onViewStudent ? (
                    <button
                      onClick={() => onViewStudent(m.user_id, name)}
                      className="font-semibold text-foreground/90 hover:underline inline-flex items-center gap-1 text-xs"
                      aria-label="View student details"
                    >
                      {name}
                    </button>
                  ) : (
                    <span className="font-semibold text-foreground/90 text-xs">{name}</span>
                  )}
                  {m.is_moderator && (
                    <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground align-middle">
                      <Shield className="h-2.5 w-2.5" /> Teacher
                    </span>
                  )}
                  <p className="break-words text-foreground/80">{m.message}</p>
                </div>
                {canModerate && (
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => togglePin(m)}
                      aria-label="Pin message"
                      className="rounded p-1 text-muted-foreground hover:text-amber-600"
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => remove(m.id)}
                      aria-label="Delete message"
                      className="rounded p-1 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Jump-to-latest pill — only shown once the student has scrolled
            up to read older comments and new ones have arrived since. */}
        {!autoScroll && unseenCount > 0 && (
          <button
            onClick={jumpToLatest}
            className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-lg transition hover:brightness-110"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            {unseenCount} new {unseenCount === 1 ? "message" : "messages"}
          </button>
        )}
      </div>

      <div className="relative flex items-center gap-2 border-t border-border/60 p-2">
        {showEmoji && (
          <div className="absolute bottom-full left-2 mb-2 flex gap-1 rounded-2xl border border-border/60 bg-background p-2 shadow-lg">
            {QUICK_EMOJI.map((e) => (
              <button
                key={e}
                onClick={() => setText((t) => (t + e).slice(0, 500))}
                className="rounded-lg p-1 text-lg hover:bg-muted"
              >
                {e}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowEmoji((s) => !s)}
          aria-label="Add emoji"
          className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Smile className="h-4 w-4" />
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.keyCode === 13) { e.preventDefault(); send(); } }}
          maxLength={500}
          placeholder="Type a comment…"
          className="min-w-0 flex-1 rounded-full border border-border/60 bg-background px-4 py-2 text-sm outline-none focus:border-primary"
        />
        <Button size="icon" className="h-9 w-9 shrink-0 rounded-full" onClick={send} disabled={sending || !text.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
