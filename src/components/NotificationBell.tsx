import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function AnnouncementTicker() {
  const [announcement, setAnnouncement] = useState(null);

  useEffect(() => {
    // Sabse latest announcement fetch karo
    const fetchLatest = async () => {
      const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(1).single();
      setAnnouncement(data);
    };
    fetchLatest();
  }, []);

  if (!announcement) return null;

  return (
    <div className="bg-indigo-600 text-white py-2 px-4 text-sm font-medium text-center animate-pulse">
      📢 {announcement.title} - <span className="underline cursor-pointer">Click here to check</span>
    </div>
  );
}
