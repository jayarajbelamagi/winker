import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";

import LoadingSpinner from "../../components/common/LoadingSpinner";

import { IoSettingsOutline } from "react-icons/io5";
import { FaUser } from "react-icons/fa";
import { FaHeart } from "react-icons/fa6";
import { apiFetch } from "../../lib/api";

const NotificationPage = () => {
	const queryClient = useQueryClient();
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
		<>
			<div className='flex-[4_4_0] min-w-0 w-full border-r border-gray-700 min-h-screen'>
				<div className='flex justify-between items-center p-3 sm:p-4 border-b border-gray-700 sticky top-12 md:top-0 bg-black/85 backdrop-blur z-10'>
					<p className='font-bold'>Notifications</p>
					<div className='dropdown dropdown-end'>
						<div tabIndex={0} role='button' className='m-1'>
							<IoSettingsOutline className='w-4 cursor-pointer hover:text-primary' />
						</div>
						<ul
							tabIndex={0}
							className='dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52'
						>
							<li>
								<a onClick={deleteNotifications}>Delete all notifications</a>
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
					<div className='text-center p-8 text-stone-400 font-medium'>No notifications yet 🤔</div>
				)}
				{!isLoading &&
					notifications?.map((notification) => (
						<div className='border-b border-gray-700' key={notification._id}>
							<div className='flex gap-2 p-4 items-center'>
								{notification.type === "follow" && <FaUser className='w-6 h-6 text-primary' />}
								{notification.type === "like" && <FaHeart className='w-6 h-6 text-red-500' />}
								<Link to={`/profile/${notification.from?.username}`} className='flex items-center gap-2'>
									<div className='avatar'>
										<div className='w-8 rounded-full overflow-hidden'>
											<img src={notification.from?.profileImg || "/avatar-placeholder.png"} alt='' />
										</div>
									</div>
									<div className='flex gap-1 text-sm'>
										<span className='font-bold hover:underline'>@{notification.from?.username}</span>{" "}
										<span className='text-stone-400'>
											{notification.type === "follow" ? "followed you" : "liked your post"}
										</span>
									</div>
								</Link>
							</div>
						</div>
					))}
			</div>
		</>
	);
};
export default NotificationPage;
