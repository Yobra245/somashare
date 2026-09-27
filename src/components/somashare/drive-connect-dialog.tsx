"use client";

/**
 * Google Drive connection dialog.
 *
 * Sandbox mode (no GOOGLE_CLIENT_ID configured): shows a Google-style
 * consent card and records the Drive linkage via /api/drive — simulating
 * the OAuth "Allow" step for the drive.file scope.
 *
 * Production: swap the body of handleAllow for the Google Identity
 * Services redirect (see src/lib/storage.ts header notes).
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Cloud, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface DriveConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentEmail: string;
  onConnected: () => void;
}

export function DriveConnectDialog({ open, onOpenChange, studentEmail, onConnected }: DriveConnectDialogProps) {
  const [busy, setBusy] = useState(false);

  const handleAllow = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", email: studentEmail }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Connection failed");
      }
      toast({ title: "Google Drive connected", description: "Your storage now powers the vault. Karibu!" });
      onConnected();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Could not connect Drive",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-auto max-w-sm rounded-2xl bg-card p-0">
        <DialogHeader className="border-b border-line px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-base font-semibold text-ink">SomaShare wants additional access</DialogTitle>
          <DialogDescription className="text-sm text-ink-muted">
            to your Google Account&nbsp;
            <span className="font-medium text-ink">{studentEmail}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          <div className="flex items-start gap-3">
            <Cloud className="mt-0.5 h-5 w-5 shrink-0 text-pumpkin" />
            <div>
              <p className="text-sm font-medium text-ink">See, edit, create, and delete only the specific Google Drive files you use with this app</p>
              <p className="mt-0.5 text-xs text-ink-muted">drive.file scope — SomaShare can never browse or modify the rest of your Drive.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest" />
            <p className="text-xs text-ink-muted">
              Uploaded revision material is shared view-only with fellow students. This keeps SomaShare free — every student brings their own storage.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy} className="text-ink-muted">
              Cancel
            </Button>
            <Button onClick={handleAllow} disabled={busy} className="bg-forest text-cream hover:bg-forest-deep">
              {busy ? "Connecting…" : "Allow"}
            </Button>
          </div>

          <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-ink-muted">
            Sandbox note: Google OAuth credentials are not configured in this environment, so this consent step is
            simulated. In production, students grant the <span className="font-mono">drive.file</span> scope during
            Google sign-in — one flow covers identity and storage contribution.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
