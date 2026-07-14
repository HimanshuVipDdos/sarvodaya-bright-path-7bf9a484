import { useEffect, useRef, useState } from "react";
import { Send, Trash2, UserRound, Shield, MessageCircle } from "lucide-react";
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

// Live comments for a single live class. Backed by the `live_chat_messages`
// table + Supabase Realtime — new messages appear instantly for everyone
// watching, no page refresh needed.
export function LiveChat({ liveClassId, canModerate = false, className, onViewStudent }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

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
        setMessages((data as ChatMessage[]) ?? []);
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
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "live_chat_messages", filter: `live_class_id=eq.${liveClassId}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as ChatMessage).id));
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [liveClassId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

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

  const avatarColors = [
    "bg-rose-500", "bg-amber-500", "bg-emerald-500", "bg-sky-500",
    "bg-violet-500", "bg-pink-500", "bg-teal-500", "bg-orange-500",
  ];
  function colorFor(id: string) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return avatarColors[h % avatarColors.length];
  }

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

      <div
        ref={listRef}
        className="flex h-64 min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-2.5"
      >
        {loading && <div className="text-xs text-muted-foreground">Loading comments…</div>}
        {!loading && messages.length === 0 && (
          <div className="text-xs text-muted-foreground">No comments yet. Say hi 👋</div>
        )}
        {messages.map((m) => {
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
              <div className="min-w-0 flex-1 leading-snug">
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
                    <Shield className="h-2.5 w-2.5" /> Admin
                  </span>
                )}
                <p className="break-words text-foreground/80">{m.message}</p>
              </div>
              {canModerate && (
                <button
                  onClick={() => remove(m.id)}
                  aria-label="Delete message"
                  className="shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-t border-border/60 p-2">
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
