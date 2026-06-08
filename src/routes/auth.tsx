import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { HardHat } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Sign in — SiteCrew" },
      { name: "description", content: "Sign in to manage your workforce and projects." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Account created. Signing you in…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err: any) {
      toast.error(err?.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-gradient-to-br from-background via-background to-accent/30">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="size-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center mb-3 shadow-sm">
            <HardHat className="size-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">SiteCrew</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Workforce & project management for contractors
          </p>
        </div>

        <Card className="p-6 glass">
          <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
            <TabsList className="grid grid-cols-2 w-full mb-6">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <TabsContent value="signin" className="m-0">
                <Button type="submit" className="w-full tap-target" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
              </TabsContent>
              <TabsContent value="signup" className="m-0">
                <Button type="submit" className="w-full tap-target" disabled={busy}>
                  {busy ? "Creating…" : "Create account"}
                </Button>
              </TabsContent>
            </form>
          </Tabs>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-6">
          By continuing you agree to manage your workforce data securely.
        </p>
      </div>
    </div>
  );
}
