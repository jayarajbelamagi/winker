import { Link } from "react-router-dom";
import { useState, useEffect } from "react";

import XSvg from "../../../components/svgs/X";

import { MdOutlineMail } from "react-icons/md";
import { FaUser } from "react-icons/fa";
import { MdPassword } from "react-icons/md";
import { MdDriveFileRenameOutline } from "react-icons/md";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiFetch, setStoredAuth, wakeUpBackend } from "../../../lib/api";

const SignUpPage = () => {
	const [formData, setFormData] = useState({
		email: "",
		username: "",
		fullName: "",
		password: "",
	});

	const queryClient = useQueryClient();

	useEffect(() => {
		wakeUpBackend();
	}, []);

	const { mutate, isError, isPending, error } = useMutation({
		mutationFn: async ({ email, username, fullName, password }) => {
			try {
				const res = await apiFetch("/api/auth/signup", {
					method: "POST",
					body: JSON.stringify({ email, username, fullName, password }),
					timeout: 50000,
				});

				const data = await res.json();
				if (!res.ok) throw new Error(data.error || "Failed to create account");
				return data;
			} catch (error) {
				console.error(error);
				throw error;
			}
		},
		onSuccess: (data) => {
			toast.success("Account created successfully");
			if (data?.token) {
				setStoredAuth(data.token, data);
			}
			queryClient.setQueryData(["authUser"], data);
			queryClient.invalidateQueries({ queryKey: ["authUser"] });
		},
	});

	const handleSubmit = (e) => {
		e.preventDefault();
		mutate(formData);
	};

	const handleInputChange = (e) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
	};

	return (
		<div className='max-w-screen-xl mx-auto flex h-screen px-4 md:px-10'>
			<div className='flex-1 hidden lg:flex items-center justify-center'>
				<XSvg className='lg:w-2/3 fill-white' />
			</div>
			<div className='flex-1 flex flex-col justify-center items-center w-full'>
				<form className='w-full max-w-sm flex gap-4 flex-col' onSubmit={handleSubmit}>
					<XSvg className='w-20 lg:hidden fill-white self-center mb-2' />
					<h1 className='text-4xl font-extrabold text-white'>Join today.</h1>
					<label className='input input-bordered rounded flex items-center gap-2'>
						<MdOutlineMail />
						<input
							type='email'
							className='grow'
							placeholder='Email'
							name='email'
							onChange={handleInputChange}
							value={formData.email}
							required
						/>
					</label>
					<div className='flex gap-4 flex-wrap'>
						<label className='input input-bordered rounded flex items-center gap-2 flex-1'>
							<FaUser />
							<input
								type='text'
								className='grow'
								placeholder='Username'
								name='username'
								onChange={handleInputChange}
								value={formData.username}
								required
							/>
						</label>
						<label className='input input-bordered rounded flex items-center gap-2 flex-1'>
							<MdDriveFileRenameOutline />
							<input
								type='text'
								className='grow'
								placeholder='Full Name'
								name='fullName'
								onChange={handleInputChange}
								value={formData.fullName}
								required
							/>
						</label>
					</div>
					<label className='input input-bordered rounded flex items-center gap-2'>
						<MdPassword />
						<input
							type='password'
							className='grow'
							placeholder='Password (min 6 chars)'
							name='password'
							onChange={handleInputChange}
							value={formData.password}
							required
						/>
					</label>
					<button
						className='btn rounded-full btn-primary text-white w-full'
						disabled={isPending}
					>
						{isPending ? (
							<span className='flex items-center gap-2'>
								<span className='loading loading-spinner loading-sm' />
								Creating account...
							</span>
						) : (
							"Sign up"
						)}
					</button>
					{isError && (
						<p className='text-red-500 text-sm text-center bg-red-950/40 border border-red-800 rounded p-2'>
							{error.message}
						</p>
					)}
				</form>
				<div className='flex flex-col w-full max-w-sm gap-2 mt-6'>
					<p className='text-white text-base text-center'>Already have an account?</p>
					<Link to='/login'>
						<button className='btn rounded-full btn-primary text-white btn-outline w-full'>
							Sign in
						</button>
					</Link>
				</div>
			</div>
		</div>
	);
};
export default SignUpPage;
