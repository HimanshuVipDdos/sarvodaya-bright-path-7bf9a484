import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // Realtime listener for new notifications
    const channel = supabase.channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        setUnread(prev => prev + 1);
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div className="relative cursor-pointer">
      <Bell className="text-gray-600" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
          {unread}
        </span>
      )}
    </div>
  );
}
