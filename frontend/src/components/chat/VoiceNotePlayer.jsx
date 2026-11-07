import { useState, useRef, useEffect } from "react";
import { IoPlay, IoPause } from "react-icons/io5";
import { BsSoundwave } from "react-icons/bs";

const formatAudioTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const VoiceNotePlayer = ({ audioUrl, duration = 0, isMine = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1); // 1x, 1.5x, 2x
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = speed;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleCycleSpeed = () => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleScrub = (e) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const totalTime = duration || audioRef.current?.duration || 0;

  return (
    <div className={`flex items-center gap-2.5 py-1 px-1 min-w-[200px] sm:min-w-[240px]`}>
      {/* Play / Pause Circular Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition shadow ${
          isMine
            ? "bg-white text-blue-600 hover:bg-stone-100"
            : "bg-primary text-white hover:bg-primary/90"
        }`}
      >
        {isPlaying ? (
          <IoPause className="w-4 h-4" />
        ) : (
          <IoPlay className="w-4 h-4 ml-0.5" />
        )}
      </button>

      {/* Progress & Waveform */}
      <div className="flex-1 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5">
          <BsSoundwave className={`w-3.5 h-3.5 ${isPlaying ? "animate-pulse" : ""}`} />
          <input
            type="range"
            min="0"
            max={totalTime || 100}
            value={currentTime}
            onChange={handleScrub}
            className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer ${
              isMine ? "accent-white bg-blue-400" : "accent-primary bg-stone-700"
            }`}
          />
        </div>

        <div className="flex justify-between items-center text-[10px] opacity-80 font-mono">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{formatAudioTime(totalTime)}</span>
        </div>
      </div>

      {/* Speed Button (1x / 1.5x / 2x) */}
      <button
        type="button"
        onClick={handleCycleSpeed}
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
          isMine
            ? "border-white/40 text-white hover:bg-white/10"
            : "border-stone-700 text-stone-300 hover:bg-stone-800"
        }`}
        title="Cycle playback speed"
      >
        {speed}x
      </button>
    </div>
  );
};

export default VoiceNotePlayer;
