import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import { useCall } from "../../context/CallContext";

import {
  FiPhone,
  FiVideo,
  FiSearch,
  FiPlus,
  FiClock,
} from "react-icons/fi";
import {
  MdCallMade,
  MdCallReceived,
  MdCallMissed,
  MdPhoneInTalk,
} from "react-icons/md";
import { IoCloseSharp } from "react-icons/io5";
import LoadingSpinner from "../../components/common/LoadingSpinner";

const formatCallTime = (dateStr) => {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (diffDays === 0) return `Today, ${timeStr}`;
  if (diffDays === 1) return `Yesterday, ${timeStr}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${timeStr}`;
};

const formatCallDuration = (sec) => {
  if (!sec) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

const CallsPage = ({ authUser }) => {
  const [activeTab, setActiveTab] = useState("all"); // "all" | "missed"
  const [searchFilter, setSearchFilter] = useState("");
  const [showNewCallModal, setShowNewCallModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");

  const { startCall } = useCall();

  // 1. Fetch Call History
  const { data: callHistory = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ["callHistory"],
    queryFn: async () => {
      const res = await apiFetch("/api/messages/calls/history");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    refetchInterval: 3000,
  });

  // 2. Fetch Eligible Mutual Contacts
  const { data: contactsData } = useQuery({
    queryKey: ["eligibleContacts"],
    queryFn: async () => {
      const res = await apiFetch("/api/messages/contacts");
      if (!res.ok) return { mutuals: [], waitingForFollowBack: [] };
      return res.json();
    },
  });

  const mutuals = contactsData?.mutuals || [];

  // Filter call logs
  const filteredCalls = callHistory.filter((call) => {
    if (!call.partner) return false;
    const matchesSearch =
      call.partner.fullName?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      call.partner.username?.toLowerCase().includes(searchFilter.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "missed") {
      return call.direction === "missed" || call.status === "missed";
    }
    return true;
  });

  const handleStartCall = (partner, callType) => {
    setShowNewCallModal(false);
    startCall({ partner, callType });
  };

  return (
    <div className="flex-1 min-w-0 w-full min-h-screen border-r border-gray-800 bg-black text-white pb-20 md:pb-10">
      {/* Top Header */}
      <div className="p-4 border-b border-gray-800 sticky top-0 bg-stone-950/95 backdrop-blur-md z-20 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <MdPhoneInTalk className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              Calls
            </h1>
            <p className="text-xs text-stone-400">Audio & HD Video Calling</p>
          </div>
        </div>

        {/* Start New Call Button */}
        <button
          onClick={() => setShowNewCallModal(true)}
          className="btn btn-sm btn-primary rounded-full px-4 text-white flex items-center gap-1.5 shadow-lg shadow-sky-500/20"
        >
          <FiPlus className="w-4 h-4" />
          <span>New Call</span>
        </button>
      </div>

      {/* Search & Tabs */}
      <div className="p-4 border-b border-gray-800 space-y-3 bg-stone-950/60">
        {/* Search Bar */}
        <div className="relative">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 w-4 h-4" />
          <input
            type="text"
            placeholder="Search call history..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full bg-stone-900 border border-gray-800 rounded-full pl-10 pr-4 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-primary"
          />
        </div>

        {/* Filter Tabs: All vs Missed */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              activeTab === "all"
                ? "bg-primary text-white"
                : "bg-stone-900 text-stone-400 hover:text-white"
            }`}
          >
            All Calls ({callHistory.length})
          </button>
          <button
            onClick={() => setActiveTab("missed")}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              activeTab === "missed"
                ? "bg-red-500 text-white"
                : "bg-stone-900 text-stone-400 hover:text-white"
            }`}
          >
            Missed Calls
          </button>
        </div>
      </div>

      {/* Quick Call: Mutual Contacts Horizontal Carousel */}
      {mutuals.length > 0 && (
        <div className="p-4 border-b border-gray-800/80 bg-stone-950/40">
          <p className="text-xs uppercase font-semibold text-stone-400 mb-3 tracking-wider">
            Quick Call (Mutual Connections)
          </p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {mutuals.map((user) => (
              <div
                key={user._id}
                className="flex flex-col items-center flex-shrink-0 w-24 p-2.5 rounded-2xl bg-stone-900/60 border border-stone-800/80 hover:border-primary/50 transition group"
              >
                <div className="relative mb-2">
                  <div className="w-12 h-12 rounded-full overflow-hidden border border-stone-700">
                    <img
                      src={user.profileImg || "/avatar-placeholder.png"}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-black absolute bottom-0 right-0" />
                </div>
                <p className="text-xs font-bold text-white truncate max-w-[80px]">
                  {user.fullName}
                </p>
                <p className="text-[10px] text-stone-500 truncate max-w-[80px] mb-2">
                  @{user.username}
                </p>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleStartCall(user, "audio")}
                    className="p-1.5 rounded-full bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition"
                    title="Audio Call"
                  >
                    <FiPhone className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleStartCall(user, "video")}
                    className="p-1.5 rounded-full bg-sky-500/20 text-sky-400 hover:bg-sky-500 hover:text-white transition"
                    title="Video Call"
                  >
                    <FiVideo className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Call History List */}
      <div className="divide-y divide-gray-900">
        {isLoadingHistory ? (
          <div className="py-16 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : filteredCalls.length === 0 ? (
          <div className="py-20 text-center text-stone-500 flex flex-col items-center px-4">
            <div className="w-16 h-16 rounded-full bg-stone-900 text-3xl flex items-center justify-center mb-3">
              📞
            </div>
            <p className="text-base font-semibold text-white mb-1">
              {activeTab === "missed" ? "No missed calls" : "No recent calls"}
            </p>
            <p className="text-xs text-stone-400 max-w-xs mb-5">
              Place your first voice or video call with any mutual connection!
            </p>
            <button
              onClick={() => setShowNewCallModal(true)}
              className="btn btn-primary rounded-full btn-sm px-6 text-white"
            >
              Start a Call
            </button>
          </div>
        ) : (
          filteredCalls.map((call) => {
            const partner = call.partner;
            const isMissed = call.direction === "missed" || call.status === "missed";
            const isOutgoing = call.direction?.startsWith("outgoing");
            const isVideo = call.callType === "video";

            return (
              <div
                key={call._id}
                className="flex items-center justify-between p-4 hover:bg-stone-900/40 transition group"
              >
                {/* Left: Avatar + Info */}
                <div className="flex items-center gap-3.5 min-w-0">
                  <Link
                    to={`/profile/${partner.username}`}
                    className="w-12 h-12 rounded-full overflow-hidden border border-stone-700 flex-shrink-0"
                  >
                    <img
                      src={partner.profileImg || "/avatar-placeholder.png"}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </Link>

                  <div className="flex flex-col min-w-0">
                    <Link
                      to={`/profile/${partner.username}`}
                      className={`font-bold text-sm truncate hover:underline ${
                        isMissed ? "text-red-400" : "text-white"
                      }`}
                    >
                      {partner.fullName}
                    </Link>

                    {/* Direction, Duration, Timestamp */}
                    <div className="flex items-center gap-1.5 text-xs text-stone-400 mt-0.5">
                      {isMissed ? (
                        <MdCallMissed className="w-4 h-4 text-red-400 flex-shrink-0" />
                      ) : isOutgoing ? (
                        <MdCallMade className="w-4 h-4 text-sky-400 flex-shrink-0" />
                      ) : (
                        <MdCallReceived className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      )}

                      <span className={isMissed ? "text-red-400 font-medium" : "text-stone-300"}>
                        {isMissed
                          ? "Missed"
                          : isOutgoing
                          ? `Outgoing (${formatCallDuration(call.duration)})`
                          : `Incoming (${formatCallDuration(call.duration)})`}
                      </span>

                      <span>·</span>
                      <span className="text-[11px] text-stone-500">
                        {formatCallTime(call.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Call Actions (Audio & Video) */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleStartCall(partner, "audio")}
                    className="p-2.5 rounded-full text-stone-300 hover:text-emerald-400 hover:bg-emerald-500/10 transition active:scale-95"
                    title={`Audio call ${partner.fullName}`}
                  >
                    <FiPhone className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleStartCall(partner, "video")}
                    className="p-2.5 rounded-full text-stone-300 hover:text-sky-400 hover:bg-sky-500/10 transition active:scale-95"
                    title={`Video call ${partner.fullName}`}
                  >
                    <FiVideo className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ================= NEW CALL MODAL ================= */}
      {showNewCallModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <FiPhone className="text-emerald-400" />
                <span>Start a Call</span>
              </h3>
              <button
                onClick={() => setShowNewCallModal(false)}
                className="p-1.5 rounded-full hover:bg-stone-800 text-stone-400 hover:text-white transition"
              >
                <IoCloseSharp className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search */}
            <div className="p-3 border-b border-gray-800">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search mutual connections..."
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-800 rounded-full pl-9 pr-3 py-1.5 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Contacts Scroll Area */}
            <div className="flex-1 overflow-y-auto p-2 divide-y divide-gray-800/60">
              {mutuals.length === 0 ? (
                <div className="py-12 text-center text-stone-500 px-4">
                  <p className="font-semibold text-white text-sm mb-1">
                    No mutual connections yet
                  </p>
                  <p className="text-xs text-stone-400">
                    You can start audio and video calls once you and another user both follow each other!
                  </p>
                </div>
              ) : (
                mutuals
                  .filter(
                    (u) =>
                      u.fullName?.toLowerCase().includes(modalSearch.toLowerCase()) ||
                      u.username?.toLowerCase().includes(modalSearch.toLowerCase())
                  )
                  .map((user) => (
                    <div
                      key={user._id}
                      className="flex items-center justify-between p-3 rounded-xl hover:bg-stone-800/40 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-stone-700 flex-shrink-0">
                          <img
                            src={user.profileImg || "/avatar-placeholder.png"}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-white truncate">
                            {user.fullName}
                          </p>
                          <p className="text-xs text-stone-400 truncate">
                            @{user.username}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartCall(user, "audio")}
                          className="btn btn-sm btn-circle btn-ghost text-emerald-400 hover:bg-emerald-500/20"
                          title="Audio Call"
                        >
                          <FiPhone className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleStartCall(user, "video")}
                          className="btn btn-sm btn-circle btn-ghost text-sky-400 hover:bg-sky-500/20"
                          title="Video Call"
                        >
                          <FiVideo className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CallsPage;
