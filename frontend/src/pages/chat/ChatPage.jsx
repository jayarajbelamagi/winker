import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { apiUrl } from "../../lib/api";

const ChatPage = ({ authUser }) => {
  const [message, setMessage] = useState("");
  const [sessionId, setSessionId] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const chatDivRef = useRef(null);
  const messageInputRef = useRef(null);
  const queryClient = useQueryClient();

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
      const res = await fetch(apiUrl(`/api/chat/history?sessionId=${sessionId}`), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json();
      setHistory(data.history || []);
    } catch (error) {
      console.error("Error loading history:", error);
      toast.error("Failed to load chat history");
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMessage() {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending) return;

    setIsSending(true);

    try {
      const res = await fetch(apiUrl("/api/chat/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: trimmedMessage,
          sessionId,
        }),
      });

      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();

      // Add message to history
      if (data.chat) {
        setHistory([...history, data.chat]);
      }

      setMessage("");
      messageInputRef.current?.focus();
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error(error.message || "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyPress(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function escapeHtml(text) {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  async function startNewChat() {
    const newSessionId = generateSessionId();
    localStorage.setItem("chatSessionId", newSessionId);
    setSessionId(newSessionId);
    setHistory([]);
    setMessage("");
    messageInputRef.current?.focus();
  }

  async function clearAllHistory() {
    if (!window.confirm("Are you sure you want to clear all chat history?")) return;

    try {
      const res = await fetch(apiUrl(`/api/chat/clear?sessionId=${sessionId}`), {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to clear history");
      setHistory([]);
      toast.success("Chat history cleared");
    } catch (error) {
      console.error("Error clearing history:", error);
      toast.error("Failed to clear history");
    }
  }

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatDivRef.current) {
      chatDivRef.current.scrollTop = chatDivRef.current.scrollHeight;
    }
  }, [history]);

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.logo}>
          <span style={{ fontSize: "28px" }}>⚡</span>
          <div>Thook</div>
        </div>

        <button style={styles.newChatBtn} onClick={startNewChat}>
          + New Chat
        </button>

        <div style={styles.historyTitle}>Chat History</div>
        <div id="historyList" style={{ flex: 1, overflowY: "auto" }}>
          {history.slice(-10).reverse().map((chat, idx) => (
            <div key={idx} style={styles.historyItem} title={escapeHtml(chat.userMessage)}>
              {escapeHtml(chat.userMessage.substring(0, 30))}...
            </div>
          ))}
        </div>

        <button style={styles.clearHistoryBtn} onClick={clearAllHistory}>
          Clear History
        </button>
      </div>

      {/* Main Chat Area */}
      <div style={styles.mainContainer}>
        <div style={styles.header}>
          <h1 style={styles.headerH1}>Friendly AI Assistant</h1>
          <p style={styles.headerP}>Ask me anything — I'll answer like a helpful friend.</p>
        </div>

        <div ref={chatDivRef} style={styles.chatDiv}>
          {history.length === 0 ? (
            <div style={styles.welcome}>
              <h2 style={styles.welcomeH2}>⚡ Thook</h2>
              <p style={styles.welcomeP}>Your friendly assistant — concise, accurate, and here to help like a friend.</p>
            </div>
          ) : (
            history.map((chat, idx) => (
              <div key={idx}>
                {/* User Message */}
                <div style={styles.messageUser}>
                  <div style={styles.messageContentUser}>{escapeHtml(chat.userMessage)}</div>
                </div>
                {/* AI Response */}
                <div style={styles.messageBot}>
                  <div style={styles.messageContentBot}>{chat.aiReply}</div>
                </div>
              </div>
            ))
          )}
          {isSending && (
            <div style={styles.messageBot}>
              <div style={{ ...styles.messageContentBot, display: "flex", gap: "4px" }}>
                <span style={styles.typingDot}></span>
                <span style={{ ...styles.typingDot, animationDelay: "0.2s" }}></span>
                <span style={{ ...styles.typingDot, animationDelay: "0.4s" }}></span>
              </div>
            </div>
          )}
        </div>

        <div style={styles.inputArea}>
          <div style={styles.inputContainer}>
            <textarea
              ref={messageInputRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me anything... (I'll be concise)"
              rows="1"
              style={styles.messageInput}
            />
            <button
              onClick={sendMessage}
              disabled={isSending || message.trim() === ""}
              style={{ ...styles.sendBtn, opacity: isSending || message.trim() === "" ? 0.6 : 1 }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes typing {
          0%, 60%, 100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-8px);
          }
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: {
    display: "flex",
    height: "100vh",
    background: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)",
    color: "#e0e0e0",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    overflow: "hidden",
  },
  sidebar: {
    width: "260px",
    background: "#111111",
    borderRight: "1px solid #2a2a2a",
    display: "flex",
    flexDirection: "column",
    padding: "20px",
    overflowY: "auto",
  },
  logo: {
    fontSize: "24px",
    fontWeight: "800",
    background: "linear-gradient(135deg, #00d9ff, #0099cc)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    marginBottom: "30px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  newChatBtn: {
    width: "100%",
    padding: "12px",
    background: "linear-gradient(135deg, #00d9ff, #0099cc)",
    border: "none",
    borderRadius: "8px",
    color: "#000",
    fontWeight: "600",
    cursor: "pointer",
    marginBottom: "20px",
    transition: "all 0.3s ease",
  },
  historyTitle: {
    fontSize: "12px",
    color: "#666",
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: "12px",
    marginTop: "20px",
  },
  historyItem: {
    padding: "10px",
    marginBottom: "8px",
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    maxHeight: "40px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    transition: "all 0.2s ease",
  },
  clearHistoryBtn: {
    marginTop: "auto",
    padding: "10px",
    background: "rgba(255, 59, 48, 0.2)",
    border: "1px solid rgba(255, 59, 48, 0.4)",
    color: "#ff3b30",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "12px",
    transition: "all 0.2s ease",
  },
  mainContainer: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#0f0f0f",
  },
  header: {
    padding: "20px",
    borderBottom: "1px solid #2a2a2a",
    background: "linear-gradient(135deg, rgba(0, 217, 255, 0.05), rgba(0, 153, 204, 0.05))",
    backdropFilter: "blur(10px)",
  },
  headerH1: {
    fontSize: "28px",
    fontWeight: "700",
    background: "linear-gradient(135deg, #00d9ff, #0099cc)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    margin: 0,
  },
  headerP: {
    fontSize: "13px",
    color: "#999",
    marginTop: "5px",
    margin: "5px 0 0 0",
  },
  chatDiv: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    scrollBehavior: "smooth",
  },
  welcome: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    gap: "20px",
    height: "100%",
  },
  welcomeH2: {
    fontSize: "32px",
    background: "linear-gradient(135deg, #00d9ff, #0099cc)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    margin: 0,
  },
  welcomeP: {
    color: "#999",
    fontSize: "14px",
    maxWidth: "400px",
    margin: 0,
  },
  messageUser: {
    display: "flex",
    justifyContent: "flex-end",
    animation: "slideIn 0.3s ease",
  },
  messageContentUser: {
    maxWidth: "70%",
    padding: "12px 16px",
    borderRadius: "18px 18px 4px 18px",
    lineHeight: "1.5",
    wordWrap: "break-word",
    background: "linear-gradient(135deg, #00d9ff, #0099cc)",
    color: "#000",
    fontWeight: "500",
  },
  messageBot: {
    display: "flex",
    justifyContent: "flex-start",
    animation: "slideIn 0.3s ease",
  },
  messageContentBot: {
    maxWidth: "70%",
    padding: "12px 16px",
    borderRadius: "18px 18px 18px 4px",
    lineHeight: "1.5",
    wordWrap: "break-word",
    background: "rgba(255, 255, 255, 0.08)",
    color: "#e0e0e0",
    border: "1px solid rgba(0, 217, 255, 0.2)",
  },
  typingDot: {
    width: "6px",
    height: "6px",
    background: "#00d9ff",
    borderRadius: "50%",
    animation: "typing 1.4s infinite",
    display: "inline-block",
  },
  inputArea: {
    padding: "20px",
    borderTop: "1px solid #2a2a2a",
    background: "linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 217, 255, 0.02))",
    backdropFilter: "blur(10px)",
  },
  inputContainer: {
    display: "flex",
    gap: "12px",
    alignItems: "flex-end",
  },
  messageInput: {
    flex: 1,
    padding: "12px 16px",
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(0, 217, 255, 0.3)",
    borderRadius: "12px",
    color: "#e0e0e0",
    fontSize: "14px",
    fontFamily: "inherit",
    resize: "none",
    maxHeight: "100px",
    transition: "all 0.3s ease",
    outline: "none",
  },
  sendBtn: {
    padding: "12px 20px",
    background: "linear-gradient(135deg, #00d9ff, #0099cc)",
    border: "none",
    borderRadius: "8px",
    color: "#000",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    whiteSpace: "nowrap",
  },
};

export default ChatPage;
