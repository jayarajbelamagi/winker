import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiTrendingUp, FiSearch, FiExternalLink, FiImage } from "react-icons/fi";
import { IoCloseSharp, IoNewspaperOutline } from "react-icons/io5";
import { BsPeopleFill } from "react-icons/bs";
import { apiFetch } from "../../lib/api";
import Post from "../../components/common/Post";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import useFollow from "../../hooks/useFollow";

const NEWS_CATEGORIES = [
  { id: "all", label: "🔥 All Trending" },
  { id: "cricket", label: "🏏 Cricket" },
  { id: "politics", label: "🏛️ Politics" },
  { id: "business", label: "📈 Business & Tech" },
  { id: "movies", label: "🎬 Cinema" },
  { id: "sports", label: "🏅 Sports" },
];

const ExplorePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const urlQuery = searchParams.get("q") || "";
  const initialTab = searchParams.get("tab") || "trending"; // "trending" | "news" | "people" | "media"

  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [newsCategory, setNewsCategory] = useState("all");

  const { follow, isPending: isFollowPending } = useFollow();

  // Sync state when URL query changes
  useEffect(() => {
    if (urlQuery !== searchQuery) {
      setSearchQuery(urlQuery);
    }
  }, [urlQuery]);

  // Fetch trending hashtags
  const { data: trendingHashtags = [] } = useQuery({
    queryKey: ["trendingHashtags"],
    queryFn: async () => {
      const res = await apiFetch("/api/posts/trending/hashtags");
      const json = await res.json();
      if (!res.ok) return [];
      return Array.isArray(json) ? json : [];
    },
    staleTime: 60 * 1000,
  });

  // Universal Search Query
  const {
    data: searchResults,
    isLoading: isSearching,
  } = useQuery({
    queryKey: ["exploreSearch", searchQuery, activeTab],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("q", searchQuery);
      params.append("tab", activeTab);

      const res = await apiFetch(`/api/posts/explore/search?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Search failed");
      return json;
    },
    enabled: activeTab !== "news",
    staleTime: 15 * 1000,
  });

  // Live News Query
  const {
    data: newsData,
    isLoading: isNewsLoading,
  } = useQuery({
    queryKey: ["news", newsCategory],
    queryFn: async () => {
      const res = await apiFetch(`/api/news?category=${newsCategory}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load news");
      return json;
    },
    enabled: activeTab === "news",
    staleTime: 45 * 1000,
  });

  const handleSearchSubmit = (e) => {
    e?.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({ q: searchQuery.trim(), tab: activeTab });
    } else {
      setSearchParams({ tab: activeTab });
    }
  };

  const handleSelectTag = (tag) => {
    setSearchQuery(tag);
    setActiveTab("trending");
    setSearchParams({ q: tag, tab: "trending" });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (searchQuery) {
      setSearchParams({ q: searchQuery, tab });
    } else {
      setSearchParams({ tab });
    }
  };

  const postsList = searchResults?.posts || [];
  const usersList = searchResults?.users || [];
  const articlesList = newsData?.articles || [];

  return (
    <div className="flex-[4_4_0] min-w-0 max-w-2xl xl:max-w-3xl w-full border-r border-gray-800 min-h-screen pb-16 md:pb-0">
      {/* Sticky Top Search Header */}
      <div className="sticky top-12 md:top-0 z-20 bg-black/85 backdrop-blur-md border-b border-gray-800 p-3 sm:p-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <FiSearch className="absolute left-4 top-3 text-stone-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search posts, #hashtags, people, or topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-10 py-2 bg-stone-900 border border-stone-800 rounded-full text-sm text-white placeholder-stone-500 focus:outline-none focus:border-primary transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSearchParams({ tab: activeTab });
              }}
              className="absolute right-3.5 top-2.5 text-stone-400 hover:text-white"
            >
              <IoCloseSharp className="w-5 h-5" />
            </button>
          )}
        </form>

        {/* Tab Navigation */}
        <div className="flex border-b border-stone-800/80 mt-3 text-xs sm:text-sm font-semibold">
          <button
            onClick={() => handleTabChange("trending")}
            className={`flex-1 pb-2.5 text-center transition border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === "trending"
                ? "border-primary text-white font-bold"
                : "border-transparent text-stone-400 hover:text-stone-200"
            }`}
          >
            <FiTrendingUp className="w-4 h-4 text-primary" />
            <span>Trending</span>
          </button>

          <button
            onClick={() => handleTabChange("news")}
            className={`flex-1 pb-2.5 text-center transition border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === "news"
                ? "border-primary text-white font-bold"
                : "border-transparent text-stone-400 hover:text-stone-200"
            }`}
          >
            <IoNewspaperOutline className="w-4 h-4 text-emerald-400" />
            <span>Live News</span>
          </button>

          <button
            onClick={() => handleTabChange("people")}
            className={`flex-1 pb-2.5 text-center transition border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === "people"
                ? "border-primary text-white font-bold"
                : "border-transparent text-stone-400 hover:text-stone-200"
            }`}
          >
            <BsPeopleFill className="w-4 h-4 text-sky-400" />
            <span>People</span>
          </button>

          <button
            onClick={() => handleTabChange("media")}
            className={`flex-1 pb-2.5 text-center transition border-b-2 flex items-center justify-center gap-1.5 ${
              activeTab === "media"
                ? "border-primary text-white font-bold"
                : "border-transparent text-stone-400 hover:text-stone-200"
            }`}
          >
            <FiImage className="w-4 h-4 text-amber-400" />
            <span>Media</span>
          </button>
        </div>
      </div>

      {/* Trending Hashtag Pills Bar */}
      {trendingHashtags.length > 0 && activeTab !== "news" && (
        <div className="p-3 border-b border-gray-800/80 overflow-x-auto scrollbar-none flex gap-2">
          {trendingHashtags.map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleSelectTag(item.tag)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 shadow-sm ${
                searchQuery.toLowerCase() === item.tag.toLowerCase()
                  ? "bg-primary text-white"
                  : "bg-stone-900 border border-stone-800 text-stone-300 hover:border-primary/50 hover:text-white"
              }`}
            >
              <span>{item.tag}</span>
              <span className="text-[10px] text-stone-400 font-mono">
                {item.posts || `${item.count} posts`}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ================= TAB CONTENT ================= */}

      {/* 1. 🔥 Trending Tab */}
      {activeTab === "trending" && (
        <div>
          {isSearching ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : postsList.length === 0 ? (
            <div className="text-center py-16 text-stone-500">
              <p className="text-base font-semibold text-white mb-1">
                {searchQuery ? `No posts matching "${searchQuery}"` : "No trending posts right now"}
              </p>
              <p className="text-xs">
                Try searching for a different #hashtag or topic!
              </p>
            </div>
          ) : (
            postsList.map((post) => <Post key={post._id} post={post} />)
          )}
        </div>
      )}

      {/* 2. 📰 Live News Tab */}
      {activeTab === "news" && (
        <div>
          {/* Category Pills */}
          <div className="p-3 border-b border-gray-800/80 overflow-x-auto scrollbar-none flex gap-2">
            {NEWS_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setNewsCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                  newsCategory === cat.id
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-stone-900 border border-stone-800 text-stone-300 hover:border-emerald-500/40"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {isNewsLoading ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : articlesList.length === 0 ? (
            <div className="text-center py-16 text-stone-500">
              No live news articles found.
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {articlesList.map((article, index) => (
                <div
                  key={index}
                  className="p-4 hover:bg-stone-900/30 transition flex gap-3.5 items-start"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-semibold text-emerald-400">
                        {article.source || "News"}
                      </span>
                      <span className="text-[10px] text-stone-500">
                        · {article.pubDate ? new Date(article.pubDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "Live"}
                      </span>
                    </div>

                    <a
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-bold text-stone-100 hover:text-primary transition line-clamp-2 leading-snug block"
                    >
                      {article.title}
                    </a>

                    {article.description && (
                      <p className="text-xs text-stone-400 line-clamp-2 mt-1 leading-relaxed">
                        {article.description}
                      </p>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        <span>Read full article</span>
                        <FiExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {article.imageUrl && (
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-stone-900 border border-stone-800">
                      <img
                        src={article.imageUrl}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. 👥 People Tab */}
      {activeTab === "people" && (
        <div>
          {isSearching ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : usersList.length === 0 ? (
            <div className="text-center py-16 text-stone-500">
              <p className="text-base font-semibold text-white mb-1">
                {searchQuery ? `No users found for "${searchQuery}"` : "Search for users"}
              </p>
              <p className="text-xs">Find friends by their name or @username.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {usersList.map((user) => (
                <div
                  key={user._id}
                  className="p-4 hover:bg-stone-900/40 transition flex items-center justify-between gap-3"
                >
                  <Link
                    to={`/profile/${user.username}`}
                    className="flex items-center gap-3 min-w-0 flex-1 group"
                  >
                    <img
                      src={user.profileImg || "/avatar-placeholder.png"}
                      alt=""
                      className="w-11 h-11 rounded-full object-cover border border-stone-700"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-white group-hover:underline truncate">
                        {user.fullName}
                      </div>
                      <div className="text-xs text-stone-400 truncate">
                        @{user.username}
                      </div>
                      {user.bio && (
                        <p className="text-xs text-stone-300 line-clamp-1 mt-0.5">
                          {user.bio}
                        </p>
                      )}
                    </div>
                  </Link>

                  <button
                    disabled={isFollowPending}
                    onClick={() => follow(user._id)}
                    className="btn btn-primary btn-sm rounded-full text-white px-4 font-semibold text-xs"
                  >
                    View / Follow
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 4. 📸 Media Tab */}
      {activeTab === "media" && (
        <div className="p-3">
          {isSearching ? (
            <div className="flex justify-center py-16">
              <LoadingSpinner size="lg" />
            </div>
          ) : postsList.length === 0 ? (
            <div className="text-center py-16 text-stone-500">
              No photo or video posts found.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {postsList
                .filter((p) => p.img)
                .map((post) => (
                  <div
                    key={post._id}
                    onClick={() => navigate(`/post/${post._id}`)}
                    className="aspect-square rounded-2xl overflow-hidden bg-stone-900 border border-stone-800 cursor-pointer hover:opacity-90 transition relative group shadow-md"
                  >
                    {post.mediaType === "video" ? (
                      <div className="w-full h-full relative">
                        <video
                          src={post.img}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-bold">
                          ▶ Video
                        </div>
                      </div>
                    ) : (
                      <img
                        src={post.img}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    )}

                    <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition flex items-center justify-between text-[11px] text-white">
                      <span className="font-semibold truncate">
                        {post.user?.fullName}
                      </span>
                      <span>❤️ {post.likes?.length || 0}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExplorePage;
