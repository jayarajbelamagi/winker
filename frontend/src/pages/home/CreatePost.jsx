import { CiImageOn } from "react-icons/ci";
import { BsEmojiSmileFill } from "react-icons/bs";
import { BiPoll } from "react-icons/bi";
import { MdOutlineGif } from "react-icons/md";
import { useRef, useState } from "react";
import { IoCloseSharp } from "react-icons/io5";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-hot-toast";
import { apiFetch } from "../../lib/api";
import EmojiPicker from "../../components/common/EmojiPicker";
import GifPicker from "../../components/common/GifPicker";
import { compressImage } from "../../utils/imageCompressor";

const MAX_MEDIA_SIZE = 8 * 1024 * 1024; // 8MB limit

const CreatePost = ({ quotedPost: initialQuotedPost = null, communityId = null, onPostSuccess }) => {
	const [text, setText] = useState("");
	const [media, setMedia] = useState(null);
	const [mediaType, setMediaType] = useState("image"); // "image" | "video"
	const [is24hStory, setIs24hStory] = useState(false);
	const [isCompressing, setIsCompressing] = useState(false);
	const [showEmojiPicker, setShowEmojiPicker] = useState(false);
	const [showGifPicker, setShowGifPicker] = useState(false);

	// Quoted post state
	const [quotedPost, setQuotedPost] = useState(initialQuotedPost);

	// Poll Creator state
	const [showPoll, setShowPoll] = useState(false);
	const [pollQuestion, setPollQuestion] = useState("");
	const [pollOptions, setPollOptions] = useState(["", ""]);
	const [pollDuration, setPollDuration] = useState("24"); // hours

	const fileRef = useRef(null);
	const textareaRef = useRef(null);

	const { data: authUser } = useQuery({ queryKey: ["authUser"] });
	const queryClient = useQueryClient();

	const {
		mutate: createPost,
		isPending,
		isError,
		error,
	} = useMutation({
		mutationFn: async ({ text, img, mediaType, is24hStory, poll, quotedPostId, communityId }) => {
			try {
				const res = await apiFetch("/api/posts/create", {
					method: "POST",
					body: JSON.stringify({
						text,
						img,
						mediaType,
						is24hStory,
						poll: poll || undefined,
						quotedPost: quotedPostId || undefined,
						communityId: communityId || undefined,
					}),
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
			setText("");
			setMedia(null);
			setMediaType("image");
			setIs24hStory(false);
			setShowEmojiPicker(false);
			setShowPoll(false);
			setPollQuestion("");
			setPollOptions(["", ""]);
			setQuotedPost(null);
			toast.success(
				is24hStory
					? "24h Story post published! It will expire in 24 hours."
					: "Post created successfully"
			);
			queryClient.invalidateQueries({ queryKey: ["posts"] });
			onPostSuccess && onPostSuccess();
		},
	});

	const handleSubmit = (e) => {
		e.preventDefault();

		let pollPayload = null;
		if (showPoll) {
			const validOptions = pollOptions.filter((opt) => opt && opt.trim());
			if (validOptions.length < 2) {
				toast.error("A poll must have at least 2 options");
				return;
			}
			pollPayload = {
				question: pollQuestion.trim() || text.trim() || "Poll",
				options: validOptions,
				durationHours: Number(pollDuration) || 24,
			};
		}

		if (!text.trim() && !media && !pollPayload && !quotedPost) {
			toast.error("Please provide text, media, or a poll");
			return;
		}

		createPost({
			text,
			img: media,
			mediaType,
			is24hStory,
			poll: pollPayload,
			quotedPostId: quotedPost?._id || null,
			communityId,
		});
	};

	const handleFileChange = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Enforce 8MB limit
		if (file.size > MAX_MEDIA_SIZE) {
			toast.error("File exceeds 8MB limit. Please choose a video or image under 8MB.");
			if (fileRef.current) fileRef.current.value = "";
			return;
		}

		const isVid = file.type?.startsWith("video");
		setMediaType(isVid ? "video" : "image");

		if (isVid) {
			// Read video as data URL
			const reader = new FileReader();
			reader.onload = () => setMedia(reader.result);
			reader.readAsDataURL(file);
		} else {
			// Compress image
			try {
				setIsCompressing(true);
				const compressed = await compressImage(file, 1600, 0.85);
				setMedia(compressed);
			} catch (err) {
				console.error("Image compression error:", err);
				const reader = new FileReader();
				reader.onload = () => setMedia(reader.result);
				reader.readAsDataURL(file);
			} finally {
				setIsCompressing(false);
			}
		}
	};

	const handleEmojiSelect = (emoji) => {
		const textarea = textareaRef.current;
		if (textarea) {
			const start = textarea.selectionStart || text.length;
			const end = textarea.selectionEnd || text.length;
			const newText = text.substring(0, start) + emoji + text.substring(end);
			setText(newText);
			setTimeout(() => {
				textarea.focus();
				textarea.setSelectionRange(start + emoji.length, start + emoji.length);
			}, 0);
		} else {
			setText((prev) => prev + emoji);
		}
	};

	const addPollOption = () => {
		if (pollOptions.length < 4) {
			setPollOptions([...pollOptions, ""]);
		}
	};

	const removePollOption = (idx) => {
		if (pollOptions.length > 2) {
			setPollOptions(pollOptions.filter((_, i) => i !== idx));
		}
	};

	return (
		<div className='flex p-3 sm:p-4 items-start gap-3 sm:gap-4 border-b border-gray-700 relative'>
			<div className='avatar'>
				<div className='w-8 rounded-full overflow-hidden'>
					<img
						src={authUser?.profileImg || "/avatar-placeholder.png"}
						alt='User avatar'
						onError={(e) => {
							e.target.onerror = null;
							e.target.src = "/avatar-placeholder.png";
						}}
					/>
				</div>
			</div>

			<form className='flex flex-col gap-2 w-full relative' onSubmit={handleSubmit}>
				<textarea
					ref={textareaRef}
					className='textarea w-full p-0 text-base sm:text-lg resize-none border-none focus:outline-none bg-transparent'
					placeholder={
						is24hStory
							? "Share a 24-hour story post..."
							: showPoll
							? "Ask a question..."
							: "What is happening?!"
					}
					value={text}
					onChange={(e) => setText(e.target.value)}
					rows={showPoll ? 2 : 3}
				/>

				{isCompressing && (
					<div className='text-xs text-sky-400 flex items-center gap-1.5 py-1'>
						<span className='loading loading-spinner loading-xs'></span>
						<span>Optimizing media...</span>
					</div>
				)}

				{/* Media Preview (Image or Video) */}
				{media && (
					<div className='relative w-full max-w-md mx-auto my-2 rounded-xl overflow-hidden border border-gray-800 bg-black'>
						<IoCloseSharp
							className='absolute top-2 right-2 text-white bg-gray-800 hover:bg-red-600 rounded-full w-6 h-6 p-1 cursor-pointer z-10 transition'
							onClick={() => {
								setMedia(null);
								setMediaType("image");
								if (fileRef.current) fileRef.current.value = null;
							}}
						/>
						{mediaType === "video" ? (
							<video
								src={media}
								controls
								playsInline
								className='max-h-80 w-full object-contain'
							/>
						) : (
							<img
								src={media}
								className='max-h-80 w-full object-contain'
								alt='Media preview'
							/>
						)}
					</div>
				)}

				{/* Quoted Post Card Preview */}
				{quotedPost && (
					<div className='relative border border-stone-700 rounded-2xl p-3 my-2 bg-stone-900/60'>
						<IoCloseSharp
							className='absolute top-2 right-2 text-stone-400 hover:text-white cursor-pointer w-5 h-5'
							onClick={() => setQuotedPost(null)}
						/>
						<div className='flex items-center gap-2 mb-1.5'>
							<img
								src={quotedPost.user?.profileImg || "/avatar-placeholder.png"}
								alt=''
								className='w-5 h-5 rounded-full object-cover'
							/>
							<span className='text-xs font-bold text-white'>
								{quotedPost.user?.fullName}
							</span>
							<span className='text-xs text-stone-500'>
								@{quotedPost.user?.username}
							</span>
						</div>
						<p className='text-xs text-stone-300 line-clamp-2'>{quotedPost.text}</p>
					</div>
				)}

				{/* Interactive Poll Creator Card */}
				{showPoll && (
					<div className='border border-stone-800 rounded-2xl p-3 bg-stone-900/40 my-2 space-y-2.5 animate-in fade-in'>
						<div className='flex justify-between items-center text-xs font-semibold text-primary'>
							<span>📊 Create a Poll</span>
							<button
								type='button'
								onClick={() => setShowPoll(false)}
								className='text-stone-400 hover:text-white'
							>
								✕
							</button>
						</div>

						{pollOptions.map((opt, idx) => (
							<div key={idx} className='flex items-center gap-2'>
								<input
									type='text'
									value={opt}
									onChange={(e) => {
										const newOpts = [...pollOptions];
										newOpts[idx] = e.target.value;
										setPollOptions(newOpts);
									}}
									placeholder={`Choice ${idx + 1}`}
									maxLength={50}
									className='flex-1 bg-black/60 border border-stone-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary'
								/>
								{pollOptions.length > 2 && (
									<button
										type='button'
										onClick={() => removePollOption(idx)}
										className='text-stone-500 hover:text-red-400 text-sm'
									>
										✕
									</button>
								)}
							</div>
						))}

						<div className='flex justify-between items-center pt-1'>
							{pollOptions.length < 4 ? (
								<button
									type='button'
									onClick={addPollOption}
									className='text-xs text-primary hover:underline font-medium'
								>
									+ Add option
								</button>
							) : (
								<div />
							)}

							<div className='flex items-center gap-1.5 text-xs text-stone-400'>
								<span>Poll length:</span>
								<select
									value={pollDuration}
									onChange={(e) => setPollDuration(e.target.value)}
									className='bg-stone-800 text-white border border-stone-700 rounded-lg px-2 py-1 text-xs focus:outline-none'
								>
									<option value='24'>1 Day</option>
									<option value='72'>3 Days</option>
									<option value='168'>7 Days</option>
								</select>
							</div>
						</div>
					</div>
				)}

				{/* 24-Hour Story Alert */}
				{is24hStory && (
					<div className='flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3 py-2 rounded-lg transition-all animate-in fade-in'>
						<span className='text-base'>⏳</span>
						<span>
							<strong>24-Hour Story Post:</strong> Automatically disappears from all feeds after 24 hours.
						</span>
					</div>
				)}

				{/* Bottom Action Bar */}
				<div className='flex justify-between border-t py-2 border-t-gray-700 relative items-center flex-wrap gap-2'>
					<div className='flex gap-1.5 items-center relative'>
						{/* Image / Video Upload (max 5MB) */}
						<button
							type='button'
							onClick={() => fileRef.current?.click()}
							className='p-1.5 rounded-full hover:bg-primary/20 transition'
							title='Upload photo or video (max 8MB)'
						>
							<CiImageOn className='fill-primary w-5 h-5 cursor-pointer' />
						</button>

						{/* GIF Picker Button */}
						<button
							type='button'
							onClick={() => setShowGifPicker(true)}
							className='p-1.5 rounded-full hover:bg-primary/20 text-primary transition'
							title='Insert GIF'
						>
							<MdOutlineGif className='w-6 h-6' />
						</button>

						{/* Poll Toggle Button */}
						<button
							type='button'
							onClick={() => setShowPoll((prev) => !prev)}
							className={`p-1.5 rounded-full hover:bg-primary/20 transition ${
								showPoll ? "text-primary bg-primary/20" : "text-primary"
							}`}
							title='Create a poll'
						>
							<BiPoll className='w-5 h-5' />
						</button>

						{/* Emoji Picker Button */}
						<button
							type='button'
							onClick={() => setShowEmojiPicker((prev) => !prev)}
							className='p-1.5 rounded-full hover:bg-primary/20 transition'
							title='Add emoji'
						>
							<BsEmojiSmileFill className='fill-primary w-4 h-4 cursor-pointer' />
						</button>

						{/* 24-Hour Story Toggle Button */}
						<button
							type='button'
							onClick={() => setIs24hStory((prev) => !prev)}
							className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition border ${
								is24hStory
									? "bg-amber-500/20 text-amber-300 border-amber-400 shadow-sm"
									: "bg-transparent text-gray-400 border-gray-700 hover:text-white hover:border-gray-500"
							}`}
							title='Make this a disappearing 24-hour post'
						>
							<span>⏳</span>
							<span>{is24hStory ? "24h Story" : "24h"}</span>
						</button>

						{/* Emoji Popover */}
						{showEmojiPicker && (
							<EmojiPicker
								onSelect={handleEmojiSelect}
								onClose={() => setShowEmojiPicker(false)}
							/>
						)}
					</div>

					<input
						type='file'
						accept='image/*,video/*'
						hidden
						ref={fileRef}
						onChange={handleFileChange}
					/>

					<button
						className='btn btn-primary rounded-full btn-sm text-white px-5'
						disabled={isPending || isCompressing}
					>
						{isPending
							? "Posting..."
							: isCompressing
							? "Processing..."
							: is24hStory
							? "Post Story"
							: "Post"}
					</button>
				</div>

				{isError && <div className='text-red-500 text-sm'>{error.message}</div>}
			</form>

			{/* GIF Picker Modal */}
			<GifPicker
				isOpen={showGifPicker}
				onClose={() => setShowGifPicker(false)}
				onSelectGif={(gifUrl) => {
					setMedia(gifUrl);
					setMediaType("image");
				}}
			/>
		</div>
	);
};

export default CreatePost;
