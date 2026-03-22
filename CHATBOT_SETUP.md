# Chatbot Integration Guide

## Overview
The Winker project now includes an integrated AI chatbot feature powered by Hugging Face Inference API. Users can chat with an AI assistant directly within the application.

## Files Created/Modified

### Backend
- **`backend/models/chat.model.js`** - MongoDB Chat schema for storing chat history
- **`backend/controllers/chat.controller.js`** - Chat controller with handlers for sending messages, fetching history, and clearing history
- **`backend/routes/chat.route.js`** - Chat API routes (protected with authentication)
- **`backend/server.js`** - Updated to mount `/api/chat` routes
- **`backend/package.json`** - Added `@huggingface/inference` dependency

### Frontend
- **`frontend/src/pages/chat/ChatPage.jsx`** - React component for chat UI with message history
- **`frontend/src/App.jsx`** - Added `/chat` route
- **`frontend/src/components/common/Sidebar.jsx`** - Updated chat link from `/thook` to `/chat`

## API Endpoints

All chat endpoints require authentication (via cookies/JWT).

### POST `/api/chat/send`
Send a message and get an AI response.

**Request:**
```json
{
  "message": "Hello, how are you?",
  "sessionId": "session_1234567890_abc123"
}
```

**Response:**
```json
{
  "success": true,
  "chat": {
    "userMessage": "Hello, how are you?",
    "aiReply": "I'm doing well, thank you for asking!",
    "timestamp": "2025-11-12T10:30:00.000Z"
  }
}
```

### GET `/api/chat/history?sessionId=xxx`
Retrieve chat history for a session.

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "_id": "...",
      "userId": "...",
      "userMessage": "Hello",
      "aiReply": "Hi there!",
      "createdAt": "2025-11-12T10:30:00.000Z"
    }
  ]
}
```

### DELETE `/api/chat/clear?sessionId=xxx`
Clear chat history for a session or user.

**Response:**
```json
{
  "success": true,
  "message": "Chat history cleared"
}
```

## Environment Variables

Ensure your `backend/.env` contains:
```env
HF_API_KEY=your_hugging_face_api_key
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
PORT=5000
```

Get your HF API key from [Hugging Face](https://huggingface.co/settings/tokens).

## Running the Project

1. **Install backend dependencies:**
   ```powershell
   cd "d:\real winker\backend"
   npm install
   ```

2. **Start the backend (port 5000):**
   ```powershell
   npm run dev
   ```

3. **In a new terminal, install frontend dependencies:**
   ```powershell
   cd "d:\real winker\frontend"
   npm install
   ```

4. **Start the frontend (port 3000):**
   ```powershell
   npm run dev
   ```

5. **Access the app:**
   - Open http://localhost:3000 in your browser
   - Log in with your credentials
   - Click "Chat" in the sidebar (robot icon) to start chatting

## Features

- ✅ Real-time AI chat powered by Hugging Face
- ✅ Chat history saved to MongoDB
- ✅ Session-based conversations
- ✅ Protected routes (authentication required)
- ✅ Responsive UI matching Winker design
- ✅ Message persistence

## Model Used

Currently using `meta-llama/Llama-2-7b-chat-hf` from Hugging Face. You can modify this in `backend/controllers/chat.controller.js` line with `.chatCompletion()` call.

## Future Enhancements

- [ ] Switch to faster/better models (GPT-4, Claude, etc.)
- [ ] Add message editing/deletion
- [ ] Implement chat search
- [ ] Add typing indicators
- [ ] Support for voice input
- [ ] Rate limiting
