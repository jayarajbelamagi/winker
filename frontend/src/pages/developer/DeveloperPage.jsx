import { useState, useEffect, useMemo } from "react";
import { toast } from "react-hot-toast";
import {
  FiDatabase,
  FiUsers,
  FiHardDrive,
  FiServer,
  FiSearch,
  FiDownload,
  FiRefreshCw,
  FiTrash2,
  FiEye,
  FiKey,
  FiLock,
  FiUnlock,
  FiCheck,
  FiCopy,
  FiLayers,
  FiActivity,
  FiMail,
  FiCalendar,
  FiHeart,
  FiBookmark,
} from "react-icons/fi";
import { IoCloseSharp } from "react-icons/io5";
import { apiFetch } from "../../lib/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";

const DEFAULT_DEV_KEY = "winker-dev-2026";

const DeveloperPage = () => {
  const [developerKey, setDeveloperKey] = useState(
    () => localStorage.getItem("winker_developer_key") || ""
  );
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Active navigation tab: "overview" | "users" | "collections" | "rawStats"
  const [activeTab, setActiveTab] = useState("overview");

  // Data states
  const [statsData, setStatsData] = useState(null);
  const [usersData, setUsersData] = useState([]);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // User search & sorting
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSortField, setUserSortField] = useState("createdAt");
  const [userSortOrder, setUserSortOrder] = useState("desc");

  // Collection explorer states
  const [selectedCollection, setSelectedCollection] = useState("posts");
  const [collectionItems, setCollectionItems] = useState([]);
  const [collectionTotal, setCollectionTotal] = useState(0);
  const [collectionPage, setCollectionPage] = useState(1);
  const [collectionSearch, setCollectionSearch] = useState("");
  const [isLoadingCollection, setIsLoadingCollection] = useState(false);

  // Inspector modal (for inspecting any raw document)
  const [inspectedDoc, setInspectedDoc] = useState(null);
  const [copiedDoc, setCopiedDoc] = useState(false);

  // Helper fetch with developer key
  const devFetch = async (endpoint, options = {}) => {
    const activeKey = developerKey || keyInput || DEFAULT_DEV_KEY;
    const headers = {
      ...(options.headers || {}),
      "x-developer-key": activeKey,
      "Content-Type": "application/json",
    };
    return apiFetch(endpoint, { ...options, headers });
  };

  // Verify key on unlock attempt
  const handleUnlock = async (keyToTest) => {
    const key = (keyToTest || keyInput || "").trim();
    if (!key) {
      toast.error("Please enter a developer access key");
      return;
    }
    setIsVerifying(true);
    try {
      const res = await devFetch("/api/developer/verify-key", {
        method: "POST",
        headers: { "x-developer-key": key },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid key");

      setDeveloperKey(key);
      localStorage.setItem("winker_developer_key", key);
      setIsUnlocked(true);
      toast.success("Developer Console Unlocked!");
    } catch (err) {
      toast.error(err.message || "Invalid Developer Key");
    } finally {
      setIsVerifying(false);
    }
  };

  // Auto-verify stored key on initial mount
  useEffect(() => {
    const stored = localStorage.getItem("winker_developer_key");
    if (stored) {
      handleUnlock(stored);
    }
  }, []);

  // Fetch telemetry & users when unlocked
  const loadStats = async () => {
    if (!isUnlocked) return;
    setIsLoadingStats(true);
    try {
      const res = await devFetch("/api/developer/stats");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load telemetry");
      setStatsData(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const loadUsers = async () => {
    if (!isUnlocked) return;
    setIsLoadingUsers(true);
    try {
      const res = await devFetch(
        `/api/developer/users?sortBy=${userSortField}&order=${userSortOrder}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsersData(data.users || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadCollectionEntries = async () => {
    if (!isUnlocked) return;
    setIsLoadingCollection(true);
    try {
      const res = await devFetch(
        `/api/developer/collection/${selectedCollection}?page=${collectionPage}&limit=40&q=${encodeURIComponent(
          collectionSearch
        )}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load collection");
      setCollectionItems(data.items || []);
      setCollectionTotal(data.totalCount || 0);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoadingCollection(false);
    }
  };

  // Trigger loads when unlocked or tab changes
  useEffect(() => {
    if (isUnlocked) {
      loadStats();
      loadUsers();
    }
  }, [isUnlocked, userSortField, userSortOrder]);

  useEffect(() => {
    if (isUnlocked && activeTab === "collections") {
      loadCollectionEntries();
    }
  }, [isUnlocked, activeTab, selectedCollection, collectionPage]);

  // Lock Console
  const handleLock = () => {
    localStorage.removeItem("winker_developer_key");
    setDeveloperKey("");
    setIsUnlocked(false);
    toast("Console locked");
  };

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return usersData;
    const q = userSearchQuery.toLowerCase();
    return usersData.filter(
      (u) =>
        u.fullName?.toLowerCase().includes(q) ||
        u.username?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u._id?.toLowerCase().includes(q)
    );
  }, [usersData, userSearchQuery]);

  // Delete an entry with confirmation
  const handleDeleteEntry = async (collection, id, label = "entry") => {
    if (!window.confirm(`Are you sure you want to permanently delete this ${label} (${id})?`)) {
      return;
    }
    try {
      const res = await devFetch(`/api/developer/entry/${collection}/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");

      toast.success(`${label} deleted successfully`);
      if (collection === "users") {
        setUsersData((prev) => prev.filter((u) => u._id !== id));
      } else {
        setCollectionItems((prev) => prev.filter((item) => item._id !== id));
      }
      loadStats();
    } catch (err) {
      toast.error(err.message);
    }
  };

  // Export Users to CSV
  const handleExportUsersCSV = () => {
    if (!usersData.length) return toast.error("No users to export");
    const headers = [
      "_id",
      "fullName",
      "username",
      "email",
      "followersCount",
      "followingCount",
      "likedPostsCount",
      "bookmarksCount",
      "createdAt",
    ];
    const rows = usersData.map((u) =>
      headers
        .map((h) => {
          let val = u[h] || "";
          if (typeof val === "string") val = `"${val.replace(/"/g, '""')}"`;
          return val;
        })
        .join(",")
    );
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `winker-users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    toast.success("Users exported to CSV!");
  };

  // Export Users to JSON
  const handleExportUsersJSON = () => {
    if (!usersData.length) return toast.error("No users to export");
    const blob = new Blob([JSON.stringify(usersData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `winker-users-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    toast.success("Users exported to JSON!");
  };

  // ================= 1. LOCKED PASSKEY GATE =================
  if (!isUnlocked) {
    return (
      <div className="min-h-screen w-full bg-[#0a0a0c] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#121317] border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="w-14 h-14 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-primary text-2xl mx-auto mb-4 shadow-inner">
            <FiLock />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-center text-white mb-1">
            Winker Developer Portal
          </h2>
          <p className="text-xs text-stone-400 text-center mb-6">
            Enter your developer access key to inspect database telemetry, users, and storage.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleUnlock();
            }}
            className="space-y-4"
          >
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400 block mb-1.5">
                Developer Access Key
              </label>
              <div className="relative">
                <FiKey className="absolute left-3.5 top-3.5 text-stone-500 w-4 h-4" />
                <input
                  type="password"
                  placeholder="Enter developer key (default: winker-dev-2026)"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-black border border-stone-800 rounded-xl text-sm text-white focus:outline-none focus:border-primary placeholder-stone-600 transition"
                  autoFocus
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full py-3 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition shadow-lg shadow-primary/30 flex items-center justify-center gap-2"
            >
              {isVerifying ? (
                <LoadingSpinner size="sm" />
              ) : (
                <>
                  <FiUnlock className="w-4 h-4" />
                  <span>Unlock Console</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-stone-800/80 text-center">
            <span className="text-[11px] text-stone-500">
              Default access key:{" "}
              <code className="text-primary font-mono bg-stone-900 px-2 py-0.5 rounded">
                winker-dev-2026
              </code>
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ================= 2. UNLOCKED CONSOLE DASHBOARD =================
  const db = statsData?.database;
  const storage = db?.storage;

  return (
    <div className="min-h-screen w-full bg-[#0a0a0c] text-stone-100 flex flex-col font-sans selection:bg-primary selection:text-white">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#121317]/90 backdrop-blur-md border-b border-stone-800 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-sky-600 flex items-center justify-center text-white font-bold shadow-md shadow-primary/20">
            <FiDatabase className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Winker Developer Console
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Atlas Live</span>
              </span>
            </div>
            <div className="text-[11px] text-stone-400 hidden sm:block">
              Database: <code className="text-stone-300 font-mono">{db?.name || "winker"}</code> · Host:{" "}
              <span className="text-stone-300">{db?.host || "MongoDB Atlas"}</span>
            </div>
          </div>
        </div>

        {/* Global Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadStats();
              loadUsers();
              if (activeTab === "collections") loadCollectionEntries();
              toast.success("Telemetry refreshed");
            }}
            disabled={isLoadingStats || isLoadingUsers}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
            title="Refresh database telemetry"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${isLoadingStats ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={handleLock}
            className="p-2 sm:px-3 sm:py-1.5 rounded-xl bg-red-950/40 border border-red-500/30 hover:bg-red-900/50 text-red-300 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
            title="Lock developer console"
          >
            <FiLock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lock</span>
          </button>
        </div>
      </header>

      {/* Main Tab Navigation */}
      <nav className="bg-[#121317] border-b border-stone-800 px-4 sm:px-6 flex overflow-x-auto scrollbar-none gap-2 sm:gap-6 text-xs sm:text-sm font-semibold">
        <button
          onClick={() => setActiveTab("overview")}
          className={`py-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-stone-400 hover:text-white"
          }`}
        >
          <FiActivity className="w-4 h-4" />
          <span>Storage & Telemetry</span>
        </button>

        <button
          onClick={() => setActiveTab("users")}
          className={`py-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-stone-400 hover:text-white"
          }`}
        >
          <FiUsers className="w-4 h-4" />
          <span>Users Directory ({usersData.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("collections")}
          className={`py-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === "collections"
              ? "border-primary text-primary"
              : "border-transparent text-stone-400 hover:text-white"
          }`}
        >
          <FiLayers className="w-4 h-4" />
          <span>Collections Explorer</span>
        </button>

        <button
          onClick={() => setActiveTab("rawStats")}
          className={`py-3 border-b-2 flex items-center gap-2 transition ${
            activeTab === "rawStats"
              ? "border-primary text-primary"
              : "border-transparent text-stone-400 hover:text-white"
          }`}
        >
          <FiServer className="w-4 h-4" />
          <span>Raw db.stats()</span>
        </button>
      </nav>

      {/* Main Body */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* ================= TAB 1: OVERVIEW & STORAGE TELEMETRY ================= */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Storage Hero Card */}
            <div className="bg-gradient-to-br from-[#14161c] to-[#0e1014] border border-stone-800 rounded-3xl p-5 sm:p-7 shadow-xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-stone-400 font-bold mb-1 flex items-center gap-1.5">
                    <FiHardDrive className="text-primary" />
                    <span>Database Total Storage Used</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tracking-tight">
                    {storage?.totalSizeFormatted || "Calculating..."}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs">
                  <div className="bg-stone-900/80 border border-stone-800 rounded-xl px-3 py-2">
                    <span className="text-stone-400 block text-[10px]">Data Size:</span>
                    <span className="font-bold text-white font-mono">{storage?.dataSizeFormatted || "0 B"}</span>
                  </div>
                  <div className="bg-stone-900/80 border border-stone-800 rounded-xl px-3 py-2">
                    <span className="text-stone-400 block text-[10px]">Allocated Storage:</span>
                    <span className="font-bold text-white font-mono">{storage?.storageSizeFormatted || "0 B"}</span>
                  </div>
                  <div className="bg-stone-900/80 border border-stone-800 rounded-xl px-3 py-2">
                    <span className="text-stone-400 block text-[10px]">Index Size:</span>
                    <span className="font-bold text-sky-400 font-mono">{storage?.indexSizeFormatted || "0 B"}</span>
                  </div>
                  <div className="bg-stone-900/80 border border-stone-800 rounded-xl px-3 py-2">
                    <span className="text-stone-400 block text-[10px]">Avg Doc Size:</span>
                    <span className="font-bold text-stone-200 font-mono">{storage?.avgDocumentSizeFormatted || "0 B"}</span>
                  </div>
                </div>
              </div>

              {/* Document Counters Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-stone-800/80">
                <div className="bg-black/40 rounded-2xl p-3 border border-stone-800/60">
                  <span className="text-[11px] text-stone-400">Total Registered Users</span>
                  <div className="text-2xl font-bold text-white mt-0.5">{statsData?.users?.total || 0}</div>
                  <span className="text-[10px] text-emerald-400">
                    +{statsData?.users?.growth?.last24Hours || 0} today
                  </span>
                </div>

                <div className="bg-black/40 rounded-2xl p-3 border border-stone-800/60">
                  <span className="text-[11px] text-stone-400">Total Posts</span>
                  <div className="text-2xl font-bold text-white mt-0.5">{statsData?.activity?.posts?.total || 0}</div>
                  <span className="text-[10px] text-stone-500">
                    {statsData?.activity?.posts?.withMedia || 0} media · {statsData?.activity?.posts?.polls || 0} polls
                  </span>
                </div>

                <div className="bg-black/40 rounded-2xl p-3 border border-stone-800/60">
                  <span className="text-[11px] text-stone-400">Total Messages Sent</span>
                  <div className="text-2xl font-bold text-white mt-0.5">{statsData?.activity?.messages?.total || 0}</div>
                  <span className="text-[10px] text-stone-500">
                    {statsData?.activity?.messages?.totalConversations || 0} conversations
                  </span>
                </div>

                <div className="bg-black/40 rounded-2xl p-3 border border-stone-800/60">
                  <span className="text-[11px] text-stone-400">Active 24h Stories</span>
                  <div className="text-2xl font-bold text-amber-300 mt-0.5">{statsData?.activity?.stories?.active || 0}</div>
                  <span className="text-[10px] text-stone-500">
                    {statsData?.activity?.stories?.total || 0} total posted
                  </span>
                </div>
              </div>
            </div>

            {/* Collection Storage Breakdown */}
            <div className="bg-[#121317] border border-stone-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-base text-white">Collections Breakdown</h3>
                  <p className="text-xs text-stone-400">Storage and entry counts by collection</p>
                </div>
                <span className="text-xs font-mono text-stone-400 bg-stone-900 border border-stone-800 px-3 py-1 rounded-full">
                  {db?.collections?.length || 9} collections
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] uppercase tracking-wider text-stone-400 bg-stone-900/60 border-b border-stone-800">
                    <tr>
                      <th className="py-3 px-4">Collection</th>
                      <th className="py-3 px-4">Key</th>
                      <th className="py-3 px-4">Entries Count</th>
                      <th className="py-3 px-4">Estimated Size</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 text-stone-300">
                    {db?.collections?.map((col) => (
                      <tr key={col.key} className="hover:bg-stone-900/40 transition">
                        <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                          <span>{col.icon}</span>
                          <span>{col.name}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-stone-400">{col.key}</td>
                        <td className="py-3 px-4 font-mono font-bold text-white">{col.count}</td>
                        <td className="py-3 px-4 font-mono text-primary">{col.formattedSize || "Dynamic"}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedCollection(col.key);
                              setCollectionPage(1);
                              setActiveTab("collections");
                            }}
                            className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition"
                          >
                            Explore →
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Server Runtime Health Card */}
            <div className="bg-[#121317] border border-stone-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <FiServer className="text-emerald-400" />
                <span>Server & Runtime Telemetry</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-stone-900/60 p-3 rounded-2xl border border-stone-800">
                  <span className="text-stone-400 text-[10px] block">Server Uptime</span>
                  <span className="font-bold text-emerald-400 font-mono text-sm">
                    {statsData?.system?.uptimeFormatted || "0s"}
                  </span>
                </div>
                <div className="bg-stone-900/60 p-3 rounded-2xl border border-stone-800">
                  <span className="text-stone-400 text-[10px] block">RAM Heap Used</span>
                  <span className="font-bold text-white font-mono text-sm">
                    {statsData?.system?.memory?.heapUsed || "0 MB"}
                  </span>
                </div>
                <div className="bg-stone-900/60 p-3 rounded-2xl border border-stone-800">
                  <span className="text-stone-400 text-[10px] block">RAM RSS Total</span>
                  <span className="font-bold text-white font-mono text-sm">
                    {statsData?.system?.memory?.rss || "0 MB"}
                  </span>
                </div>
                <div className="bg-stone-900/60 p-3 rounded-2xl border border-stone-800">
                  <span className="text-stone-400 text-[10px] block">Node Version</span>
                  <span className="font-bold text-stone-300 font-mono text-sm">
                    {statsData?.system?.nodeVersion || "v20"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: DETAILED USERS DIRECTORY ================= */}
        {activeTab === "users" && (
          <div className="bg-[#121317] border border-stone-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg text-white">All Users Directory</h3>
                <p className="text-xs text-stone-400">
                  Displaying every registered user with full names, emails, dates, and engagement counts.
                </p>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportUsersCSV}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <FiDownload className="w-3.5 h-3.5 text-primary" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleExportUsersJSON}
                  className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <FiCopy className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Search & Sort Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3.5 top-3 text-stone-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Filter users by name, @username, email, or user ID..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-black border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-primary placeholder-stone-600 transition"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={userSortField}
                  onChange={(e) => setUserSortField(e.target.value)}
                  className="bg-black border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-300 focus:outline-none focus:border-primary"
                >
                  <option value="createdAt">Sort by Joined Date</option>
                  <option value="fullName">Sort by Full Name</option>
                  <option value="username">Sort by Username</option>
                  <option value="followers">Sort by Followers</option>
                </select>

                <button
                  onClick={() => setUserSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
                  className="p-2 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white text-xs font-mono"
                  title="Toggle sort direction"
                >
                  {userSortOrder === "asc" ? "↑ ASC" : "↓ DESC"}
                </button>
              </div>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-2xl border border-stone-800">
              {isLoadingUsers ? (
                <div className="flex justify-center py-16">
                  <LoadingSpinner size="lg" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-16 text-stone-500 text-xs">
                  No users found matching query.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] uppercase tracking-wider text-stone-400 bg-stone-900/80 border-b border-stone-800">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Joined Date</th>
                      <th className="py-3 px-4">Followers</th>
                      <th className="py-3 px-4">Following</th>
                      <th className="py-3 px-4">Likes / Bookmarks</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 text-stone-300">
                    {filteredUsers.map((u) => (
                      <tr key={u._id} className="hover:bg-stone-900/40 transition">
                        {/* User Profile */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={u.profileImg || "/avatar-placeholder.png"}
                              alt=""
                              className="w-9 h-9 rounded-full object-cover border border-stone-700 flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="font-bold text-white block truncate">{u.fullName}</span>
                              <span className="text-[11px] text-stone-400 font-mono">@{u.username}</span>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="py-3 px-4 font-mono text-stone-300">
                          {u.email ? (
                            <span className="flex items-center gap-1.5">
                              <FiMail className="text-primary w-3.5 h-3.5 flex-shrink-0" />
                              <span className="truncate">{u.email}</span>
                            </span>
                          ) : (
                            <span className="text-stone-600 italic">None</span>
                          )}
                        </td>

                        {/* Joined Date */}
                        <td className="py-3 px-4 font-mono text-stone-400">
                          <div className="flex items-center gap-1.5">
                            <FiCalendar className="w-3.5 h-3.5 text-stone-500" />
                            <span>
                              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "Unknown"}
                            </span>
                          </div>
                          <span className="text-[10px] text-stone-500 block">
                            {u.createdAt ? new Date(u.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          </span>
                        </td>

                        {/* Followers */}
                        <td className="py-3 px-4 font-mono font-bold text-white">{u.followersCount}</td>

                        {/* Following */}
                        <td className="py-3 px-4 font-mono text-stone-300">{u.followingCount}</td>

                        {/* Likes & Bookmarks */}
                        <td className="py-3 px-4 font-mono text-[11px]">
                          <span className="text-pink-400 flex items-center gap-1">
                            <FiHeart className="w-3 h-3" /> {u.likedPostsCount}
                          </span>
                          <span className="text-sky-400 flex items-center gap-1 mt-0.5">
                            <FiBookmark className="w-3 h-3" /> {u.bookmarksCount}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setInspectedDoc({ title: `User @${u.username}`, data: u })}
                              className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition"
                              title="Inspect full raw JSON"
                            >
                              <FiEye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleDeleteEntry("users", u._id, `@${u.username}`)}
                              className="p-1.5 rounded-lg bg-red-950/40 border border-red-500/30 hover:bg-red-900 text-red-300 transition"
                              title="Delete user"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 3: COLLECTIONS EXPLORER ================= */}
        {activeTab === "collections" && (
          <div className="bg-[#121317] border border-stone-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-5 animate-in fade-in duration-200">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-lg text-white">Database Collections Explorer</h3>
                <p className="text-xs text-stone-400">
                  Inspect raw documents across any table in the MongoDB database.
                </p>
              </div>

              {/* Collection Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-400 font-semibold">Collection:</span>
                <select
                  value={selectedCollection}
                  onChange={(e) => {
                    setSelectedCollection(e.target.value);
                    setCollectionPage(1);
                  }}
                  className="bg-black border border-stone-800 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-primary"
                >
                  <option value="posts">📝 Posts</option>
                  <option value="users">👥 Users</option>
                  <option value="messages">💬 Messages</option>
                  <option value="conversations">📁 Conversations</option>
                  <option value="stories">📸 Stories</option>
                  <option value="spaces">🎙️ Audio Spaces</option>
                  <option value="notifications">🔔 Notifications</option>
                  <option value="profileviews">👁️ Profile Views</option>
                  <option value="calls">📞 Call Logs</option>
                </select>
              </div>
            </div>

            {/* Filter Search within collection */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <FiSearch className="absolute left-3.5 top-3 text-stone-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder={`Search in ${selectedCollection}...`}
                  value={collectionSearch}
                  onChange={(e) => setCollectionSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setCollectionPage(1);
                      loadCollectionEntries();
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2 bg-black border border-stone-800 rounded-xl text-xs text-white focus:outline-none focus:border-primary placeholder-stone-600 transition"
                />
              </div>

              <button
                onClick={() => {
                  setCollectionPage(1);
                  loadCollectionEntries();
                }}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold transition"
              >
                Search
              </button>
            </div>

            {/* Collection Items Table / Cards */}
            <div className="overflow-x-auto rounded-2xl border border-stone-800">
              {isLoadingCollection ? (
                <div className="flex justify-center py-16">
                  <LoadingSpinner size="lg" />
                </div>
              ) : collectionItems.length === 0 ? (
                <div className="text-center py-16 text-stone-500 text-xs">
                  No documents found in {selectedCollection}.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="text-[11px] uppercase tracking-wider text-stone-400 bg-stone-900/80 border-b border-stone-800">
                    <tr>
                      <th className="py-3 px-4">Document ID</th>
                      <th className="py-3 px-4">Summary / Primary Field</th>
                      <th className="py-3 px-4">Created At</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-800/60 text-stone-300">
                    {collectionItems.map((item) => {
                      const summary =
                        item.text ||
                        item.fullName ||
                        item.groupName ||
                        item.title ||
                        item.callId ||
                        item.type ||
                        "Document Record";
                      return (
                        <tr key={item._id} className="hover:bg-stone-900/40 transition">
                          <td className="py-3 px-4 font-mono text-primary font-semibold">
                            {item._id}
                          </td>
                          <td className="py-3 px-4 max-w-md truncate">
                            <span className="font-semibold text-white mr-2">{summary}</span>
                            {item.img && <span className="text-[10px] text-amber-400 font-mono">📷 [Media]</span>}
                          </td>
                          <td className="py-3 px-4 font-mono text-stone-400">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() =>
                                  setInspectedDoc({
                                    title: `${selectedCollection} / ${item._id}`,
                                    data: item,
                                  })
                                }
                                className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1 transition"
                              >
                                <FiEye className="w-3.5 h-3.5" />
                                <span>Inspect JSON</span>
                              </button>

                              <button
                                onClick={() => handleDeleteEntry(selectedCollection, item._id)}
                                className="p-1.5 rounded-lg bg-red-950/40 border border-red-500/30 hover:bg-red-900 text-red-300 transition"
                                title="Delete document"
                              >
                                <FiTrash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between text-xs text-stone-400 pt-2">
              <span>
                Total records: <strong className="text-white font-mono">{collectionTotal}</strong>
              </span>

              <div className="flex items-center gap-2">
                <button
                  disabled={collectionPage <= 1}
                  onClick={() => setCollectionPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 disabled:opacity-40 hover:bg-stone-800 text-white font-semibold transition"
                >
                  Previous
                </button>
                <span className="font-mono text-stone-300">Page {collectionPage}</span>
                <button
                  disabled={collectionItems.length < 40}
                  onClick={() => setCollectionPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-800 disabled:opacity-40 hover:bg-stone-800 text-white font-semibold transition"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: RAW DB.STATS JSON ================= */}
        {activeTab === "rawStats" && (
          <div className="bg-[#121317] border border-stone-800 rounded-3xl p-5 sm:p-6 shadow-xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">MongoDB Live db.stats() Output</h3>
                <p className="text-xs text-stone-400">Direct response from database engine</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(statsData, null, 2));
                  toast.success("Telemetry JSON copied to clipboard!");
                }}
                className="px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800 hover:bg-stone-800 text-stone-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <FiCopy className="w-3.5 h-3.5 text-primary" />
                <span>Copy JSON</span>
              </button>
            </div>

            <pre className="p-4 bg-black rounded-2xl border border-stone-800 font-mono text-xs text-emerald-400 overflow-x-auto max-h-[600px] leading-relaxed">
              {JSON.stringify(statsData, null, 2)}
            </pre>
          </div>
        )}
      </main>

      {/* ================= RAW DOCUMENT INSPECTOR MODAL ================= */}
      {inspectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#121317] border border-stone-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-stone-800 bg-[#16181C]">
              <span className="font-bold text-sm text-white truncate">{inspectedDoc.title}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(JSON.stringify(inspectedDoc.data, null, 2));
                    setCopiedDoc(true);
                    toast.success("JSON copied!");
                    setTimeout(() => setCopiedDoc(false), 2000);
                  }}
                  className="px-3 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  {copiedDoc ? <FiCheck className="text-emerald-400" /> : <FiCopy />}
                  <span>{copiedDoc ? "Copied" : "Copy"}</span>
                </button>
                <button
                  onClick={() => setInspectedDoc(null)}
                  className="p-1 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition"
                >
                  <IoCloseSharp className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-black">
              <pre className="font-mono text-xs text-sky-300 whitespace-pre-wrap break-words leading-relaxed">
                {JSON.stringify(inspectedDoc.data, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeveloperPage;
