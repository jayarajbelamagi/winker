import Post from "./Post";
import PostSkeleton from "../skeletons/PostSkeleton";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { apiFetch } from "../../lib/api";

const Posts = ({ feedType, username, userId }) => {
	const [searchTerm, setSearchTerm] = useState("");
	const [showScrollTopPill, setShowScrollTopPill] = useState(false);
	const [pullDistance, setPullDistance] = useState(0);
	const [isPulling, setIsPulling] = useState(false);

	const touchStartY = useRef(0);
	const lastScrollY = useRef(0);

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
		queryKey: ["posts", feedType, username, userId],
		queryFn: async () => {
			const res = await apiFetch(POST_ENDPOINT);
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Something went wrong");
			return data;
		},
		refetchInterval: 30000, // Background updates every 30s like X
		refetchOnWindowFocus: true,
	});

	useEffect(() => {
		refetch();
	}, [feedType, refetch, username]);

	// Detect scrolling up to refresh feed like X
	useEffect(() => {
		let highestScroll = 0;

		const handleScroll = () => {
			const currentY = window.scrollY;

			// If scrolled down > 350px, show floating "↑ New posts" pill
			if (currentY > 350) {
				setShowScrollTopPill(true);
				if (currentY > highestScroll) highestScroll = currentY;
			} else if (currentY < 120) {
				setShowScrollTopPill(false);
			}

			// When user was down the feed and scrolls back up near the top (<= 40px)
			if (highestScroll > 250 && currentY <= 40) {
				highestScroll = 0;
				refetch();
			}

			lastScrollY.current = currentY;
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, [refetch]);

	// Touch pull-to-refresh on mobile
	const handleTouchStart = (e) => {
		if (window.scrollY === 0) {
			touchStartY.current = e.touches[0].clientY;
		} else {
			touchStartY.current = 0;
		}
	};

	const handleTouchMove = (e) => {
		if (touchStartY.current === 0) return;
		const currentY = e.touches[0].clientY;
		const diff = currentY - touchStartY.current;
		if (diff > 0 && window.scrollY === 0) {
			setIsPulling(true);
			setPullDistance(Math.min(diff * 0.45, 80));
		}
	};

	const handleTouchEnd = () => {
		if (pullDistance > 50) {
			refetch();
		}
		setIsPulling(false);
		setPullDistance(0);
		touchStartY.current = 0;
	};

	// Filter posts based on search term only for forYou/following
	const filteredPosts =
		(feedType === "forYou" || feedType === "following") && searchTerm
			? posts?.filter(
					(post) =>
						post.text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
						post.user?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
						post.user?.fullName?.toLowerCase().includes(searchTerm.toLowerCase())
			  )
			: posts;

	return (
		<div
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			className="relative"
		>
			{/* Floating "↑ New posts" Pill (like X) */}
			{showScrollTopPill && (
				<button
					onClick={() => {
						window.scrollTo({ top: 0, behavior: "smooth" });
						refetch();
					}}
					className="fixed top-14 left-1/2 -translate-x-1/2 z-30 bg-primary text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg hover:bg-sky-400 active:scale-95 transition-all flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2"
				>
					<span>↑</span>
					<span>New posts</span>
				</button>
			)}

			{/* Pull to refresh visual feedback on mobile */}
			{isPulling && pullDistance > 0 && (
				<div
					style={{ height: `${pullDistance}px` }}
					className="flex items-center justify-center overflow-hidden transition-all text-xs text-sky-400 bg-stone-900/50 border-b border-stone-800"
				>
					<div className="flex items-center gap-2">
						<span
							className={`transition-transform duration-200 text-sm ${
								pullDistance > 50 ? "rotate-180" : ""
							}`}
						>
							↓
						</span>
						<span>{pullDistance > 50 ? "Release to refresh" : "Pull down to refresh"}</span>
					</div>
				</div>
			)}

			{/* Search bar at top */}
			<div className="p-3 sm:p-4 border-b border-gray-700">
				<input
					type="text"
					placeholder="Search posts or users..."
					value={searchTerm}
					onChange={(e) => setSearchTerm(e.target.value)}
					className="w-full p-2.5 rounded-full border border-gray-700 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-stone-900 text-white text-sm px-4 placeholder-stone-500"
				/>
			</div>

			{/* Background Updating Banner */}
			{isRefetching && !isLoading && (
				<div className="w-full bg-sky-950/40 py-2 flex items-center justify-center gap-2 border-b border-sky-800/40 text-xs text-sky-300 animate-in fade-in">
					<span className="loading loading-spinner loading-xs text-sky-400"></span>
					<span>Updating feed...</span>
				</div>
			)}

			{/* Initial Loading Skeletons */}
			{isLoading && (!posts || posts.length === 0) && (
				<div className="flex flex-col justify-center">
					<PostSkeleton />
					<PostSkeleton />
					<PostSkeleton />
				</div>
			)}

			{/* Empty State */}
			{!isLoading && filteredPosts?.length === 0 && (
				<p className="text-center my-8 text-stone-400">No posts found 😕</p>
			)}

			{/* Posts List */}
			{filteredPosts && (
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
