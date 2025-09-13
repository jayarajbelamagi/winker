import { FaRegComment, FaRegHeart } from "react-icons/fa";
import { FaTrash } from "react-icons/fa";
import { FiShare2 } from "react-icons/fi"; // share icon
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import LoadingSpinner from "./LoadingSpinner";
import { formatPostDate } from "../../utils/date";

const Post = ({ post }) => {
  const [comment, setComment] = useState("");
  const { data: authUser } = useQuery({ queryKey: ["authUser"] });
  const queryClient = useQueryClient();
  const postOwner = post.user;
  const isLiked = post.likes.includes(authUser._id);
  const isMyPost = authUser._id === post.user._id;
  const formattedDate = formatPostDate(post.createdAt);

  const { mutate: deletePost, isPending: isDeleting } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/${post._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      return data;
    },
    onSuccess: () => {
      toast.success("Post deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const { mutate: likePost, isPending: isLiking } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/like/${post._id}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      return data;
    },
    onSuccess: (updatedLikes) => {
      queryClient.setQueryData(["posts"], (oldData) =>
        oldData.map((p) => (p._id === post._id ? { ...p, likes: updatedLikes } : p))
      );
    },
    onError: (error) => toast.error(error.message),
  });

  const { mutate: commentPost, isPending: isCommenting } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/posts/comment/${post._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  const handlePostComment = (e) => { e.preventDefault(); if (!isCommenting) commentPost(); };
  const handleLikePost = () => { if (!isLiking) likePost(); };

  const handleSharePost = async () => {
    const postUrl = `${window.location.origin}/post/${post._id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Check this post", url: postUrl });
      } catch (err) {
        console.log(err);
      }
    } else {
      navigator.clipboard.writeText(postUrl);
      toast.success("Post link copied to clipboard!");
    }
  };

  return (
    <div className="flex gap-2 items-start p-4 border-b border-gray-700">
      <div className="avatar">
        <Link to={`/profile/${postOwner.username}`} className="w-8 rounded-full overflow-hidden">
          <img src={postOwner.profileImg || "/avatar-placeholder.png"} alt="" />
        </Link>
      </div>
      <div className="flex flex-col flex-1">
        <div className="flex gap-2 items-center">
          <Link to={`/profile/${postOwner.username}`} className="font-bold">{postOwner.fullName}</Link>
          <span className="text-gray-700 flex gap-1 text-sm">
            <Link to={`/profile/${postOwner.username}`}>@{postOwner.username}</Link>
            <span>·</span>
            <span>{formattedDate}</span>
          </span>
          {isMyPost && (
            <span className="flex justify-end flex-1">
              {!isDeleting ? <FaTrash className="cursor-pointer hover:text-red-500" onClick={handleDeletePost} /> : <LoadingSpinner size="sm" />}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-3 overflow-hidden">
          <span>{post.text}</span>
          {post.img && <img src={post.img} className="h-80 object-contain rounded-lg border border-gray-700" alt="" />}
        </div>
        <div className="flex justify-between mt-3">
          <div className="flex gap-4 items-center w-2/3 justify-between">
            <div className="flex gap-1 items-center cursor-pointer group" onClick={() => document.getElementById("comments_modal" + post._id).showModal()}>
              <FaRegComment className="w-4 h-4 text-slate-500 group-hover:text-sky-400" />
              <span className="text-sm text-slate-500 group-hover:text-sky-400">{post.comments.length}</span>
            </div>
            <div className="flex gap-1 items-center group cursor-pointer" onClick={handleLikePost}>
              {isLiking && <LoadingSpinner size="sm" />}
              <FaRegHeart className={`w-4 h-4 cursor-pointer ${isLiked ? "text-pink-500" : "text-slate-500"} group-hover:text-pink-500`} />
              <span className={`text-sm ${isLiked ? "text-pink-500" : "text-slate-500"} group-hover:text-pink-500`}>{post.likes.length}</span>
            </div>
            <div className="flex gap-1 items-center group cursor-pointer" onClick={handleSharePost}>
              <FiShare2 className="w-5 h-5 text-slate-500 group-hover:text-blue-500" />
            </div>
          </div>
        </div>

        {/* Comment Modal */}
        <dialog id={`comments_modal${post._id}`} className="modal border-none outline-none">
          <div className="modal-box rounded border border-gray-600">
            <h3 className="font-bold text-lg mb-4">COMMENTS</h3>
            <div className="flex flex-col gap-3 max-h-60 overflow-auto">
              {post.comments.length === 0 && <p className="text-sm text-slate-500">No comments yet 🤔 Be the first one 😉</p>}
              {post.comments.map((c) => (
                <div key={c._id} className="flex gap-2 items-start">
                  <div className="avatar">
                    <div className="w-8 rounded-full">
                      <img src={c.user.profileImg || "/avatar-placeholder.png"} alt="" />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="font-bold">{c.user.fullName}</span>
                      <span className="text-gray-700 text-sm">@{c.user.username}</span>
                    </div>
                    <div className="text-sm">{c.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <form className="flex gap-2 items-center mt-4 border-t border-gray-600 pt-2" onSubmit={handlePostComment}>
              <textarea
                className="textarea w-full p-1 rounded text-md resize-none border focus:outline-none border-gray-800"
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <button className="btn btn-primary rounded-full btn-sm text-white px-4">
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
