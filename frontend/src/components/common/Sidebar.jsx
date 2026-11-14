import { useState } from "react";
import XSvg from "../svgs/X";

import { MdHomeFilled } from "react-icons/md";
import {
	IoNotifications,
	IoMailOutline,
	IoCallOutline,
	IoNewspaperOutline,
	IoEyeOutline,
	IoCompassOutline,
} from "react-icons/io5";
import { FaUser } from "react-icons/fa";
import { AiOutlineRobot } from "react-icons/ai";
import { BsBookmark } from "react-icons/bs";
import { Link } from "react-router-dom";
import { BiLogOut } from "react-icons/bi";
import { RiMovie2Line } from "react-icons/ri";
import { HiUserGroup } from "react-icons/hi2";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiFetch, clearStoredAuth } from "../../lib/api";
import ProfileViewsModal from "../profile/ProfileViewsModal";

const Sidebar = () => {
	const queryClient = useQueryClient();
	const [showProfileViews, setShowProfileViews] = useState(false);

	const { mutate: logout } = useMutation({
		mutationFn: async () => {
			try {
				const res = await apiFetch("/api/auth/logout", {
					method: "POST",
				});
				const data = await res.json();

				if (!res.ok) {
					throw new Error(data.error || "Something went wrong");
				}
				return data;
			} catch (error) {
				throw new Error(error.message || error);
			}
		},
		onSuccess: () => {
			clearStoredAuth();
			queryClient.setQueryData(["authUser"], null);
			queryClient.invalidateQueries({ queryKey: ["authUser"] });
		},
		onError: () => {
			clearStoredAuth();
			queryClient.setQueryData(["authUser"], null);
			queryClient.invalidateQueries({ queryKey: ["authUser"] });
			toast.success("Logged out");
		},
	});

	const { data: authUser } = useQuery({ queryKey: ["authUser"] });

	// Query LinkedIn-style Profile Views for the badge count
	const { data: profileViewsData } = useQuery({
		queryKey: ["profileViews"],
		queryFn: async () => {
			const res = await apiFetch("/api/users/profile-views");
			const json = await res.json();
			if (!res.ok) return null;
			return json;
		},
		enabled: Boolean(authUser),
	});

	return (
		<aside className='hidden md:flex flex-col w-56 lg:w-64 xl:w-72 flex-shrink-0 border-r border-gray-800 sticky top-0 h-screen px-3 lg:px-4 z-20 bg-black justify-between select-none'>
			<div className='flex flex-col'>
				{/* Brand Logo */}
				<Link to='/' className='flex justify-center md:justify-start my-2'>
					<XSvg className='p-2 w-12 h-12 rounded-full fill-white hover:bg-stone-900 transition' />
				</Link>

				{/* Navigation Links */}
				<ul className='flex flex-col gap-1.5 mt-2'>
					{/* 1. Home */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/'
							className='flex gap-3.5 items-center hover:bg-stone-900 transition-all rounded-full duration-200 py-2.5 px-3 max-w-fit cursor-pointer text-stone-200 hover:text-white'
						>
							<MdHomeFilled className='w-6 h-6' />
							<span className='text-base hidden md:block font-medium'>Home</span>
						</Link>
					</li>

					{/* 2. Reels (Vertical Video Feed) */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/reels'
							className='flex gap-3.5 items-center hover:bg-stone-900 transition-all rounded-full duration-200 py-2.5 px-3 max-w-fit cursor-pointer group text-stone-200 hover:text-white'
						>
							<RiMovie2Line className='w-6 h-6 text-rose-500 group-hover:scale-110 transition' />
							<span className='text-base hidden md:block font-medium'>Reels</span>
						</Link>
					</li>

					{/* 3. Communities & Groups */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/communities'
							className='flex gap-3.5 items-center hover:bg-stone-900 transition-all rounded-full duration-200 py-2.5 px-3 max-w-fit cursor-pointer group text-stone-200 hover:text-white'
						>
							<HiUserGroup className='w-6 h-6 text-primary group-hover:scale-110 transition' />
							<span className='text-base hidden md:block font-medium'>Communities</span>
						</Link>
					</li>

					{/* 4. Explore & Trending */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/explore'
							className='flex gap-3.5 items-center hover:bg-stone-900 transition-all rounded-full duration-200 py-2.5 px-3 max-w-fit cursor-pointer group text-stone-200 hover:text-white'
						>
							<IoCompassOutline className='w-6 h-6 text-primary group-hover:scale-110 transition' />
							<span className='text-base hidden md:block font-medium'>Explore</span>
						</Link>
					</li>

					{/* 3. Notifications */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/notifications'
							className='flex gap-3.5 items-center hover:bg-stone-900 transition-all rounded-full duration-200 py-2.5 px-3 max-w-fit cursor-pointer text-stone-200 hover:text-white'
						>
							<IoNotifications className='w-6 h-6' />
							<span className='text-base hidden md:block font-medium'>Notifications</span>
						</Link>
					</li>

					{/* 4. Messages (Direct Texting) */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/messages'
							className='flex gap-3.5 items-center hover:bg-stone-900 transition-all rounded-full duration-200 py-2.5 px-3 max-w-fit cursor-pointer group text-stone-200 hover:text-white'
						>
							<IoMailOutline className='w-6 h-6 group-hover:text-primary transition' />
							<span className='text-base hidden md:block font-medium'>Messages</span>
						</Link>
					</li>

					{/* 5. Calls */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/calls'
							className='flex gap-3.5 items-center hover:bg-stone-900 transition-all rounded-full duration-200 py-2.5 px-3 max-w-fit cursor-pointer group text-stone-200 hover:text-white'
						>
							<IoCallOutline className='w-6 h-6 text-emerald-400 group-hover:scale-110 transition' />
							<span className='text-base hidden md:block font-medium'>Calls</span>
						</Link>
					</li>

					{/* 6. Bookmarks */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/bookmarks'
							className='flex gap-3.5 items-center hover:bg-stone-900 transition-all rounded-full duration-200 py-2.5 px-3 max-w-fit cursor-pointer text-stone-200 hover:text-white'
						>
							<BsBookmark className='w-5 h-5 ml-0.5' />
							<span className='text-base hidden md:block font-medium'>Bookmarks</span>
						</Link>
					</li>

					{/* 7. Thook AI */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/chat'
							className='flex gap-3.5 items-center hover:bg-stone-900 transition-all rounded-full duration-200 py-2.5 px-3 max-w-fit cursor-pointer text-stone-200 hover:text-white'
						>
							<AiOutlineRobot className='w-6 h-6 text-sky-400' />
							<span className='text-base hidden md:block font-medium'>Thook AI</span>
						</Link>
					</li>

					{/* 8. LinkedIn-Style Profile Views (Eye Feature) */}
					<li className='flex justify-center md:justify-start'>
						<button
							onClick={() => setShowProfileViews(true)}
							className='flex gap-3.5 items-center hover:bg-stone-900 transition-all rounded-full duration-200 py-2.5 px-3 max-w-fit cursor-pointer group w-full text-left text-stone-200 hover:text-white'
							title='Who viewed your profile'
						>
							<div className='relative'>
								<IoEyeOutline className='w-6 h-6 text-sky-400 group-hover:scale-110 transition' />
								{profileViewsData?.uniqueViewersCount > 0 && (
									<span className='absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-sky-400 animate-pulse'></span>
								)}
							</div>
							<span className='text-base hidden md:flex items-center gap-2 font-medium'>
								<span>Views</span>
								{profileViewsData?.uniqueViewersCount > 0 && (
									<span className='text-xs px-2 py-0.2 rounded-full bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30'>
										{profileViewsData.uniqueViewersCount}
									</span>
								)}
							</span>
						</button>
					</li>

					{/* 9. Profile */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to={`/profile/${authUser?.username}`}
							className='flex gap-3.5 items-center hover:bg-stone-900 transition-all rounded-full duration-200 py-2.5 px-3 max-w-fit cursor-pointer text-stone-200 hover:text-white'
						>
							<FaUser className='w-5 h-5 ml-0.5' />
							<span className='text-base hidden md:block font-medium'>Profile</span>
						</Link>
					</li>
				</ul>
			</div>

			{/* User Profile Pill at Bottom */}
			{authUser && (
				<div className='mb-4'>
					<Link
						to={`/profile/${authUser.username}`}
						className='flex gap-2.5 items-center transition-all duration-200 hover:bg-stone-900/80 p-2.5 rounded-2xl border border-transparent hover:border-stone-800'
					>
						<div className='avatar flex-shrink-0'>
							<div className='w-9 h-9 rounded-full overflow-hidden border border-stone-700'>
								<img
									src={authUser?.profileImg || "/avatar-placeholder.png"}
									alt='Avatar'
									onError={(e) => {
										e.target.onerror = null;
										e.target.src = "/avatar-placeholder.png";
									}}
								/>
							</div>
						</div>
						<div className='flex justify-between items-center flex-1 min-w-0'>
							<div className='hidden md:block min-w-0'>
								<p className='text-white font-bold text-sm truncate'>{authUser?.fullName}</p>
								<p className='text-stone-500 text-xs truncate'>@{authUser?.username}</p>
							</div>
							<BiLogOut
								className='w-5 h-5 cursor-pointer text-stone-400 hover:text-red-400 transition flex-shrink-0 ml-1'
								onClick={(e) => {
									e.preventDefault();
									logout();
								}}
								title='Log out'
							/>
						</div>
					</Link>
				</div>
			)}

			{/* LinkedIn-style Who Viewed Your Profile Modal */}
			<ProfileViewsModal
				isOpen={showProfileViews}
				onClose={() => setShowProfileViews(false)}
				authUser={authUser}
			/>
		</aside>
	);
};

export default Sidebar;
