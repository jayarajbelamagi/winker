import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { IoRadioOutline, IoAdd, IoClose } from "react-icons/io5";
import { apiFetch } from "../../lib/api";
import SpaceModal from "./SpaceModal";

const AudioSpacesBar = ({ authUser }) => {
  const [activeSpaceId, setActiveSpaceId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const queryClient = useQueryClient();

  const { data: spaces = [] } = useQuery({
    queryKey: ["activeSpaces"],
    queryFn: async () => {
      const res = await apiFetch("/api/spaces/active");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10000,
  });

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error("Please enter a title for your Space");
      return;
    }

    try {
      setIsCreating(true);
      const res = await apiFetch("/api/spaces/create", {
        method: "POST",
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start space");

      toast.success("Space started! You are live 🎙️");
      setShowCreateModal(false);
      setNewTitle("");
      queryClient.invalidateQueries({ queryKey: ["activeSpaces"] });
      setActiveSpaceId(data._id);
    } catch (err) {
      toast.error(err.message || "Failed to start space");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2.5 overflow-x-auto py-2.5 px-3 sm:px-4 border-b border-gray-700 bg-stone-900/30 scrollbar-none">
        {/* Start Space Pill */}
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white text-xs font-bold px-3 py-1.5 rounded-full flex-shrink-0 transition shadow-sm"
        >
          <IoRadioOutline className="w-4 h-4" />
          <span>Start Space</span>
        </button>

        {/* Active Spaces Pills */}
        {spaces.map((space) => {
          const host = space.hostId || {};
          return (
            <div
              key={space._id}
              onClick={() => setActiveSpaceId(space._id)}
              className="flex items-center gap-2 bg-[#16181C] hover:bg-stone-800 border border-purple-500/40 hover:border-purple-400 px-3 py-1.5 rounded-full cursor-pointer flex-shrink-0 transition shadow-sm group"
            >
              <div className="relative w-5 h-5 rounded-full overflow-hidden border border-purple-400">
                <img
                  src={host.profileImg || "/avatar-placeholder.png"}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs font-semibold text-white max-w-[120px] truncate group-hover:text-purple-300">
                {space.title}
              </span>
              <span className="flex items-center gap-1 text-[10px] bg-red-500/20 text-red-400 font-bold px-1.5 py-0.2 rounded-full border border-red-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                LIVE
              </span>
            </div>
          );
        })}
      </div>

      {/* Create Space Dialog */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16181C] border border-stone-800 w-full max-w-sm rounded-2xl p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <IoRadioOutline className="text-purple-500 w-5 h-5" />
                <h3 className="font-bold text-white text-base">Start an Audio Space</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-white"
              >
                <IoClose className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSpace} className="mt-4 space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-400 mb-1 block">
                  What do you want to talk about?
                </label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Weekend Tech Talk, AI & Social Apps..."
                  maxLength={60}
                  className="w-full bg-stone-900 border border-stone-800 rounded-xl px-3 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-purple-500"
                  autoFocus
                />
              </div>

              <p className="text-[11px] text-stone-500">
                Anyone on Winker can tune in as a listener and request to speak.
              </p>

              <button
                type="submit"
                disabled={isCreating}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold py-2.5 rounded-full text-sm transition shadow flex items-center justify-center gap-2"
              >
                {isCreating ? (
                  <>
                    <span className="loading loading-spinner loading-xs"></span>
                    <span>Starting Space...</span>
                  </>
                ) : (
                  "Go Live Now"
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Active Space Room Modal */}
      {activeSpaceId && (
        <SpaceModal
          spaceId={activeSpaceId}
          authUser={authUser}
          onClose={() => setActiveSpaceId(null)}
          onSpaceEnded={() => {
            queryClient.invalidateQueries({ queryKey: ["activeSpaces"] });
            setActiveSpaceId(null);
          }}
        />
      )}
    </>
  );
};

export default AudioSpacesBar;
