import { useState, useEffect, useRef } from "react";
import { IoCall, IoVideocam, IoMic, IoMicOff, IoVideocamOff } from "react-icons/io5";
import { MdCallEnd } from "react-icons/md";

// Web Audio API Ringtone / Call Sound Synthesizer
const playRingtone = (audioCtxRef) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, ctx.currentTime); // Standard 440Hz / 480Hz US/UK ringtone pair
    osc.connect(gain);
    gain.connect(ctx.destination);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);

    // Pulse beep every 2s
    let isBeep = true;
    const interval = setInterval(() => {
      if (!audioCtxRef.current) {
        clearInterval(interval);
        return;
      }
      if (isBeep) {
        gain.gain.setValueAtTime(0, ctx.currentTime);
      } else {
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
      }
      isBeep = !isBeep;
    }, 1200);

    osc.start();
    return () => {
      clearInterval(interval);
      try {
        osc.stop();
        ctx.close();
      } catch (e) {}
    };
  } catch (err) {
    return () => {};
  }
};

const CallModal = ({ isOpen, onClose, partner, callType = "audio", onCallEnded }) => {
  const [callStatus, setCallStatus] = useState("Calling...");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(callType === "video");

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const timerRef = useRef(null);

  // Initialize media & call lifecycle
  useEffect(() => {
    if (!isOpen) return;

    setCallStatus("Calling...");
    setCallDuration(0);
    setIsVideoOn(callType === "video");

    // Start ringtone
    const stopAudio = playRingtone(audioCtxRef);

    // If video call, start local camera stream
    if (callType === "video" && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          localStreamRef.current = stream;
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn("Camera access fallback:", err);
          setIsVideoOn(false);
        });
    }

    // Progression: Calling -> Ringing -> Connected
    const ringTimeout = setTimeout(() => {
      setCallStatus("Ringing...");
    }, 1800);

    const connectTimeout = setTimeout(() => {
      setCallStatus("Connected");
      stopAudio(); // Stop ringtone when connected

      // Start duration counter
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }, 3800);

    return () => {
      clearTimeout(ringTimeout);
      clearTimeout(connectTimeout);
      stopAudio();
      if (timerRef.current) clearInterval(timerRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen, callType]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => (t.enabled = isMuted));
    }
    setIsMuted((prev) => !prev);
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((t) => (t.enabled = !isVideoOn));
    }
    setIsVideoOn((prev) => !prev);
  };

  const handleEndCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    onCallEnded &&
      onCallEnded({
        callType,
        duration: callDuration,
        status: callDuration > 0 ? "completed" : "missed",
      });

    onClose();
  };

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (!isOpen || !partner) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm sm:max-w-md h-full sm:h-[620px] bg-stone-900 border border-stone-800 sm:rounded-3xl shadow-2xl flex flex-col justify-between p-6 overflow-hidden">
        {/* Background glow or video stream */}
        {callType === "video" && (
          <div className="absolute inset-0 bg-stone-950 z-0">
            {isVideoOn ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-600 bg-stone-900">
                Camera off
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/80" />
          </div>
        )}

        {/* Top Info */}
        <div className="relative z-10 flex flex-col items-center mt-6 text-center">
          <span className="text-xs uppercase tracking-widest text-sky-400 font-semibold mb-1 flex items-center gap-1.5">
            {callType === "video" ? <IoVideocam /> : <IoCall />}
            <span>Winker {callType === "video" ? "Video Call" : "Voice Call"}</span>
          </span>

          <h3 className="text-2xl font-bold text-white mt-1">{partner.fullName}</h3>
          <p className="text-sm text-stone-400">@{partner.username}</p>

          <div className="mt-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium tracking-wide ${
                callStatus === "Connected"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-sky-500/20 text-sky-300 border border-sky-500/30 animate-pulse"
              }`}
            >
              {callStatus === "Connected" ? formatTimer(callDuration) : callStatus}
            </span>
          </div>
        </div>

        {/* Center: Partner Avatar (for audio calls or when camera is off) */}
        {callType === "audio" && (
          <div className="relative z-10 flex flex-col items-center my-auto">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-stone-700 shadow-2xl">
                <img
                  src={partner.profileImg || "/avatar-placeholder.png"}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/avatar-placeholder.png";
                  }}
                />
              </div>
              {callStatus !== "Connected" && (
                <div className="absolute inset-0 rounded-full border-4 border-sky-500/40 animate-ping pointer-events-none" />
              )}
            </div>
          </div>
        )}

        {/* Bottom Controls Bar */}
        <div className="relative z-10 flex items-center justify-around bg-black/60 backdrop-blur-md rounded-2xl py-4 px-6 border border-stone-800/80 mb-4 shadow-xl">
          {/* Mute button */}
          <button
            onClick={toggleMute}
            className={`p-3.5 rounded-full transition active:scale-95 ${
              isMuted
                ? "bg-red-500/20 text-red-400 border border-red-500/40"
                : "bg-stone-800 text-white hover:bg-stone-700"
            }`}
            title={isMuted ? "Unmute mic" : "Mute mic"}
          >
            {isMuted ? <IoMicOff className="w-6 h-6" /> : <IoMic className="w-6 h-6" />}
          </button>

          {/* End Call Button (Big Red) */}
          <button
            onClick={handleEndCall}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/40 active:scale-90 transition transform hover:scale-105"
            title="End call"
          >
            <MdCallEnd className="w-7 h-7" />
          </button>

          {/* Video Toggle Button (for video calls) */}
          {callType === "video" ? (
            <button
              onClick={toggleVideo}
              className={`p-3.5 rounded-full transition active:scale-95 ${
                !isVideoOn
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : "bg-stone-800 text-white hover:bg-stone-700"
              }`}
              title={isVideoOn ? "Turn off camera" : "Turn on camera"}
            >
              {isVideoOn ? <IoVideocam className="w-6 h-6" /> : <IoVideocamOff className="w-6 h-6" />}
            </button>
          ) : (
            <div className="w-13" />
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;
