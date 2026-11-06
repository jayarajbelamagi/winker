import { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import { apiFetch } from "../../lib/api";
import { AiOutlineRobot, AiFillRobot } from "react-icons/ai";
import { IoSend, IoCloseSharp } from "react-icons/io5";
import { RiHistoryLine, RiAddLine } from "react-icons/ri";
import { FaTrash } from "react-icons/fa";

const SUGGESTIONS = [
  "🔥 What's trending in India today?",
  "🏏 Latest cricket & IPL updates",
  "✍️ Write an engaging tweet about AI",
  "🍿 Trending movies at the Indian box office",
];

const ChatPage = ({ authUser }) => {
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  const chatDivRef = useRef(null);
  const messageInputRef = useRef(null);

  // Initialize session ID
  useEffect(() => {
    const storedSessionId = localStorage.getItem("chatSessionId") || generateSessionId();
    localStorage.setItem("chatSessionId", storedSessionId);
    setSessionId(storedSessionId);
  }, []);

  // Load history when sessionId changes
  useEffect(() => {
    if (sessionId) {
      loadHistory();
    }
  }, [sessionId]);

  function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async function loadHistory() {
    try {
      setIsLoading(true);
      const res = await apiFetch(`/api/chat/history?sessionId=${sessionId}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMessage(textToSend) {
    const trimmedMessage = (textToSend || message).trim();
    if (!trimmedMessage || isSending) return;

    setIsSending(true);
    setMessage("");

    // Optimistically add user message
    const tempChat = { userMessage: trimmedMessage, aiReply: null, _temp: true };
    setHistory((prev) => [...prev, tempChat]);

    try {
      const res = await apiFetch("/api/chat/send", {
        method: "POST",
        body: JSON.stringify({
          message: trimmedMessage,
          sessionId,
        }),
      });

      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();

      if (data.chat) {
        setHistory((prev) => prev.map((c) => (c._temp ? data.chat : c)));
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to send message");
      setHistory((prev) => prev.filter((c) => !c._temp));
    } finally {
      setIsSending(false);
      setTimeout(() => {
        messageInputRef.current?.focus();
      }, 50);
    }
  }

  function handleKeyPress(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function startNewChat() {
    const newSessionId = generateSessionId();
    localStorage.setItem("chatSessionId", newSessionId);
    setSessionId(newSessionId);
    setHistory([]);
    setMessage("");
    setIsHistoryDrawerOpen(false);
    toast.success("New chat started");
    setTimeout(() => {
      messageInputRef.current?.focus();
    }, 100);
  }

  async function clearAllHistory() {
    if (!window.confirm("Are you sure you want to clear all chat history?")) return;

    try {
      const res = await apiFetch(`/api/chat/clear?sessionId=${sessionId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to clear history");
      setHistory([]);
      setIsHistoryDrawerOpen(false);
      toast.success("Chat history cleared");
    } catch (error) {
      console.error("Error clearing history:", error);
      toast.error("Failed to clear chat history");
    }
  }

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatDivRef.current) {
      chatDivRef.current.scrollTop = chatDivRef.current.scrollHeight;
    }
  }, [history, isSending]);

  return (
    <div className="flex-1 min-w-0 flex flex-col md:flex-row w-full h-[calc(100vh-3rem)] md:h-screen bg-stone-950 text-white relative overflow-hidden pb-14 md:pb-0 border-r border-gray-700">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-black/60 border-r border-gray-800 p-4 flex-shrink-0">
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl text-sky-400">⚡</span>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
            Thook AI
          </span>
        </div>

        <button
          onClick={startNewChat}
          className="btn btn-primary rounded-xl btn-sm w-full gap-2 mb-4 text-white shadow-md shadow-sky-500/20"
        >
          <RiAddLine className="w-4 h-4" />
          <span>New Chat</span>
        </button>

        <div className="text-xs uppercase tracking-wider text-stone-500 font-semibold mb-2">
          Recent Queries
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-stone-800 pr-1">
          {history.length === 0 ? (
            <p className="text-xs text-stone-500 italic py-2">No queries in this session yet.</p>
          ) : (
            history
              .slice(-10)
              .reverse()
              .map((chat, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setMessage(chat.userMessage);
                    messageInputRef.current?.focus();
                  }}
                  className="p-2 text-xs text-stone-300 rounded-lg hover:bg-stone-800/80 cursor-pointer truncate transition"
                  title={chat.userMessage}
                >
                  {chat.userMessage}
                </div>
              ))
          )}
        </div>

        <button
          onClick={clearAllHistory}
          className="btn btn-outline btn-error btn-xs rounded-lg mt-3 w-full gap-1.5 opacity-80 hover:opacity-100"
        >
          <FaTrash className="w-3 h-3" />
          <span>Clear History</span>
        </button>
      </aside>

      {/* MOBILE HISTORY DRAWER */}
      {isHistoryDrawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setIsHistoryDrawerOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-stone-900 border-r border-stone-800 h-full p-4 flex flex-col z-10 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xl text-sky-400">⚡</span>
                <span className="font-bold text-lg text-white">Thook History</span>
              </div>
              <button
                onClick={() => setIsHistoryDrawerOpen(false)}
                className="p-1 rounded-full text-stone-400 hover:text-white"
              >
                <IoCloseSharp className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={startNewChat}
              className="btn btn-primary rounded-xl btn-sm w-full gap-2 mb-4 text-white"
            >
              <RiAddLine className="w-4 h-4" />
              <span>New Chat</span>
            </button>

            <div className="flex-1 overflow-y-auto space-y-2">
              {history.length === 0 ? (
                <p className="text-xs text-stone-500 italic">No chat history yet.</p>
              ) : (
                history
                  .slice(-15)
                  .reverse()
                  .map((chat, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setMessage(chat.userMessage);
                        setIsHistoryDrawerOpen(false);
                      }}
                      className="p-2.5 text-xs text-stone-200 bg-stone-800/60 rounded-lg active:bg-stone-700 truncate"
                    >
                      {chat.userMessage}
                    </div>
                  ))
              )}
            </div>

            <button
              onClick={clearAllHistory}
              className="btn btn-outline btn-error btn-xs rounded-lg mt-3 w-full gap-1.5"
            >
              <FaTrash className="w-3 h-3" />
              <span>Clear History</span>
            </button>
          </div>
        </div>
      )}

      {/* MAIN CHAT AREA */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Top Chat Header */}
        <header className="px-4 py-2.5 border-b border-gray-800 bg-black/60 backdrop-blur-md flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-md">
              <AiFillRobot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-sm text-white">Thook AI</h1>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <p className="text-[11px] text-stone-400">Concise, friendly assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile History Button */}
            <button
              onClick={() => setIsHistoryDrawerOpen(true)}
              className="md:hidden p-2 rounded-full text-stone-400 hover:text-white hover:bg-stone-800 transition"
              title="Chat History"
            >
              <RiHistoryLine className="w-5 h-5" />
            </button>

            {/* New Chat Pill */}
            <button
              onClick={startNewChat}
              className="btn btn-xs btn-outline rounded-full text-stone-300 hover:text-white gap-1"
              title="Start fresh conversation"
            >
              <RiAddLine className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">New Chat</span>
            </button>
          </div>
        </header>

        {/* Scrollable Messages Container */}
        <div
          ref={chatDivRef}
          className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 scroll-smooth"
        >
          {history.length === 0 ? (
            /* Welcome / Empty State */
            <div className="h-full flex flex-col items-center justify-center text-center px-4 max-w-md mx-auto my-auto py-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-3xl shadow-xl shadow-sky-500/20 mb-4 animate-bounce">
                ⚡
              </div>
              <h2 className="text-xl font-bold text-white mb-2">How can I help you today?</h2>
              <p className="text-xs text-stone-400 mb-6">
                Ask me questions, explore trending topics, or get quick help with anything.
              </p>

              {/* Quick suggestion pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full text-left">
                {SUGGESTIONS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(s)}
                    className="p-3 text-xs bg-stone-900/90 hover:bg-stone-800 border border-gray-800 rounded-xl text-stone-300 hover:text-white transition active:scale-95"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            history.map((chat, idx) => (
              <div key={idx} className="flex flex-col space-y-3">
                {/* User Message (Right-aligned) */}
                <div className="self-end max-w-[85%] sm:max-w-[75%] bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed shadow-md">
                  {chat.userMessage}
                </div>

                {/* AI Response (Left-aligned) */}
                <div className="self-start max-w-[90%] sm:max-w-[80%] flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-sky-400 flex-shrink-0 mt-0.5">
                    <AiOutlineRobot className="w-4 h-4" />
                  </div>
                  <div className="bg-stone-900 border border-gray-800 text-stone-100 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-md">
                    {chat.aiReply || (
                      <span className="flex items-center gap-1.5 text-stone-400 py-1">
                        <span className="loading loading-dots loading-xs text-sky-400"></span>
                        <span className="text-xs">Thinking...</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}

          {isSending && history[history.length - 1]?._temp === false && (
            <div className="self-start flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center text-sky-400 flex-shrink-0">
                <AiOutlineRobot className="w-4 h-4" />
              </div>
              <div className="bg-stone-900 border border-gray-800 rounded-2xl rounded-tl-sm px-4 py-2.5 shadow-md">
                <span className="loading loading-dots loading-xs text-sky-400"></span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area (Pinned Above Mobile Navigation) */}
        <div className="p-2.5 sm:p-4 bg-black/80 backdrop-blur-md border-t border-gray-800 flex-shrink-0">
          <div className="max-w-3xl mx-auto flex items-end gap-2 bg-stone-900/90 border border-gray-700 rounded-2xl px-3 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition shadow-inner">
            <textarea
              ref={messageInputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask Thook AI anything..."
              rows={1}
              className="w-full bg-transparent text-white text-sm placeholder-stone-500 resize-none focus:outline-none max-h-24 py-1.5"
            />
            <button
              onClick={() => sendMessage()}
              disabled={isSending || !message.trim()}
              className="p-2 rounded-full bg-primary hover:bg-sky-400 text-white disabled:opacity-40 disabled:hover:bg-primary transition active:scale-95 flex-shrink-0"
              title="Send message"
            >
              <IoSend className="w-4 h-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChatPage;
