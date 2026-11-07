import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { apiFetch } from "../../lib/api";
import { compressImage } from "../../utils/imageCompressor";

import {
  FiSend,
  FiPhone,
  FiVideo,
  FiImage,
  FiSearch,
  FiLock,
  FiCheckCircle,
  FiTrash2,
  FiUsers,
  FiMic,
  FiStar,
} from "react-icons/fi";
import { FaArrowLeft, FaRegSmile, FaThumbtack, FaStar } from "react-icons/fa";
import { IoCloseSharp, IoStopCircle } from "react-icons/io5";
import { RiChatNewFill } from "react-icons/ri";
import { HiUserGroup } from "react-icons/hi2";
import { BsEyeFill } from "react-icons/bs";

import EmojiPicker from "../../components/common/EmojiPicker";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import CreateGroupModal from "../../components/chat/CreateGroupModal";
import GroupInfoModal from "../../components/chat/GroupInfoModal";
import VoiceNotePlayer from "../../components/chat/VoiceNotePlayer";
import ViewOnceModal from "../../components/chat/ViewOnceModal";
import { useCall } from "../../context/CallContext";

const QUICK_REACTIONS = ["❤️", "😂", "👍", "🔥", "😮", "😢"];

// Format "Seen x minutes ago"
const formatSeenAgo = (dateStr) => {
  if (!dateStr) return "recently";
  const diff = Date.now() - new Date(dateStr).getTime();
  if (isNaN(diff) || diff < 0) return "just now";
  const mins = Math.floor(diff / (1000 * 60));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// Sender name color generator for WhatsApp-style group messages
const getSenderColor = (id = "") => {
  const colors = [
    "text-sky-400",
    "text-emerald-400",
    "text-amber-400",
    "text-purple-400",
    "text-rose-400",
    "text-teal-400",
    "text-cyan-400",
  ];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const MessagesPage = ({ authUser }) => {
  const { userId: routeUserId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activePartner, setActivePartner] = useState(null);
  const [activeGroup, setActiveGroup] = useState(null);
  const [inputText, setInputText] = useState("");
  const [selectedImg, setSelectedImg] = useState(null);
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showGroupInfoModal, setShowGroupInfoModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  // Reaction popover message ID
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);

  // View Once Fullscreen modal
  const [viewOnceModalData, setViewOnceModalData] = useState(null); // { url, isVideo, messageId }

  // Voice note recording states
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  const { startCall: triggerGlobalCall } = useCall();

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);

  // 1. Fetch Conversations (both 1-on-1 and Groups)
  const { data: conversations = [], isLoading: isLoadingConvs, refetch: refetchConvs } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await apiFetch("/api/messages/conversations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load chats");
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 5000,
  });

  const activeConversation = conversations.find(
    (c) => !c.isGroup && c.otherUser?._id === activePartner?._id
  );
  const activeStreak = activeConversation?.streak;

  // 2. Fetch Eligible Contacts (Mutuals)
  const { data: contactsData } = useQuery({
    queryKey: ["eligibleContacts"],
    queryFn: async () => {
      const res = await apiFetch("/api/messages/contacts");
      const data = await res.json();
      if (!res.ok) return { mutuals: [], waitingForFollowBack: [] };
      return data;
    },
  });

  const mutuals = contactsData?.mutuals || [];
  const waitingForFollowBack = contactsData?.waitingForFollowBack || [];

  // 3. Resolve active partner from URL
  useEffect(() => {
    if (routeUserId) {
      const conv = conversations.find((c) => !c.isGroup && c.otherUser?._id === routeUserId);
      if (conv?.otherUser) {
        setActivePartner(conv.otherUser);
        setActiveGroup(null);
      } else {
        const mutual = mutuals.find((m) => m._id === routeUserId);
        if (mutual) {
          setActivePartner(mutual);
          setActiveGroup(null);
        } else {
          apiFetch(`/api/users/profile/${routeUserId}`)
            .then((r) => r.json())
            .then((u) => {
              if (u && !u.error) {
                setActivePartner(u);
                setActiveGroup(null);
              }
            })
            .catch(() => {});
        }
      }
    }
  }, [routeUserId, conversations, mutuals]);

  // 4a. Fetch 1-on-1 Messages
  const {
    data: directMessages = [],
    isLoading: isLoadingDirect,
  } = useQuery({
    queryKey: ["messages", activePartner?._id],
    queryFn: async () => {
      if (!activePartner?._id) return [];
      const res = await apiFetch(`/api/messages/${activePartner._id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load messages");
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(activePartner?._id),
    refetchInterval: 3000,
  });

  // 4b. Fetch Group Messages
  const {
    data: groupMessages = [],
    isLoading: isLoadingGroup,
  } = useQuery({
    queryKey: ["groupMessages", activeGroup?._id],
    queryFn: async () => {
      if (!activeGroup?._id) return [];
      const res = await apiFetch(`/api/messages/group/${activeGroup._id}/messages`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load group messages");
      return Array.isArray(data) ? data : [];
    },
    enabled: Boolean(activeGroup?._id),
    refetchInterval: 3000,
  });

  const messages = activeGroup ? groupMessages : directMessages;
  const isLoadingMessages = activeGroup ? isLoadingGroup : isLoadingDirect;

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 5. Send Message Mutation
  const { mutate: sendMessageMutation, isPending: isSending } = useMutation({
    mutationFn: async ({ text, img, audio, audioDuration, isViewOnce, callInfo }) => {
      const payload = {
        text,
        img: img || undefined,
        imgBase64: img || undefined,
        audio: audio || undefined,
        audioDuration: audioDuration || 0,
        isViewOnce: Boolean(isViewOnce),
        callInfo,
      };

      if (activeGroup) {
        const res = await apiFetch(`/api/messages/group/send/${activeGroup._id}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to send message to group");
        return data;
      }

      if (!activePartner?._id) throw new Error("No recipient selected");
      const res = await apiFetch(`/api/messages/send/${activePartner._id}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");
      return data;
    },
    onSuccess: (newMsg) => {
      setInputText("");
      setSelectedImg(null);
      setIsViewOnce(false);
      setShowEmojiPicker(false);
      if (activeGroup) {
        queryClient.setQueryData(["groupMessages", activeGroup._id], (old) => [
          ...(old || []),
          newMsg,
        ]);
      } else {
        queryClient.setQueryData(["messages", activePartner?._id], (old) => [
          ...(old || []),
          newMsg,
        ]);
      }
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send message");
    },
  });

  // 6. Delete Message Mutation
  const { mutate: deleteMessageMutation } = useMutation({
    mutationFn: async (messageId) => {
      const res = await apiFetch(`/api/messages/${messageId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete message");
      return messageId;
    },
    onSuccess: (deletedId) => {
      if (activeGroup) {
        queryClient.setQueryData(["groupMessages", activeGroup._id], (old) =>
          (old || []).filter((m) => m._id !== deletedId)
        );
      } else {
        queryClient.setQueryData(["messages", activePartner?._id], (old) =>
          (old || []).filter((m) => m._id !== deletedId)
        );
      }
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Message deleted");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete message");
    },
  });

  // 7. Toggle Reaction Mutation
  const handleReactToMessage = async (messageId, emoji) => {
    setActiveReactionMsgId(null);
    try {
      const res = await apiFetch(`/api/messages/react/${messageId}`, {
        method: "POST",
        body: JSON.stringify({ emoji }),
      });
      if (res.ok) {
        if (activeGroup) {
          queryClient.invalidateQueries({ queryKey: ["groupMessages", activeGroup._id] });
        } else {
          queryClient.invalidateQueries({ queryKey: ["messages", activePartner?._id] });
        }
      }
    } catch (err) {
      console.error("React to message failed:", err);
    }
  };

  // 8. Pin/Unpin Conversation Mutation
  const handleTogglePinConversation = async (conversationId, e) => {
    e?.stopPropagation();
    try {
      const res = await apiFetch(`/api/messages/pin/${conversationId}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.isPinned ? "Chat pinned to top 📌" : "Chat unpinned");
        refetchConvs();
      }
    } catch (err) {
      toast.error("Failed to pin chat");
    }
  };

  // 9. Star/Unstar Message Mutation
  const handleToggleStarMessage = async (messageId) => {
    try {
      const res = await apiFetch(`/api/messages/star/${messageId}`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast(data.isStarred ? "Starred message ⭐" : "Unstarred message");
        if (activeGroup) {
          queryClient.invalidateQueries({ queryKey: ["groupMessages", activeGroup._id] });
        } else {
          queryClient.invalidateQueries({ queryKey: ["messages", activePartner?._id] });
        }
      }
    } catch (err) {
      toast.error("Failed to star message");
    }
  };

  // 10. Voice Note Recording Handlers
  const startRecordingAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      toast.error("Microphone access required to send voice notes");
    }
  };

  const stopAndSendAudio = () => {
    if (!mediaRecorderRef.current) return;
    clearInterval(recordingTimerRef.current);

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Audio = reader.result;
        sendMessageMutation({
          audio: base64Audio,
          audioDuration: recordingSeconds,
        });
      };
      reader.readAsDataURL(audioBlob);

      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setIsRecordingAudio(false);
      setRecordingSeconds(0);
    };

    mediaRecorderRef.current.stop();
  };

  const cancelRecordingAudio = () => {
    if (mediaRecorderRef.current) {
      clearInterval(recordingTimerRef.current);
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      setIsRecordingAudio(false);
      setRecordingSeconds(0);
      toast("Voice note cancelled");
    }
  };

  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (!inputText.trim() && !selectedImg) return;
    sendMessageMutation({
      text: inputText,
      img: selectedImg,
      isViewOnce,
    });
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const compressed = await compressImage(file, 1600, 0.85);
        setSelectedImg(compressed);
      } catch (err) {
        toast.error("Failed to process image");
      }
    }
  };

  // Calling
  const startCall = (type) => {
    if (activeGroup) {
      triggerGlobalCall({ isGroup: true, group: activeGroup, callType: type });
      return;
    }
    if (activePartner) {
      triggerGlobalCall({ partner: activePartner, callType: type });
    }
  };

  const isChatOpen = Boolean(activePartner || activeGroup);
  const lastAuthMessage = !activeGroup
    ? [...messages].reverse().find((m) => (m.senderId?._id || m.senderId) === authUser?._id)
    : null;

  return (
    <div className="flex-1 min-w-0 w-full flex h-[calc(100dvh-3.5rem)] md:h-screen bg-black text-white overflow-hidden pb-0 border-r border-gray-800 relative">
      {/* LEFT: Conversations List */}
      <div
        className={`w-full md:w-[350px] lg:w-[380px] xl:w-[410px] border-r border-gray-800 flex flex-col bg-stone-950/80 backdrop-blur-md flex-shrink-0 h-full ${
          isChatOpen ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="p-3.5 border-b border-gray-800 flex items-center justify-between">
          <h1 className="font-bold text-lg text-white">Messages</h1>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowCreateGroupModal(true)}
              className="p-2 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition"
              title="Create New Group (WhatsApp style)"
            >
              <HiUserGroup className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="p-2 rounded-full bg-primary/20 text-primary hover:bg-primary hover:text-white transition"
              title="New Chat (Mutual followers)"
            >
              <RiChatNewFill className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-gray-800">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              placeholder="Search chats & groups..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-stone-900 border border-gray-800 rounded-full pl-9 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-900 scrollbar-thin">
          {isLoadingConvs ? (
            <div className="p-8 flex justify-center">
              <LoadingSpinner size="md" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-stone-500 flex flex-col items-center">
              <div className="w-14 h-14 rounded-full bg-stone-900 flex items-center justify-center text-stone-400 mb-3 text-2xl">
                💬
              </div>
              <p className="font-semibold text-white text-sm mb-1">No messages yet</p>
              <p className="text-xs text-stone-400 mb-4">
                Start a direct conversation or create a group with your mutual connections!
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="btn btn-primary btn-sm rounded-full text-white px-4"
                >
                  + New Chat
                </button>
                <button
                  onClick={() => setShowCreateGroupModal(true)}
                  className="btn btn-outline btn-sm rounded-full text-emerald-400 border-emerald-500/40 hover:bg-emerald-500 hover:text-white px-4"
                >
                  + New Group
                </button>
              </div>
            </div>
          ) : (
            conversations
              .filter((c) => {
                if (c.isGroup) {
                  return c.groupName?.toLowerCase().includes(searchFilter.toLowerCase());
                }
                return (
                  c.otherUser?.fullName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                  c.otherUser?.username?.toLowerCase().includes(searchFilter.toLowerCase())
                );
              })
              .map((conv) => {
                // Group Conversation Item
                if (conv.isGroup) {
                  const isSelected = activeGroup?._id === conv._id;
                  return (
                    <div
                      key={conv._id}
                      onClick={() => {
                        setActiveGroup(conv);
                        setActivePartner(null);
                        navigate("/messages");
                      }}
                      className={`flex items-center gap-3 p-3.5 cursor-pointer transition relative group ${
                        isSelected
                          ? "bg-emerald-500/10 border-l-4 border-emerald-500"
                          : "hover:bg-stone-900/60"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xl flex-shrink-0 shadow-md overflow-hidden">
                        {conv.groupImg ? (
                          <img src={conv.groupImg} alt="" className="w-full h-full object-cover" />
                        ) : (
                          "👥"
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold text-sm text-white truncate">
                              {conv.groupName}
                            </span>
                            {conv.isPinned && (
                              <FaThumbtack className="w-3 h-3 text-amber-400 rotate-45 flex-shrink-0" />
                            )}
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex-shrink-0">
                              Group
                            </span>
                          </div>
                          <span className="text-[10px] text-stone-500 flex-shrink-0">
                            {conv.lastMessage?.createdAt
                              ? new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : ""}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <p className="text-xs truncate text-stone-400">
                            {conv.lastMessage?.text || `${conv.participants?.length || 0} members`}
                          </p>
                          <button
                            type="button"
                            onClick={(e) => handleTogglePinConversation(conv._id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-stone-500 hover:text-amber-400 transition"
                            title={conv.isPinned ? "Unpin chat" : "Pin chat to top"}
                          >
                            <FaThumbtack className={`w-3 h-3 ${conv.isPinned ? "text-amber-400" : ""}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }

                // 1-on-1 Conversation Item
                const partner = conv.otherUser;
                const isSelected = activePartner?._id === partner?._id;
                const isUnread =
                  (conv.lastMessage?.senderId?._id || conv.lastMessage?.senderId) !== authUser?._id &&
                  !conv.lastMessage?.seen;

                return (
                  <div
                    key={conv._id}
                    onClick={() => {
                      setActivePartner(partner);
                      setActiveGroup(null);
                      navigate(`/messages/${partner._id}`);
                    }}
                    className={`flex items-center gap-3 p-3.5 cursor-pointer transition relative group ${
                      isSelected
                        ? "bg-sky-500/10 border-l-4 border-primary"
                        : "hover:bg-stone-900/60"
                    }`}
                  >
                    <div className="avatar flex-shrink-0 relative">
                      <div className="w-12 h-12 rounded-full overflow-hidden border border-stone-800">
                        <img src={partner?.profileImg || "/avatar-placeholder.png"} alt="" />
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`font-semibold text-sm truncate ${
                              isUnread ? "text-white font-bold" : "text-stone-200"
                            }`}
                          >
                            {partner?.fullName}
                          </span>
                          {conv.isPinned && (
                            <FaThumbtack className="w-3 h-3 text-amber-400 rotate-45 flex-shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-stone-500 flex-shrink-0">
                          {conv.lastMessage?.createdAt
                            ? new Date(conv.lastMessage.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>

                      <div className="flex items-center justify-between mt-0.5">
                        <p
                          className={`text-xs truncate ${
                            isUnread ? "font-bold text-white" : "text-stone-400"
                          }`}
                        >
                          {conv.lastMessage?.text || "Started conversation"}
                        </p>
                        <div className="flex items-center gap-1">
                          {isUnread && (
                            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleTogglePinConversation(conv._id, e)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-stone-500 hover:text-amber-400 transition"
                            title={conv.isPinned ? "Unpin chat" : "Pin chat to top"}
                          >
                            <FaThumbtack className={`w-3 h-3 ${conv.isPinned ? "text-amber-400" : ""}`} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* RIGHT: Active Chat Room */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-full bg-black relative ${
          !isChatOpen ? "hidden md:flex items-center justify-center" : "flex"
        }`}
      >
        {!isChatOpen ? (
          <div className="text-center p-8 max-w-sm">
            <div className="w-16 h-16 rounded-full bg-stone-900 text-3xl flex items-center justify-center mx-auto mb-4">
              ✉️
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Select a conversation</h2>
            <p className="text-xs text-stone-400 mb-6">
              Choose an existing chat or start a new direct conversation or group.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowNewChatModal(true)}
                className="btn btn-primary rounded-full btn-sm text-white px-5"
              >
                + New Chat
              </button>
              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="btn btn-outline rounded-full btn-sm text-emerald-400 border-emerald-500/40 hover:bg-emerald-500 hover:text-white px-5"
              >
                + New Group
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Top Bar */}
            <div className="p-3 border-b border-gray-800 bg-stone-950/90 backdrop-blur flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => {
                    setActivePartner(null);
                    setActiveGroup(null);
                    navigate("/messages");
                  }}
                  className="p-2 -ml-1 rounded-full hover:bg-stone-800 text-stone-300 md:hidden"
                  title="Back to chats"
                >
                  <FaArrowLeft className="w-4 h-4" />
                </button>

                {activeGroup ? (
                  <>
                    <div
                      onClick={() => setShowGroupInfoModal(true)}
                      className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center text-lg flex-shrink-0 cursor-pointer shadow-md overflow-hidden"
                    >
                      {activeGroup.groupImg ? (
                        <img src={activeGroup.groupImg} alt="" className="w-full h-full object-cover" />
                      ) : (
                        "👥"
                      )}
                    </div>

                    <div
                      onClick={() => setShowGroupInfoModal(true)}
                      className="flex flex-col min-w-0 cursor-pointer"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-bold text-sm text-white hover:underline truncate">
                          {activeGroup.groupName}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold flex-shrink-0">
                          Group
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-400 truncate">
                        {activeGroup.participants?.length || 0} members · Tap for info
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <Link
                      to={`/profile/${activePartner.username}`}
                      className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border border-stone-700"
                    >
                      <img
                        src={activePartner.profileImg || "/avatar-placeholder.png"}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </Link>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          to={`/profile/${activePartner.username}`}
                          className="font-bold text-sm text-white hover:underline truncate"
                        >
                          {activePartner.fullName}
                        </Link>
                        {activeStreak && activeStreak.count > 0 && (
                          <div
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 cursor-default select-none shadow-sm ${
                              activeStreak.isExpiring
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                                : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            }`}
                          >
                            <span>🔥</span>
                            <span>{activeStreak.count}</span>
                            {activeStreak.isExpiring && (
                              <span className="text-[10px] text-amber-300 font-semibold">
                                ⌛ {activeStreak.hoursRemaining}h left
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span>Mutual Connection · Active now</span>
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Call Buttons */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => startCall("audio")}
                  className="p-2.5 rounded-full text-stone-300 hover:text-white hover:bg-stone-800 transition active:scale-95"
                  title="Voice Call"
                >
                  <FiPhone className="w-5 h-5 text-emerald-400" />
                </button>
                <button
                  onClick={() => startCall("video")}
                  className="p-2.5 rounded-full text-stone-300 hover:text-white hover:bg-stone-800 transition active:scale-95"
                  title="Video Call"
                >
                  <FiVideo className="w-5 h-5 text-sky-400" />
                </button>
                {activeGroup && (
                  <button
                    onClick={() => setShowGroupInfoModal(true)}
                    className="p-2.5 rounded-full text-stone-300 hover:text-white hover:bg-stone-800 transition active:scale-95"
                    title="Group Settings"
                  >
                    <FiUsers className="w-5 h-5 text-stone-300" />
                  </button>
                )}
              </div>
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 scroll-smooth">
              <div className="max-w-4xl mx-auto w-full space-y-3.5 flex flex-col">
                {isLoadingMessages ? (
                  <div className="flex justify-center py-12">
                    <LoadingSpinner size="md" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-16 text-center text-stone-500">
                    <p className="text-sm font-semibold text-white mb-1">
                      {activeGroup
                        ? `Welcome to ${activeGroup.groupName}! 🎉`
                        : `Say hello to ${activePartner?.fullName}! 👋`}
                    </p>
                    <p className="text-xs text-stone-400">
                      Messages sent here are encrypted and private.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const senderObj = typeof msg.senderId === "object" ? msg.senderId : null;
                    const senderIdStr = (senderObj?._id || msg.senderId)?.toString();
                    const isMine = senderIdStr === authUser?._id?.toString();
                    const isLastSent = lastAuthMessage?._id === msg._id;
                    const isCallLog = Boolean(msg.callInfo?.callType);
                    const isStarred = msg.starredBy?.some(
                      (id) => (id?._id || id)?.toString() === authUser?._id?.toString()
                    );
                    const isViewOnceMsg = Boolean(msg.isViewOnce);
                    const isOpenedByMe = msg.viewedBy?.some(
                      (id) => (id?._id || id)?.toString() === authUser?._id?.toString()
                    );

                    // Group System Message
                    if (msg.isSystem) {
                      return (
                        <div key={msg._id || idx} className="flex justify-center my-2">
                          <span className="text-[11px] text-stone-400 bg-stone-900/90 border border-stone-800 rounded-full px-3.5 py-1 font-medium shadow-sm">
                            {msg.text}
                          </span>
                        </div>
                      );
                    }

                    // Call Log Message
                    if (isCallLog) {
                      return (
                        <div key={msg._id || idx} className="flex justify-center my-2">
                          <div className="bg-stone-900 border border-stone-800 rounded-full px-4 py-1.5 text-xs text-stone-400 flex items-center gap-2 shadow-sm">
                            <span>{msg.callInfo.callType === "video" ? "📹" : "📞"}</span>
                            <span>{msg.text}</span>
                            <span className="text-[10px] text-stone-500">
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    }

                    const senderName = senderObj?.fullName || senderObj?.username || "Member";
                    const senderColorClass = getSenderColor(senderIdStr);

                    return (
                      <div
                        key={msg._id || idx}
                        className={`flex flex-col group relative ${isMine ? "items-end" : "items-start"}`}
                      >
                        <div className={`flex items-start gap-1.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                          {/* Sender Avatar for incoming group messages */}
                          {activeGroup && !isMine && (
                            <div className="w-7 h-7 rounded-full overflow-hidden border border-stone-700 flex-shrink-0 mt-1">
                              <img
                                src={senderObj?.profileImg || "/avatar-placeholder.png"}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}

                          {/* Message Bubble */}
                          <div
                            className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-md ${
                              isMine
                                ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-tr-sm"
                                : "bg-stone-900 border border-stone-800 text-stone-100 rounded-tl-sm"
                            }`}
                          >
                            {/* Star Badge */}
                            {isStarred && (
                              <FaStar className="w-3 h-3 text-amber-300 absolute -top-1.5 -right-1.5 drop-shadow" />
                            )}

                            {/* Group Sender Name */}
                            {activeGroup && !isMine && (
                              <span className={`text-[11px] font-bold block mb-1 truncate ${senderColorClass}`}>
                                ~ {senderName}
                              </span>
                            )}

                            {/* View Once Media Bubble */}
                            {isViewOnceMsg ? (
                              <div className="my-1">
                                {isOpenedByMe ? (
                                  <div className="flex items-center gap-2 py-1.5 px-3 rounded-xl bg-black/30 border border-white/20 text-xs text-stone-300">
                                    <span className="text-emerald-400 font-bold">✓</span>
                                    <span className="italic">Opened</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewOnceModalData({
                                        url: msg.img,
                                        isVideo: msg.mediaType === "video",
                                        messageId: msg._id,
                                      })
                                    }
                                    className="flex items-center gap-2 py-2 px-3.5 rounded-xl bg-black/40 hover:bg-black/60 border border-dashed border-emerald-400 text-emerald-300 font-semibold text-xs transition"
                                  >
                                    <span className="w-5 h-5 rounded-full border border-emerald-400 flex items-center justify-center text-[10px]">
                                      1
                                    </span>
                                    <span>View Once {msg.mediaType === "video" ? "Video" : "Photo"}</span>
                                  </button>
                                )}
                              </div>
                            ) : msg.audio ? (
                              /* Voice Note Audio Player */
                              <VoiceNotePlayer
                                audioUrl={msg.audio}
                                duration={msg.audioDuration}
                                isMine={isMine}
                              />
                            ) : msg.img ? (
                              /* Standard Photo / Video */
                              msg.mediaType === "video" ? (
                                <video
                                  src={msg.img}
                                  controls
                                  playsInline
                                  className="rounded-xl max-h-60 w-full object-cover mb-2 border border-black/20"
                                />
                              ) : (
                                <img
                                  src={msg.img}
                                  alt=""
                                  className="rounded-xl max-h-60 w-full object-cover mb-2 border border-black/20"
                                />
                              )
                            ) : null}

                            {/* Text content */}
                            {msg.text && (
                              <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                            )}

                            {/* Reaction Badges on Bubble Corner */}
                            {msg.reactions && msg.reactions.length > 0 && (
                              <div
                                className={`absolute -bottom-2.5 ${
                                  isMine ? "right-2" : "left-2"
                                } flex gap-1 bg-stone-900 border border-stone-700/80 rounded-full px-2 py-0.5 text-xs shadow-md z-10`}
                              >
                                {Array.from(
                                  msg.reactions.reduce((map, r) => {
                                    map.set(r.emoji, (map.get(r.emoji) || 0) + 1);
                                    return map;
                                  }, new Map())
                                ).map(([emoji, count]) => (
                                  <span key={emoji} className="flex items-center gap-0.5 text-[11px]">
                                    <span>{emoji}</span>
                                    {count > 1 && (
                                      <span className="text-[9px] text-stone-400">{count}</span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Hover Action Bar: Emoji React, Star, Delete */}
                          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition self-center">
                            {/* React button */}
                            <button
                              type="button"
                              onClick={() =>
                                setActiveReactionMsgId(
                                  activeReactionMsgId === msg._id ? null : msg._id
                                )
                              }
                              className="p-1 rounded-full text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition"
                              title="React"
                            >
                              <FaRegSmile className="w-3.5 h-3.5" />
                            </button>

                            {/* Star button */}
                            <button
                              type="button"
                              onClick={() => handleToggleStarMessage(msg._id)}
                              className="p-1 rounded-full text-stone-400 hover:text-amber-300 hover:bg-stone-800 transition"
                              title={isStarred ? "Unstar" : "Star"}
                            >
                              <FiStar className={`w-3.5 h-3.5 ${isStarred ? "text-amber-300 fill-amber-300" : ""}`} />
                            </button>

                            {/* Delete button (for sender) */}
                            {isMine && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm("Delete this message?")) {
                                    deleteMessageMutation(msg._id);
                                  }
                                }}
                                className="p-1 rounded-full text-stone-400 hover:text-red-400 hover:bg-stone-800 transition"
                                title="Delete message"
                              >
                                <FiTrash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Reaction Popover */}
                        {activeReactionMsgId === msg._id && (
                          <div className="flex gap-2 bg-[#16181C] border border-stone-700 p-1.5 rounded-full shadow-2xl my-1 z-30 animate-in zoom-in-95">
                            {QUICK_REACTIONS.map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => handleReactToMessage(msg._id, emoji)}
                                className="hover:scale-125 transition text-base p-1"
                              >
                                {emoji}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Timestamp & Delivery Receipt Checks */}
                        <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-stone-500">
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {/* WhatsApp-style Checkmarks */}
                          {isMine && (
                            <span className="font-mono text-xs flex items-center">
                              {msg.status === "read" || msg.seen ? (
                                <span className="text-sky-400 font-bold" title="Read">
                                  ✓✓
                                </span>
                              ) : msg.status === "delivered" ? (
                                <span className="text-stone-400 font-bold" title="Delivered">
                                  ✓✓
                                </span>
                              ) : (
                                <span className="text-stone-500 font-bold" title="Sent">
                                  ✓
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Attachment Preview (if photo chosen) */}
            {selectedImg && (
              <div className="p-3 bg-stone-950 border-t border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-700">
                    <img src={selectedImg} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setSelectedImg(null)}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 rounded-full text-white"
                    >
                      <IoCloseSharp className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-stone-300 font-medium">Photo attached</span>
                    {isViewOnce && (
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <span>1️⃣ View once enabled</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* View Once Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsViewOnce((prev) => !prev)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                    isViewOnce
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-400"
                      : "bg-stone-900 text-stone-400 border-stone-700 hover:text-white"
                  }`}
                  title="Make this a single-view photo"
                >
                  1️⃣ View Once {isViewOnce ? "(ON)" : ""}
                </button>
              </div>
            )}

            {/* Input Bar (Voice Notes + Text + Emojis) */}
            <div className="p-3 sm:p-4 border-t border-gray-800 bg-stone-950/95 backdrop-blur-md relative z-10 flex-shrink-0">
              {isRecordingAudio ? (
                /* Recording Live State */
                <div className="max-w-4xl mx-auto flex items-center justify-between gap-3 w-full bg-red-950/40 border border-red-500/30 rounded-full px-4 py-2">
                  <div className="flex items-center gap-2 text-red-400 text-xs font-bold animate-pulse">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    <span>Recording Voice Note... ({recordingSeconds}s)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={cancelRecordingAudio}
                      className="text-stone-400 hover:text-white text-xs px-3 py-1.5 rounded-full hover:bg-stone-800 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={stopAndSendAudio}
                      className="bg-primary hover:bg-sky-400 text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-1.5 transition shadow"
                    >
                      <FiSend className="w-3.5 h-3.5" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Normal Chat Input Bar */
                <form
                  onSubmit={handleSendMessage}
                  className="max-w-4xl mx-auto flex items-center gap-2 w-full relative"
                >
                  {/* Image attachment */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded-full text-stone-400 hover:text-primary hover:bg-stone-900 transition"
                    title="Send photo"
                  >
                    <FiImage className="w-5 h-5" />
                  </button>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    hidden
                    onChange={handleImageSelect}
                  />

                  {/* 1️⃣ View Once Toggle button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (!selectedImg) {
                        fileInputRef.current?.click();
                        setIsViewOnce(true);
                      } else {
                        setIsViewOnce((prev) => !prev);
                      }
                    }}
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition ${
                      isViewOnce
                        ? "bg-emerald-500 text-white border-emerald-400 shadow"
                        : "border-stone-700 text-stone-400 hover:text-emerald-400 hover:border-emerald-500/50"
                    }`}
                    title="Send 1-time view photo"
                  >
                    1
                  </button>

                  {/* Emoji button */}
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker((prev) => !prev)}
                    className="p-2 rounded-full text-stone-400 hover:text-primary hover:bg-stone-900 transition"
                    title="Add emoji"
                  >
                    <FaRegSmile className="w-5 h-5" />
                  </button>

                  {showEmojiPicker && (
                    <div className="absolute left-2 bottom-14 z-30">
                      <EmojiPicker
                        onSelect={(emoji) => setInputText((prev) => prev + emoji)}
                        onClose={() => setShowEmojiPicker(false)}
                      />
                    </div>
                  )}

                  {/* Input Text Box */}
                  <input
                    ref={textInputRef}
                    type="text"
                    placeholder={
                      activeGroup
                        ? `Message ${activeGroup.groupName}...`
                        : `Message @${activePartner?.username}...`
                    }
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="flex-1 bg-stone-900/90 border border-gray-700/80 rounded-full px-4 py-2.5 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-primary transition"
                  />

                  {/* Mic / Voice Note Record Button */}
                  {!inputText.trim() && !selectedImg ? (
                    <button
                      type="button"
                      onClick={startRecordingAudio}
                      className="p-2.5 rounded-full bg-stone-900 hover:bg-primary text-stone-300 hover:text-white transition active:scale-95 flex-shrink-0 border border-stone-800 shadow"
                      title="Hold to record voice message"
                    >
                      <FiMic className="w-4 h-4" />
                    </button>
                  ) : (
                    /* Send Button */
                    <button
                      type="submit"
                      disabled={isSending}
                      className="p-2.5 rounded-full bg-primary hover:bg-sky-400 text-white disabled:opacity-30 transition active:scale-95 flex-shrink-0 shadow-md shadow-sky-500/20"
                      title="Send message"
                    >
                      <FiSend className="w-4 h-4" />
                    </button>
                  )}
                </form>
              )}
            </div>
          </>
        )}
      </div>

      {/* CREATE GROUP MODAL */}
      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        onGroupCreated={(newGroup) => {
          setActiveGroup(newGroup);
          setActivePartner(null);
        }}
      />

      {/* GROUP INFO MODAL */}
      <GroupInfoModal
        isOpen={showGroupInfoModal}
        onClose={() => setShowGroupInfoModal(false)}
        group={activeGroup}
        authUser={authUser}
        onLeaveGroup={() => {
          setActiveGroup(null);
        }}
      />

      {/* 1-TIME VIEW FULLSCREEN MODAL */}
      {viewOnceModalData && (
        <ViewOnceModal
          isOpen={Boolean(viewOnceModalData)}
          mediaUrl={viewOnceModalData.url}
          isVideo={viewOnceModalData.isVideo}
          onClose={() => {
            // Call view once opened endpoint
            if (viewOnceModalData.messageId) {
              apiFetch(`/api/messages/view-once/${viewOnceModalData.messageId}`, {
                method: "POST",
              }).then(() => {
                if (activeGroup) {
                  queryClient.invalidateQueries({ queryKey: ["groupMessages", activeGroup._id] });
                } else {
                  queryClient.invalidateQueries({ queryKey: ["messages", activePartner?._id] });
                }
              });
            }
            setViewOnceModalData(null);
          }}
        />
      )}

      {/* 1-on-1 NEW CHAT MODAL */}
      {showNewChatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">Start a Conversation</h3>
                <p className="text-[11px] text-stone-400">
                  You can text users when both of you follow each other.
                </p>
              </div>
              <button
                onClick={() => setShowNewChatModal(false)}
                className="p-1 rounded-full text-stone-400 hover:text-white"
              >
                <IoCloseSharp className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <span className="text-xs uppercase font-semibold tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
                  <FiCheckCircle />
                  <span>Mutual Followers ({mutuals.length})</span>
                </span>
                {mutuals.length === 0 ? (
                  <p className="text-xs text-stone-500 py-2 italic">
                    No mutual followers yet. Follow other users and have them follow you back to text!
                  </p>
                ) : (
                  <div className="space-y-1">
                    {mutuals.map((user) => (
                      <div
                        key={user._id}
                        onClick={() => {
                          setActivePartner(user);
                          setActiveGroup(null);
                          setShowNewChatModal(false);
                          navigate(`/messages/${user._id}`);
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-stone-800 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-stone-700">
                            <img
                              src={user.profileImg || "/avatar-placeholder.png"}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div>
                            <p className="font-bold text-sm text-white">{user.fullName}</p>
                            <p className="text-xs text-stone-400">@{user.username}</p>
                          </div>
                        </div>
                        <span className="badge badge-sm badge-success text-[10px] text-white">
                          Can Text
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {waitingForFollowBack.length > 0 && (
                <div className="border-t border-gray-800 pt-3">
                  <span className="text-xs uppercase font-semibold tracking-wider text-amber-400 flex items-center gap-1.5 mb-2">
                    <FiLock />
                    <span>Awaiting Follow-back ({waitingForFollowBack.length})</span>
                  </span>
                  <div className="space-y-1">
                    {waitingForFollowBack.map((user) => (
                      <div
                        key={user._id}
                        onClick={() => {
                          toast.error(
                            `You follow @${user.username}, but they haven't followed you back yet.`
                          );
                        }}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-stone-950/60 opacity-60 hover:opacity-100 cursor-not-allowed transition"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden border border-stone-800">
                            <img
                              src={user.profileImg || "/avatar-placeholder.png"}
                              alt=""
                              className="w-full h-full object-cover grayscale"
                            />
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-stone-300">{user.fullName}</p>
                            <p className="text-xs text-stone-500">@{user.username}</p>
                          </div>
                        </div>
                        <span className="badge badge-sm badge-outline text-[10px] text-amber-400 border-amber-500/40">
                          🔒 Waiting
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
