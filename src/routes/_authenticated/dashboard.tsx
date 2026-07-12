import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { BookOpen, FileText, PlayCircle, Loader2, Calendar } from 'lucide-react';
import { getAccessibleContent } from '@/lib/auth-checks';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: Dashboard,
});

function Dashboard() {
  const [content, setContent] = useState<any>({ tests: [], batches: [] });
  const [activeTab, setActiveTab] = useState<'batches' | 'mock-tests'>('batches');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAccessibleContent('current_user_id')
      .then((data: any) => {
        if (data) setContent(data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const batches = content?.batches || [];
  const tests = content?.tests || [];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto min-h-screen">
      <div className="mb-8 mt-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Student Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Welcome back! Access your enrolled batches and mock tests below.
        </p>
      </div>

      <div className="flex space-x-6 border-b border-border mb-6">
        <button
          onClick={() => setActiveTab('batches')}
          className={`pb-3 text-sm sm:text-base font-semibold border-b-2 transition-colors ${
            activeTab === 'batches' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          My Batches
        </button>
        <button
          onClick={() => setActiveTab('mock-tests')}
          className={`pb-3 text-sm sm:text-base font-semibold border-b-2 transition-colors ${
            activeTab === 'mock-tests' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
          }`}
        >
          Mock Tests
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="font-medium">Loading your content...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {activeTab === 'batches' && batches.length > 0 && batches.map((batch: any) => (
            <div key={batch.id} className="glass-strong p-6 rounded-3xl border border-border/50 hover:shadow-elegant flex flex-col h-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                  <BookOpen className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold">{batch.name}</h3>
              </div>
              <div className="mt-auto pt-4">
                <button className="w-full bg-primary/10 text-primary py-3 rounded-2xl font-semibold flex items-center justify-center gap-2">
                  <PlayCircle className="h-5 w-5" /> View Content
                </button>
              </div>
            </div>
          ))}

          {activeTab === 'mock-tests' && tests.length > 0 && tests.map((test: any) => (
            <div key={test.id} className="glass-strong p-6 rounded-3xl border border-border/50 hover:shadow-elegant flex flex-col h-full">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-3 rounded-2xl bg-green-500/10 text-green-500">
                  <FileText className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">{test.title}</h3>
                  <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full bg-background text-xs font-medium text-muted-foreground border">
                    {test.is_free ? "Free Test" : "Premium Batch"}
                  </span>
                </div>
              </div>
              <div className="mt-auto pt-4">
                <button className="w-full bg-green-500 text-white py-3 rounded-2xl font-semibold flex items-center justify-center gap-2">
                  <Calendar className="h-5 w-5" /> Start Test
                </button>
              </div>
            </div>
          ))}

          {((activeTab === 'batches' && batches.length === 0) || (activeTab === 'mock-tests' && tests.length === 0)) && (
            <div className="col-span-full py-16 px-4 text-center glass rounded-3xl border border-border/50">
              <h3 className="text-xl font-bold mb-2">No {activeTab.replace('-', ' ')} found</h3>
              <p className="text-muted-foreground">Once you enroll, they will appear right here.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
