import { useState, useEffect, useRef } from "react";
import { toast } from "react-hot-toast";
import {
  IoClose,
  IoMic,
  IoMicOff,
  IoHandRightOutline,
  IoExitOutline,
} from "react-icons/io5";
import { FaCrown } from "react-icons/fa";
import { apiFetch } from "../../lib/api";

const SpaceModal = ({ spaceId, authUser, onClose, onSpaceEnded }) => {
  const [space, setSpace] = useState(null);
  const [isMuted, setIsMuted] = useState(true);
  const [hasRaisedHand, setHasRaisedHand] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const pollIntervalRef = useRef(null);
  const localStreamRef = useRef(null);

  const fetchSpaceDetails = async () => {
    try {
      const res = await apiFetch(`/api/spaces/active`);
      const data = await res.json();
      const current = Array.isArray(data) ? data.find((s) => s._id === spaceId) : null;
      if (!current || !current.isActive) {
        toast("This Space has ended", { icon: "🎙️" });
        onSpaceEnded && onSpaceEnded();
        onClose();
        return;
      }
      setSpace(current);
      if (current.raisedHands?.some((u) => (u._id || u).toString() === authUser?._id?.toString())) {
        setHasRaisedHand(true);
      }
    } catch (err) {
      console.error("Failed to poll space:", err);
    }
  };

  useEffect(() => {
    // Join the space on mount
    apiFetch(`/api/spaces/${spaceId}/join`, { method: "POST" })
      .then((res) => res.json())
      .then((data) => setSpace(data))
      .catch((err) => console.error("Error joining space:", err));

    pollIntervalRef.current = setInterval(fetchSpaceDetails, 3000);

    return () => {
      clearInterval(pollIntervalRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [spaceId]);

  const isHost = (space?.hostId?._id || space?.hostId)?.toString() === authUser?._id?.toString();
  const isSpeaker =
    isHost ||
    space?.speakers?.some(
      (u) => (u._id || u)?.toString() === authUser?._id?.toString()
    );

  const handleToggleMic = async () => {
    if (!isSpeaker) {
      toast("You are currently a listener. Raise your hand to speak!");
      return;
    }

    try {
      if (isMuted) {
        if (!localStreamRef.current) {
          localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = true));
        setIsMuted(false);
        toast.success("Microphone active");
      } else {
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((t) => (t.enabled = false));
        }
        setIsMuted(true);
        toast("Microphone muted", { icon: "🔇" });
      }
    } catch (err) {
      toast.error("Microphone access denied");
    }
  };

  const handleRaiseHand = async () => {
    try {
      setIsProcessing(true);
      const res = await apiFetch(`/api/spaces/${spaceId}/raise-hand`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setHasRaisedHand(true);
        setSpace(data);
        toast.success("Hand raised! Waiting for host approval");
      }
    } catch (err) {
      toast.error("Failed to raise hand");
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePromoteSpeaker = async (targetUserId) => {
    try {
      const res = await apiFetch(`/api/spaces/${spaceId}/promote`, {
        method: "POST",
        body: JSON.stringify({ targetUserId }),
      });
      const data = await res.json();
      if (res.ok) {
        setSpace(data);
        toast.success("Speaker promoted!");
      }
    } catch (err) {
      toast.error("Failed to promote speaker");
    }
  };

  const handleLeaveOrEnd = async () => {
    try {
      if (isHost) {
        if (window.confirm("Ending this space will disconnect all listeners. End now?")) {
          await apiFetch(`/api/spaces/${spaceId}/end`, { method: "POST" });
          toast.success("Space ended");
          onSpaceEnded && onSpaceEnded();
          onClose();
        }
      } else {
        await apiFetch(`/api/spaces/${spaceId}/leave`, { method: "POST" });
        toast.success("Left space");
        onClose();
      }
    } catch (err) {
      onClose();
    }
  };

  if (!space) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg text-primary"></span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
      <div className="bg-[#16181C] border border-stone-800 w-full max-w-lg rounded-t-3xl sm:rounded-2xl p-5 max-h-[88vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom">
        {/* Top Header */}
        <div className="flex justify-between items-start pb-4 border-b border-stone-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-red-500/20 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                LIVE SPACE
              </span>
              <span className="text-stone-400 text-xs">
                👥 {(space.listeners?.length || 0) + (space.speakers?.length || 0)} listening
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">{space.title}</h2>
          </div>
          <button
            onClick={handleLeaveOrEnd}
            className="p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <IoClose className="w-6 h-6" />
          </button>
        </div>

        {/* Space Body (Speakers & Listeners) */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 scrollbar-thin">
          {/* Speakers Section */}
          <div>
            <div className="text-xs font-bold text-stone-400 mb-3 flex items-center gap-1.5">
              <span>🎙️ SPEAKERS ({space.speakers?.length || 1})</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
              {space.speakers?.map((spk) => {
                const isThisHost = (space.hostId?._id || space.hostId)?.toString() === (spk._id || spk)?.toString();
                return (
                  <div key={spk._id} className="flex flex-col items-center text-center">
                    <div className="relative w-16 h-16 rounded-full p-[2px] bg-gradient-to-tr from-primary to-sky-400 shadow-md">
                      <img
                        src={spk.profileImg || "/avatar-placeholder.png"}
                        alt=""
                        className="w-full h-full object-cover rounded-full"
                      />
                      {isThisHost && (
                        <div className="absolute -top-1 -right-1 bg-amber-500 text-black p-1 rounded-full shadow">
                          <FaCrown className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-white mt-1.5 truncate max-w-[80px]">
                      {spk.fullName}
                    </span>
                    <span className="text-[10px] text-primary font-medium">
                      {isThisHost ? "Host" : "Speaker"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Raised Hands (Visible to Host for Promotion) */}
          {isHost && space.raisedHands?.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-2">
                <IoHandRightOutline className="w-4 h-4" />
                <span>Hands Raised to Speak ({space.raisedHands.length})</span>
              </span>
              <div className="space-y-2">
                {space.raisedHands.map((user) => (
                  <div key={user._id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={user.profileImg || "/avatar-placeholder.png"}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover"
                      />
                      <span className="text-xs text-white font-medium">{user.fullName}</span>
                    </div>
                    <button
                      onClick={() => handlePromoteSpeaker(user._id)}
                      className="bg-primary hover:bg-primary/90 text-white text-[11px] font-bold px-3 py-1 rounded-full transition"
                    >
                      Invite to Speak
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Listeners Section */}
          <div>
            <div className="text-xs font-bold text-stone-400 mb-3">
              <span>🎧 LISTENERS ({space.listeners?.length || 0})</span>
            </div>
            {space.listeners?.length === 0 ? (
              <p className="text-xs text-stone-500 py-3 text-center">No other listeners yet</p>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
                {space.listeners?.map((listener) => (
                  <div key={listener._id} className="flex flex-col items-center text-center">
                    <img
                      src={listener.profileImg || "/avatar-placeholder.png"}
                      alt=""
                      className="w-12 h-12 rounded-full object-cover border border-stone-800"
                    />
                    <span className="text-[11px] text-stone-300 mt-1 truncate max-w-[65px]">
                      {listener.fullName}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Control Bar */}
        <div className="pt-3 border-t border-stone-800 flex items-center justify-between gap-3">
          {/* Mute/Unmute Mic for Speakers */}
          {isSpeaker ? (
            <button
              onClick={handleToggleMic}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition shadow ${
                isMuted
                  ? "bg-stone-800 hover:bg-stone-700 text-stone-300"
                  : "bg-primary text-white hover:bg-primary/90"
              }`}
            >
              {isMuted ? <IoMicOff className="w-4 h-4" /> : <IoMic className="w-4 h-4 text-white animate-pulse" />}
              <span>{isMuted ? "Unmute" : "Mic On"}</span>
            </button>
          ) : (
            /* Raise Hand for Listeners */
            <button
              onClick={handleRaiseHand}
              disabled={hasRaisedHand || isProcessing}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold transition ${
                hasRaisedHand
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-default"
                  : "bg-stone-800 hover:bg-stone-700 text-white"
              }`}
            >
              <IoHandRightOutline className="w-4 h-4" />
              <span>{hasRaisedHand ? "Hand Raised" : "Raise Hand"}</span>
            </button>
          )}

          {/* Leave or End Space */}
          <button
            onClick={handleLeaveOrEnd}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 transition"
          >
            <IoExitOutline className="w-4 h-4" />
            <span>{isHost ? "End Space" : "Leave quietly"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpaceModal;
