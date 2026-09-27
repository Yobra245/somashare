"use client";

import { Badge } from "@/components/ui/badge";
import { Download, WifiOff, BadgeCheck } from "lucide-react";
import type { ResourceDTO, ResourceType } from "@/lib/types";
import { RESOURCE_TYPE_LABELS } from "@/lib/types";
import { isOfflineSaved, formatBytes } from "./offline";

/** Tint classes per resource type (matches Figma badge styling). */
export function typeBadgeClass(type: ResourceType): string {
  switch (type) {
    case "LECTURE_NOTES":
      return "bg-forest-tint text-forest";
    case "PAST_PAPER":
      return "bg-pumpkin-tint text-pumpkin-deep";
    case "REVISION_SLIDES":
      return "bg-butter text-butter-deep";
    case "ASSIGNMENT":
      return "bg-muted text-ink-muted";
  }
}

interface ResourceCardProps {
  resource: ResourceDTO;
  onOpen: (r: ResourceDTO) => void;
  onDownload?: (r: ResourceDTO) => void;
  showUnitCode?: boolean;
  offlineTick?: number; // bumped when offline index changes
}

export function ResourceCard({ resource, onOpen, onDownload, showUnitCode = true, offlineTick = 0 }: ResourceCardProps) {
  const saved = isOfflineSaved(resource.id);
  void offlineTick; // re-render trigger only

  const initials = resource.uploaderName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  return (
    <article
      onClick={() => onOpen(resource)}
      className="cursor-pointer rounded-2xl border border-line bg-card p-4 transition-colors hover:border-forest/40 active:bg-cream-deep/50"
    >
      <div className="flex items-start justify-between gap-2">
        <Badge variant="secondary" className={`${typeBadgeClass(resource.type)} rounded-md border-0 px-2.5 py-1 text-[11px] font-semibold tracking-wide`}>
          {RESOURCE_TYPE_LABELS[resource.type].toUpperCase()}
        </Badge>
        <div className="flex items-center gap-1.5">
          {!resource.verified && (
            <span className="rounded-md bg-cream-deep px-1.5 py-0.5 text-[10px] font-semibold text-ink-muted" title="Awaiting moderator review">
              PENDING
            </span>
          )}
          {saved && <WifiOff className="h-3.5 w-3.5 text-forest" aria-label="Available offline" />}
          {showUnitCode && <span className="text-xs font-medium text-ink-muted">{resource.unit.code}</span>}
        </div>
      </div>

      <h3 className="font-display mt-2.5 text-lg font-bold leading-snug text-ink">{resource.title}</h3>
      <p className="mt-1 text-xs text-ink-muted">{formatBytes(resource.fileSize)} · {resource.academicYear} · {resource.examYear} Sem {resource.semester}</p>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-forest text-[9px] font-semibold text-cream">
            {initials || "?"}
          </span>
          <span className="truncate text-sm text-ink-muted">by {resource.uploaderName}</span>
          {resource.verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-forest" aria-label="Verified contributor" />}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            <Download className="h-3.5 w-3.5" />
            {resource.downloadCount} dls
          </span>
          {onDownload && (
            <button
              type="button"
              aria-label={saved ? "Saved for offline" : "Save for offline"}
              className={`rounded-full p-1.5 transition-colors ${saved ? "bg-forest text-cream" : "bg-forest-tint text-forest hover:bg-forest hover:text-cream"}`}
              onClick={(e) => {
                e.stopPropagation();
                onDownload(resource);
              }}
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
