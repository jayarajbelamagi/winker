import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { IoCloseSharp, IoEyeOutline, IoTimeOutline } from "react-icons/io5";
import LoadingSpinner from "../common/LoadingSpinner";
import useFollow from "../../hooks/useFollow";
import { apiFetch } from "../../lib/api";
import { formatRelativeTime, formatExactTime } from "../../utils/date";

const ProfileViewsModal = ({ isOpen, onClose, authUser }) => {
	const { follow, isPending: isFollowPending } = useFollow();

	const { data, isLoading } = useQuery({
		queryKey: ["profileViews"],
		queryFn: async () => {
			const res = await apiFetch("/api/users/profile-views");
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Failed to load profile views");
			return json;
		},
		enabled: Boolean(isOpen),
	});

	if (!isOpen) return null;

	const views = data?.views || [];
	const uniqueCount = data?.uniqueViewersCount || 0;
	const totalViews = data?.totalViews || 0;

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200'>
			<div
				className='bg-stone-950 border border-gray-800 rounded-3xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl overflow-hidden'
				onClick={(e) => e.stopPropagation()}
			>
				{/* Modal Header */}
				<div className='p-4 border-b border-gray-800 flex items-center justify-between bg-stone-900/60 flex-shrink-0'>
					<div className='flex items-center gap-2.5'>
						<div className='w-9 h-9 rounded-full bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400'>
							<IoEyeOutline className='w-5 h-5' />
						</div>
						<div>
							<h2 className='font-bold text-base text-white'>Who Viewed Your Profile</h2>
							<p className='text-xs text-stone-400'>Private to you · Recent profile visitors</p>
						</div>
					</div>

					<button
						onClick={onClose}
						className='p-1.5 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition'
						title='Close'
					>
						<IoCloseSharp className='w-5 h-5' />
					</button>
				</div>

				{/* Summary Analytics Card */}
				<div className='p-4 bg-gradient-to-r from-sky-950/30 via-stone-900/40 to-sky-950/20 border-b border-gray-800/80 flex items-center justify-between flex-shrink-0'>
					<div className='flex items-center gap-6'>
						<div>
							<div className='text-2xl font-black text-white flex items-center gap-1.5'>
								<span>{uniqueCount}</span>
								<span className='text-xs font-normal text-sky-400'>people</span>
							</div>
							<span className='text-[11px] text-stone-400'>Unique Viewers</span>
						</div>
						<div className='h-8 w-px bg-stone-800' />
						<div>
							<div className='text-2xl font-black text-white flex items-center gap-1.5'>
								<span>{totalViews}</span>
								<span className='text-xs font-normal text-emerald-400'>times</span>
							</div>
							<span className='text-[11px] text-stone-400'>Total Views</span>
						</div>
					</div>
					<div className='text-right hidden sm:block'>
						<span className='text-[11px] text-stone-400'>Updates automatically</span>
						<p className='text-[10px] text-stone-500'>When users visit your profile</p>
					</div>
				</div>

				{/* Viewers List */}
				<div className='flex-1 overflow-y-auto p-3 sm:p-4 divide-y divide-gray-800/50'>
					{isLoading && (
						<div className='flex justify-center py-16'>
							<LoadingSpinner size='lg' />
						</div>
					)}

					{!isLoading && views.length === 0 && (
						<div className='flex flex-col items-center justify-center py-16 text-center px-4'>
							<div className='w-14 h-14 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-3xl mb-3 shadow-inner'>
								👁️
							</div>
							<p className='text-sm font-bold text-white mb-1'>No profile views yet</p>
							<p className='text-xs text-stone-400 max-w-xs'>
								When other users view your profile, they will appear here along with when and how often they visited.
							</p>
						</div>
					)}

					{!isLoading &&
						views.map((item) => {
							const viewer = item.viewer;
							if (!viewer) return null;

							const isFollowing = authUser?.following?.some(
								(id) => (id?._id || id)?.toString() === viewer._id?.toString()
							);
							const relativeTime = formatRelativeTime(item.viewedAt);
							const exactTime = formatExactTime(item.viewedAt);

							return (
								<div
									key={item._id}
									className='py-3 sm:py-3.5 flex items-center justify-between gap-3 group hover:bg-stone-900/40 px-2 rounded-2xl transition'
								>
									<Link
										to={`/profile/${viewer.username}`}
										onClick={onClose}
										className='flex items-center gap-3 min-w-0 flex-1'
									>
										<div className='avatar flex-shrink-0'>
											<div className='w-11 h-11 rounded-full overflow-hidden border border-stone-700 group-hover:border-primary transition'>
												<img
													src={viewer.profileImg || "/avatar-placeholder.png"}
													alt={viewer.fullName}
													onError={(e) => {
														e.target.onerror = null;
														e.target.src = "/avatar-placeholder.png";
													}}
												/>
											</div>
										</div>

										<div className='flex flex-col min-w-0'>
											<div className='flex items-center gap-1.5 flex-wrap'>
												<span className='font-bold text-sm text-white group-hover:underline truncate'>
													{viewer.fullName}
												</span>
												<span className='text-xs text-stone-400 truncate'>
													@{viewer.username}
												</span>
											</div>

											{viewer.bio && (
												<p className='text-xs text-stone-300 line-clamp-1 mt-0.5'>
													{viewer.bio}
												</p>
											)}

											{/* View Timing & Count Badge */}
											<div className='flex items-center gap-2 mt-1 flex-wrap'>
												<span
													className='flex items-center gap-1 text-[11px] text-stone-400'
													title={exactTime}
												>
													<IoTimeOutline className='w-3 h-3 text-sky-400' />
													<span>Viewed {relativeTime}</span>
												</span>
												{item.viewCount > 1 && (
													<span className='text-[10px] px-2 py-0.2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-semibold'>
														{item.viewCount} times
													</span>
												)}
											</div>
										</div>
									</Link>

									{/* Follow / Unfollow Button */}
									{authUser?._id !== viewer._id && (
										<button
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												follow(viewer._id);
											}}
											disabled={isFollowPending}
											className={`btn btn-xs rounded-full px-3.5 flex-shrink-0 transition ${
												isFollowing
													? "btn-outline border-stone-700 text-stone-300 hover:border-red-500 hover:text-red-400 hover:bg-transparent"
													: "btn-primary text-white"
											}`}
										>
											{isFollowing ? "Following" : "Follow"}
										</button>
									)}
								</div>
							);
						})}
				</div>

				{/* Footer info note */}
				<div className='p-3 bg-stone-900/50 border-t border-gray-800 text-center text-[11px] text-stone-400 flex-shrink-0'>
					🔒 Profile view history is private to you.
				</div>
			</div>
		</div>
	);
};

export default ProfileViewsModal;
