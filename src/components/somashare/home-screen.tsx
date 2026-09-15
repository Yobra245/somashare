"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Search, Cloud, PartyPopper, WifiOff } from "lucide-react";
import type { SessionUser, UnitDTO, ResourceDTO } from "@/lib/types";
import { DRIVE_PERKS_THRESHOLD, DRIVE_CONTRIBUTION_REQUIRED } from "@/lib/types";
import { useAppStore } from "./store";
import { ResourceCard } from "./resource-card";
import { ResourceSheet } from "./resource-sheet";
import { saveOffline } from "./offline";
import { useToast } from "@/hooks/use-toast";

interface HomeScreenProps {
  user: SessionUser;
  online: boolean;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Request failed");
  return res.json();
}

export function HomeScreen({ user, online }: HomeScreenProps) {
  const setScreen = useAppStore((s) => s.setScreen);
  const setChip = useAppStore((s) => s.setChip);
  const chip = useAppStore((s) => s.unitShortLabel);
  const openUnit = useAppStore((s) => s.openUnit);
  const setSearchMode = useAppStore((s) => s.setSearchMode);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState<ResourceDTO | null>(null);
  const [offlineTick, setOfflineTick] = useState(0);
  const { toast } = useToast();

  const { data: unitsData } = useQuery({
    queryKey: ["units"],
    queryFn: () => fetchJson<{ units: UnitDTO[] }>("/api/units"),
  });

  const { data: recentData, refetch: refetchRecent } = useQuery({
    queryKey: ["resources", "recent"],
    queryFn: () => fetchJson<{ resources: ResourceDTO[] }>("/api/resources?limit=6"),
  });

  const { data: mineData, refetch: refetchMine } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: () => fetchJson<{ stats: { contributionCount: number; perksUnlocked: boolean } }>(`/api/profile?t=${Date.now()}`),
    refetchOnWindowFocus: true,
  });

  const chipLabels = useMemo(() => {
    const labels = new Set<string>();
    unitsData?.units.forEach((u) => labels.add(u.shortLabel));
    return ["All Units", ...Array.from(labels)];
  }, [unitsData]);

  const recent = useMemo(() => {
    let items = recentData?.resources ?? [];
    if (chip && chip !== "All Units") items = items.filter((r) => r.unit.shortLabel === chip);
    return items;
  }, [recentData, chip]);

  const contribution = mineData?.stats.contributionCount ?? 0;
  const perksUnlocked = mineData?.stats.perksUnlocked ?? false;

  const handleSaveOffline = async (r: ResourceDTO) => {
    try {
      await saveOffline(r);
      setOfflineTick((t) => t + 1);
      toast({ title: "Saved for offline", description: "Accessible anytime — no internet needed." });
    } catch (err) {
      toast({ title: "Could not save", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    }
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    useAppStore.getState().setSearchQuery(search.trim());
    setSearchMode(true);
    setScreen("browse");
  };

  return (
    <div className="px-5 pt-6">
      {/* Greeting */}
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm text-ink-muted">Habari, {user.name}</p>
          <h1 className="font-display text-3xl font-bold text-ink">Kenyatta University</h1>
        </div>
        <button
          type="button"
          aria-label="Open profile"
          onClick={() => setScreen("profile")}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-deep text-sm font-bold text-forest transition-transform active:scale-95"
        >
          {user.name
            .split(" ")
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase())
            .join("")}
        </button>
      </header>

      {/* Search */}
      <form onSubmit={submitSearch} role="search" className="mt-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search units, past papers, lecture notes..."
            aria-label="Search units, past papers, lecture notes"
            className="h-12 rounded-xl border-line bg-card pl-11 text-base placeholder:text-ink-muted/70"
          />
        </div>
      </form>

      {/* Course unit chips */}
      <section aria-label="My course units" className="mt-6">
        <h2 className="text-xs font-bold tracking-widest text-ink">MY COURSE UNITS</h2>
        <div className="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
          {chipLabels.map((label) => {
            const active = (chip ?? "All Units") === label;
            return (
              <button
                key={label}
                type="button"
                onClick={() => setChip(label === "All Units" ? null : label)}
                className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-forest text-cream" : "border border-line bg-card text-ink hover:border-forest/40"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Offline banner */}
      {!online && (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-butter px-4 py-3 text-sm font-medium text-butter-deep">
          <WifiOff className="h-4 w-4 shrink-0" /> You&apos;re offline — recently viewed files and your saved library are
          still available.
        </p>
      )}

      {/* Recent uploads */}
      <section aria-label="Recent uploads" className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl font-bold text-ink">Recent Uploads</h2>
          <button
            type="button"
            onClick={() => {
              openUnit(null);
              setScreen("browse");
            }}
            className="text-sm font-semibold text-forest hover:underline"
          >
            View All
          </button>
        </div>
        <div className="mt-3 space-y-3">
          {recent.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              offlineTick={offlineTick}
              onOpen={setSheet}
              onDownload={handleSaveOffline}
            />
          ))}
          {recent.length === 0 && (
            <p className="rounded-xl border border-dashed border-line bg-card p-6 text-center text-sm text-ink-muted">
              No uploads in this filter yet — be the first to share!
            </p>
          )}
        </div>
      </section>

      {/* Drive perks */}
      <section aria-label="Drive storage perks" className="mt-6 mb-6">
        {perksUnlocked ? (
          <div className="rounded-2xl border border-forest/60 bg-forest-tint p-4">
            <h3 className="font-display flex items-center gap-2 text-xl font-bold text-forest">
              <PartyPopper className="h-5 w-5" /> Storage Perks Unlocked
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-forest/90">
              Thanks to your {contribution} verified contributions, you enjoy unlimited downloading privileges. Keep the
              vault alive!
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-forest/60 bg-forest-tint p-4">
            <h3 className="font-display text-xl font-bold text-forest">Earn Drive Storage Perks</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-forest/90">
              {user.driveConnected ? (
                <>
                  Connect your Google Drive and share at least {DRIVE_PERKS_THRESHOLD} verified papers to unlock
                  unlimited downloading privileges. You&apos;ve shared {contribution} of {DRIVE_CONTRIBUTION_REQUIRED}{" "}
                  so far.
                </>
              ) : (
                <>
                  Connect your Google Drive and share at least {DRIVE_PERKS_THRESHOLD} verified papers to unlock
                  unlimited downloading privileges.
                </>
              )}
            </p>
            {!user.driveConnected && (
              <button
                type="button"
                onClick={() => setScreen("profile")}
                className="mt-3 flex items-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-cream hover:bg-forest-deep"
              >
                <Cloud className="h-4 w-4" /> Connect Google Drive
              </button>
            )}
          </div>
        )}
      </section>

      <ResourceSheet
        resource={sheet}
        open={!!sheet}
        onOpenChange={(o) => !o && setSheet(null)}
        onOfflineChange={() => {
          setOfflineTick((t) => t + 1);
          refetchRecent();
          refetchMine();
        }}
      />
    </div>
  );
}
