import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send } from 'lucide-react';

export function LiveChat({ classId }: { classId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Initial messages fetch karein
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('live_chat_messages')
        .select('*')
        .eq('class_id', classId)
        .order('created_at', { ascending: true });
      if (data) setMessages(data);
    };

    fetchMessages();

    // 2. Realtime listener taaki instant real-time sync ho sake
    const channel = supabase
      .channel(`chat:${classId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `class_id=eq.${classId}` }, 
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [classId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("Please login to send comments!");
      return;
    }

    // Database schema ke hisab se name fallback select karein
    const studentName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student';

    const { error } = await supabase.from('live_chat_messages').insert({
      class_id: classId,
      user_id: user.id,
      sender_name: studentName,
      message: newMessage.trim(),
    });

    if (!error) {
      setNewMessage(''); // Input field clean karein
    } else {
      console.error("Error sending message:", error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, idx) => (
          <div key={msg.id || idx} className="text-sm bg-muted/40 p-2.5 rounded-lg border border-border/50">
            <span className="font-bold text-primary mr-2">{msg.sender_name || 'Anonymous'}:</span>
            <span className="text-foreground break-words">{msg.message}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-3 border-t border-border flex gap-2 bg-muted/20">
        <Input
          type="text"
          placeholder="Say something..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" size="icon" className="shrink-0">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
