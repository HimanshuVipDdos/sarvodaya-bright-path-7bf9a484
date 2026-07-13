-- Mark whether a live-chat message was sent by an admin/teacher, so the UI
-- can show an "Admin" badge instead of treating every sender the same.
ALTER TABLE public.live_chat_messages
  ADD COLUMN is_moderator BOOLEAN NOT NULL DEFAULT false;
