"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Cloud, UploadCloud, Loader2, FileUp, X } from "lucide-react";
import type { UnitDTO, ResourceType } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { DriveConnectDialog } from "./drive-connect-dialog";
import { useAppStore } from "./store";
import type { SessionUser } from "@/lib/types";

interface UploadScreenProps {
  user: SessionUser;
  onPublished: () => void;
}

const DOC_TYPES: { value: ResourceType; label: string }[] = [
  { value: "PAST_PAPER", label: "Past Paper" },
  { value: "LECTURE_NOTES", label: "Lecture Notes" },
  { value: "REVISION_SLIDES", label: "Revision Slides" },
  { value: "ASSIGNMENT", label: "Assignment" },
];
const ACADEMIC_YEARS = ["Year 1", "Year 2", "Year 3", "Year 4", "Year 5"];
const EXAM_YEARS = ["2025", "2024", "2023", "2022", "2021"];
const SEMESTERS = [
  { value: "1", label: "Semester 1" },
  { value: "2", label: "Semester 2" },
];

export function UploadScreen({ user, onPublished }: UploadScreenProps) {
  const [unitId, setUnitId] = useState("");
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState<ResourceType>("PAST_PAPER");
  const [academicYear, setAcademicYear] = useState("Year 3");
  const [examYear, setExamYear] = useState("2025");
  const [semester, setSemester] = useState("1");
  const [consent, setConsent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [driveDialog, setDriveDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const setScreen = useAppStore((s) => s.setScreen);

  const { data: unitsData } = useQuery({
    queryKey: ["units"],
    queryFn: async () => {
      const res = await fetch("/api/units");
      if (!res.ok) throw new Error("Failed to load units");
      return (await res.json()) as { units: UnitDTO[] };
    },
  });

  const units = unitsData?.units ?? [];
  const selectedUnit = units.find((u) => u.id === unitId);

  const pickFile = (f: File | null) => {
    if (f && f.size > 25 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 25 MB.", variant: "destructive" });
      return;
    }
    setFile(f);
  };

  const publish = async () => {
    if (!selectedUnit) {
      toast({ title: "Choose a course unit", variant: "destructive" });
      return;
    }
    if (!title.trim()) {
      toast({ title: "Add a document title", variant: "destructive" });
      return;
    }
    if (!user.driveConnected) {
      setDriveDialog(true);
      return;
    }
    if (!consent) {
      toast({ title: "Consent required", description: "Agree to the Storage Sharing Consent to publish.", variant: "destructive" });
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.set("unitId", selectedUnit.id);
      form.set("title", title.trim());
      form.set("type", docType);
      form.set("academicYear", academicYear);
      form.set("examYear", examYear);
      form.set("semester", semester);
      form.set("consent", "1");
      if (file) form.set("file", file);

      const res = await fetch("/api/resources", { method: "POST", body: form });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Publish failed");

      toast({
        title: "Published to the Vault!",
        description: "Fellow students can now revise from your contribution.",
      });
      await queryClient.invalidateQueries({ queryKey: ["resources"] });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      onPublished();
    } catch (err) {
      toast({ title: "Could not publish", description: err instanceof Error ? err.message : "Try again.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col px-5 pt-6">
      <header>
        <p className="text-xs font-bold tracking-widest text-forest">CONTRIBUTE MATERIALS</p>
        <h1 className="font-display mt-1 text-3xl font-bold text-ink">Upload Document</h1>
      </header>

      <div className="mt-6 space-y-5">
        {/* Unit */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-ink">Unit Code &amp; Title</Label>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger className="h-12 w-full rounded-xl border-line bg-card text-base">
              <SelectValue placeholder="Select course unit" />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {units.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.code}: {u.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="doc-title" className="text-sm font-semibold text-ink">
            Document Title
          </Label>
          <Input
            id="doc-title"
            placeholder="e.g. 2024 Nov End-Semester Past Paper"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-12 rounded-xl border-line bg-card text-base"
          />
        </div>

        {/* Type + Academic year */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-ink">Document Type</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as ResourceType)}>
              <SelectTrigger className="h-12 w-full rounded-xl border-line bg-card text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-ink">Academic Year</Label>
            <Select value={academicYear} onValueChange={setAcademicYear}>
              <SelectTrigger className="h-12 w-full rounded-xl border-line bg-card text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACADEMIC_YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Exam year + Semester */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-ink">Calendar Year</Label>
            <Select value={examYear} onValueChange={setExamYear}>
              <SelectTrigger className="h-12 w-full rounded-xl border-line bg-card text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXAM_YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-ink">Semester</Label>
            <Select value={semester} onValueChange={setSemester}>
              <SelectTrigger className="h-12 w-full rounded-xl border-line bg-card text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEMESTERS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* File picker */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold text-ink">File (PDF, DOCX, PPT, images — max 25 MB)</Label>
          {file ? (
            <div className="flex items-center justify-between rounded-xl border border-forest/40 bg-forest-tint px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <FileUp className="h-5 w-5 shrink-0 text-forest" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                  <p className="text-xs text-ink-muted">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              </div>
              <button type="button" aria-label="Remove file" onClick={() => setFile(null)} className="rounded-full p-1 text-ink-muted hover:bg-cream-deep">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-card px-4 py-4 text-sm font-medium text-ink-muted transition-colors hover:border-forest/50 hover:text-forest"
            >
              <UploadCloud className="h-5 w-5" /> Choose a file from this device
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </div>

        {/* Google Drive consent */}
        <section aria-label="Google Drive sharing consent" className="rounded-2xl border border-pumpkin/70 bg-pumpkin-tint p-4">
          <h2 className="font-display flex items-center gap-2 text-lg font-bold text-pumpkin-deep">
            <Cloud className="h-5 w-5" /> Google Drive Sharing Consent
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/90">
            To keep SomaShare free and peer-led, files are hosted on shared Google Drive storage. By uploading, you
            consent to allow SomaShare students view-only access to this specific file. We will never scan or modify any
            other contents of your Drive.
          </p>
          {!user.driveConnected && (
            <p className="mt-2 rounded-lg bg-white/60 px-3 py-2 text-xs font-medium text-pumpkin-deep">
              Your Google Drive isn&apos;t connected yet — tap Publish to connect it first.
            </p>
          )}
          <label className="mt-3 flex cursor-pointer items-center gap-2.5">
            <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="border-pumpkin-deep data-[state=checked]:bg-pumpkin data-[state=checked]:border-pumpkin" />
            <span className="text-sm font-semibold text-ink">I agree to the Storage Sharing Consent</span>
          </label>
        </section>
      </div>

      {/* Publish */}
      <div className="sticky bottom-0 mt-6 bg-cream pb-4 pt-3">
        <Button
          onClick={publish}
          disabled={busy}
          className="h-13 w-full rounded-xl bg-forest py-4 text-base font-semibold text-cream shadow-sm hover:bg-forest-deep"
        >
          {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UploadCloud className="mr-2 h-5 w-5" />}
          {busy ? "Publishing…" : "Publish to Vault"}
        </Button>
      </div>

      <DriveConnectDialog
        open={driveDialog}
        onOpenChange={setDriveDialog}
        studentEmail={user.driveEmail ?? user.email}
        onConnected={async () => {
          await queryClient.invalidateQueries({ queryKey: ["me"] });
          if (consent) publish();
        }}
      />
    </div>
  );
}
