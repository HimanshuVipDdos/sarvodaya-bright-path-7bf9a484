import React, { useState } from "react";
import { VideoPlayer } from "./VideoPlayer";

export default function LiveStreamRoom() {
  const [chatMessages, setChatMessages] = useState<string[]>([]);
  const [typedMessage, setTypedMessage] = useState("");

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (typedMessage.trim()) {
      setChatMessages([...chatMessages, typedMessage]);
      setTypedMessage("");
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4 max-w-7xl mx-auto">
      {/* Video Section */}
      <div className="lg:col-span-2">
        <VideoPlayer
          src="https://mux.com" // Replace with your HLS/DASH/MP4 url
          poster="https://mux.com"
          title="Live Q&A Session"
          isLive={true}
        />
        <div className="mt-4">
          <h1 className="text-xl font-bold text-white">Live Session Title</h1>
          <p className="text-gray-400">Welcome to the live broadcast. Chat is live below.</p>
        </div>
      </div>

      {/* Live Chat Section */}
      <div className="flex flex-col h-[500px] bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-800 bg-gray-800 text-white font-semibold">
          Live Chat
        </div>
        
        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-2 text-sm text-gray-200">
          {chatMessages.length === 0 ? (
            <div className="text-gray-500 text-center mt-10">No messages yet. Say hi!</div>
          ) : (
            chatMessages.map((msg, idx) => (
              <div key={idx} className="p-2 bg-gray-800 rounded-md">
                <span className="font-bold text-blue-400">User: </span>
                {msg}
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-800 bg-gray-800">
          <div className="flex gap-2">
            <input
              type="text"
              value={typedMessage}
              onChange={(e) => setTypedMessage(e.target.value)}
              placeholder="Send a message..."
              className="flex-1 bg-gray-900 text-white p-2 rounded-md border border-gray-700 focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-500 transition-colors"
            >
              Chat
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
