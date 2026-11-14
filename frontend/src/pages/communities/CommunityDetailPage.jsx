import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { FaArrowLeft } from "react-icons/fa";
import { HiUserGroup } from "react-icons/hi2";
import { FiUsers, FiCalendar, FiShield } from "react-icons/fi";
import { apiFetch } from "../../lib/api";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import Post from "../../components/common/Post";
import CreatePost from "../home/CreatePost";
import { formatPostDate } from "../../utils/date";

const CommunityDetailPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch Community details
  const { data: community, isLoading: isCommLoading } = useQuery({
    queryKey: ["community", slug],
    queryFn: async () => {
      const res = await apiFetch(`/api/communities/${slug}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load community");
      return data;
    },
  });

  // Fetch Community Posts
  const { data: posts, isLoading: isPostsLoading } = useQuery({
    queryKey: ["communityPosts", slug],
    queryFn: async () => {
      const res = await apiFetch(`/api/communities/${slug}/posts`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load community posts");
      return data;
    },
  });

  // Join / Leave Mutation
  const { mutate: toggleJoin, isPending: isJoining } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/communities/${community._id}/join`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update membership");
      return data;
    },
    onSuccess: (resData) => {
      toast.success(resData.joined ? "Joined community!" : "Left community");
      queryClient.invalidateQueries({ queryKey: ["community", slug] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  if (isCommLoading) {
    return (
      <div className="flex-[4_4_0] border-r border-stone-800 min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!community) {
    return (
      <div className="flex-[4_4_0] border-r border-stone-800 min-h-screen p-8 text-center">
        <h2 className="text-xl font-bold text-white mb-2">Community Not Found</h2>
        <Link to="/communities" className="text-primary hover:underline text-sm">
          ← Back to Communities
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-[4_4_0] min-w-0 max-w-2xl xl:max-w-3xl w-full border-r border-stone-800 min-h-screen bg-black">
      {/* Sticky Top Header */}
      <div className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3 bg-black/85 backdrop-blur-md border-b border-stone-800">
        <button
          onClick={() => navigate("/communities")}
          className="p-2 rounded-full hover:bg-stone-800 text-stone-300 hover:text-white transition"
        >
          <FaArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="font-extrabold text-base text-white truncate max-w-[240px] sm:max-w-md">
            c/{community.name}
          </h1>
          <span className="text-[11px] text-stone-500 font-medium">
            {community.membersCount} {community.membersCount === 1 ? "member" : "members"}
          </span>
        </div>
      </div>

      {/* Hero Banner & Community Header */}
      <div className="relative">
        <div className="h-36 sm:h-48 bg-gradient-to-r from-blue-950 via-purple-950 to-stone-900 relative overflow-hidden">
          {community.banner && (
            <img src={community.banner} alt="" className="w-full h-full object-cover" />
          )}
          <span className="absolute top-3 right-3 text-xs font-bold px-3 py-1 rounded-full bg-black/70 text-white backdrop-blur-sm border border-white/10">
            {community.category}
          </span>
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-end justify-between -mt-10 sm:-mt-12 mb-3">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-4 border-black bg-stone-800 shadow-xl">
              <img
                src={
                  community.avatar ||
                  `https://api.dicebear.com/7.x/identicon/svg?seed=${community.slug}`
                }
                alt=""
                className="w-full h-full object-cover"
              />
            </div>

            <button
              onClick={() => toggleJoin()}
              disabled={isJoining}
              className={`btn btn-sm rounded-full px-5 font-bold transition shadow ${
                community.isMember
                  ? "bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700"
                  : "bg-primary hover:bg-primary/90 text-white border-none shadow-primary/30"
              }`}
            >
              {community.isMember ? "Joined" : "Join Community"}
            </button>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-white">{community.name}</h2>
          <span className="text-xs text-primary font-mono font-semibold">c/{community.slug}</span>

          {community.description && (
            <p className="text-xs sm:text-sm text-stone-200 mt-2.5 leading-relaxed">
              {community.description}
            </p>
          )}

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-stone-400">
            <div className="flex items-center gap-1.5">
              <FiUsers className="w-3.5 h-3.5 text-primary" />
              <span>{community.membersCount} members</span>
            </div>

            <div className="flex items-center gap-1.5">
              <FiCalendar className="w-3.5 h-3.5 text-stone-500" />
              <span>Created {formatPostDate(community.createdAt)}</span>
            </div>

            {community.creator && (
              <div className="flex items-center gap-1.5">
                <FiShield className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  Admin:{" "}
                  <Link
                    to={`/profile/${community.creator.username}`}
                    className="text-stone-300 hover:underline font-medium"
                  >
                    @{community.creator.username}
                  </Link>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Post Composer inside Community */}
      <div className="border-t border-b border-stone-800 bg-stone-950/40 p-1">
        <CreatePost
          communityId={community._id}
          onPostSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["communityPosts", slug] });
          }}
        />
      </div>

      {/* Community Feed */}
      <div>
        <div className="px-4 py-3 border-b border-stone-800/80 bg-stone-900/30">
          <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
            Community Discussions
          </h3>
        </div>

        {isPostsLoading ? (
          <div className="flex justify-center py-16">
            <LoadingSpinner size="lg" />
          </div>
        ) : posts?.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-xl bg-stone-900 border border-stone-800 flex items-center justify-center text-2xl mx-auto mb-2">
              💬
            </div>
            <p className="text-sm font-bold text-white mb-1">No posts in this community yet</p>
            <p className="text-xs text-stone-500">
              Start the discussion by creating the first post above!
            </p>
          </div>
        ) : (
          posts?.map((post) => <Post key={post._id} post={post} />)
        )}
      </div>
    </div>
  );
};

export default CommunityDetailPage;
