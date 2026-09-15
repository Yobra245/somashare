"use client";

import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, WifiOff, Trash2, ExternalLink, BadgeCheck, FileText, Cloud } from "lucide-react";
import type { ResourceDTO } from "@/lib/types";
import { RESOURCE_TYPE_LABELS } from "@/lib/types";
import { typeBadgeClass } from "./resource-card";
import { isOfflineSaved, saveOffline, removeOffline, openResource, saveToDevice, formatBytes } from "./offline";
import { toast } from "@/hooks/use-toast";

interface ResourceSheetProps {
  resource: ResourceDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOfflineChange?: () => void;
}

export function ResourceSheet({ resource, open, onOpenChange, onOfflineChange }: ResourceSheetProps) {
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (resource) setSaved(isOfflineSaved(resource.id));
  }, [resource, open]);

  if (!resource) return null;

  const handleSave = async () => {
    if (!resource) return;
    setBusy(true);
    try {
      if (saved) {
        await removeOffline(resource.id);
        setSaved(false);
        toast({ title: "Removed from offline library" });
      } else {
        await saveOffline(resource);
        setSaved(true);
        toast({ title: "Saved for offline", description: "You can revise this even without internet." });
      }
      onOfflineChange?.();
    } catch (err) {
      toast({
        title: saved ? "Could not remove" : "Could not save",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleOpenFile = async () => {
    setBusy(true);
    try {
      const url = await openResource(resource.id);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast({ title: "File unavailable", description: "Save it for offline first, then try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-md bg-cream">
        <DrawerHeader className="pb-2 text-left">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className={`${typeBadgeClass(resource.type)} rounded-md border-0 px-2.5 py-1 text-[11px] font-semibold`}>
              {RESOURCE_TYPE_LABELS[resource.type].toUpperCase()}
            </Badge>
            <span className="text-xs font-medium text-ink-muted">{resource.unit.code}</span>
          </div>
          <DrawerTitle className="font-display text-xl font-bold leading-snug text-ink">{resource.title}</DrawerTitle>
          <DrawerDescription className="text-sm">
            {resource.unit.department} · {resource.academicYear} · {resource.examYear} · Semester {resource.semester}
          </DrawerDescription>
        </DrawerHeader>

        <div className="space-y-3 px-4 pb-8">
          <div className="rounded-xl border border-line bg-card p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-ink-muted">Contributed by</span>
              <span className="flex items-center gap-1 font-medium text-ink">
                {resource.uploaderName}
                {resource.verified && <BadgeCheck className="h-3.5 w-3.5 text-forest" aria-label="Verified" />}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-ink-muted">File</span>
              <span className="font-medium text-ink">{formatBytes(resource.fileSize)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-ink-muted">Downloads</span>
              <span className="font-medium text-ink">{resource.downloadCount}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-ink-muted">Storage</span>
              <span className="flex items-center gap-1 font-medium text-ink">
                <Cloud className="h-3.5 w-3.5 text-pumpkin" /> Google Drive (peer)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button onClick={handleOpenFile} disabled={busy} className="bg-forest text-cream hover:bg-forest-deep">
              <FileText className="mr-2 h-4 w-4" /> Open
            </Button>
            <Button
              onClick={() => {
                saveToDevice(resource.id);
              }}
              variant="outline"
              className="border-line bg-card text-ink hover:bg-muted"
            >
              <ExternalLink className="mr-2 h-4 w-4" /> Device
            </Button>
          </div>

          <Button
            onClick={handleSave}
            disabled={busy}
            variant={saved ? "outline" : "default"}
            className={`w-full ${saved ? "border-line bg-card text-ink hover:bg-muted" : "bg-forest-tint text-forest hover:bg-forest hover:text-cream"}`}
          >
            {saved ? (
              <>
                <Trash2 className="mr-2 h-4 w-4" /> Remove from offline library
              </>
            ) : (
              <>
                <WifiOff className="mr-2 h-4 w-4" /> Save for offline revision
              </>
            )}
          </Button>

          {saved && (
            <p className="flex items-center justify-center gap-1.5 text-center text-xs text-forest">
              <WifiOff className="h-3 w-3" /> Available offline — open it anytime, even without internet.
            </p>
          )}
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-ink-muted">
            <Download className="h-3 w-3" /> Files stay on the contributor&apos;s Google Drive — view-only access.
          </p>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
