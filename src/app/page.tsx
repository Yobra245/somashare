"use client";

/**
 * SomaShare — student-powered learning vault (PWA).
 *
 * Single-surface app: session gate → Login or the app shell
 * (Home / Browse / Upload / Profile) with a persistent bottom nav.
 */
import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SessionUser } from "@/lib/types";
import { useAppStore } from "@/components/somashare/store";
import { useServiceWorker, useOnlineStatus } from "@/components/somashare/pwa";
import { LoginScreen } from "@/components/somashare/login-screen";
import { HomeScreen } from "@/components/somashare/home-screen";
import { BrowseScreen } from "@/components/somashare/browse-screen";
import { UploadScreen } from "@/components/somashare/upload-screen";
import { ProfileScreen } from "@/components/somashare/profile-screen";
import { BottomNav } from "@/components/somashare/bottom-nav";
import { Loader2 } from "lucide-react";

export default function Page() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SomaShareApp />
    </QueryClientProvider>
  );
}

function SomaShareApp() {
  useServiceWorker();
  const online = useOnlineStatus();

  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);

  // restore session on first load
  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { user: SessionUser | null }) => setSession(data.user))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  // scroll to top on screen change
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [screen]);

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream" role="status" aria-label="Loading SomaShare">
        <Loader2 className="h-7 w-7 animate-spin text-forest" />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onSignedIn={(user) => setSession(user)} />;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col border-line bg-cream sm:border-x">
      <div className="flex-1">
        {screen === "home" && <HomeScreen user={session} online={online} />}
        {screen === "browse" && <BrowseScreen online={online} />}
        {screen === "upload" && (
          <UploadScreen
            user={session}
            onPublished={() => {
              setScreen("home");
            }}
          />
        )}
        {screen === "profile" && (
          <ProfileScreen
            user={session}
            onSignedOut={() => {
              setSession(null);
              setScreen("home");
            }}
            onUserRefreshed={(u) => setSession(u)}
          />
        )}
      </div>
      <BottomNav screen={screen} onNavigate={setScreen} />
    </div>
  );
}
