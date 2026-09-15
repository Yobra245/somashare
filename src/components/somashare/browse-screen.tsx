"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { UnitDTO, ResourceDTO, ResourceType } from "@/lib/types";
import { useAppStore, type TypeFilter } from "./store";
import { ResourceCard } from "./resource-card";
import { ResourceSheet } from "./resource-sheet";
import { saveOffline, listOffline, openResource } from "./offline";
import { toast } from "@/hooks/use-toast";

const TYPE_CHIPS: { value: TypeFilter; label: string }[] = [
  { value: "ALL", label: "All Files" },
  { value: "LECTURE_NOTES", label: "Lecture Notes" },
  { value: "PAST_PAPER", label: "Past Papers" },
  { value: "REVISION_SLIDES", label: "Revision Slides" },
  { value: "ASSIGNMENT", label: "Assignments" },
];

interface BrowseScreenProps {
  online: boolean;
}

export function BrowseScreen({ online }: BrowseScreenProps) {
  const selectedUnitId = useAppStore((s) => s.selectedUnitId);
  const openUnit = useAppStore((s) => s.openUnit);
  const typeFilter = useAppStore((s) => s.typeFilter);
  const setTypeFilter = useAppStore((s) => s.setTypeFilter);
  const yearFilter = useAppStore((s) => s.yearFilter);
  const setYearFilter = useAppStore((s) => s.setYearFilter);
  const semFilter = useAppStore((s) => s.semFilter);
  const setSemFilter = useAppStore((s) => s.setSemFilter);
  const searchMode = useAppStore((s) => s.searchMode);
  const searchQuery = useAppStore((s) => s.searchQuery);

  const [sheet, setSheet] = useState<ResourceDTO | null>(null);
  const [offlineTick, setOfflineTick] = useState(0);

  const { data: unitsData } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const res = await fetch("/api/units");
      if (!res.ok) throw new Error("Failed to load units");
      return res.json() as Promise<{ units: UnitDTO[] }>;
    },
  });

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedUnitId) params.set("unitId", selectedUnitId);
    if (typeFilter !== "ALL") params.set("type", typeFilter);
    if (yearFilter !== "ALL") params.set("year", yearFilter);
    if (semFilter !== "ALL") params.set("semester", semFilter);
    if (searchMode && searchQuery) params.set("q", searchQuery);
    return params.toString();
  }, [selectedUnitId, typeFilter, yearFilter, semFilter, searchMode, searchQuery]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["resources", query],
    queryFn: async () => {
      const res = await fetch(`/api/resources?${query}`);
      if (!res.ok) throw new Error("Failed to load resources");
      return res.json() as Promise<{ resources: ResourceDTO[] }>;
    },
  });

  const resources = data?.resources ?? [];
  const unit = unitsData?.units.find((u) => u.id === selectedUnitId);

  const handleSaveOffline = async (r: ResourceDTO) => {
    if (isOffline(r.id)) {
      const url = await openResource(r.id).catch(() => null);
      if (url) {
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        return;
      }
    }
    try {
      await saveOffline(r);
      setOfflineTick((t) => t + 1);
      toast({ title: "Saved for offline", description: "Revise anytime — no internet needed." });
    } catch (err) {
      toast({ title: "Could not save", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    }
  };

  const isOffline = (id: string) => listOffline().some((e) => e.resource.id === id);

  return (
    <div className="px-5 pt-6">
      {/* Header: unit-specific or search/all view */}
      {unit ? (
        <header>
          <p className="text-xs font-bold tracking-widest text-pumpkin uppercase">{unit.department}</p>
          <h1 className="font-display mt-1 text-3xl font-bold leading-tight text-ink">
            {unit.code}: {unit.title}
          </h1>
        </header>
      ) : (
        <header>
          <p className="text-xs font-bold tracking-widest text-pumpkin uppercase">
            {searchMode ? "Search results" : "The Vault"}
          </p>
          <h1 className="font-display mt-1 text-3xl font-bold leading-tight text-ink">
            {searchMode ? `“${searchQuery}”` : "Browse all revision resources"}
          </h1>
        </header>
      )}

      {/* Unit picker (when no unit selected) */}
      {!unit && !searchMode && (
        <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1" role="listbox" aria-label="Filter by unit">
          <button
            type="button"
            onClick={() => openUnit(null)}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium ${!selectedUnitId ? "bg-forest text-cream" : "border border-line bg-card text-ink"}`}
          >
            All Units
          </button>
          {unitsData?.units.map((u) => (
            <button
              key={u.id}
              type="button"
              role="option"
              aria-selected={selectedUnitId === u.id}
              onClick={() => openUnit(u.id)}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium ${selectedUnitId === u.id ? "bg-forest text-cream" : "border border-line bg-card text-ink"}`}
            >
              {u.code}
            </button>
          ))}
        </div>
      )}

      {/* Type chips */}
      <div className="no-scrollbar -mx-5 mt-4 flex gap-2 overflow-x-auto px-5 pb-1" aria-label="Filter by document type">
        {TYPE_CHIPS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTypeFilter(t.value)}
            className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              typeFilter === t.value ? "bg-forest text-cream" : "border border-line bg-card text-ink hover:border-forest/40"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Year / Sem filters */}
      <div className="mt-3 flex gap-2">
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="h-9 w-auto gap-1 rounded-lg border-line bg-card px-3 text-sm" aria-label="Filter by year">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Years</SelectItem>
            <SelectItem value="2025">Year: 2025</SelectItem>
            <SelectItem value="2024">Year: 2024</SelectItem>
            <SelectItem value="2023">Year: 2023</SelectItem>
            <SelectItem value="2022">Year: 2022</SelectItem>
          </SelectContent>
        </Select>
        <Select value={semFilter} onValueChange={setSemFilter}>
          <SelectTrigger className="h-9 w-auto gap-1 rounded-lg border-line bg-card px-3 text-sm" aria-label="Filter by semester">
            <SelectValue placeholder="Sem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Sems</SelectItem>
            <SelectItem value="1">Sem: 1</SelectItem>
            <SelectItem value="2">Sem: 2</SelectItem>
          </SelectContent>
        </Select>
        {(yearFilter !== "ALL" || semFilter !== "ALL" || typeFilter !== "ALL") && (
          <button
            type="button"
            onClick={() => {
              setTypeFilter("ALL");
              setYearFilter("ALL");
              setSemFilter("ALL");
            }}
            className="ml-auto text-sm font-medium text-pumpkin-deep hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {/* Results */}
      <section aria-label="Revision resources" className="mt-5 pb-6">
        <h2 className="text-xs font-bold tracking-widest text-ink">
          FOUND {resources.length} REVISION RESOURCE{resources.length === 1 ? "" : "S"}
        </h2>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-forest" />
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {resources.map((r) => (
              <ResourceCard key={r.id} resource={r} offlineTick={offlineTick} onOpen={setSheet} onDownload={handleSaveOffline} />
            ))}
            {resources.length === 0 && (
              <div className="rounded-xl border border-dashed border-line bg-card p-8 text-center">
                <p className="font-display text-lg font-semibold text-ink">Nothing here yet</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {online
                    ? "No resources match these filters. Try clearing filters or upload the first one."
                    : "You're offline — saved files remain available on the Profile tab."}
                </p>
              </div>
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
          refetch();
        }}
      />
    </div>
  );
}
