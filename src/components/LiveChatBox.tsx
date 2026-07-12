import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function LiveChatBox({ classId, userProfile }) {
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    // Admin panel se sync
    const channel = supabase.channel('live_comments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_comments', filter: `class_id=eq.${classId}` }, (payload) => {
        setComments((prev) => [...prev, payload.new]);
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [classId]);

  const sendComment = async () => {
    if (!text.trim()) return;
    await supabase.from('live_comments').insert({ 
      class_id: classId, 
      user_name: userProfile.name, 
      message: text 
    });
    setText("");
  };

  return (
    <div className="flex flex-col h-full p-2">
      <div className="flex-1 overflow-y-auto space-y-2">
        {comments.map((c, i) => (
          <p key={i} className="text-xs text-gray-800">
            <span className="font-bold text-blue-600">{c.user_name}: </span>
            {c.message}
          </p>
        ))}
      </div>
      <div className="flex gap-2 p-2 border-t">
        <input value={text} onChange={(e) => setText(e.target.value)} className="w-full text-sm border p-1 rounded" placeholder="Comment..." />
        <button onClick={sendComment} className="bg-blue-600 text-white px-2 py-1 rounded text-xs">Send</button>
      </div>
    </div>
  );
}
