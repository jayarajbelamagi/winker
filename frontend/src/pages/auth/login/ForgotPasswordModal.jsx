import { useState } from "react";
import { apiFetch } from "../../../lib/api";
import { toast } from "react-hot-toast";
import { MdOutlineMail } from "react-icons/md";
import { Link } from "react-router-dom";

const ForgotPasswordModal = ({ isOpen, onClose }) => {
	const [email, setEmail] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [resetLink, setResetLink] = useState(null);

	if (!isOpen) return null;

	const handleSubmit = async (e) => {
		e.preventDefault();
		if (!email.trim()) return toast.error("Please enter your email");

		setIsLoading(true);
		setResetLink(null);

		try {
			const res = await apiFetch("/api/auth/forgot-password", {
				method: "POST",
				body: JSON.stringify({ email: email.trim() }),
			});
			const data = await res.json();

			if (!res.ok) throw new Error(data.error || "Failed to generate reset link");

			toast.success(data.message || "Reset link generated!");
			if (data.resetLink) {
				setResetLink(data.resetLink);
			}
		} catch (error) {
			toast.error(error.message || "Something went wrong");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<dialog open className="modal modal-bottom sm:modal-middle bg-black/70 z-50">
			<div className="modal-box bg-stone-900 border border-gray-700 max-w-md">
				<div className="flex justify-between items-center mb-4">
					<h3 className="font-bold text-lg text-white">Reset your password</h3>
					<button
						type="button"
						onClick={onClose}
						className="btn btn-sm btn-circle btn-ghost text-stone-400"
					>
						✕
					</button>
				</div>

				<p className="text-sm text-stone-400 mb-4">
					Enter your account email address and we'll generate a secure password reset link.
				</p>

				<form onSubmit={handleSubmit} className="flex flex-col gap-4">
					<label className="input input-bordered rounded flex items-center gap-2 bg-black/60 border-gray-700">
						<MdOutlineMail className="text-stone-400" />
						<input
							type="email"
							placeholder="Enter your registered email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							className="grow text-white"
							required
						/>
					</label>

					<button
						type="submit"
						disabled={isLoading}
						className="btn btn-primary rounded-full text-white w-full"
					>
						{isLoading ? (
							<span className="flex items-center gap-2">
								<span className="loading loading-spinner loading-xs" />
								Generating link...
							</span>
						) : (
							"Send Reset Link"
						)}
					</button>
				</form>

				{resetLink && (
					<div className="mt-4 p-3 bg-stone-800 border border-primary/40 rounded-lg text-xs animate-in fade-in">
						<p className="font-semibold text-green-400 mb-1">✓ Reset link ready:</p>
						<Link
							to={resetLink}
							onClick={onClose}
							className="text-primary hover:underline break-all block font-mono"
						>
							{window.location.origin}{resetLink}
						</Link>
						<div className="mt-2 text-right">
							<Link
								to={resetLink}
								onClick={onClose}
								className="btn btn-xs btn-primary rounded-full text-white"
							>
								Open Reset Page Now →
							</Link>
						</div>
					</div>
				)}
			</div>
			<form method="dialog" className="modal-backdrop">
				<button onClick={onClose}>close</button>
			</form>
		</dialog>
	);
};

export default ForgotPasswordModal;
