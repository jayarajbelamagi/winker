import { useState, useEffect } from "react";
import XSvg from "../svgs/X";

const AppLoadingScreen = ({ onSkip }) => {
	const [elapsed, setElapsed] = useState(0);

	useEffect(() => {
		const timer = setInterval(() => {
			setElapsed((prev) => prev + 1);
		}, 1000);
		return () => clearInterval(timer);
	}, []);

	return (
		<div className="h-screen w-full flex flex-col justify-center items-center bg-black text-white px-4">
			<div className="flex flex-col items-center max-w-sm text-center">
				<div className="w-16 h-16 mb-6 animate-pulse">
					<XSvg className="fill-white w-full h-full" />
				</div>

				<h1 className="text-2xl font-bold tracking-tight mb-2">Winker</h1>

				<div className="flex items-center gap-2 mb-4">
					<span className="loading loading-spinner loading-md text-primary" />
					<span className="text-gray-300 text-sm font-medium">
						{elapsed < 3
							? "Opening Winker..."
							: elapsed < 10
							? "Connecting to server..."
							: "Waking up server from standby mode..."}
					</span>
				</div>

				{elapsed >= 4 && (
					<div className="bg-stone-900 border border-stone-800 rounded-lg p-3 text-xs text-stone-400 mb-6 transition-all duration-300">
						<p className="font-semibold text-stone-300 mb-1">⚡ Render Free Server Notice</p>
						<p>
							Free backend instances go to sleep when idle. First wake-up takes ~30–45s. The app will open
							automatically once connected!
						</p>
					</div>
				)}

				{onSkip && (
					<button
						onClick={onSkip}
						className="btn btn-sm btn-outline rounded-full text-stone-400 hover:text-white"
					>
						Go to Login
					</button>
				)}
			</div>
		</div>
	);
};

export default AppLoadingScreen;
