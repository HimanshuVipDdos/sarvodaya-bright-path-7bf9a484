import React from 'react';
import { LiveChat } from './live-chat';

export function LiveClassPlayer({ videoUrl, classId }: { videoUrl: string, classId: string }) {
  return (
    <div className="w-full max-w-[1600px] mx-auto p-4">
      {/* Grid Layout: YouTube Style */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Large Resolution Video Player */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg group">
            <video 
              src={videoUrl} 
              controls 
              className="w-full h-full object-contain"
              playsInline
            />
          </div>
          <h1 className="text-xl font-bold mt-2">Live Interactive Session</h1>
        </div>

        {/* Right Side: YouTube Style Comments/Chat UI */}
        <div className="lg:col-span-1 h-[calc(100vh-200px)] min-h-[500px] max-h-[700px] flex flex-col border border-border rounded-xl bg-card overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/50">
            <h2 className="font-semibold text-sm uppercase tracking-wider">Live Chat / Comments</h2>
          </div>
          <div className="flex-1 overflow-hidden">
            <LiveChat classId={classId} />
          </div>
        </div>

      </div>
    </div>
  );
}
