"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Cloud, CloudOff, FileText, WifiOff, Trash2, LogOut, Loader2, HardDriveDownload } from "lucide-react";
import type { SessionUser, ResourceDTO } from "@/lib/types";
import { RESOURCE_TYPE_LABELS, DRIVE_CONTRIBUTION_REQUIRED, DRIVE_PERKS_THRESHOLD } from "@/lib/types";
import { listOffline, removeOffline, formatBytes, openResource } from "./offline";
import { ResourceSheet } from "./resource-sheet";
import { DriveConnectDialog } from "./drive-connect-dialog";
import { AdminPanel } from "./admin-panel";
import { useAppStore } from "./store";
import { useToast } from "@/hooks/use-toast";

interface ProfileScreenProps {
  user: SessionUser;
  onSignedOut: () => void;
  onUserRefreshed: (u: SessionUser) => void;
}

interface ProfileData {
  user: SessionUser;
  stats: { contributionCount: number; totalUploads: number; requiredCount: number; perksUnlocked: boolean };
  uploads: ResourceDTO[];
}

export function ProfileScreen({ user, onSignedOut, onUserRefreshed }: ProfileScreenProps) {
  const [driveDialog, setDriveDialog] = useState(false);
  const [sheet, setSheet] = useState<ResourceDTO | null>(null);
  const [offlineTick, setOfflineTick] = useState(0);
  const [busySignOut, setBusySignOut] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const googleConfigured = useAppStore((s) => s.googleConfigured);

  const { data, refetch } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      return (await res.json()) as ProfileData;
    },
  });

  const stats = data?.stats ?? { contributionCount: 0, totalUploads: 0, requiredCount: DRIVE_CONTRIBUTION_REQUIRED, perksUnlocked: false };
  const offlineEntries = listOffline();
  void offlineTick; // re-render trigger after save/remove

  const toggleDrive = async () => {
    if (user.driveConnected) {
      await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disconnect" }),
      });
      toast({ title: "Google Drive disconnected" });
    } else {
      // Production: consent happens in the Google sign-in flow.
      if (googleConfigured) {
        window.location.href = "/api/auth/google/start";
        return;
      }
      setDriveDialog(true);
      return;
    }
    const res = await fetch("/api/auth/me");
    const me = (await res.json()) as { user: SessionUser | null };
    if (me.user) onUserRefreshed(me.user);
    await queryClient.invalidateQueries({ queryKey: ["profile"] });
  };

  const signOut = async () => {
    setBusySignOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
      onSignedOut();
    } finally {
      setBusySignOut(false);
    }
  };

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  const progressPct = Math.min(100, Math.round((stats.contributionCount / stats.requiredCount) * 100));

  return (
    <div className="min-h-[calc(100dvh-56px)] bg-cream-deep/60">
      {/* Header */}
      <header className="bg-cream-deep/70 px-5 pb-5 pt-8">
        <div className="flex items-center gap-4">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-forest font-display text-xl font-bold text-cream">
            {initials}
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">{user.name}</h1>
            <p className="text-sm text-ink-muted">
              Kenyatta University · {user.department} {user.yearOfStudy.replace("Year ", "Y")}
            </p>
          </div>
        </div>

        {/* Drive contribution card */}
        <div className="mt-5 rounded-2xl border border-line bg-card p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs font-bold tracking-widest text-ink">MY DRIVE CONTRIBUTION</h2>
            <span className="font-display text-sm font-bold text-forest">
              {stats.contributionCount} / {stats.requiredCount} Required
            </span>
          </div>
          <Progress value={progressPct} className="mt-3 h-2.5 bg-cream-deep" aria-label={`${progressPct}% of contribution target`} />
          <p className="mt-2.5 text-xs leading-relaxed text-ink-muted">
            {stats.perksUnlocked
              ? `You have contributed ${stats.contributionCount} verified papers. Unlimited downloads are unlocked — asante!`
              : stats.contributionCount >= DRIVE_PERKS_THRESHOLD
                ? `Unlimited downloads unlocked. Share ${Math.max(0, stats.requiredCount - stats.contributionCount)} more to reach the full ${stats.requiredCount}-paper contribution target.`
                : `You have contributed ${stats.contributionCount} verified papers. Share ${DRIVE_PERKS_THRESHOLD - stats.contributionCount} more to unlock unlimited downloads (${stats.requiredCount} for full storage perks).`}
          </p>
        </div>
      </header>

      <main className="px-5 py-5">
        {/* My uploads */}
        <section aria-label="My uploaded resources">
          <h2 className="text-xs font-bold tracking-widest text-ink">MY UPLOADED RESOURCES ({stats.totalUploads})</h2>
          <div className="mt-3 space-y-2.5">
            {data?.uploads.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSheet(r)}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-card px-4 py-3.5 text-left transition-colors hover:border-forest/40"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-forest-tint">
                    <FileText className="h-4.5 w-4.5 text-forest" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{r.title}</p>
                    <p className="text-xs text-ink-muted">
                      {r.unit.code} · {RESOURCE_TYPE_LABELS[r.type]} · {r.downloadCount} dls
                    </p>
                  </div>
                </div>
                <span className={`ml-3 shrink-0 text-xs font-semibold ${r.verified ? "text-forest" : "text-ink-muted"}`}>
                  {r.verified ? "Active (Shared)" : "Pending"}
                </span>
              </button>
            ))}
            {data && data.uploads.length === 0 && (
              <p className="rounded-xl border border-dashed border-line bg-card p-5 text-center text-sm text-ink-muted">
                No uploads yet — your first contribution counts toward Drive perks.
              </p>
            )}
          </div>
        </section>

        {/* Integrations & privacy */}
        <section aria-label="Integrations and privacy" className="mt-7">
          <h2 className="text-xs font-bold tracking-widest text-ink">INTEGRATIONS &amp; PRIVACY</h2>
          <div className="mt-3 rounded-xl border border-line bg-card px-4 py-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.driveConnected ? (
                  <Cloud className="h-5 w-5 text-forest" />
                ) : (
                  <CloudOff className="h-5 w-5 text-ink-muted" />
                )}
                <span className="text-sm font-semibold text-ink">
                  {user.driveConnected ? "Google Drive Connected" : "Google Drive Not Connected"}
                </span>
              </div>
              <button
                type="button"
                onClick={toggleDrive}
                className={`text-sm font-semibold ${user.driveConnected ? "text-pumpkin-deep hover:underline" : "text-forest hover:underline"}`}
              >
                {user.driveConnected ? "Disconnect" : "Connect"}
              </button>
            </div>
            {user.driveConnected && user.driveEmail && (
              <p className="mt-1.5 pl-8 text-xs text-ink-muted">{user.driveEmail} · drive.file scope only</p>
            )}
          </div>
        </section>

        {/* Owner tools (moderation + mailing list) */}
        {user.isAdmin && (
          <section aria-label="Owner tools" className="mt-7">
            <h2 className="text-xs font-bold tracking-widest text-ink">OWNER TOOLS</h2>
            <div className="mt-3">
              <AdminPanel />
            </div>
          </section>
        )}

        {/* Saved for offline */}
        <section aria-label="Saved for offline" className="mt-7">
          <h2 className="flex items-center gap-2 text-xs font-bold tracking-widest text-ink">
            <HardDriveDownload className="h-4 w-4" /> SAVED FOR OFFLINE ({offlineEntries.length})
          </h2>
          <div className="mt-3 space-y-2.5">
            {offlineEntries.map((entry) => (
              <div key={entry.resource.id} className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3">
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-3 text-left"
                  onClick={async () => {
                    try {
                      const url = await openResource(entry.resource.id);
                      window.open(url, "_blank");
                      setTimeout(() => URL.revokeObjectURL(url), 60_000);
                    } catch {
                      toast({ title: "File unavailable", variant: "destructive" });
                    }
                  }}
                >
                  <WifiOff className="h-4 w-4 shrink-0 text-forest" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{entry.resource.title}</p>
                    <p className="text-xs text-ink-muted">
                      {entry.resource.unit.code} · {formatBytes(entry.bytes)} · ready offline
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${entry.resource.title} from offline library`}
                  onClick={async () => {
                    await removeOffline(entry.resource.id);
                    setOfflineTick((t) => t + 1);
                    toast({ title: "Removed from offline library" });
                  }}
                  className="rounded-full p-2 text-ink-muted hover:bg-cream-deep hover:text-pumpkin-deep"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            {offlineEntries.length === 0 && (
              <p className="rounded-xl border border-dashed border-line bg-card p-5 text-center text-sm text-ink-muted">
                Files you save for offline revision appear here — perfect for hostels with patchy WiFi.
              </p>
            )}
          </div>
        </section>

        {/* Sign out */}
        <section className="mt-8 mb-6">
          <Button
            variant="ghost"
            onClick={signOut}
            disabled={busySignOut}
            className="w-full rounded-xl border border-line bg-card text-sm font-semibold text-pumpkin-deep hover:bg-pumpkin-tint"
          >
            {busySignOut ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
            Sign out
          </Button>
        </section>
      </main>

      <DriveConnectDialog
        open={driveDialog}
        onOpenChange={setDriveDialog}
        studentEmail={user.driveEmail ?? user.email}
        onConnected={async () => {
          const res = await fetch("/api/auth/me");
          const me = (await res.json()) as { user: SessionUser | null };
          if (me.user) onUserRefreshed(me.user);
          await refetch();
        }}
      />

      <ResourceSheet
        resource={sheet}
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        onOfflineChange={() => setOfflineTick((t) => t + 1)}
      />
    </div>
  );
}
