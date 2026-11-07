import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { IoCloseSharp } from "react-icons/io5";
import { FiUserPlus, FiLogOut, FiUsers } from "react-icons/fi";
import { Link } from "react-router-dom";
import LoadingSpinner from "../common/LoadingSpinner";
import { apiFetch } from "../../lib/api";

const GroupInfoModal = ({ isOpen, onClose, group, authUser, onLeaveGroup }) => {
  const queryClient = useQueryClient();
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedToAdd, setSelectedToAdd] = useState([]);

  // Fetch group details
  const { data: groupDetails, isLoading: isGroupLoading } = useQuery({
    queryKey: ["groupDetails", group?._id],
    queryFn: async () => {
      const res = await apiFetch(`/api/messages/group/${group._id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load group details");
      return data;
    },
    enabled: Boolean(isOpen && group?._id),
  });

  // Fetch mutual connections for adding new members
  const { data: contacts } = useQuery({
    queryKey: ["eligibleContacts"],
    queryFn: async () => {
      const res = await apiFetch("/api/messages/contacts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load contacts");
      return data || [];
    },
    enabled: Boolean(showAddMembers),
  });

  // Add members mutation
  const { mutate: addMembersMutation, isPending: isAdding } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/messages/group/${group._id}/add`, {
        method: "POST",
        body: JSON.stringify({ newMemberIds: selectedToAdd }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add members");
      return data;
    },
    onSuccess: () => {
      toast.success("Members added to group!");
      queryClient.invalidateQueries({ queryKey: ["groupDetails", group._id] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      queryClient.invalidateQueries({ queryKey: ["groupMessages", group._id] });
      setShowAddMembers(false);
      setSelectedToAdd([]);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to add members");
    },
  });

  // Leave group mutation
  const { mutate: leaveGroupMutation, isPending: isLeaving } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/messages/group/${group._id}/leave`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to leave group");
      return data;
    },
    onSuccess: () => {
      toast.success("You left the group");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onLeaveGroup && onLeaveGroup(group._id);
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to leave group");
    },
  });

  if (!isOpen || !group) return null;

  const currentGroup = groupDetails || group;
  const participants = currentGroup.participants || [];
  const isAdmin = (currentGroup.groupAdmin?._id || currentGroup.groupAdmin)?.toString() === authUser?._id?.toString();

  // Filter contacts not already in group
  const existingIds = new Set(participants.map((p) => (p._id || p).toString()));
  const eligibleToAdd = (contacts || []).filter((c) => !existingIds.has(c._id.toString()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-stone-950 border border-gray-800 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-stone-900/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <FiUsers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Group Info</h2>
              <p className="text-xs text-stone-400">{participants.length} members</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <IoCloseSharp className="w-5 h-5" />
          </button>
        </div>

        {/* Group Banner & Title */}
        <div className="p-5 border-b border-gray-800 bg-stone-900/20 flex flex-col items-center text-center flex-shrink-0">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center text-3xl shadow-xl shadow-emerald-500/20 mb-3">
            {currentGroup.groupImg ? (
              <img src={currentGroup.groupImg} alt="" className="w-full h-full object-cover rounded-2xl" />
            ) : (
              "👥"
            )}
          </div>
          <h3 className="font-bold text-lg text-white">{currentGroup.groupName}</h3>
          {currentGroup.groupDescription && (
            <p className="text-xs text-stone-400 mt-1 max-w-xs">{currentGroup.groupDescription}</p>
          )}
        </div>

        {/* Members List Section */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Participants ({participants.length})
            </span>
            <button
              onClick={() => setShowAddMembers((prev) => !prev)}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
            >
              <FiUserPlus className="w-3.5 h-3.5" />
              <span>Add Member</span>
            </button>
          </div>

          {/* Add Members Inline Selector */}
          {showAddMembers && (
            <div className="p-3 bg-stone-900 border border-stone-800 rounded-2xl space-y-2 animate-in fade-in">
              <span className="text-xs font-semibold text-white block">Add Mutual Contacts:</span>
              {eligibleToAdd.length === 0 ? (
                <p className="text-xs text-stone-500 italic py-2">
                  All your mutual connections are already in this group.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto space-y-1.5">
                  {eligibleToAdd.map((contact) => {
                    const isSelected = selectedToAdd.includes(contact._id);
                    return (
                      <div
                        key={contact._id}
                        onClick={() =>
                          setSelectedToAdd((prev) =>
                            prev.includes(contact._id)
                              ? prev.filter((id) => id !== contact._id)
                              : [...prev, contact._id]
                          )
                        }
                        className={`p-2 rounded-xl flex items-center justify-between text-xs cursor-pointer transition ${
                          isSelected ? "bg-emerald-500/20 text-emerald-300 font-bold" : "hover:bg-stone-800 text-stone-300"
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <img
                            src={contact.profileImg || "/avatar-placeholder.png"}
                            alt=""
                            className="w-6 h-6 rounded-full object-cover"
                          />
                          <span className="truncate">{contact.fullName}</span>
                        </div>
                        <span>{isSelected ? "✓" : "+"}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedToAdd.length > 0 && (
                <button
                  onClick={() => addMembersMutation()}
                  disabled={isAdding}
                  className="btn btn-xs btn-primary rounded-xl text-white w-full mt-2"
                >
                  {isAdding ? "Adding..." : `Add ${selectedToAdd.length} to group`}
                </button>
              )}
            </div>
          )}

          {/* Existing Members */}
          <div className="divide-y divide-gray-800/60">
            {participants.map((member) => {
              const isMemberAdmin = (currentGroup.groupAdmin?._id || currentGroup.groupAdmin)?.toString() === member._id?.toString();
              const isMe = member._id?.toString() === authUser?._id?.toString();

              return (
                <div key={member._id} className="py-2.5 flex items-center justify-between gap-2">
                  <Link
                    to={`/profile/${member.username}`}
                    onClick={onClose}
                    className="flex items-center gap-2.5 min-w-0 group"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden border border-stone-700 flex-shrink-0">
                      <img
                        src={member.profileImg || "/avatar-placeholder.png"}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-white group-hover:underline truncate">
                          {member.fullName}
                        </span>
                        {isMe && <span className="text-[10px] text-stone-400">(You)</span>}
                      </div>
                      <span className="text-[11px] text-stone-500 truncate">@{member.username}</span>
                    </div>
                  </Link>

                  {isMemberAdmin && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-semibold flex-shrink-0">
                      👑 Admin
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer: Leave Group Button */}
        <div className="p-3.5 border-t border-gray-800 bg-stone-900/60 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => {
              if (window.confirm(`Are you sure you want to leave "${currentGroup.groupName}"?`)) {
                leaveGroupMutation();
              }
            }}
            disabled={isLeaving}
            className="btn btn-xs btn-outline btn-error rounded-xl gap-1.5"
          >
            <FiLogOut className="w-3.5 h-3.5" />
            <span>{isLeaving ? "Leaving..." : "Leave Group"}</span>
          </button>

          <button
            onClick={onClose}
            className="btn btn-xs btn-ghost text-stone-400 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupInfoModal;
