import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { apiFetch } from "../../../lib/api";
import { toast } from "react-hot-toast";
import XSvg from "../../../components/svgs/X";
import { MdPassword } from "react-icons/md";

const ResetPasswordPage = () => {
	const { token } = useParams();
	const navigate = useNavigate();

	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);

	const handleSubmit = async (e) => {
		e.preventDefault();

		if (newPassword.length < 6) {
			return toast.error("Password must be at least 6 characters");
		}
		if (newPassword !== confirmPassword) {
			return toast.error("Passwords do not match");
		}

		setIsLoading(true);

		try {
			const res = await apiFetch("/api/auth/reset-password", {
				method: "POST",
				body: JSON.stringify({ token, newPassword }),
			});
			const data = await res.json();

			if (!res.ok) throw new Error(data.error || "Failed to reset password");

			setIsSuccess(true);
			toast.success("Password reset successfully! Please log in.");
			setTimeout(() => {
				navigate("/login");
			}, 2000);
		} catch (error) {
			toast.error(error.message || "Failed to reset password");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className="max-w-md mx-auto min-h-screen flex flex-col justify-center items-center px-4">
			<div className="w-full bg-stone-900 border border-gray-800 rounded-2xl p-6 shadow-2xl">
				<div className="flex flex-col items-center mb-6">
					<XSvg className="w-16 fill-white mb-2" />
					<h1 className="text-2xl font-extrabold text-white">Reset Password</h1>
					<p className="text-sm text-stone-400 text-center mt-1">
						Choose a strong, new password for your Winker account.
					</p>
				</div>

				{isSuccess ? (
					<div className="p-4 bg-green-950/40 border border-green-800 rounded-xl text-center">
						<p className="text-green-400 font-bold mb-2">✓ Password Updated!</p>
						<p className="text-xs text-stone-400 mb-4">Redirecting you to the login page...</p>
						<Link to="/login" className="btn btn-sm btn-primary rounded-full text-white">
							Log in now
						</Link>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="flex flex-col gap-4">
						<label className="input input-bordered rounded-lg flex items-center gap-2 bg-black/60 border-gray-700">
							<MdPassword className="text-stone-400" />
							<input
								type="password"
								placeholder="New password (min 6 chars)"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								className="grow text-white"
								required
							/>
						</label>

						<label className="input input-bordered rounded-lg flex items-center gap-2 bg-black/60 border-gray-700">
							<MdPassword className="text-stone-400" />
							<input
								type="password"
								placeholder="Confirm new password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								className="grow text-white"
								required
							/>
						</label>

						<button
							type="submit"
							disabled={isLoading}
							className="btn btn-primary rounded-full text-white w-full mt-2"
						>
							{isLoading ? (
								<span className="flex items-center gap-2">
									<span className="loading loading-spinner loading-xs" />
									Updating password...
								</span>
							) : (
								"Update Password"
							)}
						</button>

						<div className="text-center mt-2">
							<Link to="/login" className="text-xs text-stone-400 hover:text-white">
								Back to login
							</Link>
						</div>
					</form>
				)}
			</div>
		</div>
	);
};

export default ResetPasswordPage;
