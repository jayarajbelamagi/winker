import { useQuery } from "@tanstack/react-query";
import Post from "../../components/common/Post";
import PostSkeleton from "../../components/skeletons/PostSkeleton";
import { apiFetch } from "../../lib/api";
import { BsBookmark } from "react-icons/bs";

const BookmarksPage = () => {
	const { data: posts, isLoading, isRefetching } = useQuery({
		queryKey: ["bookmarkedPosts"],
		queryFn: async () => {
			const res = await apiFetch("/api/posts/bookmarks");
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Failed to load bookmarks");
			return data;
		},
	});

	return (
		<div className="flex-[4_4_0] min-w-0 max-w-2xl xl:max-w-3xl w-full border-r border-gray-800 min-h-screen">
			{/* Header */}
			<div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-700 sticky top-12 md:top-0 bg-black/85 backdrop-blur z-10">
				<div>
					<h1 className="text-xl font-bold text-white flex items-center gap-2">
						<BsBookmark className="text-primary" />
						Bookmarks
					</h1>
					<p className="text-xs text-stone-500">
						{posts?.length || 0} {posts?.length === 1 ? "post" : "posts"} saved
					</p>
				</div>
			</div>

			{/* Loading skeletons */}
			{(isLoading || isRefetching) && (
				<div>
					<PostSkeleton />
					<PostSkeleton />
					<PostSkeleton />
				</div>
			)}

			{/* Empty state */}
			{!isLoading && (!posts || posts.length === 0) && (
				<div className="flex flex-col items-center justify-center p-12 text-center">
					<div className="w-16 h-16 rounded-full bg-stone-900 flex items-center justify-center mb-4">
						<BsBookmark className="w-8 h-8 text-stone-500" />
					</div>
					<h2 className="text-2xl font-bold text-white mb-2">Save posts for later</h2>
					<p className="text-stone-400 max-w-sm text-sm">
						Don't let the good ones fly away! Bookmark posts to easily find them again in the future.
					</p>
				</div>
			)}

			{/* Post list */}
			{!isLoading && posts && posts.length > 0 && (
				<div>
					{posts.map((post) => (
						<Post key={post._id} post={post} />
					))}
				</div>
			)}
		</div>
	);
};

export default BookmarksPage;
