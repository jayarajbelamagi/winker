import { FaRegComment, FaRegHeart } from "react-icons/fa";
import { FaTrash } from "react-icons/fa";
import { FiShare2 } from "react-icons/fi";
import { BsBookmark, BsBookmarkFill } from "react-icons/bs";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import LoadingSpinner from "./LoadingSpinner";
import { formatPostDate } from "../../utils/date";
import { apiFetch } from "../../lib/api";

const Post = ({ post }) => {
  const [comment, setComment] = useState("");
  const { data: authUser } = useQuery({ queryKey: ["authUser"] });
  const queryClient = useQueryClient();

  const postOwner = post.user || {};

  const isLiked = post.likes?.includes(authUser?._id);
  const isMyPost = authUser?._id === post.user?._id;
  const formattedDate = post?.createdAt ? formatPostDate(post.createdAt) : "";

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

  return (
    <div className="flex gap-3 items-start p-4 border-b border-gray-700 hover:bg-stone-900/30 transition">
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
      <div className="flex flex-col flex-1">
        <div className="flex gap-2 items-center">
          <Link to={`/profile/${postOwner?.username || ""}`} className="font-bold hover:underline">
            {postOwner?.fullName || "User"}
          </Link>
          <span className="text-gray-500 flex gap-1 text-sm">
            <Link to={`/profile/${postOwner?.username || ""}`}>
              @{postOwner?.username || "user"}
            </Link>
            <span>·</span>
            <span>{formattedDate}</span>
          </span>
          {isMyPost && (
            <span className="flex justify-end flex-1">
              {!isDeleting ? (
                <FaTrash
                  className="cursor-pointer text-stone-500 hover:text-red-500 transition"
                  onClick={handleDeletePost}
                  title="Delete post"
                />
              ) : (
                <LoadingSpinner size="sm" />
              )}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3 overflow-hidden mt-1">
          <span className="text-[15px] leading-relaxed whitespace-pre-wrap">{post?.text}</span>
          {post?.img && (
            <img
              src={post.img}
              className="max-h-96 w-full object-contain rounded-xl border border-gray-800 bg-black/40"
              alt=""
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
          )}
        </div>

        {/* Action Buttons Bar: Comments, Likes, Bookmarks, Share */}
        <div className="flex justify-between items-center mt-3 pt-1 text-slate-500 max-w-md">
          {/* Comments */}
          <div
            className="flex gap-1.5 items-center cursor-pointer group"
            onClick={() =>
              document
                .getElementById("comments_modal" + post._id)
                ?.showModal()
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

          {/* Bookmark (Like X) */}
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

        {/* Comment Modal */}
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
                      <span className="font-bold text-sm text-white">{c.user?.fullName}</span>
                      <span className="text-gray-500 text-xs">
                        @{c.user?.username}
                      </span>
                    </div>
                    <div className="text-sm text-stone-300 mt-0.5">{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <form
              className="flex gap-2 items-center mt-4 border-t border-gray-700 pt-3"
              onSubmit={handlePostComment}
            >
              <textarea
                className="textarea w-full p-2 rounded-lg text-sm resize-none border focus:outline-none border-gray-700 bg-black/50 text-white"
                placeholder="Post your reply..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={1}
              />
              <button
                className="btn btn-primary rounded-full btn-sm text-white px-4"
                disabled={isCommenting || !comment.trim()}
              >
                {isCommenting ? <LoadingSpinner size="sm" /> : "Reply"}
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
