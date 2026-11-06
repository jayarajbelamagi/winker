import { useEffect, useRef } from "react";
import { IoCall, IoVideocam } from "react-icons/io5";
import { MdCallEnd } from "react-icons/md";

// Web Audio API Ringtone Synthesizer for Incoming Calls
const playIncomingRingtone = (audioCtxRef) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return () => {};
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    let isPlaying = true;
    let timeoutId = null;

    const playChime = () => {
      if (!isPlaying || ctx.state === "closed") return;

      const now = ctx.currentTime;
      // Note 1: 523.25 Hz (C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Note 2: 659.25 Hz (E5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, now + 0.18);
      gain2.gain.setValueAtTime(0, now + 0.18);
      gain2.gain.linearRampToValueAtTime(0.25, now + 0.23);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.7);

      // Note 3: 783.99 Hz (G5)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(783.99, now + 0.4);
      gain3.gain.setValueAtTime(0, now + 0.4);
      gain3.gain.linearRampToValueAtTime(0.28, now + 0.45);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.4);
      osc3.stop(now + 1.2);

      // Repeat chime sequence every 2.4s
      timeoutId = setTimeout(playChime, 2400);
    };

    playChime();

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

const IncomingCallModal = ({ incomingCall, onAccept, onDecline }) => {
  const audioCtxRef = useRef(null);

  useEffect(() => {
    if (!incomingCall) return;

    // Start incoming ringtone
    const stopAudio = playIncomingRingtone(audioCtxRef);

    return () => {
      stopAudio();
    };
  }, [incomingCall]);

  if (!incomingCall) return null;

  const caller = incomingCall.caller || {};
  const isVideo = incomingCall.callType === "video";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200 p-4">
      <div className="relative w-full max-w-sm bg-stone-900/95 border border-stone-800 rounded-3xl shadow-2xl p-6 flex flex-col items-center text-center overflow-hidden">
        {/* Subtle Ambient Pulse Background */}
        <div className="absolute inset-0 -z-10 bg-radial from-emerald-500/10 via-transparent to-transparent animate-pulse" />

        {/* Incoming Badge */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider mb-6 animate-pulse">
          {isVideo ? <IoVideocam className="w-3.5 h-3.5" /> : <IoCall className="w-3.5 h-3.5" />}
          <span>Incoming {isVideo ? "Video" : "Audio"} Call...</span>
        </span>

        {/* Pulsing Caller Avatar */}
        <div className="relative my-4">
          <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-emerald-500/60 shadow-xl shadow-emerald-500/20">
            <img
              src={caller.profileImg || "/avatar-placeholder.png"}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/avatar-placeholder.png";
              }}
            />
          </div>
          {/* Multiple Glowing Radar Rings */}
          <div className="absolute inset-0 rounded-full border-4 border-emerald-400/40 animate-ping pointer-events-none" />
          <div className="absolute -inset-3 rounded-full border-2 border-emerald-400/20 animate-pulse pointer-events-none" />
        </div>

        {/* Caller Info */}
        <h3 className="text-xl font-bold text-white mt-2">{caller.fullName || "Someone"}</h3>
        <p className="text-sm text-stone-400 mb-8">@{caller.username || "user"}</p>

        {/* Two Prominent Action Buttons: Decline (Red) & Accept (Green) */}
        <div className="w-full flex items-center justify-around px-4">
          {/* Decline Button */}
          <button
            onClick={() => onDecline(incomingCall.callId)}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition transform group-hover:scale-110 active:scale-95">
              <MdCallEnd className="w-8 h-8" />
            </div>
            <span className="text-xs text-stone-400 group-hover:text-red-400 transition font-medium">
              Decline
            </span>
          </button>

          {/* Accept Button */}
          <button
            onClick={() => onAccept(incomingCall.callId)}
            className="flex flex-col items-center gap-2 group cursor-pointer"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transition transform group-hover:scale-110 active:scale-95 animate-bounce">
              {isVideo ? <IoVideocam className="w-8 h-8" /> : <IoCall className="w-8 h-8" />}
            </div>
            <span className="text-xs text-stone-300 group-hover:text-emerald-400 transition font-semibold">
              Accept
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;
