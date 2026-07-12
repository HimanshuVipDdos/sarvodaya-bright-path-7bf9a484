import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Phone, Mail, Save } from 'lucide-react';

export function ProfileSettings({ userProfile }) {
  const [name, setName] = useState(userProfile?.display_name || "");
  const [mobile, setMobile] = useState(userProfile?.phone_number || "");
  const [loading, setLoading] = useState(false);

  const handleUpdate = async () => {
    setLoading(true);
    // Profile table mein details update kar rahe hain
    const { error } = await supabase
      .from('profiles')
      .update({ 
        display_name: name, 
        phone_number: mobile 
      })
      .eq('id', userProfile.id);

    if (error) alert("Error updating profile!");
    else alert("Profile updated successfully! Comments mein naya naam show hoga.");
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-xl shadow-sm border mt-6">
      <h2 className="text-xl font-bold mb-6 border-b pb-4">My Account</h2>
      
      {/* Name Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Display Name</label>
        <div className="flex items-center border rounded-lg p-3 bg-gray-50">
          <User className="text-gray-400 mr-3" size={20} />
          <input 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            className="bg-transparent w-full outline-none"
          />
        </div>
        <p className="text-xs text-gray-400 mt-1">Ye naam aapke comments mein show hoga.</p>
      </div>

      {/* Mobile Input */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Mobile Number</label>
        <div className="flex items-center border rounded-lg p-3 bg-gray-50">
          <Phone className="text-gray-400 mr-3" size={20} />
          <input 
            value={mobile} 
            onChange={(e) => setMobile(e.target.value)}
            className="bg-transparent w-full outline-none"
          />
        </div>
      </div>

      {/* Update Button */}
      <button 
        onClick={handleUpdate}
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition"
      >
        <Save size={20} />
        {loading ? "Updating..." : "Save Changes"}
      </button>
    </div>
  );
}
