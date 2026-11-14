import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import LoadingSpinner from "../../components/common/LoadingSpinner";

import { IoSettingsOutline, IoCall, IoTimeOutline } from "react-icons/io5";
import { FaUser, FaRegComment, FaReply, FaAt } from "react-icons/fa";
import { FaHeart } from "react-icons/fa6";
import { MdCallMissed } from "react-icons/md";
import { apiFetch } from "../../lib/api";
import { useCall } from "../../context/CallContext";
import { formatRelativeTime, formatExactTime } from "../../utils/date";

const NotificationPage = () => {
	const queryClient = useQueryClient();
	const { startCall } = useCall();
	const { data: notifications, isLoading } = useQuery({
		queryKey: ["notifications"],
		queryFn: async () => {
			try {
				const res = await apiFetch("/api/notifications");
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || "Something went wrong");
				return data;
			} catch (error) {
				throw new Error(error.message || error);
			}
		},
	});

	const { mutate: deleteNotifications } = useMutation({
		mutationFn: async () => {
			try {
				const res = await apiFetch("/api/notifications", {
					method: "DELETE",
				});
				const data = await res.json();

				if (!res.ok) throw new Error(data.error || "Something went wrong");
				return data;
			} catch (error) {
				throw new Error(error.message || error);
			}
		},
		onSuccess: () => {
			toast.success("Notifications deleted successfully");
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
		},
		onError: (error) => {
			toast.error(error.message);
		},
	});

	return (
		<div className='flex-[4_4_0] min-w-0 max-w-2xl xl:max-w-3xl w-full border-r border-gray-800 min-h-screen'>
			{/* Header with 24h Filter Pill */}
			<div className='flex justify-between items-center p-3.5 sm:p-4 border-b border-gray-800 sticky top-12 md:top-0 bg-black/85 backdrop-blur-md z-10'>
				<div className='flex items-center gap-2.5'>
					<h1 className='font-bold text-lg text-white'>Notifications</h1>
					<span className='inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-stone-900 border border-stone-800 text-stone-300 font-medium'>
						<IoTimeOutline className='w-3.5 h-3.5 text-primary' />
						<span>Last 24 Hours</span>
					</span>
				</div>
				<div className='dropdown dropdown-end'>
					<div tabIndex={0} role='button' className='m-1 p-1.5 rounded-full hover:bg-stone-800 transition'>
						<IoSettingsOutline className='w-4 h-4 cursor-pointer text-stone-400 hover:text-primary' />
					</div>
					<ul
						tabIndex={0}
						className='dropdown-content z-[1] menu p-2 shadow-xl bg-stone-900 border border-stone-800 rounded-xl w-52 text-stone-200'
					>
						<li>
							<button onClick={deleteNotifications} className='text-red-400 hover:text-red-300'>
								Delete all notifications
							</button>
						</li>
					</ul>
				</div>
			</div>

			{isLoading && (
				<div className='flex justify-center h-48 items-center'>
					<LoadingSpinner size='lg' />
				</div>
			)}

			{!isLoading && notifications?.length === 0 && (
				<div className='flex flex-col items-center justify-center py-20 px-4 text-center'>
					<div className='w-14 h-14 rounded-2xl bg-stone-900 border border-stone-800 flex items-center justify-center text-2xl mb-3 shadow-inner'>
						🕒
					</div>
					<p className='text-base font-bold text-white mb-1'>No notifications in the last 24 hours</p>
					<p className='text-xs text-stone-400 max-w-sm'>
						You're completely caught up! Any new likes, follows, comments, or calls in the past 24 hours will appear here.
					</p>
				</div>
			)}

			{!isLoading &&
				notifications?.map((notification) => {
					const relativeTime = formatRelativeTime(notification.createdAt);
					const exactTime = formatExactTime(notification.createdAt);

					return (
						<div
							className='border-b border-gray-800/80 hover:bg-stone-950/60 transition p-3.5 sm:p-4'
							key={notification._id}
						>
							<div className='flex items-center justify-between gap-3'>
								<div className='flex items-start gap-3 min-w-0'>
									{/* Notification Type Icon */}
									<div className='mt-1 flex-shrink-0'>
										{notification.type === "follow" && (
											<div className='p-2 rounded-full bg-primary/10 text-primary'>
												<FaUser className='w-4 h-4' />
											</div>
										)}
										{notification.type === "like" && (
											<div className='p-2 rounded-full bg-rose-500/10 text-rose-500'>
												<FaHeart className='w-4 h-4' />
											</div>
										)}
										{notification.type === "comment" && (
											<div className='p-2 rounded-full bg-sky-500/10 text-sky-400'>
												<FaRegComment className='w-4 h-4' />
											</div>
										)}
										{notification.type === "reply" && (
											<div className='p-2 rounded-full bg-sky-500/10 text-sky-400'>
												<FaReply className='w-4 h-4' />
											</div>
										)}
										{notification.type === "call" && (
											<div className='p-2 rounded-full bg-emerald-500/20 text-emerald-400 animate-pulse'>
												<IoCall className='w-4 h-4' />
											</div>
										)}
										{notification.type === "missed_call" && (
											<div className='p-2 rounded-full bg-rose-500/20 text-rose-400'>
												<MdCallMissed className='w-4 h-4' />
											</div>
										)}
										{notification.type === "mention" && (
											<div className='p-2 rounded-full bg-purple-500/20 text-purple-400'>
												<FaAt className='w-4 h-4' />
											</div>
										)}
									</div>

									{/* User Info & Notification Text */}
									<div className='flex flex-col min-w-0'>
										<Link
											to={`/profile/${notification.from?.username}`}
											className='flex items-center gap-2 group flex-wrap'
										>
											<div className='avatar flex-shrink-0'>
												<div className='w-7 h-7 rounded-full overflow-hidden border border-stone-700'>
													<img
														src={notification.from?.profileImg || "/avatar-placeholder.png"}
														alt=''
														onError={(e) => {
															e.target.onerror = null;
															e.target.src = "/avatar-placeholder.png";
														}}
													/>
												</div>
											</div>
											<span className='font-bold text-sm text-white group-hover:underline truncate'>
												{notification.from?.fullName || `@${notification.from?.username}`}
											</span>
											<span className='text-xs text-stone-400 truncate'>
												@{notification.from?.username}
											</span>
										</Link>

										<p className='text-xs sm:text-sm text-stone-300 mt-1'>
											{notification.type === "follow" && "started following you"}
											{notification.type === "like" && "liked your post"}
											{notification.type === "comment" && "commented on your post"}
											{notification.type === "reply" && "replied to your comment"}
											{notification.type === "call" && "called you"}
											{notification.type === "missed_call" && "missed call from this user"}
											{notification.type === "mention" && (
												<span>
													mentioned you in a post or comment.{" "}
													{notification.post && (
														<Link
															to={`/post/${notification.post}`}
															className='text-primary hover:underline font-semibold ml-1'
														>
															View post →
														</Link>
													)}
												</span>
											)}
										</p>

										{/* Notification Timing Display */}
										<div
											className='flex items-center gap-1.5 mt-1 text-[11px] text-stone-500'
											title={exactTime}
										>
											<IoTimeOutline className='w-3 h-3' />
											<span>{relativeTime}</span>
											<span className='text-stone-600'>·</span>
											<span className='hover:text-stone-400 cursor-default'>{exactTime}</span>
										</div>
									</div>
								</div>

								{/* Call back button if call notification */}
								{(notification.type === "call" || notification.type === "missed_call") && notification.from && (
									<button
										onClick={() => startCall({ partner: notification.from, callType: "audio" })}
										className='btn btn-xs btn-outline rounded-full text-emerald-400 border-emerald-500/40 hover:bg-emerald-500 hover:text-white transition flex-shrink-0'
									>
										Call back
									</button>
								)}
							</div>
						</div>
					);
				})}
		</div>
	);
};

export default NotificationPage;
