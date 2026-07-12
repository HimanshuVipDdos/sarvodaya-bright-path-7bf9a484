import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client'; // Yahan apna supabase client import kar

export default function CBTTestPage() {
  const [questions, setQuestions] = useState([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [visited, setVisited] = useState(new Set([0]));
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);

  // 1. Data Fetching (Admin Panel se)
  useEffect(() => {
    async function fetchData() {
      // Yahan apne database table ka naam daal dena (e.g., 'cbt_questions')
      const { data, error } = await supabase.from('cbt_tests').select('*').single();
      if (data) {
        setQuestions(data.questions);
        setTimeLeft(data.duration_minutes * 60); // Admin panel ka time
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // 2. Auto-Submit Function
  const handleAutoSubmit = useCallback(async () => {
    alert("Test submitted!");
    // Yahan apna submit logic (DB update) daal dena
    // await supabase.from('submissions').insert({ ... });
  }, []);

  // 3. Timer Logic
  useEffect(() => {
    if (loading || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, loading, handleAutoSubmit]);

  // 4. Anti-Cheat (Tab Change)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        alert("Tab change detected! Test submitting...");
        handleAutoSubmit();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [handleAutoSubmit]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) return <div>Loading Test...</div>;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* HEADER: Clean Branding */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-6 shadow-sm">
        <div className="font-bold text-gray-800">Test: {questions[currentIdx]?.test_name}</div>
        <div className="text-red-600 font-bold px-4 py-1 bg-red-50 rounded-md border border-red-200">
          Time: {formatTime(timeLeft)}
        </div>
        <div className="text-[10px] text-gray-400 font-semibold tracking-wider">
          Made By Extreme OG
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* MAIN QUESTION AREA (70%) */}
        <div className="flex-1 p-8 overflow-y-auto">
           <div className="mb-6 text-xl font-medium">Q{currentIdx + 1}. {questions[currentIdx]?.question_text}</div>
           <div className="grid gap-3">
             {questions[currentIdx]?.options.map((opt, i) => (
               <button 
                key={i}
                onClick={() => setAnswers({...answers, [currentIdx]: i})}
                className={`p-4 text-left border rounded-lg transition ${answers[currentIdx] === i ? 'bg-blue-100 border-blue-500' : 'bg-white hover:bg-gray-50'}`}
               >
                 {opt}
               </button>
             ))}
           </div>
        </div>

        {/* QUESTION PALETTE (30%) */}
        <div className="w-80 bg-white border-l p-4 flex flex-col">
           <div className="text-sm font-semibold mb-4 text-gray-600">Question Palette</div>
           <div className="grid grid-cols-5 gap-2 content-start">
             {questions.map((_, i) => (
               <button 
                key={i} 
                onClick={() => { setCurrentIdx(i); setVisited(new Set(visited).add(i)); }}
                className={`w-10 h-10 rounded text-sm font-medium transition ${currentIdx === i ? 'bg-blue-600 text-white' : answers.hasOwnProperty(i) ? 'bg-green-500 text-white' : visited.has(i) ? 'bg-gray-200' : 'bg-white border'}`}
               >
                 {i + 1}
               </button>
             ))}
           </div>
           
           <button 
            className="w-full mt-auto bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition"
            onClick={handleAutoSubmit}
           >
             Submit Test
           </button>
        </div>
      </div>
    </div>
  );
}
