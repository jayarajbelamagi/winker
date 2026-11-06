import { useState, useEffect, useRef } from "react";
import { IoCall, IoVideocam, IoMic, IoMicOff, IoVideocamOff } from "react-icons/io5";
import { MdCallEnd } from "react-icons/md";
import { toast } from "react-hot-toast";

// Outgoing Ringback Sound Synthesizer (for Caller)
const playOutgoingRingback = (audioCtxRef) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return () => {};
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    let isPlaying = true;
    let timeoutId = null;

    const playRingCycle = () => {
      if (!isPlaying || ctx.state === "closed") return;

      const now = ctx.currentTime;
      // Dual tone: 440Hz + 480Hz standard ringback
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(480, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
      gain.gain.setValueAtTime(0.08, now + 1.4);
      gain.gain.linearRampToValueAtTime(0, now + 1.5);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.5);
      osc2.stop(now + 1.5);

      timeoutId = setTimeout(playRingCycle, 3500);
    };

    playRingCycle();

    return () => {
      isPlaying = false;
      if (timeoutId) clearTimeout(timeoutId);
      try {
        ctx.close();
      } catch (e) {}
    };
  } catch (err) {
    return () => {};
  }
};

// Busy / Declined Tone
const playBusyTone = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      const start = now + i * 0.35;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(480, start);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.setValueAtTime(0, start + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.22);
    }
    setTimeout(() => {
      try {
        ctx.close();
      } catch (e) {}
    }, 1200);
  } catch (e) {}
};

const CallModal = ({
  isOpen,
  callSession,
  currentUserId,
  onEndCall,
}) => {
  const [callStatus, setCallStatus] = useState("Connecting...");
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const ringbackAudioRef = useRef(null);
  const timerRef = useRef(null);

  const callType = callSession?.callType || "audio";
  const isCaller = callSession?.caller?._id === currentUserId?.toString();
  const partner = isCaller ? callSession?.receiver : callSession?.caller;

  // Initialize Media Stream (Microphone / Camera)
  useEffect(() => {
    if (!isOpen) return;

    setIsVideoOn(callType === "video");
    setIsMuted(false);

    if (navigator.mediaDevices?.getUserMedia) {
      const constraints = {
        audio: true,
        video: callType === "video",
      };

      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          localStreamRef.current = stream;
          if (localVideoRef.current && callType === "video") {
            localVideoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.warn("Could not access camera/mic:", err);
          setIsVideoOn(false);
        });
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    };
  }, [isOpen, callType]);

  // Handle call status transitions
  useEffect(() => {
    if (!isOpen || !callSession) return;

    const currentStatus = callSession.status;

    if (currentStatus === "ringing") {
      if (isCaller) {
        setCallStatus("Ringing...");
        if (!ringbackAudioRef.current) {
          ringbackAudioRef.current = playOutgoingRingback(ringbackAudioRef);
        }
      } else {
        setCallStatus("Connecting...");
      }
    } else if (currentStatus === "connected") {
      setCallStatus("Connected");
      // Stop outgoing ringback
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current();
        ringbackAudioRef.current = null;
      }

      // Calculate initial duration based on connectedAt
      if (callSession.connectedAt) {
        const elapsed = Math.floor((Date.now() - callSession.connectedAt) / 1000);
        setCallDuration(Math.max(0, elapsed));
      }

      // Start duration ticker if not already running
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    } else if (currentStatus === "declined") {
      setCallStatus("Call Declined");
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current();
        ringbackAudioRef.current = null;
      }
      playBusyTone();
      toast.error("Call was declined");
      const closeTimer = setTimeout(() => {
        onEndCall && onEndCall(callSession.callId, true);
      }, 2000);
      return () => clearTimeout(closeTimer);
    } else if (currentStatus === "ended" || currentStatus === "missed") {
      setCallStatus(currentStatus === "missed" ? "Missed Call" : "Call Ended");
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current();
        ringbackAudioRef.current = null;
      }
      const closeTimer = setTimeout(() => {
        onEndCall && onEndCall(callSession.callId, true);
      }, 1500);
      return () => clearTimeout(closeTimer);
    }

    return () => {
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current();
        ringbackAudioRef.current = null;
      }
    };
  }, [callSession?.status, callSession?.connectedAt, isOpen, isCaller]);

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current();
        ringbackAudioRef.current = null;
      }
    };
  }, []);

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach((t) => {
        t.enabled = isMuted;
      });
    }
    setIsMuted((prev) => !prev);
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      videoTracks.forEach((t) => {
        t.enabled = !isVideoOn;
      });
    }
    setIsVideoOn((prev) => !prev);
  };

  const handleEndCallClick = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (ringbackAudioRef.current) {
      ringbackAudioRef.current();
      ringbackAudioRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    if (callSession?.callId) {
      onEndCall && onEndCall(callSession.callId);
    }
  };

  const formatTimer = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (!isOpen || !callSession || !partner) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/85 backdrop-blur-xl animate-in fade-in duration-200">
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
              <div className="w-full h-full flex items-center justify-center text-stone-600 bg-stone-900 text-sm">
                Camera off
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/85" />
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
                  : callStatus === "Call Declined"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-sky-500/20 text-sky-300 border border-sky-500/30 animate-pulse"
              }`}
            >
              {callStatus === "Connected" ? formatTimer(callDuration) : callStatus}
            </span>
          </div>
        </div>

        {/* Center: Partner Avatar (for audio calls or camera off) */}
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
              {callStatus === "Ringing..." && (
                <div className="absolute inset-0 rounded-full border-4 border-sky-500/40 animate-ping pointer-events-none" />
              )}
              {callStatus === "Connected" && (
                <div className="absolute -inset-2 rounded-full border-2 border-emerald-400/30 animate-pulse pointer-events-none" />
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
            onClick={handleEndCallClick}
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
            <div className="w-12" />
          )}
        </div>
      </div>
    </div>
  );
};

export default CallModal;
