// src/components/admin/NewAdminFeatures.tsx
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function NewAdminFeatures() {
  const [activeTab, setActiveTab] = useState('quick-actions');

  return (
    <div className="p-6 bg-gray-50 border rounded-xl mt-4">
      <h3 className="font-bold text-lg mb-4 text-indigo-700">⚙️ Quick Admin Tools</h3>
      
      {/* Tabs */}
      <div className="flex gap-4 border-b mb-4">
        <button onClick={() => setActiveTab('quick-actions')} className="pb-2 border-b-2 border-indigo-600">Quick Actions</button>
      </div>

      {/* Feature Content */}
      <div className="grid grid-cols-2 gap-4">
        <button className="p-4 bg-white border rounded hover:shadow transition">Add Live Lecture</button>
        <button className="p-4 bg-white border rounded hover:shadow transition">Upload DPP/PDF</button>
      </div>
    </div>
  );
}
