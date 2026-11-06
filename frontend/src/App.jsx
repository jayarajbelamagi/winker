import { useState, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import HomePage from "./pages/home/HomePage";
import LoginPage from "./pages/auth/login/LoginPage";
import SignUpPage from "./pages/auth/signup/SignUpPage";
import NotificationPage from "./pages/notification/NotificationPage";
import ProfilePage from "./pages/profile/ProfilePage";
import ChatPage from "./pages/chat/ChatPage";
import NewsPage from "./pages/news/NewsPage";
import BookmarksPage from "./pages/bookmarks/BookmarksPage";
import ResetPasswordPage from "./pages/auth/reset/ResetPasswordPage";

import Sidebar from "./components/common/Sidebar";
import RightPanel from "./components/common/RightPanel";

import { Toaster } from "react-hot-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppLoadingScreen from "./components/common/AppLoadingScreen";
import { apiFetch, getStoredToken, clearStoredAuth, wakeUpBackend } from "./lib/api";

import FollowersPage from "./pages/FollowersFollowing/FollowersPage";
import FollowingPage from "./pages/FollowersFollowing/FollowingPage";
import PostPage from "./pages/post/PostPage";

import MobileTopBar from "./components/common/MobileTopBar";
import MobileDrawer from "./components/common/MobileDrawer";
import BottomNav from "./components/common/BottomNav";
import MobileFAB from "./components/common/MobileFAB";

function App() {
  const queryClient = useQueryClient();
  const [hasToken, setHasToken] = useState(() => Boolean(getStoredToken()));
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Trigger non-blocking backend wake-up immediately on app launch
  useEffect(() => {
    wakeUpBackend();
  }, []);

  const {
    data: authUser,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["authUser"],
    queryFn: async () => {
      try {
        const res = await apiFetch("/api/auth/me", { timeout: 45000 });
        if (!res.ok) {
          clearStoredAuth();
          setHasToken(false);
          return null;
        }
        const data = await res.json();
        if (data.error) {
          clearStoredAuth();
          setHasToken(false);
          return null;
        }
        return data;
      } catch (error) {
        console.warn("Auth check failed:", error);
        clearStoredAuth();
        setHasToken(false);
        return null;
      }
    },
    // Only query if the user has an existing token saved
    enabled: hasToken,
    initialData: hasToken ? undefined : null,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  // If verifying token, show warm-up loading screen with status & skip option
  if (hasToken && isLoading) {
    return (
      <AppLoadingScreen
        onSkip={() => {
          clearStoredAuth();
          setHasToken(false);
          queryClient.setQueryData(["authUser"], null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Mobile Top Header */}
      {authUser && (
        <MobileTopBar
          authUser={authUser}
          onOpenDrawer={() => setMobileDrawerOpen(true)}
        />
      )}

      {/* Mobile Slide-Over Drawer */}
      {authUser && (
        <MobileDrawer
          authUser={authUser}
          isOpen={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
        />
      )}

      <div className="flex max-w-6xl mx-auto w-full relative min-h-screen pb-16 md:pb-0">
        {authUser && <Sidebar />}
        <Routes>
          <Route
            path="/"
            element={authUser ? <HomePage authUser={authUser} /> : <Navigate to="/login" />}
          />
          <Route
            path="/login"
            element={!authUser ? <LoginPage /> : <Navigate to="/" />}
          />
          <Route
            path="/signup"
            element={!authUser ? <SignUpPage /> : <Navigate to="/" />}
          />
          <Route
            path="/reset-password/:token"
            element={<ResetPasswordPage />}
          />
          <Route
            path="/post/:id"
            element={authUser ? <PostPage authUser={authUser} /> : <Navigate to="/login" />}
          />
          <Route
            path="/news"
            element={authUser ? <NewsPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/bookmarks"
            element={authUser ? <BookmarksPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/notifications"
            element={authUser ? <NotificationPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/profile/:username"
            element={authUser ? <ProfilePage /> : <Navigate to="/login" />}
          />

          {/* Followers & Following Routes */}
          <Route
            path="/:username/followers"
            element={authUser ? <FollowersPage /> : <Navigate to="/login" />}
          />
          <Route
            path="/:username/following"
            element={authUser ? <FollowingPage /> : <Navigate to="/login" />}
          />

          {/* Chat Route */}
          <Route
            path="/chat"
            element={authUser ? <ChatPage authUser={authUser} /> : <Navigate to="/login" />}
          />
        </Routes>
        {authUser && <RightPanel />}
      </div>

      {/* Mobile Floating Action Button */}
      {authUser && <MobileFAB />}

      {/* Mobile Bottom Navigation Bar */}
      {authUser && <BottomNav authUser={authUser} />}

      <Toaster />
    </div>
  );
}

export default App;
