import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { IoCloseSharp } from "react-icons/io5";
import { FiSearch, FiCheck } from "react-icons/fi";
import { HiUserGroup } from "react-icons/hi2";
import LoadingSpinner from "../common/LoadingSpinner";
import { apiFetch } from "../../lib/api";

const CreateGroupModal = ({ isOpen, onClose, onGroupCreated }) => {
  const queryClient = useQueryClient();
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  // Fetch mutual connections who can be added to the group
  const { data: contacts, isLoading } = useQuery({
    queryKey: ["eligibleContacts"],
    queryFn: async () => {
      const res = await apiFetch("/api/messages/contacts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load contacts");
      return data || [];
    },
    enabled: Boolean(isOpen),
  });

  const { mutate: createGroupMutation, isPending } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch("/api/messages/group/create", {
        method: "POST",
        body: JSON.stringify({
          groupName: groupName.trim(),
          groupDescription: groupDescription.trim(),
          memberIds: selectedUserIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create group");
      return data;
    },
    onSuccess: (newGroup) => {
      toast.success(`Group "${newGroup.groupName}" created!`);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onGroupCreated && onGroupCreated(newGroup);
      handleClose();
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create group");
    },
  });

  const handleClose = () => {
    setGroupName("");
    setGroupDescription("");
    setSearchQuery("");
    setSelectedUserIds([]);
    onClose();
  };

  const toggleSelectUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  if (!isOpen) return null;

  const eligibleContacts = contacts || [];
  const filteredContacts = eligibleContacts.filter(
    (c) =>
      c.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-stone-950 border border-gray-800 rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-stone-900/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <HiUserGroup className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base text-white">Create New Group</h2>
              <p className="text-xs text-stone-400">Add mutual followers to group chat</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition"
          >
            <IoCloseSharp className="w-5 h-5" />
          </button>
        </div>

        {/* Group Info Inputs */}
        <div className="p-4 border-b border-gray-800 space-y-3 flex-shrink-0 bg-stone-900/20">
          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1">
              Group Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Weekend Trip, Work Team..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={40}
              className="w-full bg-stone-900 border border-gray-700 rounded-xl px-3.5 py-2 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-300 mb-1">
              Description (Optional)
            </label>
            <input
              type="text"
              placeholder="What is this group about?"
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              maxLength={100}
              className="w-full bg-stone-900 border border-gray-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-primary"
            />
          </div>

          {/* Selected Member Chips */}
          {selectedUserIds.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-stone-400 mb-1.5">
                Selected ({selectedUserIds.length} members):
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                {selectedUserIds.map((id) => {
                  const user = eligibleContacts.find((c) => c._id === id);
                  if (!user) return null;
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-medium"
                    >
                      <span className="truncate max-w-[100px]">{user.fullName}</span>
                      <button
                        type="button"
                        onClick={() => toggleSelectUser(id)}
                        className="hover:text-white"
                      >
                        <IoCloseSharp className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Member Search */}
        <div className="p-3 border-b border-gray-800 bg-stone-900/30">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-xs" />
            <input
              type="text"
              placeholder="Search mutual connections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-900 border border-gray-800 rounded-full pl-8 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto p-3 divide-y divide-gray-800/40">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <LoadingSpinner size="md" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-10 text-stone-500 text-xs">
              {searchQuery ? "No matching contacts found." : "No mutual connections yet to add."}
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isSelected = selectedUserIds.includes(contact._id);
              return (
                <div
                  key={contact._id}
                  onClick={() => toggleSelectUser(contact._id)}
                  className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition ${
                    isSelected ? "bg-emerald-500/10 border border-emerald-500/30" : "hover:bg-stone-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="avatar flex-shrink-0">
                      <div className="w-9 h-9 rounded-full overflow-hidden border border-stone-700">
                        <img
                          src={contact.profileImg || "/avatar-placeholder.png"}
                          alt=""
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/avatar-placeholder.png";
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-xs text-white truncate">
                        {contact.fullName}
                      </span>
                      <span className="text-[11px] text-stone-400 truncate">
                        @{contact.username}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center border transition ${
                      isSelected
                        ? "bg-emerald-500 border-emerald-500 text-black"
                        : "border-stone-600 bg-transparent"
                    }`}
                  >
                    {isSelected && <FiCheck className="w-3.5 h-3.5 font-black" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 border-t border-gray-800 bg-stone-900/60 flex items-center justify-between flex-shrink-0">
          <span className="text-xs text-stone-400">
            {selectedUserIds.length === 0
              ? "Select at least 1 member"
              : `${selectedUserIds.length} members selected`}
          </span>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="btn btn-xs btn-ghost text-stone-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => createGroupMutation()}
              disabled={isPending || !groupName.trim() || selectedUserIds.length === 0}
              className="btn btn-xs btn-primary rounded-xl text-white px-4 disabled:opacity-40"
            >
              {isPending ? "Creating..." : "Create Group"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
