"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, BadgeCheck, ShieldCheck, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { SessionUser } from "@/lib/types";

interface LoginScreenProps {
  onSignedIn: (user: SessionUser) => void;
}

const INSTITUTIONS = ["Kenyatta University"];
const DEPARTMENTS = ["Engineering", "Computing & IT", "Business Administration", "Science", "Education", "Law", "Medicine"];
const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"];

export function LoginScreen({ onSignedIn }: LoginScreenProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("Engineering");
  const [year, setYear] = useState("Year 3");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, department, yearOfStudy: year }),
      });
      const data = (await res.json()) as { user?: SessionUser; error?: string };
      if (!res.ok || !data.user) throw new Error(data.error ?? "Sign-in failed");
      toast({ title: `Karibu, ${data.user.name.split(" ")[0]}!`, description: "Welcome to the vault." });
      onSignedIn(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setBusy(false);
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

        <section aria-label="Select your institution" className="mt-7">
          <h2 className="text-xs font-bold tracking-widest text-ink">SELECT YOUR INSTITUTION</h2>
          <Select defaultValue="ku" disabled>
            <SelectTrigger className="mt-2.5 h-13 rounded-xl border-2 border-forest bg-card text-base font-semibold text-ink shadow-sm data-[disabled]:opacity-100">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="h-5 w-5 text-forest" />
                <SelectValue placeholder="Choose institution" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {INSTITUTIONS.map((i) => (
                <SelectItem key={i} value="ku">
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </section>

        <Button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="mt-4 h-13 w-full rounded-xl border border-line bg-card py-4 text-base font-semibold text-ink shadow-sm hover:bg-muted"
          variant="outline"
        >
          <BadgeCheck className="mr-2 h-5 w-5" /> Sign in with Student Email
        </Button>
        <p className="mt-3 text-center text-xs leading-relaxed text-ink-muted">
          Launch restriction: Authenticates with your valid @ku.ac.ke student email
        </p>

        <footer className="mt-16 flex items-start gap-3 rounded-xl bg-cream-deep p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest" />
          <p className="text-xs leading-relaxed text-ink-muted">
            SomaShare is a <span className="font-semibold text-ink">student-run platform</span>. We are not officially
            affiliated with Kenyatta University administration.
          </p>
        </footer>
      </main>

      {/* Sign-in dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="mx-auto max-w-sm rounded-2xl bg-cream">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-ink">Student Sign In</DialogTitle>
            <DialogDescription className="text-sm text-ink-muted">
              Use your official <span className="font-medium text-ink">@ku.ac.ke</span> email. Your Drive storage is
              connected after sign-in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold text-ink">
                Student Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="alex.ochieng@ku.ac.ke"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl border-line bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-semibold text-ink">
                Full Name
              </Label>
              <Input
                id="name"
                placeholder="Alex Ochieng"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-xl border-line bg-card"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-ink">Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="h-11 rounded-xl border-line bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((d) => (
                      <SelectItem key={d} value={d}>
                        {d}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-ink">Year of Study</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="h-11 rounded-xl border-line bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {error && <p className="rounded-lg bg-pumpkin-tint px-3 py-2 text-xs font-medium text-pumpkin-deep">{error}</p>}

            <Button onClick={signIn} disabled={busy || !email.trim()} className="h-12 w-full rounded-xl bg-forest text-base font-semibold text-cream hover:bg-forest-deep">
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {busy ? "Signing in…" : "Sign In"}
            </Button>
            <button
              type="button"
              className="w-full text-center text-xs font-medium text-forest underline-offset-2 hover:underline"
              onClick={() => {
                setEmail("alex.ochieng@ku.ac.ke");
                setName("Alex Ochieng");
              }}
            >
              Use demo account (Alex Ochieng · Year 3)
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
