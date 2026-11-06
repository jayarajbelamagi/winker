import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import XSvg from "../../../components/svgs/X";

import { MdOutlineMail } from "react-icons/md";
import { MdPassword } from "react-icons/md";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, setStoredAuth, wakeUpBackend } from "../../../lib/api";
import ForgotPasswordModal from "./ForgotPasswordModal";
import toast from "react-hot-toast";

const LoginPage = () => {
	const [formData, setFormData] = useState({
		username: "",
		password: "",
	});
	const [showForgotModal, setShowForgotModal] = useState(false);
	const [socialLoading, setSocialLoading] = useState(false);
	const queryClient = useQueryClient();

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

	// Social Login Handler (Google & X)
	const handleSocialLogin = async (provider) => {
		const email = window.prompt(
			`Sign in with ${provider === "google" ? "Google" : "X"}:\nEnter your email address:`,
			"user@example.com"
		);

		if (!email || !email.trim()) return;

		setSocialLoading(true);
		try {
			const res = await apiFetch("/api/auth/social-login", {
				method: "POST",
				body: JSON.stringify({
					provider,
					email: email.trim(),
					fullName: email.split("@")[0],
					avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`,
				}),
			});

			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Social sign-in failed");

			if (data?.token) {
				setStoredAuth(data.token, data);
			}
			queryClient.setQueryData(["authUser"], data);
			queryClient.invalidateQueries({ queryKey: ["authUser"] });
			toast.success(`Signed in with ${provider === "google" ? "Google" : "X"}!`);
		} catch (err) {
			toast.error(err.message || "Social sign in failed");
		} finally {
			setSocialLoading(false);
		}
	};

	return (
		<div className='max-w-screen-xl mx-auto flex h-screen'>
			<div className='flex-1 hidden lg:flex items-center justify-center'>
				<XSvg className='lg:w-2/3 fill-white' />
			</div>
			<div className='flex-1 flex flex-col justify-center items-center px-4'>
				<div className='w-full max-w-sm flex flex-col'>
					<XSvg className='w-20 lg:hidden fill-white self-center mb-3' />
					<h1 className='text-3xl font-extrabold text-white mb-6'>Happening now.</h1>

					{/* SOCIAL SIGN IN BUTTONS */}
					<div className='flex flex-col gap-2.5 mb-4'>
						{/* Google Sign In */}
						<button
							type='button'
							disabled={socialLoading}
							onClick={() => handleSocialLogin("google")}
							className='btn rounded-full w-full flex items-center justify-center gap-3 bg-white text-black hover:bg-stone-200 border-none font-medium'
						>
							<svg className='w-4 h-4' viewBox='0 0 24 24'>
								<path
									fill='#4285F4'
									d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'
								/>
								<path
									fill='#34A853'
									d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'
								/>
								<path
									fill='#FBBC05'
									d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z'
								/>
								<path
									fill='#EA4335'
									d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z'
								/>
							</svg>
							<span>Sign in with Google</span>
						</button>

						{/* X Sign In */}
						<button
							type='button'
							disabled={socialLoading}
							onClick={() => handleSocialLogin("x")}
							className='btn rounded-full w-full flex items-center justify-center gap-2.5 bg-stone-900 text-white hover:bg-stone-800 border border-gray-700 font-medium'
						>
							<XSvg className='w-3.5 h-3.5 fill-white' />
							<span>Sign in with X</span>
						</button>
					</div>

					{/* Divider */}
					<div className='flex items-center gap-3 w-full my-3'>
						<div className='flex-1 h-px bg-gray-800' />
						<span className='text-xs text-stone-500 uppercase'>or use credentials</span>
						<div className='flex-1 h-px bg-gray-800' />
					</div>

					{/* CREDENTIALS FORM */}
					<form className='flex gap-3 flex-col w-full' onSubmit={handleSubmit}>
						<label className='input input-bordered rounded-lg flex items-center gap-2 bg-black/50 border-gray-700'>
							<MdOutlineMail className='text-stone-400' />
							<input
								type='text'
								className='grow text-white'
								placeholder='Username or Email'
								name='username'
								onChange={handleInputChange}
								value={formData.username}
								required
							/>
						</label>

						<label className='input input-bordered rounded-lg flex items-center gap-2 bg-black/50 border-gray-700'>
							<MdPassword className='text-stone-400' />
							<input
								type='password'
								className='grow text-white'
								placeholder='Password'
								name='password'
								onChange={handleInputChange}
								value={formData.password}
								required
							/>
						</label>

						<div className='flex justify-end'>
							<button
								type='button'
								onClick={() => setShowForgotModal(true)}
								className='text-xs text-primary hover:underline transition'
							>
								Forgot password?
							</button>
						</div>

						<button
							className='btn rounded-full btn-primary text-white w-full mt-1'
							disabled={isPending || socialLoading}
						>
							{isPending || socialLoading ? (
								<span className='flex items-center gap-2'>
									<span className='loading loading-spinner loading-sm' />
									Connecting...
								</span>
							) : (
								"Login"
							)}
						</button>
						{isError && (
							<p className='text-red-500 text-xs text-center bg-red-950/40 border border-red-800 rounded p-2'>
								{error.message}
							</p>
						)}
					</form>

					<div className='flex flex-col gap-2 mt-6 w-full'>
						<p className='text-white text-sm text-center'>{"Don't"} have an account?</p>
						<Link to='/signup'>
							<button className='btn rounded-full btn-primary text-white btn-outline w-full'>
								Sign up
							</button>
						</Link>
					</div>
				</div>
			</div>

			{/* Forgot Password Modal */}
			<ForgotPasswordModal
				isOpen={showForgotModal}
				onClose={() => setShowForgotModal(false)}
			/>
		</div>
	);
};

export default LoginPage;
