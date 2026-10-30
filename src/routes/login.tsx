import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { AuthScreen, BootScreen } from "@/components/synapse/auth-screen";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <BootScreen />;
  if (user) return <Navigate to="/" search={{ p: "home" }} />;
  return <AuthScreen />;
}
