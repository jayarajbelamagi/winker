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
  FiCheck,
  FiCheckCircle,
  FiTrash2,
} from "react-icons/fi";
import { FaArrowLeft, FaRegSmile } from "react-icons/fa";
import { IoCloseSharp } from "react-icons/io5";
import { RiChatNewFill } from "react-icons/ri";

import EmojiPicker from "../../components/common/EmojiPicker";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useCall } from "../../context/CallContext";

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

const MessagesPage = ({ authUser }) => {
  const { userId: routeUserId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activePartner, setActivePartner] = useState(null);
  const [inputText, setInputText] = useState("");
  const [selectedImg, setSelectedImg] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");

  const { startCall: triggerGlobalCall } = useCall();

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);

  // 1. Fetch Conversations
  const { data: conversations = [], isLoading: isLoadingConvs, refetch: refetchConvs } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await apiFetch("/api/messages/conversations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load chats");
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 5000, // Poll every 5s for live conversation updates
  });

  // Active streak status with selected chat partner
  const activeConversation = conversations.find(
    (c) => c.otherUser?._id === activePartner?._id
  );
  const activeStreak = activeConversation?.streak;

  // 2. Fetch Eligible Contacts (Mutuals vs Awaiting Follow-back)
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

  // 3. Resolve active partner from URL parameter or selection
  useEffect(() => {
    if (routeUserId) {
      // Find in conversations or contacts
      const conv = conversations.find((c) => c.otherUser?._id === routeUserId);
      if (conv?.otherUser) {
        setActivePartner(conv.otherUser);
      } else {
        const mutual = mutuals.find((m) => m._id === routeUserId);
        if (mutual) {
          setActivePartner(mutual);
        } else {
          // Fetch user details
          apiFetch(`/api/users/profile/${routeUserId}`)
            .then((r) => r.json())
            .then((u) => {
              if (u && !u.error) setActivePartner(u);
            })
            .catch(() => {});
        }
      }
    }
  }, [routeUserId, conversations, mutuals]);

  // 4. Fetch Messages for active partner
  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
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
    refetchInterval: 3000, // Live poll every 3s for real-time chat & seen updates
  });

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 5. Send Message Mutation
  const { mutate: sendMessageMutation, isPending: isSending } = useMutation({
    mutationFn: async ({ text, img, callInfo }) => {
      if (!activePartner?._id) throw new Error("No recipient selected");
      const res = await apiFetch(`/api/messages/send/${activePartner._id}`, {
        method: "POST",
        body: JSON.stringify({ text, img, callInfo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send message");
      return data;
    },
    onSuccess: (newMsg) => {
      setInputText("");
      setSelectedImg(null);
      setShowEmojiPicker(false);
      queryClient.setQueryData(["messages", activePartner?._id], (old) => [
        ...(old || []),
        newMsg,
      ]);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to send message");
    },
  });

  // 7. Delete Message Mutation
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
      queryClient.setQueryData(["messages", activePartner?._id], (old) =>
        (old || []).filter((m) => m._id !== deletedId)
      );
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Message deleted");
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete message");
    },
  });

  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (!inputText.trim() && !selectedImg) return;
    sendMessageMutation({ text: inputText, img: selectedImg });
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

  const startCall = (type) => {
    if (!activePartner) return;
    triggerGlobalCall({ partner: activePartner, callType: type });
  };

  // Find last sent message by authUser to show seen status
  const lastAuthMessage = [...messages]
    .reverse()
    .find((m) => m.senderId === authUser?._id);

  return (
    <div className="flex-1 min-w-0 w-full flex h-[calc(100dvh-3.5rem)] md:h-screen bg-black text-white overflow-hidden pb-0 border-r border-gray-800 relative">
      {/* LEFT: Conversations List (Hidden on mobile if a partner is active, wide on desktop) */}
      <div
        className={`w-full md:w-[350px] lg:w-[380px] xl:w-[410px] border-r border-gray-800 flex flex-col bg-stone-950/80 backdrop-blur-md flex-shrink-0 h-full ${
          activePartner ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-stone-950/90 backdrop-blur z-10">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Messages</span>
          </h1>
          <button
            onClick={() => setShowNewChatModal(true)}
            className="p-2 rounded-full bg-primary/20 text-primary hover:bg-primary hover:text-white transition"
            title="New Chat (Mutual followers)"
          >
            <RiChatNewFill className="w-5 h-5" />
          </button>
        </div>

        {/* Search Conversations */}
        <div className="p-3 border-b border-gray-800">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-stone-900 border border-gray-800 rounded-full pl-9 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Conversations Scroll Area */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-900">
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
                Start a direct conversation with anyone who follows you back!
              </p>
              <button
                onClick={() => setShowNewChatModal(true)}
                className="btn btn-primary btn-sm rounded-full text-white px-5"
              >
                + New Chat
              </button>
            </div>
          ) : (
            conversations
              .filter((c) =>
                c.otherUser?.fullName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                c.otherUser?.username?.toLowerCase().includes(searchFilter.toLowerCase())
              )
              .map((conv) => {
                const partner = conv.otherUser;
                const isSelected = activePartner?._id === partner?._id;
                const isUnread = conv.lastMessage?.senderId !== authUser?._id && !conv.lastMessage?.seen;

                return (
                  <div
                    key={conv._id}
                    onClick={() => {
                      setActivePartner(partner);
                      navigate(`/messages/${partner._id}`);
                    }}
                    className={`flex items-center gap-3 p-3.5 cursor-pointer transition ${
                      isSelected
                        ? "bg-sky-500/10 border-l-4 border-primary"
                        : "hover:bg-stone-900/60"
                    }`}
                  >
                    <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 border border-stone-700">
                      <img
                        src={partner?.profileImg || "/avatar-placeholder.png"}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/avatar-placeholder.png";
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-bold text-sm text-white truncate">
                            {partner?.fullName}
                          </span>
                          {conv.streak && conv.streak.count > 0 && (
                            <span
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold shadow-sm flex-shrink-0 ${
                                conv.streak.isExpiring
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                                  : "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                              }`}
                              title={
                                conv.streak.isExpiring
                                  ? `Streak ending in ${conv.streak.hoursRemaining}h! Send a text or call to save it!`
                                  : `${conv.streak.count}-day streak! Keep it going with daily interactions.`
                              }
                            >
                              <span>🔥</span>
                              <span>{conv.streak.count}</span>
                              {conv.streak.isExpiring && <span>⌛</span>}
                            </span>
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
                        {isUnread && (
                          <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>

      {/* RIGHT: Active Chat Conversation Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 h-full bg-black relative ${
          !activePartner ? "hidden md:flex items-center justify-center" : "flex"
        }`}
      >
        {!activePartner ? (
          /* Empty selection on desktop */
          <div className="text-center p-8 max-w-sm">
            <div className="w-16 h-16 rounded-full bg-stone-900 text-3xl flex items-center justify-center mx-auto mb-4">
              ✉️
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Select a conversation</h2>
            <p className="text-xs text-stone-400 mb-6">
              Choose from your existing chats or start a new conversation with mutual connections.
            </p>
            <button
              onClick={() => setShowNewChatModal(true)}
              className="btn btn-primary rounded-full btn-sm text-white px-5"
            >
              + New Message
            </button>
          </div>
        ) : (
          <>
            {/* Active Chat Top Header */}
            <div className="p-3 border-b border-gray-800 bg-stone-950/90 backdrop-blur flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-3">
                {/* Mobile Back Button */}
                <button
                  onClick={() => {
                    setActivePartner(null);
                    navigate("/messages");
                  }}
                  className="p-2 -ml-1 rounded-full hover:bg-stone-800 text-stone-300 md:hidden"
                  title="Back to chats"
                >
                  <FaArrowLeft className="w-4 h-4" />
                </button>

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
                      className="font-bold text-sm text-white hover:underline flex items-center gap-1.5 truncate"
                    >
                      <span>{activePartner.fullName}</span>
                    </Link>
                    {activeStreak && activeStreak.count > 0 && (
                      <div
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 cursor-default select-none shadow-sm ${
                          activeStreak.isExpiring
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse"
                            : "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                        }`}
                        title={
                          activeStreak.isExpiring
                            ? `Streak expires in ${activeStreak.hoursRemaining}h! Send a message or call to keep it alive.`
                            : `${activeStreak.count} day streak! Interact every 24 hours to keep the flame burning.`
                        }
                      >
                        <span>🔥</span>
                        <span>{activeStreak.count}</span>
                        {activeStreak.isExpiring && (
                          <span className="flex items-center gap-0.5 text-[10px] text-amber-300 font-semibold">
                            <span>⌛</span>
                            <span>{activeStreak.hoursRemaining}h left</span>
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
              </div>

              {/* Calling Action Buttons (Phone & Video) */}
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => startCall("audio")}
                  className="p-2.5 rounded-full text-stone-300 hover:text-white hover:bg-stone-800 transition active:scale-95"
                  title="Audio Call"
                >
                  <FiPhone className="w-5 h-5" />
                </button>

                <button
                  onClick={() => startCall("video")}
                  className="p-2.5 rounded-full text-stone-300 hover:text-white hover:bg-stone-800 transition active:scale-95"
                  title="Video Call"
                >
                  <FiVideo className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Streak Expiring Warning Banner (Snapchat 12h countdown warning) */}
            {activeStreak && activeStreak.isExpiring && (
              <div className="mx-4 mt-2.5 mb-1 px-3.5 py-2 bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/15 border border-amber-500/35 rounded-2xl flex items-center justify-between text-xs text-amber-300 shadow-md animate-pulse">
                <div className="flex items-center gap-2">
                  <span className="text-base">⌛</span>
                  <span>
                    Your <strong>🔥 {activeStreak.count}-day streak</strong> with {activePartner.fullName} is ending in{" "}
                    <strong>{activeStreak.hoursRemaining} hours</strong>!
                  </span>
                </div>
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wide flex-shrink-0">
                  Send a text or call to save it!
                </span>
              </div>
            )}

            {/* Messages Scroll View */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 scroll-smooth">
              <div className="max-w-4xl mx-auto w-full space-y-3.5 flex flex-col">
              {isLoadingMessages ? (
                <div className="flex justify-center py-12">
                  <LoadingSpinner size="md" />
                </div>
              ) : messages.length === 0 ? (
                <div className="py-16 text-center text-stone-500">
                  <p className="text-sm font-semibold text-white mb-1">
                    Say hello to {activePartner.fullName}! 👋
                  </p>
                  <p className="text-xs text-stone-400">
                    You both follow each other. Messages are direct and private.
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMine = msg.senderId === authUser?._id;
                  const isLastSent = lastAuthMessage?._id === msg._id;
                  const isCallLog = Boolean(msg.callInfo?.callType);

                  if (isCallLog) {
                    return (
                      <div key={msg._id || idx} className="flex justify-center my-2">
                        <div className="bg-stone-900 border border-stone-800 rounded-full px-4 py-1.5 text-xs text-stone-400 flex items-center gap-2">
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

                  return (
                    <div
                      key={msg._id || idx}
                      className={`flex flex-col group ${isMine ? "items-end" : "items-start"}`}
                    >
                      <div className={`flex items-center gap-1.5 ${isMine ? "flex-row-reverse" : "flex-row"}`}>
                        <div
                          className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-md ${
                            isMine
                              ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-tr-sm"
                              : "bg-stone-900 border border-stone-800 text-stone-100 rounded-tl-sm"
                          }`}
                        >
                          {msg.img && (
                            <img
                              src={msg.img}
                              alt=""
                              className="rounded-xl max-h-60 w-full object-cover mb-2 border border-black/20"
                            />
                          )}
                          <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                        </div>

                        {/* Delete Message Button */}
                        {isMine && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm("Delete this message?")) {
                                deleteMessageMutation(msg._id);
                              }
                            }}
                            className="opacity-60 sm:opacity-0 sm:group-hover:opacity-100 p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-red-400 transition"
                            title="Delete message"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Seen / Delivery Status under message */}
                      <div className="flex items-center gap-1.5 mt-1 px-1 text-[10px] text-stone-500">
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {isMine && isLastSent && (
                          <span className="font-medium text-sky-400">
                            {msg.seen ? (
                              <span className="flex items-center gap-0.5">
                                <span className="font-bold">✓✓</span>
                                <span>Seen {formatSeenAgo(msg.seenAt)}</span>
                              </span>
                            ) : (
                              <span>✓ Sent</span>
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

            {/* Image Preview if selected */}
            {selectedImg && (
              <div className="p-3 bg-stone-950 border-t border-gray-800">
                <div className="max-w-4xl mx-auto flex items-center gap-3">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-700">
                    <img src={selectedImg} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => setSelectedImg(null)}
                      className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 rounded-full text-white"
                    >
                      <IoCloseSharp className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-stone-400">Photo attached</span>
                </div>
              </div>
            )}

            {/* Bottom Message Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 sm:p-4 border-t border-gray-800 bg-stone-950/95 backdrop-blur-md relative z-10 flex-shrink-0"
            >
              <div className="max-w-4xl mx-auto flex items-center gap-2.5 w-full relative">
                {/* Image upload button */}
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

                {/* Textarea */}
                <input
                  ref={textInputRef}
                  type="text"
                  placeholder={`Message @${activePartner.username}...`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  className="flex-1 bg-stone-900/90 border border-gray-700/80 rounded-full px-5 py-2.5 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
                />

                {/* Send button */}
                <button
                  type="submit"
                  disabled={isSending || (!inputText.trim() && !selectedImg)}
                  className="p-2.5 rounded-full bg-primary hover:bg-sky-400 text-white disabled:opacity-30 disabled:hover:bg-primary transition active:scale-95 flex-shrink-0 shadow-md shadow-sky-500/20"
                  title="Send message"
                >
                  <FiSend className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        )}
      </div>

      {/* NEW CHAT MODAL (MUTUAL FOLLOWERS ENFORCEMENT) */}
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
              {/* Mutual Followers Section */}
              <div>
                <span className="text-xs uppercase font-semibold tracking-wider text-emerald-400 flex items-center gap-1.5 mb-2">
                  <FiCheckCircle />
                  <span>Mutual Followers ({mutuals.length})</span>
                </span>
                {mutuals.length === 0 ? (
                  <p className="text-xs text-stone-500 py-2 italic">
                    No mutual followers yet. Follow other users and have them follow you back to start texting!
                  </p>
                ) : (
                  <div className="space-y-1">
                    {mutuals.map((user) => (
                      <div
                        key={user._id}
                        onClick={() => {
                          setActivePartner(user);
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

              {/* Waiting for Follow-back Section (Locked) */}
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
                            `You follow @${user.username}, but they haven't followed you back yet. You can text once @${user.username} follows you back!`
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
