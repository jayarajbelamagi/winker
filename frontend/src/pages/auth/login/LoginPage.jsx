import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import XSvg from "../../../components/svgs/X";

import { MdOutlineMail } from "react-icons/md";
import { MdPassword } from "react-icons/md";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, setStoredAuth, wakeUpBackend } from "../../../lib/api";

const LoginPage = () => {
	const [formData, setFormData] = useState({
		username: "",
		password: "",
	});
	const queryClient = useQueryClient();

	// Trigger non-blocking wake up so Render server is hot when user submits
	useEffect(() => {
		wakeUpBackend();
	}, []);

	const {
		mutate: loginMutation,
		isPending,
		isError,
		error,
	} = useMutation({
		mutationFn: async ({ username, password }) => {
			try {
				const res = await apiFetch("/api/auth/login", {
					method: "POST",
					body: JSON.stringify({ username, password }),
					timeout: 50000,
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
		onSuccess: (data) => {
			if (data?.token) {
				setStoredAuth(data.token, data);
			}
			queryClient.setQueryData(["authUser"], data);
			queryClient.invalidateQueries({ queryKey: ["authUser"] });
		},
	});

	const handleSubmit = (e) => {
		e.preventDefault();
		loginMutation(formData);
	};

	const handleInputChange = (e) => {
		setFormData({ ...formData, [e.target.name]: e.target.value });
	};

	return (
		<div className='max-w-screen-xl mx-auto flex h-screen'>
			<div className='flex-1 hidden lg:flex items-center justify-center'>
				<XSvg className='lg:w-2/3 fill-white' />
			</div>
			<div className='flex-1 flex flex-col justify-center items-center px-4'>
				<form className='flex gap-4 flex-col w-full max-w-sm' onSubmit={handleSubmit}>
					<XSvg className='w-20 lg:hidden fill-white self-center mb-2' />
					<h1 className='text-4xl font-extrabold text-white'>{"Let's"} go.</h1>
					<label className='input input-bordered rounded flex items-center gap-2'>
						<MdOutlineMail />
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

					<label className='input input-bordered rounded flex items-center gap-2'>
						<MdPassword />
						<input
							type='password'
							className='grow'
							placeholder='Password'
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
								Connecting...
							</span>
						) : (
							"Login"
						)}
					</button>
					{isError && (
						<p className='text-red-500 text-sm text-center bg-red-950/40 border border-red-800 rounded p-2'>
							{error.message}
						</p>
					)}
				</form>
				<div className='flex flex-col gap-2 mt-6 w-full max-w-sm'>
					<p className='text-white text-base text-center'>{"Don't"} have an account?</p>
					<Link to='/signup'>
						<button className='btn rounded-full btn-primary text-white btn-outline w-full'>
							Sign up
						</button>
					</Link>
				</div>
			</div>
		</div>
	);
};

export default LoginPage;
