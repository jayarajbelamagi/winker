import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { HiUserGroup } from "react-icons/hi2";
import { FiSearch, FiPlus, FiUsers, FiArrowRight } from "react-icons/fi";
import { IoClose } from "react-icons/io5";
import { apiFetch } from "../../lib/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";

const CATEGORIES = ["All", "Tech", "Gaming", "Sports", "Music", "College", "Memes", "Design", "General"];

const CommunitiesPage = () => {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Tech");
  const [avatar, setAvatar] = useState("");
  const [banner, setBanner] = useState("");

  const { data: communities, isLoading } = useQuery({
    queryKey: ["communities", selectedCategory, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "All") params.append("category", selectedCategory);
      if (searchQuery.trim()) params.append("q", searchQuery.trim());
      const res = await apiFetch(`/api/communities?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch communities");
      return data;
    },
  });

  // Create Community Mutation
  const { mutate: createCommunity, isPending: isCreating } = useMutation({
    mutationFn: async (payload) => {
      const res = await apiFetch("/api/communities/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create community");
      return data;
    },
    onSuccess: (newComm) => {
      toast.success(`Community c/${newComm.slug} created! 🎉`);
      setShowCreateModal(false);
      setName("");
      setDescription("");
      setAvatar("");
      setBanner("");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // Join / Leave Mutation
  const { mutate: toggleJoin } = useMutation({
    mutationFn: async (communityId) => {
      const res = await apiFetch(`/api/communities/${communityId}/join`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update membership");
      return data;
    },
    onSuccess: (resData) => {
      toast.success(resData.joined ? "Joined community!" : "Left community");
      queryClient.invalidateQueries({ queryKey: ["communities"] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleImagePick = (e, setter) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-[4_4_0] min-w-0 max-w-2xl xl:max-w-3xl w-full border-r border-stone-800 min-h-screen bg-black">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between p-4 bg-black/85 backdrop-blur-md border-b border-stone-800">
        <div className="flex items-center gap-2">
          <HiUserGroup className="w-6 h-6 text-primary" />
          <h1 className="font-extrabold text-lg text-white">Communities & Groups</h1>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary btn-sm rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-primary/30"
        >
          <FiPlus className="w-3.5 h-3.5" />
          <span>New Community</span>
        </button>
      </div>

      {/* Search & Category Pills */}
      <div className="p-4 border-b border-stone-800/80 space-y-3">
        <div className="relative">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-500 w-4 h-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search communities by name or topic..."
            className="w-full bg-stone-900 border border-stone-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-stone-500 focus:outline-none focus:border-primary transition"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? "bg-primary text-white"
                  : "bg-stone-900 text-stone-400 hover:text-white border border-stone-800"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Communities Grid */}
      <div className="p-4">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : communities?.length === 0 ? (
          <div className="text-center py-20 px-4">
            <div className="w-16 h-16 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-3xl mx-auto mb-3">
              🏢
            </div>
            <h3 className="font-bold text-white text-base mb-1">No communities found</h3>
            <p className="text-xs text-stone-400 max-w-sm mx-auto mb-4">
              Be the first to launch a community for your college, gaming squad, or tech interests!
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn btn-primary btn-sm rounded-full"
            >
              Create Community
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {communities.map((comm) => (
              <div
                key={comm._id}
                className="bg-[#16181C] border border-stone-800 rounded-2xl overflow-hidden hover:border-stone-700 transition flex flex-col justify-between group shadow-md"
              >
                {/* Banner & Avatar */}
                <div>
                  <div className="h-20 bg-gradient-to-r from-blue-900/60 to-purple-900/60 relative overflow-hidden">
                    {comm.banner && (
                      <img
                        src={comm.banner}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    )}
                    <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-black/60 text-white backdrop-blur-sm">
                      {comm.category}
                    </span>
                  </div>

                  <div className="p-3.5 pt-0 relative">
                    <div className="flex items-end justify-between -mt-6 mb-2">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-[#16181C] bg-stone-800 shadow-md">
                        <img
                          src={comm.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${comm.slug}`}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          toggleJoin(comm._id);
                        }}
                        className={`btn btn-xs rounded-full px-3.5 font-bold transition ${
                          comm.isMember
                            ? "bg-stone-800 hover:bg-stone-700 text-stone-300 border-none"
                            : "bg-white hover:bg-stone-200 text-black border-none"
                        }`}
                      >
                        {comm.isMember ? "Joined" : "Join"}
                      </button>
                    </div>

                    <Link to={`/communities/${comm.slug}`} className="block group-hover:underline">
                      <h4 className="font-bold text-white text-sm truncate">{comm.name}</h4>
                      <span className="text-[11px] text-stone-400 font-mono">c/{comm.slug}</span>
                    </Link>

                    {comm.description && (
                      <p className="text-xs text-stone-300 mt-2 line-clamp-2 leading-relaxed">
                        {comm.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Footer Info */}
                <div className="px-3.5 py-2.5 bg-stone-900/50 border-t border-stone-800/60 flex items-center justify-between text-[11px] text-stone-400">
                  <div className="flex items-center gap-1.5 font-medium">
                    <FiUsers className="w-3.5 h-3.5 text-primary" />
                    <span>{comm.membersCount} {comm.membersCount === 1 ? "member" : "members"}</span>
                  </div>

                  <Link
                    to={`/communities/${comm.slug}`}
                    className="text-primary hover:underline font-semibold flex items-center gap-1"
                  >
                    <span>View Feed</span>
                    <FiArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Community Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16181C] border border-stone-800 w-full max-w-md rounded-2xl p-5 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <HiUserGroup className="w-5 h-5 text-primary" />
                <span className="font-bold text-white text-base">Create a Community</span>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-white"
              >
                <IoClose className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createCommunity({ name, description, category, avatar, banner });
              }}
              className="mt-4 space-y-3.5"
            >
              <div>
                <label className="text-[11px] font-semibold text-stone-400 block mb-1">
                  Community Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI & Tech Innovators, College Meme Hub"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-black border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-stone-400 block mb-1">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-black border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                >
                  {CATEGORIES.filter((c) => c !== "All").map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-stone-400 block mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="What is this community about? What should members post?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-black border border-stone-800 rounded-xl p-3 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-semibold text-stone-400 block mb-1">
                    Avatar Icon
                  </label>
                  <label className="flex items-center justify-center p-2.5 bg-black border border-dashed border-stone-800 rounded-xl text-xs text-stone-400 hover:border-primary cursor-pointer truncate">
                    <span>{avatar ? "Icon selected ✓" : "Upload Icon"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImagePick(e, setAvatar)}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-stone-400 block mb-1">
                    Cover Banner
                  </label>
                  <label className="flex items-center justify-center p-2.5 bg-black border border-dashed border-stone-800 rounded-xl text-xs text-stone-400 hover:border-primary cursor-pointer truncate">
                    <span>{banner ? "Banner selected ✓" : "Upload Banner"}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImagePick(e, setBanner)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreating || !name.trim()}
                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs uppercase tracking-wider transition shadow-lg shadow-primary/30 flex items-center justify-center gap-2 mt-4"
              >
                {isCreating ? <LoadingSpinner size="sm" /> : "Launch Community"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunitiesPage;
