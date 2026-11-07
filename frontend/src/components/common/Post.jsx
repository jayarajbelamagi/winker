import { FaRegComment, FaRegHeart } from "react-icons/fa";
import { FaTrash } from "react-icons/fa";
import { FiShare2 } from "react-icons/fi";
import { BsBookmark, BsBookmarkFill } from "react-icons/bs";
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import LoadingSpinner from "./LoadingSpinner";
import { formatPostDate } from "../../utils/date";
import { apiFetch } from "../../lib/api";

const Post = ({ post }) => {
  const [comment, setComment] = useState("");
  const navigate = useNavigate();
  const { data: authUser } = useQuery({ queryKey: ["authUser"] });
  const queryClient = useQueryClient();

  const postOwner = post.user || {};

  const isLiked = post.likes?.includes(authUser?._id);
  const isMyPost = authUser?._id === post.user?._id;
  const formattedDate = post?.createdAt ? formatPostDate(post.createdAt) : "";

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return "24h left";
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h left`;
    return `${minutes}m left`;
  };

  // Bookmark status
  const [isBookmarked, setIsBookmarked] = useState(
    () => authUser?.bookmarks?.some((id) => (typeof id === "string" ? id : id?._id) === post._id) || false
  );

  useEffect(() => {
    if (authUser?.bookmarks) {
      setIsBookmarked(
        authUser.bookmarks.some((id) => (typeof id === "string" ? id : id?._id) === post._id)
      );
    }
  }, [authUser?.bookmarks, post._id]);

  // 🗑️ Delete Post
  const { mutate: deletePost, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/posts/${post._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      return data;
    },
    onSuccess: () => {
      toast.success("Post deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarkedPosts"] });
    },
  });

  // ❤️ Like Post
  const { mutate: likePost, isPending: isLiking } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/posts/like/${post._id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      return data;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      const previousPosts = queryClient.getQueryData(["posts"]);

      queryClient.setQueryData(["posts"], (oldPosts) =>
        oldPosts?.map((p) =>
          p._id === post._id
            ? {
                ...p,
                likes: isLiked
                  ? p.likes.filter((id) => id !== authUser?._id)
                  : [...(p.likes || []), authUser?._id],
              }
            : p
        )
      );

      return { previousPosts };
    },
    onError: (error, _, context) => {
      queryClient.setQueryData(["posts"], context?.previousPosts);
      toast.error(error.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  // 🔖 Bookmark Post (like X)
  const { mutate: toggleBookmark, isPending: isBookmarking } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/posts/bookmark/${post._id}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update bookmark");
      return data;
    },
    onSuccess: (data) => {
      setIsBookmarked(data.bookmarked);
      toast.success(data.message || (data.bookmarked ? "Saved to Bookmarks" : "Removed from Bookmarks"));
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      queryClient.invalidateQueries({ queryKey: ["bookmarkedPosts"] });
    },
    onError: (err) => {
      toast.error(err.message || "Failed to bookmark");
    },
  });

  // 📊 Vote on Poll
  const { mutate: votePoll } = useMutation({
    mutationFn: async (optionIndex) => {
      const res = await apiFetch(`/api/posts/poll/${post._id}/vote`, {
        method: "POST",
        body: JSON.stringify({ optionIndex }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit vote");
      return data;
    },
    onSuccess: () => {
      toast.success("Vote recorded!");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  // 💬 Comment on Post
  const { mutate: commentPost, isPending: isCommenting } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/posts/comment/${post._id}`, {
        method: "POST",
        body: JSON.stringify({ text: comment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      return data;
    },
    onSuccess: () => {
      toast.success("Comment posted successfully");
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error) => toast.error(error.message),
  });

  const handleDeletePost = () => deletePost();
  const handlePostComment = (e) => {
    e.preventDefault();
    if (!isCommenting && comment.trim()) commentPost();
  };
  const handleLikePost = () => {
    if (!isLiking) likePost();
  };
  const handleBookmarkPost = () => {
    if (!isBookmarking) toggleBookmark();
  };

  const handleSharePost = async () => {
    const postUrl = `${window.location.origin}/post/${post._id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Check this post on Winker", url: postUrl });
      } catch (err) {
        console.log(err);
      }
    } else {
      navigator.clipboard.writeText(postUrl);
      toast.success("Post link copied to clipboard!");
    }
  };

  const handlePostClick = (e) => {
    if (e.target.closest("a, button, input, textarea, video, svg, .modal, .no-nav")) {
      return;
    }
    navigate(`/post/${post._id}`);
  };

  const isVideoMedia =
    post?.mediaType === "video" ||
    (post?.img &&
      (post.img.includes("/video/upload/") ||
        post.img.endsWith(".mp4") ||
        post.img.endsWith(".webm") ||
        post.img.endsWith(".mov")));

  return (
    <div
      onClick={handlePostClick}
      className="flex gap-3 items-start p-3 sm:p-4 border-b border-gray-700 hover:bg-stone-900/30 transition cursor-pointer"
    >
      <div className="avatar">
        <Link
          to={`/profile/${postOwner?.username || ""}`}
          className="w-10 h-10 rounded-full overflow-hidden block"
        >
          <img
            src={postOwner?.profileImg || "/avatar-placeholder.png"}
            alt=""
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/avatar-placeholder.png";
            }}
          />
        </Link>
      </div>

      <div className="flex flex-col flex-1 min-w-0">
        {/* Compact Author Header (Only Name & Time, no username) */}
        <div className="flex gap-2 items-center">
          <Link
            to={`/profile/${postOwner?.username || ""}`}
            className="text-xs font-semibold text-white/95 hover:underline truncate"
          >
            {postOwner?.fullName || "User"}
          </Link>
          <span className="text-gray-500 text-[11px] whitespace-nowrap">
            · {formattedDate}
          </span>
          {post?.is24hStory && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 ml-1"
              title="24-Hour Story Post"
            >
              <span>⏳ 24h</span>
              <span className="font-mono text-[9px] text-amber-400">
                ({getTimeRemaining(post.expiresAt)})
              </span>
            </span>
          )}

          {isMyPost && (
            <span className="flex justify-end flex-1">
              {!isDeleting ? (
                <FaTrash
                  className="cursor-pointer text-stone-500 hover:text-red-500 transition w-3.5 h-3.5"
                  onClick={handleDeletePost}
                  title="Delete post"
                />
              ) : (
                <LoadingSpinner size="sm" />
              )}
            </span>
          )}
        </div>

        {/* Post Text (Prominent focal point) */}
        <div className="flex flex-col gap-2.5 overflow-hidden mt-1.5">
          {post?.text && (
            <span className="text-[15px] sm:text-[16px] text-stone-100 leading-relaxed whitespace-pre-wrap break-words">
              {post.text}
            </span>
          )}

          {/* Interactive Poll Display */}
          {post?.poll?.options?.length > 0 && (
            <div
              className="border border-stone-800 rounded-2xl p-3 bg-stone-900/40 my-1 space-y-2 max-w-lg no-nav"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="font-semibold text-xs sm:text-sm text-stone-200">
                {post.poll.question || "Poll"}
              </div>

              {(() => {
                const totalVotes = post.poll.options.reduce(
                  (sum, opt) => sum + (opt.votes?.length || 0),
                  0
                );
                const userVoteIndex = post.poll.options.findIndex((opt) =>
                  opt.votes?.some(
                    (id) => (id?._id || id)?.toString() === authUser?._id?.toString()
                  )
                );
                const hasVoted = userVoteIndex > -1;
                const isExpired =
                  post.poll.expiresAt && new Date() > new Date(post.poll.expiresAt);

                return (
                  <div className="space-y-2 mt-2">
                    {post.poll.options.map((opt, optIdx) => {
                      const votesCount = opt.votes?.length || 0;
                      const percent =
                        totalVotes > 0 ? Math.round((votesCount / totalVotes) * 100) : 0;
                      const isUserChoice = userVoteIndex === optIdx;

                      if (hasVoted || isExpired) {
                        return (
                          <div
                            key={optIdx}
                            className="relative h-9 rounded-xl overflow-hidden bg-stone-800/60 border border-stone-700/50 flex items-center px-3"
                          >
                            <div
                              className={`absolute left-0 top-0 bottom-0 ${
                                isUserChoice ? "bg-primary/35" : "bg-stone-700/30"
                              } transition-all duration-500`}
                              style={{ width: `${percent}%` }}
                            />
                            <div className="relative z-10 flex justify-between w-full text-xs font-medium text-white">
                              <span className="flex items-center gap-1.5 truncate">
                                {opt.text}
                                {isUserChoice && (
                                  <span className="text-primary font-bold">✓</span>
                                )}
                              </span>
                              <span className="font-mono text-stone-300 ml-2">{percent}%</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => votePoll(optIdx)}
                          className="w-full text-left py-2 px-3.5 rounded-xl border border-primary/40 hover:bg-primary/10 text-primary text-xs font-semibold transition"
                        >
                          {opt.text}
                        </button>
                      );
                    })}

                    <div className="text-[11px] text-stone-500 pt-1 flex justify-between items-center">
                      <span>
                        {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
                      </span>
                      <span>{isExpired ? "Final results" : "Active poll"}</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Media Display (Photo or Video Player up to 5MB) */}
          {post?.img && (
            <div className="rounded-xl overflow-hidden border border-gray-800 bg-black/40 my-1">
              {isVideoMedia ? (
                <video
                  src={post.img}
                  controls
                  playsInline
                  className="max-h-96 w-full object-contain bg-black"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <img
                  src={post.img}
                  className="max-h-96 w-full object-contain"
                  alt=""
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              )}
            </div>
          )}

          {/* Quoted Post Card */}
          {post?.quotedPost && (
            <div
              className="border border-stone-800 rounded-2xl p-3 bg-stone-900/30 hover:bg-stone-900/60 transition cursor-pointer my-1"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/post/${post.quotedPost._id}`);
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <img
                  src={post.quotedPost.user?.profileImg || "/avatar-placeholder.png"}
                  alt=""
                  className="w-5 h-5 rounded-full object-cover"
                />
                <span className="text-xs font-bold text-white">
                  {post.quotedPost.user?.fullName}
                </span>
              </div>
              <p className="text-xs text-stone-300 line-clamp-3 whitespace-pre-wrap">
                {post.quotedPost.text}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons Bar: Comments, Likes, Bookmarks, Share */}
        <div className="flex justify-between items-center mt-3 pt-1 text-slate-500 max-w-md">
          {/* Comments */}
          <div
            className="flex gap-1.5 items-center cursor-pointer group"
            onClick={() =>
              document.getElementById("comments_modal" + post._id)?.showModal()
            }
          >
            <FaRegComment className="w-4 h-4 group-hover:text-sky-400 transition" />
            <span className="text-xs group-hover:text-sky-400">
              {post.comments?.length || 0}
            </span>
          </div>

          {/* Likes */}
          <div
            className="flex gap-1.5 items-center group cursor-pointer"
            onClick={handleLikePost}
          >
            {isLiking ? (
              <LoadingSpinner size="sm" />
            ) : (
              <FaRegHeart
                className={`w-4 h-4 ${
                  isLiked ? "text-pink-500 fill-pink-500" : "group-hover:text-pink-500"
                } transition`}
              />
            )}
            <span
              className={`text-xs ${
                isLiked ? "text-pink-500 font-semibold" : "group-hover:text-pink-500"
              }`}
            >
              {post.likes?.length || 0}
            </span>
          </div>

          {/* Bookmark */}
          <div
            className="flex gap-1.5 items-center group cursor-pointer"
            onClick={handleBookmarkPost}
            title={isBookmarked ? "Remove bookmark" : "Bookmark"}
          >
            {isBookmarked ? (
              <BsBookmarkFill className="w-4 h-4 text-sky-400 transition scale-110" />
            ) : (
              <BsBookmark className="w-4 h-4 group-hover:text-sky-400 transition" />
            )}
          </div>

          {/* Share */}
          <div
            className="flex gap-1.5 items-center group cursor-pointer"
            onClick={handleSharePost}
            title="Share post"
          >
            <FiShare2 className="w-4 h-4 group-hover:text-green-500 transition" />
          </div>
        </div>

        {/* Comments Dialog */}
        <dialog
          id={`comments_modal${post._id}`}
          className="modal border-none outline-none"
        >
          <div className="modal-box rounded-xl border border-gray-700 bg-stone-900">
            <h3 className="font-bold text-lg mb-4 text-white">Comments</h3>
            <div className="flex flex-col gap-3 max-h-60 overflow-auto">
              {(!post.comments || post.comments.length === 0) && (
                <p className="text-sm text-slate-500 text-center py-4">
                  No comments yet 🤔 Be the first to comment!
                </p>
              )}
              {post.comments?.map((c) => (
                <div key={c._id} className="flex gap-2 items-start py-1">
                  <div className="avatar">
                    <div className="w-8 rounded-full overflow-hidden">
                      <img
                        src={c.user?.profileImg || "/avatar-placeholder.png"}
                        alt=""
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = "/avatar-placeholder.png";
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="font-bold text-sm text-white">
                        {c.user?.fullName}
                      </span>
                    </div>
                    <div className="text-sm text-stone-300 mt-0.5">{c.text}</div>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handlePostComment}
              className="flex gap-2 items-center mt-4 border-t border-gray-600 pt-2"
            >
              <textarea
                className="textarea w-full p-1 rounded text-md resize-none border focus:outline-none border-gray-800 bg-black text-white"
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button
                className="btn btn-primary rounded-full btn-sm text-white px-4"
                disabled={isCommenting}
              >
                {isCommenting ? <LoadingSpinner size="md" /> : "Post"}
              </button>
            </form>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button className="outline-none">close</button>
          </form>
        </dialog>
      </div>
    </div>
  );
};

export default Post;
