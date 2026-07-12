import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { getAccessibleContent } from '@/lib/auth-checks';

// YAHI WO LINE HAI JISKE BINA 404 AA RAHA THA
export const Route = createFileRoute('/_authenticated/dashboard')({
  component: Dashboard,
});

function Dashboard() {
  const [content, setContent] = useState({ tests: [], batches: [] });
  const [activeTab, setActiveTab] = useState('batches'); // 'batches' or 'mock-tests'

  useEffect(() => {
    // Component load hote hi data fetch karo
    getAccessibleContent('current_user_id').then(setContent);
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto mt-10">
      <h1 className="text-3xl font-bold mb-6">Student Dashboard</h1>
      
      {/* TABS (Inspiration: PW/Unacademy UI) */}
      <div className="flex space-x-6 border-b mb-6">
        <button 
          onClick={() => setActiveTab('batches')}
          className={`pb-2 font-bold ${activeTab === 'batches' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
        >
          My Batches
        </button>
        <button 
          onClick={() => setActiveTab('mock-tests')}
          className={`pb-2 font-bold ${activeTab === 'mock-tests' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground'}`}
        >
          Mock Tests
        </button>
      </div>

      {/* CONTENT AREA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {activeTab === 'batches' && content?.batches?.map((batch: any) => (
          <div key={batch.id} className="p-6 glass-strong rounded-xl shadow-sm border hover:shadow-md transition">
            <h3 className="text-lg font-bold">{batch.name}</h3>
            <button className="mt-4 w-full bg-primary text-primary-foreground py-2 rounded-xl font-medium">View Content</button>
          </div>
        ))}

        {activeTab === 'mock-tests' && content?.tests?.map((test: any) => (
          <div key={test.id} className="p-6 glass-strong rounded-xl shadow-sm border">
            <h3 className="text-lg font-bold">{test.title}</h3>
            <p className="text-sm text-muted-foreground mt-1">{test.is_free ? "Free Test" : "Batch Test"}</p>
            <button className="mt-4 w-full bg-green-600 text-white py-2 rounded-xl font-medium">Start Test</button>
          </div>
        ))}

        {/* Fallback agar content khali ho */}
        {((activeTab === 'batches' && (!content?.batches || content.batches.length === 0)) || 
          (activeTab === 'mock-tests' && (!content?.tests || content.tests.length === 0))) && (
          <div className="col-span-full p-8 text-center glass rounded-2xl">
            <p className="text-muted-foreground">No {activeTab.replace('-', ' ')} found yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
