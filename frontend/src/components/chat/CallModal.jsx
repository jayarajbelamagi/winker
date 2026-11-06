import { useState, useEffect, useRef } from "react";
import {
  IoCall,
  IoVideocam,
  IoMic,
  IoMicOff,
  IoVideocamOff,
  IoCameraReverse,
} from "react-icons/io5";
import { MdCallEnd } from "react-icons/md";
import { toast } from "react-hot-toast";
import { apiFetch } from "../../lib/api";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

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
  const [facingMode, setFacingMode] = useState("user"); // "user" or "environment"
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [isPiPSwapped, setIsPiPSwapped] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const pcRef = useRef(null);
  const ringbackAudioRef = useRef(null);
  const timerRef = useRef(null);
  const signalingPollRef = useRef(null);

  const callType = callSession?.callType || "audio";
  const myIdStr = currentUserId?.toString();
  const isCaller =
    callSession?.caller?._id === myIdStr ||
    callSession?.callerId?.toString() === myIdStr;
  const partner = isCaller ? callSession?.receiver : callSession?.caller;

  // 1. Initialize Local Media Stream (Camera / Mic)
  useEffect(() => {
    if (!isOpen) return;

    setIsVideoOn(callType === "video");
    setIsMuted(false);
    setHasRemoteStream(false);
    setIsPiPSwapped(false);

    if (navigator.mediaDevices?.getUserMedia) {
      const constraints = {
        audio: true,
        video:
          callType === "video"
            ? { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } }
            : false,
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
  }, [isOpen, callType, facingMode]);

  // 2. WebRTC Peer Connection & Real-Time Signaling
  useEffect(() => {
    if (!isOpen || !callSession?.callId || callSession.status !== "connected") return;

    let isMounted = true;
    const callId = callSession.callId;

    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Add local media tracks to peer connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      // Handle incoming remote media tracks
      pc.ontrack = (event) => {
        if (!isMounted) return;
        if (event.streams && event.streams[0]) {
          setHasRemoteStream(true);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = event.streams[0];
          }
        }
      };

      // Negotiation: Caller creates Offer, Receiver creates Answer
      if (isCaller) {
        pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === "video" })
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            return apiFetch(`/api/messages/call/signal/${callId}`, {
              method: "POST",
              body: JSON.stringify({ senderType: "caller", signalData: pc.localDescription }),
            });
          })
          .catch((err) => console.warn("WebRTC offer error:", err));

        // Poll for Receiver's Answer
        signalingPollRef.current = setInterval(async () => {
          if (!isMounted || pc.currentRemoteDescription) return;
          try {
            const res = await apiFetch(`/api/messages/call/signal/${callId}`);
            if (res.ok) {
              const data = await res.json();
              if (data?.receiverSignal && !pc.currentRemoteDescription) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.receiverSignal));
              }
            }
          } catch (e) {}
        }, 1200);
      } else {
        // Receiver polls for Caller's Offer, then responds with Answer
        signalingPollRef.current = setInterval(async () => {
          if (!isMounted || pc.currentRemoteDescription) return;
          try {
            const res = await apiFetch(`/api/messages/call/signal/${callId}`);
            if (res.ok) {
              const data = await res.json();
              if (data?.callerSignal && !pc.currentRemoteDescription) {
                await pc.setRemoteDescription(new RTCSessionDescription(data.callerSignal));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                await apiFetch(`/api/messages/call/signal/${callId}`, {
                  method: "POST",
                  body: JSON.stringify({ senderType: "receiver", signalData: answer }),
                });
              }
            }
          } catch (e) {}
        }, 1200);
      }
    } catch (err) {
      console.warn("WebRTC initialization fallback:", err);
    }

    return () => {
      isMounted = false;
      if (signalingPollRef.current) clearInterval(signalingPollRef.current);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [isOpen, callSession?.status, callSession?.callId, isCaller, callType]);

  // 3. Handle Call Status Lifecycle (Ringing -> Connected -> Declined/Ended)
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
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current();
        ringbackAudioRef.current = null;
      }

      // Synchronize timer with connectedAt
      if (callSession.connectedAt) {
        const elapsed = Math.floor((Date.now() - callSession.connectedAt) / 1000);
        setCallDuration(Math.max(0, elapsed));
      }

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

  // 4. Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (ringbackAudioRef.current) ringbackAudioRef.current();
      if (signalingPollRef.current) clearInterval(signalingPollRef.current);
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

  const flipCamera = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    toast.success(`Switched to ${nextMode === "user" ? "Front" : "Rear"} Camera`);
  };

  const handleEndCallClick = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (ringbackAudioRef.current) ringbackAudioRef.current();
    if (signalingPollRef.current) clearInterval(signalingPollRef.current);
    if (pcRef.current) pcRef.current.close();
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

  const isConnected = callStatus === "Connected";

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 backdrop-blur-2xl animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm sm:max-w-lg h-full sm:h-[680px] bg-stone-950 border border-stone-800 sm:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden">
        
        {/* ================= VIDEO CALL MAIN STAGE ================= */}
        {callType === "video" && (
          <div className="absolute inset-0 bg-stone-950 z-0 overflow-hidden">
            {/* Remote Partner Video Stream */}
            {isConnected && hasRemoteStream ? (
              <video
                ref={isPiPSwapped ? localVideoRef : remoteVideoRef}
                autoPlay
                playsInline
                className={`w-full h-full object-cover ${isPiPSwapped ? "scale-x-[-1]" : ""}`}
              />
            ) : (
              /* Fallback Animated Stage while video initializes */
              <div className="w-full h-full flex flex-col items-center justify-center relative bg-gradient-to-b from-stone-900 via-stone-950 to-black px-6 text-center">
                <div className="relative mb-6">
                  <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-stone-700 shadow-2xl">
                    <img
                      src={partner.profileImg || "/avatar-placeholder.png"}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {/* Subtle animated soundwaves */}
                  {isConnected && (
                    <div className="absolute -inset-4 rounded-full border-2 border-emerald-500/40 animate-ping pointer-events-none" />
                  )}
                  {callStatus === "Ringing..." && (
                    <div className="absolute inset-0 rounded-full border-4 border-sky-500/40 animate-ping pointer-events-none" />
                  )}
                </div>

                <h4 className="text-xl font-bold text-white mb-1">{partner.fullName}</h4>
                <p className="text-xs text-stone-400 mb-3">@{partner.username}</p>

                {isConnected && !hasRemoteStream && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Live Video Connected</span>
                  </div>
                )}
              </div>
            )}

            {/* Ambient vignette gradients */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none" />

            {/* ================= FLOATING PICTURE-IN-PICTURE (PiP) PREVIEW ================= */}
            <div
              onClick={() => setIsPiPSwapped((prev) => !prev)}
              className="absolute top-20 right-4 z-20 w-28 h-40 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border-2 border-stone-700/80 bg-stone-900 shadow-2xl cursor-pointer transition transform hover:scale-105 active:scale-95 group"
              title="Tap to switch view"
            >
              {isVideoOn ? (
                <video
                  ref={isPiPSwapped ? remoteVideoRef : localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${!isPiPSwapped ? "scale-x-[-1]" : ""}`}
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-stone-900 text-stone-500 text-[10px] p-2 text-center">
                  <IoVideocamOff className="w-6 h-6 mb-1 text-stone-600" />
                  <span>Camera off</span>
                </div>
              )}
              <div className="absolute bottom-1 left-2 text-[10px] font-semibold text-white/80 bg-black/60 px-1.5 py-0.5 rounded-md pointer-events-none">
                {isPiPSwapped ? partner.username : "You"}
              </div>
            </div>
          </div>
        )}

        {/* ================= AUDIO CALL MAIN STAGE ================= */}
        {callType === "audio" && (
          <div className="relative z-10 flex flex-col items-center my-auto px-6 text-center">
            <div className="relative mb-6">
              <div className="w-36 h-36 rounded-full overflow-hidden border-4 border-stone-700 shadow-2xl">
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
              {isConnected && (
                <>
                  <div className="absolute -inset-3 rounded-full border-2 border-emerald-400/30 animate-pulse pointer-events-none" />
                  <div className="absolute -inset-6 rounded-full border border-emerald-400/15 animate-ping pointer-events-none" />
                </>
              )}
            </div>

            <h3 className="text-2xl font-bold text-white mb-1">{partner.fullName}</h3>
            <p className="text-sm text-stone-400 mb-4">@{partner.username}</p>

            {/* Audio Wave Visualizer Bars */}
            {isConnected && (
              <div className="flex items-center gap-1.5 h-6 my-2">
                <span className="w-1 bg-emerald-400 rounded-full animate-bounce h-3" />
                <span className="w-1 bg-emerald-400 rounded-full animate-bounce h-6 delay-75" />
                <span className="w-1 bg-emerald-400 rounded-full animate-bounce h-4 delay-150" />
                <span className="w-1 bg-emerald-400 rounded-full animate-bounce h-7 delay-100" />
                <span className="w-1 bg-emerald-400 rounded-full animate-bounce h-2 delay-200" />
              </div>
            )}
          </div>
        )}

        {/* ================= TOP HEADER INFO ================= */}
        <div className="relative z-10 flex flex-col items-center mt-6 px-6 text-center">
          <span className="text-xs uppercase tracking-widest text-sky-400 font-semibold mb-1 flex items-center gap-1.5">
            {callType === "video" ? <IoVideocam /> : <IoCall />}
            <span>Winker {callType === "video" ? "Video Call" : "Voice Call"}</span>
          </span>

          {callType === "video" && (
            <h3 className="text-lg font-bold text-white truncate max-w-xs">{partner.fullName}</h3>
          )}

          <div className="mt-2">
            <span
              className={`px-3.5 py-1 rounded-full text-xs font-semibold tracking-wide ${
                callStatus === "Connected"
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : callStatus === "Call Declined"
                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                  : "bg-sky-500/20 text-sky-300 border border-sky-500/30 animate-pulse"
              }`}
            >
              {callStatus === "Connected" ? formatTimer(callDuration) : callStatus}
            </span>
          </div>
        </div>

        {/* ================= BOTTOM IN-CALL CONTROLS ================= */}
        <div className="relative z-10 flex items-center justify-around bg-black/70 backdrop-blur-xl rounded-2xl py-4 px-6 border border-stone-800 mx-4 mb-5 shadow-2xl">
          {/* Mute Mic Button */}
          <button
            onClick={toggleMute}
            className={`p-3.5 rounded-full transition active:scale-95 ${
              isMuted
                ? "bg-red-500/25 text-red-400 border border-red-500/40"
                : "bg-stone-800 text-white hover:bg-stone-700"
            }`}
            title={isMuted ? "Unmute mic" : "Mute mic"}
          >
            {isMuted ? <IoMicOff className="w-6 h-6" /> : <IoMic className="w-6 h-6" />}
          </button>

          {/* Flip Camera Button (Video only) */}
          {callType === "video" ? (
            <button
              onClick={flipCamera}
              className="p-3.5 rounded-full bg-stone-800 text-white hover:bg-stone-700 transition active:scale-95"
              title="Flip Camera (Front/Rear)"
            >
              <IoCameraReverse className="w-6 h-6" />
            </button>
          ) : null}

          {/* Video Toggle Button (Video only) */}
          {callType === "video" ? (
            <button
              onClick={toggleVideo}
              className={`p-3.5 rounded-full transition active:scale-95 ${
                !isVideoOn
                  ? "bg-red-500/25 text-red-400 border border-red-500/40"
                  : "bg-stone-800 text-white hover:bg-stone-700"
              }`}
              title={isVideoOn ? "Turn camera off" : "Turn camera on"}
            >
              {isVideoOn ? <IoVideocam className="w-6 h-6" /> : <IoVideocamOff className="w-6 h-6" />}
            </button>
          ) : null}

          {/* End Call Button (Big Red) */}
          <button
            onClick={handleEndCallClick}
            className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white shadow-xl shadow-red-600/40 active:scale-90 transition transform hover:scale-105"
            title="End Call"
          >
            <MdCallEnd className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallModal;
