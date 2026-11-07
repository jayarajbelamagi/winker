import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { IoCloseSharp, IoSend } from "react-icons/io5";
import { FiSearch, FiCopy, FiCheck, FiUsers } from "react-icons/fi";
import { apiFetch } from "../../lib/api";
import LoadingSpinner from "./LoadingSpinner";

const SharePostModal = ({ isOpen, onClose, post, authUser }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [sentMap, setSentMap] = useState({}); // { [id]: boolean }
  const queryClient = useQueryClient();

  // Fetch recent conversations & groups
  const { data: conversations = [], isLoading: loadingConvs } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await apiFetch("/api/messages/conversations");
      const json = await res.json();
      if (!res.ok) return [];
      return Array.isArray(json) ? json : [];
    },
    enabled: isOpen,
  });

  // Fetch eligible mutual contacts
  const { data: contactsData, isLoading: loadingContacts } = useQuery({
    queryKey: ["eligibleContacts"],
    queryFn: async () => {
      const res = await apiFetch("/api/messages/contacts");
      const json = await res.json();
      if (!res.ok) return [];
      return json.eligibleContacts || [];
    },
    enabled: isOpen,
  });

  const eligibleContacts = contactsData || [];

  // Send Direct Message with shared post
  const { mutate: sendToDirect, isPending: isSendingDM } = useMutation({
    mutationFn: async ({ receiverId, name }) => {
      const res = await apiFetch(`/api/messages/send/${receiverId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Shared post by @${post.user?.fullName || "user"}`,
          sharedPost: post._id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      return { id: receiverId, name };
    },
    onSuccess: ({ id, name }) => {
      setSentMap((prev) => ({ ...prev, [id]: true }));
      toast.success(`Sent to ${name}!`);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Send Group Message with shared post
  const { mutate: sendToGroup, isPending: isSendingGroup } = useMutation({
    mutationFn: async ({ conversationId, name }) => {
      const res = await apiFetch(`/api/messages/group/send/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `Shared post by @${post.user?.fullName || "user"}`,
          sharedPost: post._id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      return { id: conversationId, name };
    },
    onSuccess: ({ id, name }) => {
      setSentMap((prev) => ({ ...prev, [id]: true }));
      toast.success(`Sent to ${name}!`);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (!isOpen || !post) return null;

  const postUrl = `${window.location.origin}/post/${post._id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(postUrl);
    setCopiedLink(true);
    toast.success("Post link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // Filter conversations
  const filteredGroups = conversations
    .filter((c) => c.isGroup)
    .filter((g) =>
      (g.groupName || "Group").toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Filter contacts
  const filteredContacts = eligibleContacts.filter(
    (u) =>
      u.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#121214] border border-stone-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-stone-800 bg-[#16181C]">
          <h3 className="font-bold text-base text-white">Share Post</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition"
          >
            <IoCloseSharp className="w-5 h-5" />
          </button>
        </div>

        {/* Post Quick Preview Card */}
        <div className="p-3 bg-stone-900/50 border-b border-stone-800/80 flex items-center gap-3">
          <img
            src={post.user?.profileImg || "/avatar-placeholder.png"}
            alt=""
            className="w-10 h-10 rounded-full object-cover border border-stone-700"
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate">
              {post.user?.fullName}
            </div>
            <div className="text-xs text-stone-400 line-clamp-1">
              {post.text || (post.img ? "📷 Photo/Video" : "Shared post")}
            </div>
          </div>
          {post.img && (
            <img
              src={post.img}
              alt=""
              className="w-10 h-10 rounded-lg object-cover border border-stone-700/60"
            />
          )}
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-stone-800/80">
          <div className="relative">
            <FiSearch className="absolute left-3 top-2.5 text-stone-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search friends or groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-stone-900 border border-stone-800 rounded-full text-xs text-white focus:outline-none focus:border-primary placeholder-stone-500"
            />
          </div>
        </div>

        {/* Share Targets List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-stone-800/40">
          {loadingConvs || loadingContacts ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : (
            <>
              {/* Groups Section */}
              {filteredGroups.length > 0 && (
                <div className="pb-2">
                  <div className="text-[11px] font-semibold text-stone-500 uppercase px-3 py-1 tracking-wider">
                    Groups
                  </div>
                  {filteredGroups.map((group) => {
                    const isSent = Boolean(sentMap[group._id]);
                    return (
                      <div
                        key={group._id}
                        className="flex items-center justify-between p-2 hover:bg-stone-900/60 rounded-xl transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {group.groupImg ? (
                            <img
                              src={group.groupImg}
                              alt=""
                              className="w-9 h-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                              <FiUsers className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {group.groupName}
                            </div>
                            <div className="text-[10px] text-stone-400">
                              {group.participants?.length || 0} members
                            </div>
                          </div>
                        </div>

                        <button
                          disabled={isSent || isSendingGroup}
                          onClick={() =>
                            sendToGroup({
                              conversationId: group._id,
                              name: group.groupName,
                            })
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition ${
                            isSent
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "bg-primary hover:bg-primary/90 text-white shadow-sm"
                          }`}
                        >
                          {isSent ? (
                            <>
                              <FiCheck className="w-3.5 h-3.5" />
                              <span>Sent</span>
                            </>
                          ) : (
                            <>
                              <IoSend className="w-3 h-3" />
                              <span>Send</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Friends Section */}
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-stone-500 uppercase px-3 py-1 tracking-wider">
                  Friends
                </div>
                {filteredContacts.length === 0 && filteredGroups.length === 0 ? (
                  <div className="text-xs text-stone-500 text-center py-6">
                    No mutual friends found. Follow each other to share posts directly!
                  </div>
                ) : (
                  filteredContacts.map((contact) => {
                    const isSent = Boolean(sentMap[contact._id]);
                    return (
                      <div
                        key={contact._id}
                        className="flex items-center justify-between p-2 hover:bg-stone-900/60 rounded-xl transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={contact.profileImg || "/avatar-placeholder.png"}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover border border-stone-800"
                          />
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate">
                              {contact.fullName}
                            </div>
                            <div className="text-[10px] text-stone-400 truncate">
                              @{contact.username}
                            </div>
                          </div>
                        </div>

                        <button
                          disabled={isSent || isSendingDM}
                          onClick={() =>
                            sendToDirect({
                              receiverId: contact._id,
                              name: contact.fullName,
                            })
                          }
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition ${
                            isSent
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : "bg-primary hover:bg-primary/90 text-white shadow-sm"
                          }`}
                        >
                          {isSent ? (
                            <>
                              <FiCheck className="w-3.5 h-3.5" />
                              <span>Sent</span>
                            </>
                          ) : (
                            <>
                              <IoSend className="w-3 h-3" />
                              <span>Send</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer: Copy Link Button */}
        <div className="p-3 border-t border-stone-800 bg-[#16181C] flex items-center justify-between">
          <span className="text-xs text-stone-400">Or share link directly</span>
          <button
            onClick={handleCopyLink}
            className="px-3.5 py-1.5 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            {copiedLink ? (
              <>
                <FiCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied!</span>
              </>
            ) : (
              <>
                <FiCopy className="w-3.5 h-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SharePostModal;
