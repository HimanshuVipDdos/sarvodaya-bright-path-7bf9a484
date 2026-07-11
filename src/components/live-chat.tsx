import { useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type ChatMessage = {
  id: string;
  live_class_id: string;
  user_id: string;
  user_name: string | null;
  message: string;
  created_at: string;
};

type Props = {
  liveClassId: string;
  /** Show a delete button on every message (admin monitor view). */
  canModerate?: boolean;
  /** Fixed height for the scrollable message list. */
  className?: string;
};

// Live comments for a single live class. Backed by the `live_chat_messages`
// table + Supabase Realtime — new messages appear instantly for everyone
// watching, no page refresh needed.
export function LiveChat({ liveClassId, canModerate = false, className }: Props) {
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
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles").select("full_name").eq("id", user.id).maybeSingle();
      const name = profile?.full_name || user.email?.split("@")[0] || "Student";

      const { error } = await supabase.from("live_chat_messages").insert({
        live_class_id: liveClassId,
        user_id: user.id,
        user_name: name,
        message: trimmed.slice(0, 500),
      } as never);
      if (!error) setText("");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    await supabase.from("live_chat_messages").delete().eq("id", id);
  }

  return (
    <div className={className}>
      <div
        ref={listRef}
        className="flex h-64 flex-col gap-2 overflow-y-auto rounded-2xl bg-background/60 p-3"
      >
        {loading && <div className="text-xs text-muted-foreground">Loading comments…</div>}
        {!loading && messages.length === 0 && (
          <div className="text-xs text-muted-foreground">No comments yet. Say hi 👋</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className="group flex items-start justify-between gap-2 text-sm">
            <div className="min-w-0">
              <span className="font-semibold text-primary">{m.user_name || "Student"}: </span>
              <span className="break-words">{m.message}</span>
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
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          maxLength={500}
          placeholder="Type a comment…"
          className="glass min-w-0 flex-1 rounded-full border-0 px-4 py-2 text-sm outline-none"
        />
        <Button size="sm" onClick={send} disabled={sending || !text.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
