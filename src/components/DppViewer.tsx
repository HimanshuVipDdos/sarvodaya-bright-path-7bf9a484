import { useState } from 'react';
import { ChevronLeft, Download, Maximize2 } from 'lucide-react';

export function DppViewer({ pdfUrl, title }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <div className={`flex flex-col h-screen bg-gray-100 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* HEADER: PW/Unacademy Style */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-6 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={() => window.history.back()} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronLeft size={20} />
          </button>
          <h1 className="font-bold text-gray-800">{title}</h1>
        </div>
        
        <div className="flex items-center gap-4">
          <a href={pdfUrl} download target="_blank" className="text-gray-600 hover:text-indigo-600 flex items-center gap-2 text-sm font-medium">
            <Download size={18} /> Download
          </a>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="text-gray-600 hover:text-indigo-600">
            <Maximize2 size={18} />
          </button>
          {/* Small Branding */}
          <span className="text-[10px] text-gray-300 ml-4">Extreme OG</span>
        </div>
      </div>

      {/* PDF VIEWER CONTAINER */}
      <div className="flex-1 w-full overflow-hidden">
        {/* Google Docs Viewer (Sabse stable tareeka bina kisi heavy library ke) */}
        <iframe 
          src={`https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true`} 
          className="w-full h-full border-none"
          title="DPP Viewer"
        />
      </div>
    </div>
  );
}
