import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { completeProfile, getMyProfile } from "@/lib/synapse/api";
import { clearClaim, peekClaim } from "@/lib/synapse/claim";
import { AppShell, type PageId } from "@/components/synapse/shell";
import { AuthScreen, BootScreen, ClaimScreen } from "@/components/synapse/auth-screen";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    const page = search.p;
    const p: PageId = page === "inbox" || page === "chat" || page === "studio" ? page : "home";
    return { p };
  },
  component: Home,
});

function Home() {
  const { user, isPending } = useCurrentUserState();
  const { p } = Route.useSearch();
  const [profile, setProfile] = useState<"loading" | null | string>("loading");

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setProfile(null);
      return;
    }
    let cancel = false;
    setProfile("loading");
    void (async () => {
      const staged = peekClaim();
      if (staged) {
        const saved = await completeProfile({ data: staged });
        if (cancel) return;
        if (saved.ok) {
          clearClaim();
          setProfile(saved.username);
          return;
        }
      }
      try {
        const mine = await getMyProfile();
        if (cancel) return;
        setProfile(mine?.username ?? null);
      } catch {
        if (!cancel) setProfile(null);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [isPending, user?.id]);

  if (isPending || (user && profile === "loading")) return <BootScreen />;
  if (!user) return <AuthScreen />;
  if (!profile) return <ClaimScreen onDone={(username) => setProfile(username)} />;
  return <AppShell page={p} />;
}
