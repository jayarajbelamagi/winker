import { HfInference } from "@huggingface/inference";
import dotenv from "dotenv";
import Chat from "../models/chat.model.js";
import he from "he"; // ✅ ADD THIS

dotenv.config();

// ✅ Initialize Hugging Face Inference Client
const client = new HfInference(process.env.HF_API_KEY);

/**
 * 🧠 SEND MESSAGE
 */
export const sendMessage = async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    const userId = req.user._id.toString();

    if (!message?.trim()) {
      return res
        .status(400)
        .json({ success: false, error: "Message is required" });
    }

    // ✅ Call DeepSeek-V3 using chat API
    const chatCompletion = await client.chatCompletion({
      provider: "novita",
      model: "deepseek-ai/DeepSeek-V3-0324",
      messages: [
        {
          role: "system",
          content:
            "You are a small, friendly AI assistant. Reply in plain natural text only. Do NOT use HTML, HTML entities, or encoded characters. Write contractions normally (e.g., use It's instead of It is or It&#039;s). Keep answers concise, clear, and human. Give the direct answer first, followed by one short supporting sentence if helpful. Use a warm, conversational tone. Ask clarifying questions only when absolutely necessary.",
        },
        { role: "user", content: message },
      ],
    });

    // ✅ Extract + DECODE model reply (🔥 FIX)
    const rawReply =
      chatCompletion.choices?.[0]?.message?.content || "No response";

    const cleanReply = he.decode(rawReply); // ✅ THIS LINE FIXES It&#039;s

    // ✅ Save chat to MongoDB (save clean text)
    const chat = new Chat({
      userId,
      sessionId: sessionId || null,
      userMessage: message,
      aiReply: cleanReply,
    });
    await chat.save();

    res.status(200).json({
      success: true,
      reply: cleanReply,
      chat: {
        userMessage: chat.userMessage,
        aiReply: chat.aiReply,
        sessionId: chat.sessionId,
        createdAt: chat.createdAt,
      },
    });
  } catch (error) {
    console.error("Error in sendMessage:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error contacting Hugging Face API",
    });
  }
};

/**
 * 📜 GET CHAT HISTORY
 */
export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const { sessionId } = req.query;

    const query = { userId };
    if (sessionId) query.sessionId = sessionId;

    const history = await Chat.find(query)
      .sort({ createdAt: 1 })
      .select("userMessage aiReply sessionId createdAt");

    res.status(200).json({ success: true, history });
  } catch (error) {
    console.error("Error in getChatHistory:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * 🧹 CLEAR CHAT HISTORY
 */
export const clearChatHistory = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const sessionId = req.query.sessionId || req.body?.sessionId;

    const query = { userId };
    if (sessionId) query.sessionId = sessionId;

    await Chat.deleteMany(query);

    res.status(200).json({
      success: true,
      message: sessionId
        ? "Session history cleared"
        : "All chat history cleared",
    });
  } catch (error) {
    console.error("Error in clearChatHistory:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
