# 🚀 Winker – Social Media Platform (Twitter × Instagram)

Winker is a full-stack social media platform that combines the best features of Twitter and Instagram — enabling users to share posts, interact in real-time, and build a digital presence.

---

## 🌟 Features

### 👤 User Authentication & Profiles

* Secure authentication using JWT
* User signup/login/logout
* Profile creation with bio, profile picture, and cover image
* Follow / Unfollow users
* Suggested users

---

### 📝 Posts & Content

* Create, edit, and delete posts
* Upload images (Cloudinary integration)
* Caption support (like Instagram)
* Text-based posts (like Twitter)
* Feed with latest posts

---

### ❤️ Engagement Features

* Like / Unlike posts
* Comment on posts
* Reply to comments
* Save / bookmark posts
* Share posts

---

### 🔔 Social Interaction

* Follow system (followers / following)
* Notifications for likes, comments, follows
* Real-time updates (if implemented)

---

### 🔍 Explore & Discovery

* Explore feed
* Search users/posts
* Trending content (Twitter-like)

---

### 💬 Messaging (Optional if implemented)

* Direct messaging system
* Chat between users

---

### 🛠️ Backend Features

* RESTful API design
* JWT-based authentication & authorization
* Secure routes & middleware
* Scalable architecture

---

## 🛠️ Tech Stack

### Frontend

* React.js
* Axios
* Tailwind CSS / CSS

### Backend

* Node.js
* Express.js

### Database

* MongoDB

### Other Tools & Services

* JWT (Authentication)
* Cloudinary (Image Uploads)
* Bcrypt (Password hashing)

---

## 📂 Project Structure

```
Winker/
│── frontend/
│   ├── src/
│   ├── components/
│   ├── pages/
│
│── backend/
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│
│── .env
│── package.json
```

---

## ⚙️ Installation

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/your-username/winker.git
cd winker
```

---

### 2️⃣ Backend Setup

```bash
cd backend
npm install
npm run dev
```

---

### 3️⃣ Frontend Setup

```bash
cd frontend
npm install
npm start
```

---

## 🔐 Environment Variables

Create a `.env` file in the backend folder:

```env
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_secret_key
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

---

## ▶️ Usage

* Open `http://localhost:3000`
* Register/Login
* Create posts, follow users, and interact

---

## 📊 Highlights

* Full MERN stack implementation
* Scalable backend architecture
* Secure authentication with JWT
* Media handling via Cloudinary
* Combines features of Instagram & Twitter in one platform

---

## 🤝 Contributing

Contributions are welcome! Feel free to fork and submit pull requests.

## 💡 Author

Developed by **[Jayaraj Belamagi]**

---

