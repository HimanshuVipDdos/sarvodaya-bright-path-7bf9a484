import { useRef, useState, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { Play, Pause, FastForward, Rewind, Maximize, Minimize, MessageSquare } from 'lucide-react';
import { LiveChatBox } from './LiveChatBox';

export function LiveLecturePlayer({ url, classId, userProfile }) {
  const playerRef = useRef(null);
  const containerRef = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(true);

  // Fullscreen Handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleChange);
    return () => document.removeEventListener('fullscreenchange', handleChange);
  }, []);

  return (
    <div ref={containerRef} className="relative flex w-full bg-black h-[500px] overflow-hidden rounded-xl">
      {/* Player Section */}
      <div className={`relative ${showChat ? 'flex-1' : 'w-full'} h-full`}>
        <ReactPlayer
          ref={playerRef}
          url={url}
          width="100%"
          height="100%"
          playing={playing}
          playbackRate={playbackRate}
          controls={false} // YouTube controls hidden
          config={{
            youtube: {
              playerVars: { modestbranding: 1, rel: 0, disablekb: 1, fs: 0 }
            }
          }}
        />

        {/* Custom Overlay Controls */}
        <div className="absolute bottom-0 w-full p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 hover:opacity-100 transition-opacity flex justify-between items-center text-white">
          <div className="flex gap-4">
            <button onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}</button>
            <button onClick={() => playerRef.current?.seekTo(playerRef.current.getCurrentTime() - 10)}><Rewind /></button>
            <button onClick={() => playerRef.current?.seekTo(playerRef.current.getCurrentTime() + 10)}><FastForward /></button>
          </div>
          
          <div className="flex gap-4 items-center">
            <select onChange={(e) => setPlaybackRate(parseFloat(e.target.value))} className="bg-transparent text-xs">
              <option value="1">1x</option>
              <option value="1.5">1.5x</option>
              <option value="2">2x</option>
            </select>
            <button onClick={() => setShowChat(!showChat)}><MessageSquare /></button>
            <button onClick={toggleFullscreen}>{isFullscreen ? <Minimize /> : <Maximize />}</button>
          </div>
        </div>
      </div>

      {/* Chat Section */}
      {showChat && (
        <div className={`w-[320px] bg-white border-l h-full flex flex-col ${isFullscreen ? 'fixed right-0 z-50' : ''}`}>
           <LiveChatBox classId={classId} userProfile={userProfile} />
        </div>
      )}
    </div>
  );
}
