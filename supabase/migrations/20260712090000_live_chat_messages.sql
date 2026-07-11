-- ============ LIVE CHAT MESSAGES ============
-- Realtime comments for a live class. Referenced by src/components/live-chat.tsx.

CREATE TABLE IF NOT EXISTS public.live_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT,
  message TEXT NOT NULL CHECK (char_length(message) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.live_chat_messages TO authenticated;
GRANT ALL ON public.live_chat_messages TO service_role;

ALTER TABLE public.live_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read chat" ON public.live_chat_messages
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users send own messages" ON public.live_chat_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners and admins delete messages" ON public.live_chat_messages
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')
  );

CREATE INDEX IF NOT EXISTS idx_live_chat_messages_class ON public.live_chat_messages(live_class_id, created_at);

-- Enable realtime for instant chat updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_chat_messages;
