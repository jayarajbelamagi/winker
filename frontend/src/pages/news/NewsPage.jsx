import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../lib/api";
import { HiOutlineExternalLink, HiOutlineSparkles } from "react-icons/hi";
import { BiSearch } from "react-icons/bi";
import { FaXTwitter } from "react-icons/fa6";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { useNavigate } from "react-router-dom";

const CATEGORIES = [
	{ id: "all", label: "🇮🇳 All Trending", icon: "🔥" },
	{ id: "politics", label: "Politics", icon: "🏛️" },
	{ id: "cricket", label: "Cricket", icon: "🏏" },
	{ id: "football", label: "Football", icon: "⚽" },
	{ id: "movies", label: "Movies & Cinema", icon: "🎬" },
	{ id: "sports", label: "Sports", icon: "🏅" },
	{ id: "business", label: "Business & Tech", icon: "📈" },
];

const formatNewsTime = (pubDate) => {
	if (!pubDate) return "Just now";
	const diff = Date.now() - new Date(pubDate).getTime();
	if (isNaN(diff) || diff < 0) return "Just now";
	const mins = Math.floor(diff / (1000 * 60));
	if (mins < 60) return `${mins <= 1 ? "Just now" : `${mins}m ago`}`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
};

const NewsPage = () => {
	const [activeCategory, setActiveCategory] = useState("all");
	const [searchQuery, setSearchQuery] = useState("");
	const [showScrollTopPill, setShowScrollTopPill] = useState(false);
	const [pullDistance, setPullDistance] = useState(0);
	const [isPulling, setIsPulling] = useState(false);

	const touchStartY = useRef(0);
	const lastScrollY = useRef(0);
	const navigate = useNavigate();

	const { data, isLoading, isError, refetch, isRefetching } = useQuery({
		queryKey: ["news", activeCategory],
		queryFn: async () => {
			const res = await apiFetch(`/api/news?category=${activeCategory}`);
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Failed to load news");
			return json;
		},
		staleTime: 30 * 1000,
		refetchInterval: 60 * 1000, // Auto-update live news every 1 min
	});

	// Detect scrolling up to refresh news like feed
	useEffect(() => {
		let highestScroll = 0;

		const handleScroll = () => {
			const currentY = window.scrollY;

			// If scrolled down > 350px, show floating "↑ New stories" pill
			if (currentY > 350) {
				setShowScrollTopPill(true);
				if (currentY > highestScroll) highestScroll = currentY;
			} else if (currentY < 120) {
				setShowScrollTopPill(false);
			}

			// When user was down and scrolls back up near the top (<= 40px)
			if (highestScroll > 250 && currentY <= 40) {
				highestScroll = 0;
				refetch();
			}

			lastScrollY.current = currentY;
		};

		window.addEventListener("scroll", handleScroll, { passive: true });
		return () => window.removeEventListener("scroll", handleScroll);
	}, [refetch]);

	// Touch pull-to-refresh on mobile
	const handleTouchStart = (e) => {
		if (window.scrollY === 0) {
			touchStartY.current = e.touches[0].clientY;
		} else {
			touchStartY.current = 0;
		}
	};

	const handleTouchMove = (e) => {
		if (touchStartY.current === 0) return;
		const currentY = e.touches[0].clientY;
		const diff = currentY - touchStartY.current;
		if (diff > 0 && window.scrollY === 0) {
			setIsPulling(true);
			setPullDistance(Math.min(diff * 0.45, 80));
		}
	};

	const handleTouchEnd = () => {
		if (pullDistance > 50) {
			refetch();
		}
		setIsPulling(false);
		setPullDistance(0);
		touchStartY.current = 0;
	};

	const articles = data?.articles || [];

	const filteredArticles = searchQuery.trim()
		? articles.filter((a) =>
				a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				a.source?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				a.trendingTag?.toLowerCase().includes(searchQuery.toLowerCase())
		  )
		: articles;

	const handleDiscussOnWinker = (article) => {
		const text = `Discussing: "${article.title}" via ${article.source} ${article.trendingTag?.split("·")[0] || ""}\n${article.link}`;
		navigator.clipboard.writeText(text);
		navigate(`/?share=${encodeURIComponent(text)}`);
	};

	return (
		<div
			onTouchStart={handleTouchStart}
			onTouchMove={handleTouchMove}
			onTouchEnd={handleTouchEnd}
			className="flex-[4_4_0] min-w-0 max-w-2xl xl:max-w-3xl w-full border-r border-gray-800 min-h-screen relative"
		>
			{/* Floating "↑ New stories" Pill */}
			{showScrollTopPill && (
				<button
					onClick={() => {
						window.scrollTo({ top: 0, behavior: "smooth" });
						refetch();
					}}
					className="fixed top-14 left-1/2 -translate-x-1/2 z-30 bg-primary text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-lg hover:bg-sky-400 active:scale-95 transition-all flex items-center gap-1.5 animate-in fade-in slide-in-from-top-2"
				>
					<span>↑</span>
					<span>New stories</span>
				</button>
			)}

			{/* Pull to refresh visual feedback on mobile */}
			{isPulling && pullDistance > 0 && (
				<div
					style={{ height: `${pullDistance}px` }}
					className="flex items-center justify-center overflow-hidden transition-all text-xs text-sky-400 bg-stone-900/50 border-b border-stone-800"
				>
					<div className="flex items-center gap-2">
						<span
							className={`transition-transform duration-200 text-sm ${
								pullDistance > 50 ? "rotate-180" : ""
							}`}
						>
							↓
						</span>
						<span>{pullDistance > 50 ? "Release to refresh" : "Pull down to refresh news"}</span>
					</div>
				</div>
			)}

			{/* Top Header */}
			<div className="p-3 sm:p-4 border-b border-gray-700 sticky top-12 md:top-0 bg-black/85 backdrop-blur z-20">
				<div className="flex justify-between items-center mb-3">
					<div>
						<h1 className="text-2xl font-black text-white flex items-center gap-2">
							<span className="text-2xl">🇮🇳</span>
							<span>India Trending News</span>
							<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
								<span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
								LIVE
							</span>
						</h1>
						<p className="text-xs text-stone-400 mt-0.5 flex items-center gap-1">
							<HiOutlineSparkles className="text-primary text-sm" />
							Real-time articles & hashtags circulating on X (India)
						</p>
					</div>
					<button
						onClick={() => refetch()}
						className="btn btn-xs btn-outline rounded-full text-stone-300 hover:text-white"
						disabled={isLoading || isRefetching}
					>
						{isRefetching ? "Refreshing..." : "↻ Refresh"}
					</button>
				</div>

				{/* Search bar */}
				<div className="relative mb-3">
					<BiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500" />
					<input
						type="text"
						placeholder="Search headlines, sources, or topics..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="w-full bg-stone-900 border border-gray-700 rounded-full pl-9 pr-4 py-1.5 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-primary"
					/>
				</div>

				{/* Category Filters Bar */}
				<div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
					{CATEGORIES.map((cat) => (
						<button
							key={cat.id}
							onClick={() => setActiveCategory(cat.id)}
							className={`btn btn-xs rounded-full whitespace-nowrap transition-all duration-200 ${
								activeCategory === cat.id
									? "btn-primary text-white shadow-md shadow-primary/20 scale-105"
									: "btn-ghost text-stone-300 hover:bg-stone-800"
							}`}
						>
							<span className="mr-1">{cat.icon}</span>
							{cat.label}
						</button>
					))}
				</div>
			</div>

			{/* Background Updating Banner */}
			{isRefetching && !isLoading && (
				<div className="w-full bg-sky-950/40 py-2 flex items-center justify-center gap-2 border-b border-sky-800/40 text-xs text-sky-300 animate-in fade-in">
					<span className="loading loading-spinner loading-xs text-sky-400"></span>
					<span>Fetching latest breaking news...</span>
				</div>
			)}

			{/* Initial Loading State */}
			{isLoading && articles.length === 0 && (
				<div className="flex flex-col items-center justify-center p-16 gap-3">
					<LoadingSpinner size="lg" />
					<span className="text-sm text-stone-400">Curating top India stories & trends...</span>
				</div>
			)}

			{/* Error State */}
			{isError && (
				<div className="p-8 text-center">
					<p className="text-red-400 mb-3">Unable to fetch live feed at the moment.</p>
					<button onClick={() => refetch()} className="btn btn-sm btn-primary rounded-full">
						Try Again
					</button>
				</div>
			)}

			{/* Articles List */}
			{!isLoading && (
				<div className="divide-y divide-gray-800">
					{filteredArticles.length === 0 ? (
						<div className="text-center p-12 text-stone-500">
							No stories found for "{searchQuery}".
						</div>
					) : (
						filteredArticles.map((article) => {
							const hashtagQuery = article.trendingTag?.split("·")[0]?.replace("#", "")?.trim() || "";
							const xSearchUrl = `https://x.com/search?q=${encodeURIComponent(hashtagQuery || article.title)}`;

							return (
								<article
									key={article.id}
									className="p-4 hover:bg-stone-900/40 transition duration-150 flex flex-col gap-2 group"
								>
									{/* Top Meta info */}
									<div className="flex items-center justify-between text-xs text-stone-400">
										<div className="flex items-center gap-2">
											<span className="font-semibold text-primary">{article.source}</span>
											<span>•</span>
											<span className="text-stone-300 font-mono">
												{formatNewsTime(article.pubDate)}
											</span>
										</div>
										<span className="badge badge-sm badge-neutral text-[10px] uppercase font-bold text-stone-300">
											{article.category}
										</span>
									</div>

									{/* Headline Link */}
									<a
										href={article.link}
										target="_blank"
										rel="noreferrer"
										className="text-base font-bold text-white hover:text-sky-400 transition leading-snug"
									>
										{article.title}
									</a>

									{/* Summary */}
									{article.summary && (
										<p className="text-sm text-stone-400 line-clamp-2 leading-relaxed">
											{article.summary}
										</p>
									)}

									{/* Bottom Bar: Trending on X badge & Actions */}
									<div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-gray-800/60">
										{/* Trending on X pill */}
										<a
											href={xSearchUrl}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-900 border border-stone-700/80 text-xs text-stone-300 hover:border-sky-500 transition"
											title="View trending discussion on X"
										>
											<FaXTwitter className="text-white text-xs" />
											<span className="font-medium text-sky-400">{article.trendingTag}</span>
										</a>

										{/* Action Buttons */}
										<div className="flex items-center gap-2">
											<a
												href={article.link}
												target="_blank"
												rel="noreferrer"
												className="btn btn-xs btn-ghost text-stone-400 hover:text-white flex items-center gap-1"
											>
												<span>Read Full</span>
												<HiOutlineExternalLink />
											</a>
											<button
												onClick={() => handleDiscussOnWinker(article)}
												className="btn btn-xs btn-outline btn-primary rounded-full"
											>
												Discuss
											</button>
										</div>
									</div>
								</article>
							);
						})
					)}
				</div>
			)}
		</div>
	);
};

export default NewsPage;
