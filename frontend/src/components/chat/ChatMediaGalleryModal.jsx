import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IoCloseSharp } from "react-icons/io5";
import { FiImage, FiMic, FiLink, FiStar, FiCopy, FiExternalLink } from "react-icons/fi";
import { toast } from "react-hot-toast";
import { apiFetch } from "../../lib/api";
import LoadingSpinner from "../common/LoadingSpinner";
import VoiceNotePlayer from "./VoiceNotePlayer";

const ChatMediaGalleryModal = ({ isOpen, onClose, conversationId, title = "Chat Gallery" }) => {
  const [activeTab, setActiveTab] = useState("media"); // "media" | "audio" | "links" | "starred"
  const [previewMedia, setPreviewMedia] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["conversationMedia", conversationId],
    queryFn: async () => {
      if (!conversationId) return { media: [], audio: [], links: [], starred: [] };
      const res = await apiFetch(`/api/messages/conversation/${conversationId}/media`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load media");
      return json;
    },
    enabled: Boolean(isOpen && conversationId),
  });

  if (!isOpen) return null;

  const mediaList = data?.media || [];
  const audioList = data?.audio || [];
  const linksList = data?.links || [];
  const starredList = data?.starred || [];

  const handleCopyLink = (url) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-[#121214] border border-stone-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800 bg-[#16181C]">
          <h3 className="font-bold text-base text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition"
          >
            <IoCloseSharp className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-stone-800 bg-stone-900/60 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("media")}
            className={`flex-1 py-3 flex items-center justify-center gap-1.5 transition border-b-2 ${
              activeTab === "media"
                ? "border-primary text-primary"
                : "border-transparent text-stone-400 hover:text-white"
            }`}
          >
            <FiImage className="w-4 h-4" />
            <span>Media ({mediaList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("audio")}
            className={`flex-1 py-3 flex items-center justify-center gap-1.5 transition border-b-2 ${
              activeTab === "audio"
                ? "border-primary text-primary"
                : "border-transparent text-stone-400 hover:text-white"
            }`}
          >
            <FiMic className="w-4 h-4" />
            <span>Voice ({audioList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("links")}
            className={`flex-1 py-3 flex items-center justify-center gap-1.5 transition border-b-2 ${
              activeTab === "links"
                ? "border-primary text-primary"
                : "border-transparent text-stone-400 hover:text-white"
            }`}
          >
            <FiLink className="w-4 h-4" />
            <span>Links ({linksList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("starred")}
            className={`flex-1 py-3 flex items-center justify-center gap-1.5 transition border-b-2 ${
              activeTab === "starred"
                ? "border-amber-400 text-amber-400"
                : "border-transparent text-stone-400 hover:text-white"
            }`}
          >
            <FiStar className="w-4 h-4" />
            <span>Starred ({starredList.length})</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <>
              {/* 📷 Media Tab */}
              {activeTab === "media" && (
                mediaList.length === 0 ? (
                  <div className="text-center py-16 text-stone-500 text-sm">
                    No photos or videos shared yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {mediaList.map((item) => (
                      <div
                        key={item._id}
                        onClick={() => setPreviewMedia(item)}
                        className="aspect-square rounded-xl overflow-hidden bg-stone-900 border border-stone-800 cursor-pointer hover:opacity-90 transition relative group"
                      >
                        {item.mediaType === "video" ? (
                          <div className="w-full h-full relative">
                            <video
                              src={item.url}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/30 flex items-center justify-center text-white text-xs font-bold">
                              ▶ Video
                            </div>
                          </div>
                        ) : (
                          <img
                            src={item.url}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* 🎙️ Voice Notes Tab */}
              {activeTab === "audio" && (
                audioList.length === 0 ? (
                  <div className="text-center py-16 text-stone-500 text-sm">
                    No voice notes sent yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {audioList.map((item) => (
                      <div
                        key={item._id}
                        className="p-3 rounded-2xl bg-stone-900/60 border border-stone-800 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={item.sender?.profileImg || "/avatar-placeholder.png"}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover border border-stone-700"
                          />
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-white truncate block">
                              {item.sender?.fullName}
                            </span>
                            <span className="text-[10px] text-stone-400">
                              {new Date(item.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 max-w-xs">
                          <VoiceNotePlayer
                            audioUrl={item.url}
                            duration={item.duration}
                            isMine={false}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* 🔗 Links Tab */}
              {activeTab === "links" && (
                linksList.length === 0 ? (
                  <div className="text-center py-16 text-stone-500 text-sm">
                    No links found in this chat.
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {linksList.map((link, idx) => (
                      <div
                        key={link._id + idx}
                        className="p-3 rounded-xl bg-stone-900/70 border border-stone-800 flex items-center justify-between gap-3 hover:border-stone-700 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm font-semibold text-sky-400 hover:underline truncate block"
                          >
                            {link.url}
                          </a>
                          <span className="text-[10px] text-stone-500">
                            Shared by {link.sender?.fullName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleCopyLink(link.url)}
                            className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition"
                            title="Copy link"
                          >
                            <FiCopy className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 transition"
                            title="Open link"
                          >
                            <FiExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* ⭐ Starred Messages Tab */}
              {activeTab === "starred" && (
                starredList.length === 0 ? (
                  <div className="text-center py-16 text-stone-500 text-sm">
                    No starred messages yet. Star any important message to find it here quickly!
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {starredList.map((msg) => (
                      <div
                        key={msg._id}
                        className="p-3 rounded-xl bg-stone-900/80 border border-amber-500/30 space-y-1 relative"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-amber-300">
                            {msg.senderId?.fullName || "Member"}
                          </span>
                          <span className="text-[10px] text-stone-500">
                            {new Date(msg.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {msg.text && (
                          <p className="text-xs text-stone-200 whitespace-pre-wrap">
                            {msg.text}
                          </p>
                        )}
                        {msg.img && (
                          <img
                            src={msg.img}
                            alt=""
                            className="h-24 rounded-lg object-cover border border-stone-800 mt-1"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </div>

        {/* Media Preview Modal Overlay */}
        {previewMedia && (
          <div
            onClick={() => setPreviewMedia(null)}
            className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl border border-stone-800">
              {previewMedia.mediaType === "video" ? (
                <video
                  src={previewMedia.url}
                  controls
                  autoPlay
                  className="max-h-[85vh] w-auto object-contain"
                />
              ) : (
                <img
                  src={previewMedia.url}
                  alt=""
                  className="max-h-[85vh] w-auto object-contain"
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMediaGalleryModal;
