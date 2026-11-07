import { createContext, useContext, useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { apiFetch } from "../lib/api";
import IncomingCallModal from "../components/chat/IncomingCallModal";
import CallModal from "../components/chat/CallModal";

const CallContext = createContext(null);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error("useCall must be used within a CallProvider");
  }
  return context;
};

export const CallProvider = ({ children, authUser }) => {
  const queryClient = useQueryClient();
  const [activeCall, setActiveCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);

  const activeCallRef = useRef(null);
  const incomingCallRef = useRef(null);
  activeCallRef.current = activeCall;
  incomingCallRef.current = incomingCall;

  // Ultra-reliable 1-second interval poller with zero cache lag
  useEffect(() => {
    if (!authUser) {
      setActiveCall(null);
      setIncomingCall(null);
      return;
    }

    const checkActiveCalls = async () => {
      try {
        const res = await apiFetch("/api/messages/call/active");
        if (!res.ok) return;
        const data = await res.json();
        const serverCall = data?.activeCall || null;

        const myId = (authUser._id || authUser.id)?.toString();

        if (!serverCall) {
          if (incomingCallRef.current) setIncomingCall(null);
          if (
            activeCallRef.current &&
            (activeCallRef.current.status === "ended" ||
              activeCallRef.current.status === "declined" ||
              activeCallRef.current.status === "missed")
          ) {
            setActiveCall(null);
          }
          return;
        }

        const receiverId = (serverCall.receiver?._id || serverCall.receiverId)?.toString();
        const callerId = (serverCall.caller?._id || serverCall.callerId)?.toString();

        const isGroup = Boolean(serverCall.isGroupCall);
        const isParticipant = Boolean(
          isGroup && serverCall.participantIds?.some((pid) => (pid?._id || pid)?.toString() === myId)
        );

        const isReceiver =
          Boolean(myId && receiverId && myId === receiverId) ||
          (isGroup && isParticipant && myId !== callerId);
        const isCaller = Boolean(myId && callerId && myId === callerId);

        if (isReceiver && serverCall.status === "ringing") {
          // Incoming call ringing for this receiver / group member
          setIncomingCall(serverCall);
          setActiveCall(null);
        } else if (serverCall.status === "connected" && (isReceiver || isCaller)) {
          // Connected call
          setIncomingCall(null);
          setActiveCall(serverCall);
        } else if (isCaller && serverCall.status === "ringing") {
          // Caller waiting for receiver(s)
          setActiveCall(serverCall);
          setIncomingCall(null);
        } else if (
          serverCall.status === "declined" ||
          serverCall.status === "ended" ||
          serverCall.status === "missed"
        ) {
          setIncomingCall(null);
          if (activeCallRef.current) {
            setActiveCall((prev) => (prev ? { ...prev, status: serverCall.status } : null));
          }
        }
      } catch (err) {
        // network hiccup
      }
    };

    checkActiveCalls();
    const interval = setInterval(checkActiveCalls, 1000);

    return () => clearInterval(interval);
  }, [authUser]);

  // Tab Title Notification for Incoming Calls
  useEffect(() => {
    if (incomingCall) {
      const origTitle = document.title;
      let flip = false;
      const titleTimer = setInterval(() => {
        document.title = flip
          ? `📞 Incoming Call from @${incomingCall.caller?.username || "user"}!`
          : `🔔 Ringing on Winker...`;
        flip = !flip;
      }, 1000);

      return () => {
        clearInterval(titleTimer);
        document.title = origTitle;
      };
    }
  }, [incomingCall]);

  // Caller initiates call (1-on-1 or WhatsApp-style Group Call)
  const startCall = async ({ partner, isGroup = false, group = null, callType = "audio" }) => {
    // If starting a group call
    if (isGroup || group) {
      const convId = (group?._id || partner?._id || group?.id)?.toString();
      if (!convId) {
        toast.error("Group conversation not found");
        return;
      }
      try {
        const res = await apiFetch(`/api/messages/call/group/initiate/${convId}`, {
          method: "POST",
          body: JSON.stringify({ callType }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to initiate group call");
        }
        setActiveCall(data.call);
      } catch (err) {
        toast.error(err.message || "Could not start group call");
      }
      return;
    }

    // 1-on-1 call
    const partnerId = (partner?._id || partner?.id)?.toString();
    if (!partnerId) {
      toast.error("Please select a recipient first");
      return;
    }

    try {
      const res = await apiFetch(`/api/messages/call/initiate/${partnerId}`, {
        method: "POST",
        body: JSON.stringify({ callType }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate call");
      }

      setActiveCall(data.call);
    } catch (err) {
      toast.error(err.message || "Could not start call");
    }
  };

  // Receiver accepts incoming call
  const acceptCall = async (callId) => {
    try {
      const res = await apiFetch(`/api/messages/call/answer/${callId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Call ended or unavailable");
      }

      setIncomingCall(null);
      setActiveCall(data.call);
    } catch (err) {
      toast.error(err.message || "Failed to answer call");
      setIncomingCall(null);
    }
  };

  // Receiver declines incoming call
  const declineCall = async (callId) => {
    setIncomingCall(null);
    try {
      await apiFetch(`/api/messages/call/decline/${callId}`, {
        method: "POST",
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (err) {}
  };

  // Either user ends active call
  const endCall = async (callId, skipApi = false) => {
    setActiveCall(null);
    if (!skipApi && callId) {
      try {
        await apiFetch(`/api/messages/call/end/${callId}`, {
          method: "POST",
        });
      } catch (err) {}
    }
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.invalidateQueries({ queryKey: ["messages"] });
  };

  return (
    <CallContext.Provider
      value={{
        activeCall,
        incomingCall,
        startCall,
        acceptCall,
        declineCall,
        endCall,
      }}
    >
      {children}

      {/* Global Incoming Call Overlay (Rings on Receiver's Screen Anywhere in the App) */}
      <IncomingCallModal
        incomingCall={incomingCall}
        onAccept={acceptCall}
        onDecline={declineCall}
      />

      {/* Global Active Call Overlay (Audio & Video with PiP and controls) */}
      <CallModal
        isOpen={Boolean(activeCall)}
        callSession={activeCall}
        currentUserId={authUser?._id || authUser?.id}
        onEndCall={endCall}
      />
    </CallContext.Provider>
  );
};
