"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, BadgeCheck, ShieldCheck, Loader2, Mail, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SessionUser } from "@/lib/types";

interface LoginScreenProps {
  onSignedIn: (user: SessionUser) => void;
}

const AUTH_ERRORS: Record<string, string> = {
  domain: "Only @ku.ac.ke student Google accounts can sign in to SomaShare.",
  state: "Sign-in session expired — please try again.",
  exchange: "Google sign-in failed — please try again.",
  missing_params: "Sign-in was interrupted — please try again.",
  unconfigured: "Google sign-in is not configured on this deployment yet.",
  rate: "Too many attempts — wait a minute and try again.",
};

const DEMO_CREDENTIALS = { email: "alex.ochieng@ku.ac.ke", name: "Alex Ochieng", department: "Engineering", yearOfStudy: "Year 3" };

export function LoginScreen({ onSignedIn }: LoginScreenProps) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [flags, setFlags] = useState<{ googleConfigured: boolean; demoEnabled: boolean }>({
    googleConfigured: false,
    demoEnabled: false,
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const [busyDemo, setBusyDemo] = useState(false);

  // Join form
  const [joinName, setJoinName] = useState("");
  const [joinEmail, setJoinEmail] = useState("");
  const [joinBusy, setJoinBusy] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { googleConfigured?: boolean; demoEnabled?: boolean }) =>
        setFlags({ googleConfigured: !!data.googleConfigured, demoEnabled: !!data.demoEnabled })
      )
      .catch(() => undefined);

    const params = new URLSearchParams(window.location.search);
    const err = params.get("auth_error");
    if (err) setAuthError(AUTH_ERRORS[err] ?? "Sign-in failed — please try again.");
  }, []);

  const demoSignIn = async () => {
    setBusyDemo(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(DEMO_CREDENTIALS),
      });
      const data = (await res.json()) as { user?: SessionUser; error?: string };
      if (!res.ok || !data.user) throw new Error(data.error ?? "Sign-in failed");
      toast({ title: `Karibu, ${data.user.name.split(" ")[0]}!`, description: "Welcome to the vault." });
      onSignedIn(data.user);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusyDemo(false);
    }
  };

  const join = async () => {
    if (!joinEmail.trim()) {
      toast({ title: "Add your email first", variant: "destructive" });
      return;
    }
    setJoinBusy(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: joinName, email: joinEmail }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not sign you up");
      toast({ title: "You're on the list! 🎉", description: "We'll email you when the vault opens up." });
      setJoinOpen(false);
      setJoinName("");
      setJoinEmail("");
    } catch (err) {
      toast({
        title: "Signup failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setJoinBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-cream pb-10">
      {/* Hero */}
      <div className="relative h-64 w-full overflow-hidden sm:h-80">
        <img
          src="/images/hero-library.png"
          alt="Warm university library with tall bookshelves and green trees through the window"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
        <span className="absolute bottom-5 left-5 rounded-md bg-pumpkin px-3 py-1.5 text-xs font-bold tracking-wide text-white shadow-sm">
          KENYATTA UNIVERSITY LAUNCH
        </span>
      </div>

      <main className="mx-auto max-w-md px-5">
        <h1 className="font-display mt-7 text-4xl font-bold text-ink">SomaShare</h1>
        <p className="mt-3 text-lg leading-relaxed text-ink-muted">
          The student-powered learning vault. Access notes, revision slides, and past papers contributed by fellow KU
          peers.
        </p>

        {authError && (
          <p role="alert" className="mt-4 rounded-xl bg-pumpkin-tint px-4 py-3 text-sm font-medium text-pumpkin-deep">
            {authError}
          </p>
        )}

        <section aria-label="Select your institution" className="mt-6">
          <h2 className="text-xs font-bold tracking-widest text-ink">SELECT YOUR INSTITUTION</h2>
          <Select defaultValue="ku" disabled>
            <SelectTrigger className="mt-2.5 h-13 rounded-xl border-2 border-forest bg-card text-base font-semibold text-ink shadow-sm data-[disabled]:opacity-100">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="h-5 w-5 text-forest" />
                <SelectValue placeholder="Choose institution" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ku">Kenyatta University</SelectItem>
            </SelectContent>
          </Select>
        </section>

        {/* Google sign-in */}
        <Button
          type="button"
          onClick={() => {
            window.location.href = "/api/auth/google/start";
          }}
          className="mt-4 h-13 w-full rounded-xl border border-line bg-card py-4 text-base font-semibold text-ink shadow-sm hover:bg-muted"
          variant="outline"
        >
          <GoogleG />
          <span className="ml-3">Continue with Google</span>
        </Button>
        <p className="mt-3 text-center text-xs leading-relaxed text-ink-muted">
          Use your <span className="font-semibold text-ink">@ku.ac.ke</span> student Google account. One tap also
          connects your Drive storage — every upload lives in <em>your own</em> Drive.
        </p>

        {/* Mailing list */}
        <Button
          type="button"
          onClick={() => setJoinOpen(true)}
          className="mt-3 h-12 w-full rounded-xl bg-forest-tint text-base font-semibold text-forest hover:bg-forest hover:text-cream"
          variant="outline"
        >
          <Users className="mr-2 h-5 w-5" /> Not a student yet? Join the community
        </Button>

        {flags.demoEnabled && (
          <button
            type="button"
            onClick={demoSignIn}
            disabled={busyDemo}
            className="mt-4 w-full text-center text-xs font-medium text-forest underline-offset-2 hover:underline"
          >
            {busyDemo ? (
              <Loader2 className="mx-auto h-4 w-4 animate-spin" />
            ) : (
              "Use demo account (Alex Ochieng · Year 3)"
            )}
          </button>
        )}

        <footer className="mt-14 flex items-start gap-3 rounded-xl bg-cream-deep p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest" />
          <p className="text-xs leading-relaxed text-ink-muted">
            SomaShare is a <span className="font-semibold text-ink">student-run platform</span>. We are not officially
            affiliated with Kenyatta University administration.
          </p>
        </footer>
      </main>

      {/* Join the community dialog */}
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="mx-auto max-w-sm rounded-2xl bg-cream">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-ink">Join the community</DialogTitle>
            <DialogDescription className="text-sm text-ink-muted">
              Get launch updates and occasional study-season emails. No spam —{" "}
              <span className="font-medium text-ink">unsubscribe anytime</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="join-name" className="text-sm font-semibold text-ink">
                Name
              </Label>
              <Input
                id="join-name"
                placeholder="Alex Ochieng"
                value={joinName}
                onChange={(e) => setJoinName(e.target.value)}
                className="h-11 rounded-xl border-line bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="join-email" className="text-sm font-semibold text-ink">
                Email
              </Label>
              <Input
                id="join-email"
                type="email"
                placeholder="you@example.com"
                value={joinEmail}
                onChange={(e) => setJoinEmail(e.target.value)}
                className="h-11 rounded-xl border-line bg-card"
              />
            </div>
            <Button
              onClick={join}
              disabled={joinBusy || !joinEmail.trim()}
              className="h-12 w-full rounded-xl bg-forest text-base font-semibold text-cream hover:bg-forest-deep"
            >
              {joinBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              {joinBusy ? "Signing you up…" : "Keep me posted"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Google "G" mark, inline SVG (brand colors). */
function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
