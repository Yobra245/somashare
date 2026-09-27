"use client";

/**
 * Owner tools — visible only to ADMIN_EMAILS members.
 *  - Moderation queue: review (verify) or delete uploaded resources.
 *  - Mailing list: browse signups, export CSV, send an update.
 */
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BadgeCheck, Trash2, Download, Send, Loader2, ShieldCheck, Users, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBytes } from "./offline";
import type { ResourceType } from "@/lib/types";
import { RESOURCE_TYPE_LABELS } from "@/lib/types";

interface AdminResource {
  id: string;
  title: string;
  type: string;
  uploaderName: string;
  uploaderEmail: string | null;
  verified: boolean;
  fileName: string;
  fileSize: number;
  createdAt: string;
  unit: { id: string; code: string; title: string; shortLabel: string };
}

interface AdminSubscriber {
  id: string;
  email: string;
  name: string;
  source: string;
  createdAt: string;
}

export function AdminPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);

  const pending = useQuery({
    queryKey: ["admin", "resources", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/admin/resources?status=pending");
      if (!res.ok) throw new Error("Failed to load the moderation queue");
      return (await res.json()) as { resources: AdminResource[] };
    },
  });

  const subscribers = useQuery({
    queryKey: ["admin", "subscribers"],
    queryFn: async () => {
      const res = await fetch("/api/admin/subscribers");
      if (!res.ok) throw new Error("Failed to load the mailing list");
      return (await res.json()) as { count: number; subscribers: AdminSubscriber[] };
    },
  });

  const act = async (id: string, action: "verify" | "delete") => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/resources/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      toast({ title: action === "verify" ? "Resource verified ✓" : "Resource deleted" });
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      await queryClient.invalidateQueries({ queryKey: ["resources"] });
    } catch (err) {
      toast({
        title: "Action failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  const broadcast = async () => {
    if (!subject.trim() || !body.trim()) {
      toast({ title: "Subject and message are required", variant: "destructive" });
      return;
    }
    setBroadcastBusy(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      const data = (await res.json()) as { sent?: number; failed?: number; dryRun?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Broadcast failed");
      toast({
        title: data.dryRun ? "Dry run complete" : "Update sent!",
        description:
          data.dryRun
            ? "No mailer configured — nothing was actually sent."
            : `${data.sent ?? 0} delivered, ${data.failed ?? 0} failed.`,
      });
      setBroadcastOpen(false);
      setSubject("");
      setBody("");
    } catch (err) {
      toast({
        title: "Broadcast failed",
        description: err instanceof Error ? err.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBroadcastBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Moderation queue */}
      <section aria-label="Moderation queue" className="rounded-xl border border-pumpkin/50 bg-card px-4 py-3.5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-pumpkin-deep">
          <ShieldCheck className="h-4.5 w-4.5" /> MODERATION QUEUE
          <span className="ml-auto text-xs font-semibold text-ink-muted">
            {pending.data?.resources.length ?? 0} pending
          </span>
        </h3>
        <div className="mt-3 space-y-2.5">
          {pending.isLoading && (
            <p className="flex items-center gap-2 text-sm text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading queue…
            </p>
          )}
          {pending.data?.resources.map((r) => (
            <div key={r.id} className="rounded-lg border border-line bg-cream-deep/40 p-3">
              <p className="truncate text-sm font-semibold text-ink">{r.title}</p>
              <p className="mt-0.5 text-xs text-ink-muted">
                {r.unit.code} · {RESOURCE_TYPE_LABELS[r.type as ResourceType] ?? r.type} ·{" "}
                {formatBytes(r.fileSize)} · by {r.uploaderName}
                {r.uploaderEmail ? ` (${r.uploaderEmail})` : ""}
              </p>
              <div className="mt-2.5 flex gap-2">
                <Button
                  size="sm"
                  onClick={() => act(r.id, "verify")}
                  disabled={busyId === r.id}
                  className="h-9 rounded-lg bg-forest text-xs font-semibold text-cream hover:bg-forest-deep"
                >
                  {busyId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="mr-1 h-3.5 w-3.5" />}
                  Verify
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act(r.id, "delete")}
                  disabled={busyId === r.id}
                  className="h-9 rounded-lg border-line text-xs font-semibold text-pumpkin-deep hover:bg-pumpkin-tint"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
          {pending.data && pending.data.resources.length === 0 && (
            <p className="rounded-lg border border-dashed border-line bg-cream-deep/40 p-3 text-center text-xs text-ink-muted">
              Queue is clear — every upload has been reviewed. 🎉
            </p>
          )}
        </div>
      </section>

      {/* Mailing list */}
      <section aria-label="Mailing list" className="rounded-xl border border-line bg-card px-4 py-3.5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-forest">
          <Users className="h-4.5 w-4.5" /> MAILING LIST
          <span className="ml-auto text-xs font-semibold text-ink-muted">{subscribers.data?.count ?? 0} members</span>
        </h3>
        <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto pr-1">
          {subscribers.data?.subscribers.slice(0, 20).map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-cream-deep/40 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-ink">{s.email}</p>
                <p className="text-[11px] text-ink-muted">
                  {s.name} · {new Date(s.createdAt).toLocaleDateString()}
                </p>
              </div>
              <a
                href={`mailto:${s.email}`}
                aria-label={`Email ${s.name}`}
                className="rounded-full p-1.5 text-ink-muted hover:bg-cream-deep hover:text-forest"
              >
                <Mail className="h-3.5 w-3.5" />
              </a>
            </div>
          ))}
          {subscribers.data?.subscribers.length === 0 && (
            <p className="rounded-lg border border-dashed border-line bg-cream-deep/40 p-3 text-center text-xs text-ink-muted">
              No signups yet — share the &ldquo;Join the community&rdquo; page.
            </p>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open("/api/admin/subscribers?format=csv", "_blank")}
            className="h-9 flex-1 rounded-lg border-line text-xs font-semibold text-ink hover:bg-muted"
          >
            <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button
            size="sm"
            onClick={() => setBroadcastOpen(true)}
            className="h-9 flex-1 rounded-lg bg-forest text-xs font-semibold text-cream hover:bg-forest-deep"
          >
            <Send className="mr-1 h-3.5 w-3.5" /> Send update
          </Button>
        </div>
      </section>

      {/* Broadcast dialog */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="mx-auto max-w-sm rounded-2xl bg-cream">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-ink">Send an update</DialogTitle>
            <DialogDescription className="text-sm text-ink-muted">
              Goes to all {subscribers.data?.count ?? 0} mailing-list members via email.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="b-subject" className="text-sm font-semibold text-ink">
                Subject
              </Label>
              <Input
                id="b-subject"
                placeholder="Fresh past papers for EET 300 🎉"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-11 rounded-xl border-line bg-card"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-body" className="text-sm font-semibold text-ink">
                Message
              </Label>
              <Textarea
                id="b-body"
                rows={5}
                placeholder="Hi! We just added 12 new past papers for second-year electrical units…"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="rounded-xl border-line bg-card"
              />
            </div>
            <Button
              onClick={broadcast}
              disabled={broadcastBusy || !subject.trim() || !body.trim()}
              className="h-12 w-full rounded-xl bg-forest text-base font-semibold text-cream hover:bg-forest-deep"
            >
              {broadcastBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {broadcastBusy ? "Sending…" : "Send to list"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
