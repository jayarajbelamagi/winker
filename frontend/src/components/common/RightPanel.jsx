import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FiTrendingUp } from "react-icons/fi";

import useFollow from "../../hooks/useFollow";
import RightPanelSkeleton from "../skeletons/RightPanelSkeleton";
import LoadingSpinner from "./LoadingSpinner";
import { apiFetch } from "../../lib/api";

const TRENDING_TOPICS = [
	{ category: "Technology · Trending", tag: "#AI2026", posts: "24.5K posts" },
	{ category: "Sports · Trending", tag: "#CricketChampionship", posts: "89.2K posts" },
	{ category: "Entertainment · Trending", tag: "#WinkerStories", posts: "14.8K posts" },
	{ category: "Trending in India", tag: "#NextGenSocial", posts: "32.1K posts" },
	{ category: "Science · Trending", tag: "#SpaceExploration", posts: "12.3K posts" },
];

const RightPanel = () => {
	const { data: suggestedUsers, isLoading } = useQuery({
		queryKey: ["suggestedUsers"],
		queryFn: async () => {
			try {
				const res = await apiFetch("/api/users/suggested");
				const data = await res.json();
				if (!res.ok) {
					throw new Error(data.error || "Something went wrong!");
				}
				return data;
			} catch (error) {
				throw new Error(error.message);
			}
		},
	});

	const { follow, isPending } = useFollow();

	return (
		<aside className='hidden lg:flex flex-col w-72 xl:w-80 my-3 mx-3 flex-shrink-0 gap-4 sticky top-2 max-h-[96vh] overflow-y-auto scrollbar-none'>
			{/* Explore & Trending Section */}
			<div className='bg-[#16181C] p-4 rounded-2xl border border-stone-800/80 shadow-md'>
				<div className='flex items-center gap-2 mb-3'>
					<FiTrendingUp className='text-primary w-5 h-5' />
					<h3 className='font-bold text-base text-white'>What's Happening</h3>
				</div>
				<div className='flex flex-col divide-y divide-stone-800/60'>
					{TRENDING_TOPICS.map((topic, i) => (
						<Link
							key={i}
							to='/news'
							className='py-2.5 hover:bg-stone-900/60 transition rounded-lg px-2 group block'
						>
							<div className='text-[11px] text-stone-500 font-medium'>
								{topic.category}
							</div>
							<div className='text-sm font-bold text-stone-100 group-hover:text-primary transition'>
								{topic.tag}
							</div>
							<div className='text-[11px] text-stone-500'>{topic.posts}</div>
						</Link>
					))}
				</div>
			</div>

			{/* Who to follow Section */}
			{suggestedUsers && suggestedUsers.length > 0 && (
				<div className='bg-[#16181C] p-4 rounded-2xl border border-stone-800/80 shadow-md'>
					<h3 className='font-bold text-base mb-3 text-white'>Who to follow</h3>
					<div className='flex flex-col gap-3.5'>
						{isLoading && (
							<>
								<RightPanelSkeleton />
								<RightPanelSkeleton />
								<RightPanelSkeleton />
							</>
						)}
						{!isLoading &&
							suggestedUsers?.slice(0, 5).map((user) => (
								<Link
									to={`/profile/${user.username}`}
									className='flex items-center justify-between gap-3 group'
									key={user._id}
								>
									<div className='flex gap-2.5 items-center min-w-0'>
										<div className='avatar flex-shrink-0'>
											<div className='w-9 h-9 rounded-full overflow-hidden border border-stone-800'>
												<img
													src={user.profileImg || "/avatar-placeholder.png"}
													alt=''
												/>
											</div>
										</div>
										<div className='flex flex-col min-w-0'>
											<span className='font-semibold text-xs text-white truncate max-w-[110px] group-hover:underline'>
												{user.fullName}
											</span>
											<span className='text-[11px] text-stone-500 truncate max-w-[110px]'>
												@{user.username}
											</span>
										</div>
									</div>
									<button
										type='button'
										className='btn bg-white hover:bg-stone-200 text-black border-none rounded-full btn-xs px-3 font-semibold transition'
										onClick={(e) => {
											e.preventDefault();
											follow(user._id);
										}}
									>
										{isPending ? <LoadingSpinner size='sm' /> : "Follow"}
									</button>
								</Link>
							))}
					</div>
				</div>
			)}
		</aside>
	);
};

export default RightPanel;
