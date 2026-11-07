import { useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import {
  FaArrowLeft,
  FaRegHeart,
  FaHeart,
  FaRegComment,
  FaTrash,
  FaReply,
} from "react-icons/fa";
import { BsBookmark, BsBookmarkFill, BsEmojiSmileFill } from "react-icons/bs";
import { FiShare2 } from "react-icons/fi";
import { IoCloseSharp } from "react-icons/io5";

import LoadingSpinner from "../../components/common/LoadingSpinner";
import EmojiPicker from "../../components/common/EmojiPicker";
import { formatPostDate } from "../../utils/date";
import { apiFetch } from "../../lib/api";

const PostPage = ({ authUser }) => {
  const { id: postId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [commentText, setCommentText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyingToCommentId, setReplyingToCommentId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const replyInputRef = useRef(null);

  // Fetch post details
  const {
    data: post,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["post", postId],
    queryFn: async () => {
      const res = await apiFetch(`/api/posts/${postId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Post not found");
      return data;
    },
  });

  const postOwner = post?.user || {};
  const isLiked = post?.likes?.includes(authUser?._id);
  const isMyPost = authUser?._id === postOwner?._id;

  // Bookmark status
  const isBookmarked = authUser?.bookmarks?.some(
    (b) => (typeof b === "string" ? b : b?._id) === postId
  );

  // Like / Unlike Post
  const { mutate: likePost, isPending: isLiking } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/posts/like/${postId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to like post");
      return data;
    },
    onSuccess: (updatedLikes) => {
      queryClient.setQueryData(["post", postId], (old) =>
        old ? { ...old, likes: updatedLikes } : old
      );
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (err) => toast.error(err.message),
  });

  // Bookmark / Unbookmark
  const { mutate: toggleBookmark } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/posts/bookmark/${postId}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update bookmark");
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["authUser"], (old) => {
        if (!old) return old;
        const bookmarks = old.bookmarks || [];
        const nextBookmarks = data.bookmarked
          ? [...bookmarks, postId]
          : bookmarks.filter((b) => (typeof b === "string" ? b : b?._id) !== postId);
        return { ...old, bookmarks: nextBookmarks };
      });
      toast.success(data.message || (data.bookmarked ? "Post saved!" : "Bookmark removed"));
    },
    onError: (err) => toast.error(err.message),
  });

  // Delete Post
  const { mutate: deletePost, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/posts/${postId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete post");
      return data;
    },
    onSuccess: () => {
      toast.success("Post deleted");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      navigate("/");
    },
    onError: (err) => toast.error(err.message),
  });

  // Add Comment (Reply to Post)
  const { mutate: addComment, isPending: isCommenting } = useMutation({
    mutationFn: async () => {
      const res = await apiFetch(`/api/posts/comment/${postId}`, {
        method: "POST",
        body: JSON.stringify({ text: commentText }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post comment");
      return data;
    },
    onSuccess: (updatedComments) => {
      setCommentText("");
      setShowEmojiPicker(false);
      queryClient.setQueryData(["post", postId], (old) =>
        old ? { ...old, comments: updatedComments } : old
      );
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Reply posted!");
    },
    onError: (err) => toast.error(err.message),
  });

  // Reply to a Comment
  const { mutate: addReply, isPending: isReplying } = useMutation({
    mutationFn: async ({ commentId, text }) => {
      const res = await apiFetch(`/api/posts/comment/${postId}/reply/${commentId}`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to post reply");
      return data;
    },
    onSuccess: (updatedComments) => {
      setReplyText("");
      setReplyingToCommentId(null);
      queryClient.setQueryData(["post", postId], (old) =>
        old ? { ...old, comments: updatedComments } : old
      );
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Reply added!");
    },
    onError: (err) => toast.error(err.message),
  });

  // Like a Comment
  const { mutate: likeComment } = useMutation({
    mutationFn: async (commentId) => {
      const res = await apiFetch(`/api/posts/comment/${postId}/like/${commentId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to like comment");
      return { commentId, likes: data };
    },
    onSuccess: ({ commentId, likes }) => {
      queryClient.setQueryData(["post", postId], (old) => {
        if (!old) return old;
        return {
          ...old,
          comments: old.comments?.map((c) =>
            c._id === commentId ? { ...c, likes } : c
          ),
        };
      });
    },
  });

  const handleShare = async () => {
    const postUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Post on Winker", url: postUrl });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(postUrl);
      toast.success("Post link copied to clipboard!");
    }
  };

  const getTimeRemaining = (expiresAt) => {
    if (!expiresAt) return "24h left";
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return hours > 0 ? `${hours}h left` : `${minutes}m left`;
  };

  if (isLoading) {
    return (
      <div className="flex-[4_4_0] min-h-screen border-r border-gray-700 flex justify-center items-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="flex-[4_4_0] min-h-screen border-r border-gray-700 p-6 text-center">
        <button
          onClick={() => navigate(-1)}
          className="btn btn-sm btn-ghost gap-2 mb-4"
        >
          <FaArrowLeft /> Back
        </button>
        <p className="text-xl text-stone-400">Post not found or has expired.</p>
        <button onClick={() => navigate("/")} className="btn btn-primary mt-4">
          Go to Home Feed
        </button>
      </div>
    );
  }

  const formattedDate = post?.createdAt
    ? new Date(post.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }) +
      " · " +
      new Date(post.createdAt).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className="flex-[4_4_0] min-w-0 max-w-2xl xl:max-w-3xl border-r border-gray-800 min-h-screen pb-20 md:pb-6">
      {/* Top Header: Sticky like X */}
      <div className="sticky top-0 z-20 bg-black/85 backdrop-blur-md px-4 py-3 border-b border-gray-700 flex items-center gap-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-stone-800 transition"
          title="Back"
        >
          <FaArrowLeft className="w-4 h-4 text-white" />
        </button>
        <h2 className="text-lg font-bold text-white tracking-wide">Post</h2>
      </div>

      {/* Main Post Card */}
      <article className="p-4 border-b border-gray-700">
        {/* Author Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link
              to={`/profile/${postOwner.username || ""}`}
              className="w-12 h-12 rounded-full overflow-hidden block flex-shrink-0"
            >
              <img
                src={postOwner.profileImg || "/avatar-placeholder.png"}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/avatar-placeholder.png";
                }}
              />
            </Link>
            <div className="flex flex-col">
              <Link
                to={`/profile/${postOwner.username || ""}`}
                className="font-bold text-white hover:underline text-base"
              >
                {postOwner.fullName || "User"}
              </Link>
              <span className="text-stone-400 text-sm">
                @{postOwner.username || "user"}
              </span>
            </div>
          </div>

          {/* Delete Button (if own post) */}
          {isMyPost && (
            <button
              onClick={() => deletePost()}
              disabled={isDeleting}
              className="text-stone-400 hover:text-red-500 p-2 rounded-full transition"
              title="Delete post"
            >
              {isDeleting ? <LoadingSpinner size="sm" /> : <FaTrash className="w-4 h-4" />}
            </button>
          )}
        </div>

        {/* 24h Story Banner if active */}
        {post.is24hStory && (
          <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <span>⏳</span>
            <span>24-Hour Story Post</span>
            <span className="font-mono text-amber-400">
              ({getTimeRemaining(post.expiresAt)})
            </span>
          </div>
        )}

        {/* Post Text */}
        <p className="text-[17px] text-white leading-relaxed whitespace-pre-wrap break-words mt-1 mb-3">
          {post.text}
        </p>

        {/* Post Image */}
        {post.img && (
          <div className="my-3 rounded-2xl overflow-hidden border border-gray-800 bg-black/40">
            <img
              src={post.img}
              alt="Post attachment"
              className="w-full max-h-[550px] object-contain"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          </div>
        )}

        {/* Timestamp */}
        <div className="py-2.5 text-stone-500 text-sm border-b border-gray-800">
          <span>{formattedDate}</span>
        </div>

        {/* Metrics Row (Likes, Comments, Bookmarks) */}
        <div className="flex items-center gap-6 py-3 border-b border-gray-800 text-sm text-stone-400">
          <div>
            <strong className="text-white font-semibold">
              {post.likes?.length || 0}
            </strong>{" "}
            Likes
          </div>
          <div>
            <strong className="text-white font-semibold">
              {post.comments?.length || 0}
            </strong>{" "}
            Replies
          </div>
        </div>

        {/* Interactive Action Bar */}
        <div className="flex items-center justify-around py-3 border-b border-gray-800 text-stone-400">
          {/* Reply Icon */}
          <button
            onClick={() => {
              const composer = document.getElementById("main-reply-input");
              composer?.focus();
            }}
            className="flex items-center gap-2 hover:text-sky-400 transition"
            title="Reply"
          >
            <FaRegComment className="w-5 h-5" />
            <span className="text-xs">{post.comments?.length || 0}</span>
          </button>

          {/* Like Button */}
          <button
            onClick={() => likePost()}
            className={`flex items-center gap-2 transition ${
              isLiked ? "text-pink-500" : "hover:text-pink-500"
            }`}
            title="Like"
          >
            {isLiked ? (
              <FaHeart className="w-5 h-5 fill-pink-500 animate-in zoom-in-50" />
            ) : (
              <FaRegHeart className="w-5 h-5" />
            )}
            <span className="text-xs">{post.likes?.length || 0}</span>
          </button>

          {/* Bookmark Button */}
          <button
            onClick={() => toggleBookmark()}
            className={`flex items-center gap-2 transition ${
              isBookmarked ? "text-sky-500" : "hover:text-sky-500"
            }`}
            title="Bookmark"
          >
            {isBookmarked ? (
              <BsBookmarkFill className="w-5 h-5 fill-sky-500" />
            ) : (
              <BsBookmark className="w-5 h-5" />
            )}
          </button>

          {/* Share Button */}
          <button
            onClick={handleShare}
            className="flex items-center gap-2 hover:text-sky-400 transition"
            title="Share"
          >
            <FiShare2 className="w-5 h-5" />
          </button>
        </div>

        {/* Inline "Post your reply" Box */}
        <div className="flex gap-3 pt-4">
          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
            <img
              src={authUser?.profileImg || "/avatar-placeholder.png"}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 flex flex-col gap-2">
            <textarea
              id="main-reply-input"
              rows={2}
              placeholder="Post your reply"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              className="w-full bg-transparent text-white placeholder-stone-500 text-base resize-none focus:outline-none"
            />
            <div className="flex items-center justify-between border-t border-gray-800 pt-2 relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((prev) => !prev)}
                className="text-primary hover:text-sky-300 p-1 rounded-full"
                title="Add emoji"
              >
                <BsEmojiSmileFill className="w-5 h-5" />
              </button>

              {showEmojiPicker && (
                <div className="absolute left-0 bottom-10 z-30">
                  <EmojiPicker
                    onSelect={(emoji) => setCommentText((prev) => prev + emoji)}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                </div>
              )}

              <button
                onClick={() => addComment()}
                disabled={isCommenting || !commentText.trim()}
                className="btn btn-primary rounded-full btn-sm px-5 text-white"
              >
                {isCommenting ? "Replying..." : "Reply"}
              </button>
            </div>
          </div>
        </div>
      </article>

      {/* Threaded Comments & Nested Replies Section */}
      <section className="divide-y divide-gray-800">
        {post.comments?.length === 0 ? (
          <div className="py-12 text-center text-stone-500">
            No replies yet. Be the first to reply!
          </div>
        ) : (
          post.comments?.map((comment) => {
            const commentUser = comment.user || {};
            const isCommentLiked = comment.likes?.includes(authUser?._id);
            const isReplyingThis = replyingToCommentId === comment._id;

            return (
              <div key={comment._id} className="p-4 hover:bg-stone-900/20 transition">
                {/* Comment Container */}
                <div className="flex gap-3 items-start">
                  <Link
                    to={`/profile/${commentUser.username || ""}`}
                    className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 block"
                  >
                    <img
                      src={commentUser.profileImg || "/avatar-placeholder.png"}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = "/avatar-placeholder.png";
                      }}
                    />
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Link
                          to={`/profile/${commentUser.username || ""}`}
                          className="font-bold text-white hover:underline text-sm"
                        >
                          {commentUser.fullName || "User"}
                        </Link>
                        <span className="text-stone-500 text-xs">
                          @{commentUser.username || "user"}
                        </span>
                        {comment.createdAt && (
                          <>
                            <span className="text-stone-500 text-xs">·</span>
                            <span className="text-stone-500 text-xs">
                              {formatPostDate(comment.createdAt)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="text-stone-200 text-sm mt-1 whitespace-pre-wrap break-words">
                      {comment.text}
                    </p>

                    {/* Comment action bar */}
                    <div className="flex items-center gap-6 mt-2 text-stone-500 text-xs">
                      {/* Reply button */}
                      <button
                        onClick={() => {
                          setReplyingToCommentId(
                            isReplyingThis ? null : comment._id
                          );
                          setReplyText(
                            isReplyingThis ? "" : `@${commentUser.username} `
                          );
                        }}
                        className="flex items-center gap-1.5 hover:text-sky-400 transition"
                      >
                        <FaReply className="w-3 h-3" />
                        <span>Reply</span>
                      </button>

                      {/* Like comment button */}
                      <button
                        onClick={() => likeComment(comment._id)}
                        className={`flex items-center gap-1 hover:text-pink-500 transition ${
                          isCommentLiked ? "text-pink-500" : ""
                        }`}
                      >
                        {isCommentLiked ? (
                          <FaHeart className="w-3 h-3 fill-pink-500" />
                        ) : (
                          <FaRegHeart className="w-3 h-3" />
                        )}
                        <span>{comment.likes?.length || ""}</span>
                      </button>
                    </div>

                    {/* Inline Nested Reply Composer */}
                    {isReplyingThis && (
                      <div className="mt-3 p-3 bg-stone-900/70 rounded-xl border border-gray-700 animate-in fade-in">
                        <div className="text-xs text-stone-400 mb-2">
                          Replying to{" "}
                          <span className="text-sky-400">
                            @{commentUser.username}
                          </span>
                        </div>
                        <textarea
                          ref={replyInputRef}
                          rows={2}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Post your reply"
                          className="w-full bg-stone-800 text-white text-sm p-2 rounded-lg border border-gray-700 focus:outline-none focus:border-sky-500 resize-none"
                        />
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => {
                              setReplyingToCommentId(null);
                              setReplyText("");
                            }}
                            className="btn btn-xs btn-ghost text-stone-400"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() =>
                              addReply({ commentId: comment._id, text: replyText })
                            }
                            disabled={isReplying || !replyText.trim()}
                            className="btn btn-xs btn-primary rounded-full px-4 text-white"
                          >
                            {isReplying ? "Replying..." : "Reply"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Threaded Nested Replies */}
                    {comment.replies && comment.replies.length > 0 && (
                      <div className="mt-3 pl-3 border-l-2 border-stone-800 space-y-3">
                        {comment.replies.map((reply, rIdx) => {
                          const replyUser = reply.user || {};
                          return (
                            <div key={reply._id || rIdx} className="flex gap-2.5 items-start">
                              <Link
                                to={`/profile/${replyUser.username || ""}`}
                                className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 block mt-0.5"
                              >
                                <img
                                  src={replyUser.profileImg || "/avatar-placeholder.png"}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = "/avatar-placeholder.png";
                                  }}
                                />
                              </Link>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <Link
                                    to={`/profile/${replyUser.username || ""}`}
                                    className="font-bold text-white hover:underline text-xs"
                                  >
                                    {replyUser.fullName || "User"}
                                  </Link>
                                  <span className="text-stone-500 text-[11px]">
                                    @{replyUser.username || "user"}
                                  </span>
                                  {reply.createdAt && (
                                    <>
                                      <span className="text-stone-500 text-[11px]">·</span>
                                      <span className="text-stone-500 text-[11px]">
                                        {formatPostDate(reply.createdAt)}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <p className="text-stone-200 text-xs mt-0.5 whitespace-pre-wrap break-words">
                                  {reply.text}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </section>
    </div>
  );
};

export default PostPage;
