import { useState, useEffect } from 'react';
import { getAccessibleContent } from '@/lib/auth-checks';

export default function Dashboard() {
  const [content, setContent] = useState({ tests: [], batches: [] });
  const [activeTab, setActiveTab] = useState('batches'); // 'batches' or 'mock-tests'

  useEffect(() => {
    // Component load hote hi data fetch karo
    getAccessibleContent('current_user_id').then(setContent);
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* TABS (Inspiration: PW/Unacademy UI) */}
      <div className="flex space-x-6 border-b mb-6">
        <button 
          onClick={() => setActiveTab('batches')}
          className={`pb-2 font-bold ${activeTab === 'batches' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
        >
          My Batches
        </button>
        <button 
          onClick={() => setActiveTab('mock-tests')}
          className={`pb-2 font-bold ${activeTab === 'mock-tests' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-500'}`}
        >
          Mock Tests
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {activeTab === 'batches' && content.batches.map(batch => (
          <div key={batch.id} className="p-6 bg-white rounded-xl shadow-sm border hover:shadow-md transition">
            <h3 className="text-lg font-bold">{batch.name}</h3>
            <button className="mt-4 w-full bg-indigo-600 text-white py-2 rounded">View Content</button>
          </div>
        ))}

        {activeTab === 'mock-tests' && content.tests.map(test => (
          <div key={test.id} className="p-6 bg-white rounded-xl shadow-sm border">
            <h3 className="text-lg font-bold">{test.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{test.is_free ? "Free Test" : "Batch Test"}</p>
            <button className="mt-4 w-full bg-green-600 text-white py-2 rounded">Start Test</button>
          </div>
        ))}
      </div>
    </div>
  );
}
