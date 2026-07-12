import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, FileText, PlayCircle, Loader2, Calendar } from 'lucide-react';
import { getAccessibleContent } from '@/lib/auth-checks';

// YEH LINE 404 ERROR FIX KAREGI - Router ko pata chalega page yahan hai
export const Route = createFileRoute('/_authenticated/dashboard')({
  component: Dashboard,
});

export default function Dashboard() {
  const [content, setContent] = useState<{ tests: any[]; batches: any[] }>({ tests: [], batches: [] });
  const [activeTab, setActiveTab] = useState<'batches' | 'mock-tests'>('batches');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Data fetch with safety check so Vercel doesn't break
    getAccessibleContent('current_user_id')
      .then((data: any) => {
        if (data) {
          setContent(data);
        }
      })
      .catch((error: any) => {
        console.error("Error fetching content:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto min-h-screen">
      
      {/* HEADER SECTION */}
      <div className="mb-8 mt-4">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          Student Dashboard
        </h1>
        <p className="text-muted-foreground mt-2">
          Welcome back! Access your enrolled batches and mock tests below.
        </p>
      </div>

      {/* TABS SECTION */}
      <div className="flex space-x-6 border-b border-border mb-6">
        <button
