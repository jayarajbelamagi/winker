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

// STUN + Global OpenRelay TURN servers (Ports 80 & 443 with UDP, TCP, TLS)
// Bypasses Symmetric NAT, CGNAT (Jio, Airtel, Vi, mobile hotspots), and firewalls
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
    { urls: "stun:openrelay.metered.ca:80" },
    {
      urls: [
        "turn:openrelay.metered.ca:80",
        "turn:openrelay.metered.ca:443",
        "turn:openrelay.metered.ca:443?transport=tcp",
        "turns:openrelay.metered.ca:443?transport=tcp",
      ],
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
  iceCandidatePoolSize: 10,
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

// Helper: Safely stop all tracks on a MediaStream
const stopMediaStream = (stream) => {
  if (!stream) return;
  try {
    const tracks = typeof stream.getTracks === "function" ? stream.getTracks() : [];
    tracks.forEach((track) => {
      try {
        track.stop();
        track.enabled = false;
      } catch (e) {}
    });
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
  const [localStream, setLocalStream] = useState(null);
  const [hasRemoteStream, setHasRemoteStream] = useState(false);
  const [isPiPSwapped, setIsPiPSwapped] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState("connecting"); // "connecting" | "live" | "reconnecting"

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteMediaStreamRef = useRef(null);
  const pcRef = useRef(null);
  const ringbackAudioRef = useRef(null);
  const timerRef = useRef(null);
  const signalingPollRef = useRef(null);
  const remoteDescSetRef = useRef(false);
  const addedCandidatesRef = useRef(new Set());
  const isSignalingRef = useRef(false);

  const callType = callSession?.callType || "audio";
  const myIdStr = (currentUserId || callSession?.currentUserId)?.toString();
  const isCaller =
    callSession?.caller?._id === myIdStr ||
    callSession?.callerId?.toString() === myIdStr;
  const partner = isCaller
    ? callSession?.receiver || (callSession?.isGroupCall ? {
        fullName: callSession.groupName || "Group Call",
        username: "group",
        profileImg: "/avatar-placeholder.png",
      } : null)
    : callSession?.caller || (callSession?.isGroupCall ? {
        fullName: callSession.groupName || "Group Call",
        username: "group",
        profileImg: "/avatar-placeholder.png",
      } : null);

  // Complete, foolproof hardware shutdown function (Camera LED & Mic guaranteed off)
  const cleanupCallHardware = () => {
    // 1. Stop local stream ref tracks (shuts down laptop camera & mic hardware)
    if (localStreamRef.current) {
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
    }

    // 2. Stop localStream state tracks
    if (localStream) {
      stopMediaStream(localStream);
    }

    // 3. Stop remote media stream ref
    if (remoteMediaStreamRef.current) {
      stopMediaStream(remoteMediaStreamRef.current);
      remoteMediaStreamRef.current = null;
    }

    // 4. Detach from local video element and release hardware camera sink
    if (localVideoRef.current) {
      try {
        localVideoRef.current.pause();
        localVideoRef.current.srcObject = null;
      } catch (e) {}
    }

    // 5. Detach from remote video element
    if (remoteVideoRef.current) {
      try {
        remoteVideoRef.current.pause();
        remoteVideoRef.current.srcObject = null;
      } catch (e) {}
    }

    // 6. Detach from remote audio element
    if (remoteAudioRef.current) {
      try {
        remoteAudioRef.current.pause();
        remoteAudioRef.current.srcObject = null;
      } catch (e) {}
    }

    // 7. Close peer connection
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }

    setLocalStream(null);
    setHasRemoteStream(false);
  };

  // 1. Initialize Local Media Stream (Camera / Mic)
  useEffect(() => {
    if (!isOpen) {
      cleanupCallHardware();
      return;
    }

    setIsVideoOn(callType === "video");
    setIsMuted(false);
    setHasRemoteStream(false);
    setIsPiPSwapped(false);
    remoteDescSetRef.current = false;
    addedCandidatesRef.current.clear();
    setConnectionHealth("connecting");
    remoteMediaStreamRef.current = new MediaStream();

    if (navigator.mediaDevices?.getUserMedia) {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video:
          callType === "video"
            ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
            : false,
      };

      navigator.mediaDevices
        .getUserMedia(constraints)
        .then((stream) => {
          localStreamRef.current = stream;
          setLocalStream(stream);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(() => {});
          }
        })
        .catch((err) => {
          console.warn("Could not access camera/mic with ideal constraints:", err);
          setIsVideoOn(false);
          // Fallback to basic audio
          navigator.mediaDevices
            ?.getUserMedia({ audio: true })
            .then((stream) => {
              localStreamRef.current = stream;
              setLocalStream(stream);
            })
            .catch(() => {});
        });
    }

    return () => {
      cleanupCallHardware();
    };
  }, [isOpen, callType]);

  // Keep local video element bound whenever stream or element mounts
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isVideoOn]);

  // 2. WebRTC Peer Connection & Real-Time Signaling (Runs when call is connected and localStream is ready)
  useEffect(() => {
    if (!isOpen || !callSession?.callId || callSession.status !== "connected" || !localStream) {
      return;
    }

    let isMounted = true;
    const callId = callSession.callId;

    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      // Add all local tracks into the peer connection
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // Trickle ICE candidate event with immediate delivery
      pc.onicecandidate = (event) => {
        if (event.candidate && isMounted) {
          apiFetch(`/api/messages/call/signal/${callId}`, {
            method: "POST",
            body: JSON.stringify({
              senderType: isCaller ? "caller" : "receiver",
              candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
            }),
          }).catch(() => {});
        }
      };

      // Connection health and auto-recovery
      pc.oniceconnectionstatechange = () => {
        if (!isMounted) return;
        const state = pc.iceConnectionState;
        console.log("ICE Connection State:", state);
        if (state === "connected" || state === "completed") {
          setConnectionHealth("live");
        } else if (state === "checking") {
          setConnectionHealth("connecting");
        } else if (state === "failed") {
          console.warn("ICE connection failed, attempting ICE restart...");
          setConnectionHealth("reconnecting");
          try {
            if (typeof pc.restartIce === "function") {
              pc.restartIce();
            }
          } catch (e) {}
        } else if (state === "disconnected") {
          setConnectionHealth("reconnecting");
        }
      };

      // Handle incoming remote media tracks (Audio & Video)
      pc.ontrack = (event) => {
        if (!isMounted) return;
        console.log("WebRTC ontrack received track:", event.track.kind);

        if (!remoteMediaStreamRef.current) {
          remoteMediaStreamRef.current = new MediaStream();
        }

        // Add track into persistent remote stream if not already attached
        const currentTracks = remoteMediaStreamRef.current.getTracks();
        if (!currentTracks.some((t) => t.id === event.track.id)) {
          remoteMediaStreamRef.current.addTrack(event.track);
        }

        // Bind remote video element directly
        if (remoteVideoRef.current) {
          if (remoteVideoRef.current.srcObject !== remoteMediaStreamRef.current) {
            remoteVideoRef.current.srcObject = remoteMediaStreamRef.current;
          }
          remoteVideoRef.current.play().catch(() => {});
        }

        // Bind dedicated remote audio element directly
        if (remoteAudioRef.current) {
          if (remoteAudioRef.current.srcObject !== remoteMediaStreamRef.current) {
            remoteAudioRef.current.srcObject = remoteMediaStreamRef.current;
          }
          remoteAudioRef.current.play().catch(() => {});
        }

        setHasRemoteStream(true);
        setConnectionHealth("live");
      };

      // Negotiation Logic
      if (isCaller) {
        // Caller creates offer and sets local description
        pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: callType === "video",
        })
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            if (!isMounted) return;
            return apiFetch(`/api/messages/call/signal/${callId}`, {
              method: "POST",
              body: JSON.stringify({
                senderType: "caller",
                signalData: pc.localDescription,
              }),
            });
          })
          .catch((err) => console.warn("WebRTC offer error:", err));

        // Poll for Receiver's Answer and trickled candidates
        signalingPollRef.current = setInterval(async () => {
          if (!isMounted || isSignalingRef.current) return;
          isSignalingRef.current = true;
          try {
            const res = await apiFetch(`/api/messages/call/signal/${callId}`);
            if (!res.ok) return;
            const data = await res.json();

            // Set remote answer
            if (data?.receiverSignal && !remoteDescSetRef.current && pc.signalingState === "have-local-offer") {
              remoteDescSetRef.current = true;
              await pc.setRemoteDescription(new RTCSessionDescription(data.receiverSignal));
            }

            // Apply any trickle candidates from receiver
            if (Array.isArray(data?.receiverCandidates) && pc.remoteDescription) {
              for (const cand of data.receiverCandidates) {
                const key = cand.candidate || JSON.stringify(cand);
                if (cand && !addedCandidatesRef.current.has(key)) {
                  addedCandidatesRef.current.add(key);
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (e) {}
                }
              }
            }
          } catch (e) {
          } finally {
            isSignalingRef.current = false;
          }
        }, 800);
      } else {
        // Receiver polls for Caller's Offer, responds with Answer
        signalingPollRef.current = setInterval(async () => {
          if (!isMounted || isSignalingRef.current) return;
          isSignalingRef.current = true;
          try {
            const res = await apiFetch(`/api/messages/call/signal/${callId}`);
            if (!res.ok) return;
            const data = await res.json();

            // Receive offer, create answer
            if (data?.callerSignal && !remoteDescSetRef.current && pc.signalingState === "stable") {
              remoteDescSetRef.current = true;
              await pc.setRemoteDescription(new RTCSessionDescription(data.callerSignal));
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              if (isMounted) {
                await apiFetch(`/api/messages/call/signal/${callId}`, {
                  method: "POST",
                  body: JSON.stringify({
                    senderType: "receiver",
                    signalData: pc.localDescription,
                  }),
                });
              }
            }

            // Apply any trickle candidates from caller
            if (Array.isArray(data?.callerCandidates) && pc.remoteDescription) {
              for (const cand of data.callerCandidates) {
                const key = cand.candidate || JSON.stringify(cand);
                if (cand && !addedCandidatesRef.current.has(key)) {
                  addedCandidatesRef.current.add(key);
                  try {
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                  } catch (e) {}
                }
              }
            }
          } catch (e) {
          } finally {
            isSignalingRef.current = false;
          }
        }, 800);
      }
    } catch (err) {
      console.warn("WebRTC initialization error:", err);
    }

    return () => {
      isMounted = false;
      if (signalingPollRef.current) clearInterval(signalingPollRef.current);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [isOpen, callSession?.status, callSession?.callId, isCaller, callType, localStream]);

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
      cleanupCallHardware();
      playBusyTone();
      setTimeout(() => {
        handleEndCallClick();
      }, 2000);
    } else if (currentStatus === "ended" || currentStatus === "missed") {
      setCallStatus(currentStatus === "missed" ? "Missed Call" : "Call Ended");
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current();
        ringbackAudioRef.current = null;
      }
      // Immediately shut down camera and mic hardware so laptop camera LED turns off at once!
      cleanupCallHardware();
      setTimeout(() => {
        handleEndCallClick();
      }, 1500);
    }

    return () => {
      if (ringbackAudioRef.current) {
        ringbackAudioRef.current();
        ringbackAudioRef.current = null;
      }
    };
  }, [callSession?.status, callSession?.connectedAt, isOpen, isCaller]);

  // 4. Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupCallHardware();
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

  // Switch front and rear cameras seamlessly via replaceTrack
  const flipCamera = async () => {
    if (callType !== "video") return;
    const nextMode = facingMode === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      // If call was ended while camera was initializing:
      if (!localStreamRef.current) {
        stopMediaStream(newStream);
        return;
      }
      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        // Stop any other unused tracks in newStream
        newStream.getTracks().forEach((t) => {
          if (t !== newVideoTrack) t.stop();
        });

        if (localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            oldVideoTrack.stop();
            oldVideoTrack.enabled = false;
            localStreamRef.current.removeTrack(oldVideoTrack);
          }
          localStreamRef.current.addTrack(newVideoTrack);
        }
        if (pcRef.current) {
          const sender = pcRef.current.getSenders().find((s) => s.track && s.track.kind === "video");
          if (sender) {
            await sender.replaceTrack(newVideoTrack);
          }
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        setFacingMode(nextMode);
        toast.success(`Switched to ${nextMode === "user" ? "Front" : "Rear"} Camera`);
      } else {
        stopMediaStream(newStream);
      }
    } catch (err) {
      console.warn("Flip camera error:", err);
      toast.error("Could not switch camera");
    }
  };

  const handleEndCallClick = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (ringbackAudioRef.current) ringbackAudioRef.current();
    if (signalingPollRef.current) clearInterval(signalingPollRef.current);
    
    // Stop all camera & mic hardware and release video sinks
    cleanupCallHardware();

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
    <div
      onClick={() => {
        // Unlock audio autoplay if restricted by mobile browser policy
        if (remoteAudioRef.current) remoteAudioRef.current.play().catch(() => {});
        if (remoteVideoRef.current) remoteVideoRef.current.play().catch(() => {});
      }}
      className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 backdrop-blur-2xl animate-in fade-in duration-200"
    >
      {/* Dedicated Global Audio Element (Plays remote partner's voice reliably) */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="relative w-full max-w-sm sm:max-w-lg h-full sm:h-[680px] bg-stone-950 border border-stone-800 sm:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden">
        
        {/* ================= VIDEO CALL MAIN STAGE ================= */}
        {callType === "video" && (
          <div className="absolute inset-0 bg-stone-950 z-0 overflow-hidden">
            {/* Remote Partner Video Stream - Dedicated DOM element, never unmounted */}
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={`object-cover transition-all duration-300 ${
                isPiPSwapped
                  ? "absolute top-20 right-4 z-30 w-28 h-40 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border-2 border-stone-700/80 bg-stone-900 shadow-2xl cursor-pointer hover:scale-105 active:scale-95"
                  : "absolute inset-0 w-full h-full z-0"
              } ${hasRemoteStream ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              onClick={isPiPSwapped ? () => setIsPiPSwapped(false) : undefined}
              title={isPiPSwapped ? "Tap to maximize remote video" : ""}
            />

            {/* Local User Video Stream - Dedicated DOM element with scale-x mirror */}
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`object-cover transition-all duration-300 scale-x-[-1] ${
                isPiPSwapped
                  ? "absolute inset-0 w-full h-full z-0"
                  : "absolute top-20 right-4 z-30 w-28 h-40 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border-2 border-stone-700/80 bg-stone-900 shadow-2xl cursor-pointer hover:scale-105 active:scale-95"
              } ${isVideoOn ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              onClick={!isPiPSwapped ? () => setIsPiPSwapped(true) : undefined}
              title={!isPiPSwapped ? "Tap to maximize your camera" : ""}
            />

            {/* Local Camera Off Placeholder inside PiP */}
            {!isVideoOn && !isPiPSwapped && (
              <div
                onClick={() => setIsPiPSwapped(true)}
                className="absolute top-20 right-4 z-30 w-28 h-40 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border-2 border-stone-700/80 bg-stone-900 shadow-2xl flex flex-col items-center justify-center text-stone-500 text-[10px] p-2 text-center cursor-pointer"
              >
                <IoVideocamOff className="w-6 h-6 mb-1 text-stone-600" />
                <span>Camera off</span>
                <span className="text-[9px] text-stone-400 mt-1">Tap to swap</span>
              </div>
            )}

            {/* Remote Connecting Stage (shown before remote stream arrives) */}
            {(!isConnected || !hasRemoteStream) && (
              <div className="absolute inset-0 z-10 w-full h-full flex flex-col items-center justify-center relative bg-gradient-to-b from-stone-900 via-stone-950 to-black px-6 text-center">
                <div className="relative mb-6">
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
                  {/* Subtle animated status rings */}
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
                    <span>
                      {connectionHealth === "reconnecting"
                        ? "Reconnecting Media Relay..."
                        : "Establishing HD Video Stream..."}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Ambient vignette gradients */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/90 pointer-events-none z-10" />

            {/* PiP badge indicator */}
            <div className="absolute top-20 right-4 z-40 pointer-events-none p-1">
              <span className="text-[10px] font-semibold text-white/90 bg-black/70 px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                {isPiPSwapped ? partner.username : "You"}
              </span>
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
        <div className="relative z-20 flex flex-col items-center mt-6 px-6 text-center">
          <span className="text-xs uppercase tracking-widest text-sky-400 font-semibold mb-1 flex items-center gap-1.5">
            {callType === "video" ? <IoVideocam /> : <IoCall />}
            <span>Winker {callType === "video" ? "Video Call" : "Voice Call"}</span>
          </span>

          {callType === "video" && (
            <h3 className="text-lg font-bold text-white truncate max-w-xs">{partner.fullName}</h3>
          )}

          <div className="mt-2 flex items-center gap-2">
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

            {isConnected && connectionHealth === "reconnecting" && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                Reconnecting...
              </span>
            )}
          </div>
        </div>

        {/* ================= BOTTOM IN-CALL CONTROLS ================= */}
        <div className="relative z-20 flex items-center justify-around bg-black/70 backdrop-blur-xl rounded-2xl py-4 px-6 border border-stone-800 mx-4 mb-5 shadow-2xl">
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