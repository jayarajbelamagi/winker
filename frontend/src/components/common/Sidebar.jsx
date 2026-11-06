import XSvg from "../svgs/X";

import { MdHomeFilled } from "react-icons/md";
import { IoNotifications, IoMailOutline } from "react-icons/io5";
import { FaUser } from "react-icons/fa";
import { AiOutlineRobot } from "react-icons/ai";
import { IoNewspaperOutline } from "react-icons/io5";
import { BsBookmark } from "react-icons/bs";
import { Link } from "react-router-dom";
import { BiLogOut } from "react-icons/bi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiFetch, clearStoredAuth } from "../../lib/api";

const Sidebar = () => {
	const queryClient = useQueryClient();
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

	return (
		<div className='hidden md:flex md:flex-[2_2_0] max-w-52'>
			<div className='sticky top-0 left-0 h-screen flex flex-col border-r border-gray-700 w-full'>
				<Link to='/' className='flex justify-center md:justify-start my-1'>
					<XSvg className='p-2 w-14 h-14 rounded-full fill-white hover:bg-stone-900 transition' />
				</Link>
				<ul className='flex flex-col gap-2 mt-4'>
					{/* 1. Home */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<MdHomeFilled className='w-7 h-7' />
							<span className='text-lg hidden md:block'>Home</span>
						</Link>
					</li>

					{/* 2. News (India Trending) */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/news'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer group'
						>
							<IoNewspaperOutline className='w-7 h-7 text-primary group-hover:scale-110 transition' />
							<span className='text-lg hidden md:block font-medium'>News</span>
						</Link>
					</li>

					{/* 3. Notifications */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/notifications'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<IoNotifications className='w-7 h-7' />
							<span className='text-lg hidden md:block'>Notifications</span>
						</Link>
					</li>

					{/* 4. Messages (Direct Texting & Calling) */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/messages'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer group'
						>
							<IoMailOutline className='w-7 h-7 group-hover:text-primary transition' />
							<span className='text-lg hidden md:block font-medium'>Messages</span>
						</Link>
					</li>

					{/* 4. Bookmarks */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/bookmarks'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<BsBookmark className='w-6 h-6 ml-0.5' />
							<span className='text-lg hidden md:block'>Bookmarks</span>
						</Link>
					</li>

					{/* 5. Thook AI */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to='/chat'
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<AiOutlineRobot className='w-7 h-7' />
							<span className='text-lg hidden md:block'>Thook</span>
						</Link>
					</li>

					{/* 6. Profile */}
					<li className='flex justify-center md:justify-start'>
						<Link
							to={`/profile/${authUser?.username}`}
							className='flex gap-3 items-center hover:bg-stone-900 transition-all rounded-full duration-300 py-2 pl-2 pr-4 max-w-fit cursor-pointer'
						>
							<FaUser className='w-6 h-6 ml-0.5' />
							<span className='text-lg hidden md:block'>Profile</span>
						</Link>
					</li>
				</ul>
				{authUser && (
					<Link
						to={`/profile/${authUser.username}`}
						className='mt-auto mb-10 flex gap-2 items-start transition-all duration-300 hover:bg-[#181818] py-2 px-4 rounded-full'
					>
						<div className='avatar hidden md:inline-flex'>
							<div className='w-8 rounded-full overflow-hidden'>
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
						<div className='flex justify-between flex-1'>
							<div className='hidden md:block'>
								<p className='text-white font-bold text-sm w-20 truncate'>{authUser?.fullName}</p>
								<p className='text-slate-500 text-sm'>@{authUser?.username}</p>
							</div>
							<BiLogOut
								className='w-5 h-5 cursor-pointer text-stone-400 hover:text-white'
								onClick={(e) => {
									e.preventDefault();
									logout();
								}}
								title='Log out'
							/>
						</div>
					</Link>
				)}
			</div>
		</div>
	);
};
export default Sidebar;
