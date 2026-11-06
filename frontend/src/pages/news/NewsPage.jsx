import { useState } from "react";
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

const NewsPage = () => {
	const [activeCategory, setActiveCategory] = useState("all");
	const [searchQuery, setSearchQuery] = useState("");
	const navigate = useNavigate();

	const { data, isLoading, isError, refetch, isRefetching } = useQuery({
		queryKey: ["news", activeCategory],
		queryFn: async () => {
			const res = await apiFetch(`/api/news?category=${activeCategory}`);
			const json = await res.json();
			if (!res.ok) throw new Error(json.error || "Failed to load news");
			return json;
		},
		staleTime: 60 * 1000,
	});

	const articles = data?.articles || [];

	const filteredArticles = searchQuery.trim()
		? articles.filter((a) =>
				a.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				a.source?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				a.trendingTag?.toLowerCase().includes(searchQuery.toLowerCase())
		  )
		: articles;

	const handleDiscussOnWinker = (article) => {
		// Navigate to home and populate create post or open modal
		const text = `Discussing: "${article.title}" via ${article.source} ${article.trendingTag?.split("·")[0] || ""}\n${article.link}`;
		navigator.clipboard.writeText(text);
		navigate(`/?share=${encodeURIComponent(text)}`);
	};

	return (
		<div className="flex-[4_4_0] border-r border-gray-700 min-h-screen">
			{/* Top Header */}
			<div className="p-4 border-b border-gray-700 sticky top-0 bg-black/85 backdrop-blur z-20">
				<div className="flex justify-between items-center mb-3">
					<div>
						<h1 className="text-2xl font-black text-white flex items-center gap-2">
							<span className="text-2xl">🇮🇳</span>
							<span>India Trending News</span>
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

			{/* Loading State */}
			{(isLoading || isRefetching) && (
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
											<span>
												{new Date(article.pubDate).toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit",
												})}
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
