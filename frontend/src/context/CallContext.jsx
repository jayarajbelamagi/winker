import { createContext, useContext, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

  // Poll backend for active calls
  const isCallActive = Boolean(activeCall || incomingCall);
  const { data: callData } = useQuery({
    queryKey: ["activeCallSession"],
    queryFn: async () => {
      if (!authUser) return null;
      try {
        const res = await apiFetch("/api/messages/call/active");
        if (!res.ok) return null;
        const data = await res.json();
        return data?.activeCall || null;
      } catch (err) {
        return null;
      }
    },
    enabled: Boolean(authUser),
    refetchInterval: isCallActive ? 1200 : 2500,
    refetchIntervalInBackground: true,
  });

  // Sync state whenever callData updates from server
  useEffect(() => {
    if (!authUser) {
      setActiveCall(null);
      setIncomingCall(null);
      return;
    }

    if (!callData) {
      if (incomingCall) setIncomingCall(null);
      if (activeCall && (activeCall.status === "ended" || activeCall.status === "declined")) {
        setActiveCall(null);
      }
      return;
    }

    const userIdStr = authUser._id.toString();
    const isReceiver = callData.receiver?._id === userIdStr;
    const isCaller = callData.caller?._id === userIdStr;

    if (isReceiver && callData.status === "ringing") {
      // Incoming call ringing for this receiver
      setIncomingCall(callData);
      setActiveCall(null);
    } else if (callData.status === "connected") {
      // Connected call for either caller or receiver
      setIncomingCall(null);
      setActiveCall(callData);
    } else if (isCaller && callData.status === "ringing") {
      // Caller waiting for receiver to pick up
      setActiveCall(callData);
      setIncomingCall(null);
    } else if (callData.status === "declined" || callData.status === "ended" || callData.status === "missed") {
      setIncomingCall(null);
      if (activeCall) {
        setActiveCall((prev) => (prev ? { ...prev, status: callData.status } : null));
      }
    }
  }, [callData, authUser]);

  // Caller initiates call
  const startCall = async ({ partner, callType = "audio" }) => {
    if (!partner?._id) return;
    try {
      const res = await apiFetch(`/api/messages/call/initiate/${partner._id}`, {
        method: "POST",
        body: JSON.stringify({ callType }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate call");
      }

      setActiveCall(data.call);
      queryClient.setQueryData(["activeCallSession"], data.call);
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
      queryClient.setQueryData(["activeCallSession"], data.call);
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
      queryClient.invalidateQueries({ queryKey: ["activeCallSession"] });
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
    queryClient.invalidateQueries({ queryKey: ["activeCallSession"] });
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

      {/* Global Incoming Call Alert (rings anywhere in app) */}
      <IncomingCallModal
        incomingCall={incomingCall}
        onAccept={acceptCall}
        onDecline={declineCall}
      />

      {/* Global In-Call Overlay (Audio or Video with video stream & controls) */}
      <CallModal
        isOpen={Boolean(activeCall)}
        callSession={activeCall}
        currentUserId={authUser?._id}
        onEndCall={endCall}
      />
    </CallContext.Provider>
  );
};
