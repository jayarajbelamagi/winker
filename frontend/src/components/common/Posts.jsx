import Post from "./Post";
import PostSkeleton from "../skeletons/PostSkeleton";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const Posts = ({ feedType, username, userId }) => {
	const [searchTerm, setSearchTerm] = useState("");

	const getPostEndpoint = () => {
		switch (feedType) {
			case "forYou":
				return "/api/posts/all";
			case "following":
				return "/api/posts/following";
			case "posts":
				return `/api/posts/user/${username}`;
			case "likes":
				return `/api/posts/likes/${userId}`;
			default:
				return "/api/posts/all";
		}
	};

	const POST_ENDPOINT = getPostEndpoint();

	const {
		data: posts,
		isLoading,
		refetch,
		isRefetching,
	} = useQuery({
		queryKey: ["posts", feedType],
		queryFn: async () => {
			const res = await fetch(POST_ENDPOINT);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
	});

	useEffect(() => {
		refetch();
	}, [feedType, refetch, username]);

	// Filter posts based on search term only for forYou/following
	const filteredPosts =
		(feedType === "forYou" || feedType === "following") && searchTerm
			? posts?.filter(
					(post) =>
						post.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
						post.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
						post.user.fullName.toLowerCase().includes(searchTerm.toLowerCase())
			  )
			: posts;

	return (
		<div>
			{/* Search bar at the extreme top */}
			<div className="p-4 border-b border-gray-700">
				<input
					type="text"
					placeholder="Search posts or users..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className="w-full p-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-gray-800 text-white"
				/>
			</div>

			{/* Posts */}
			{(isLoading || isRefetching) && (
				<div className="flex flex-col justify-center">
					<PostSkeleton />
					<PostSkeleton />
					<PostSkeleton />
				</div>
			)}
			{!isLoading && !isRefetching && filteredPosts?.length === 0 && (
				<p className="text-center my-4">No posts found 😕</p>
			)}
			{!isLoading && !isRefetching && filteredPosts && (
				<div>
					{filteredPosts.map((post) => (
						<Post key={post._id} post={post} />
					))}
				</div>
			)}
		</div>
	);
};

export default Posts;
