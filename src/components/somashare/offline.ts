"use client";

/**
 * Offline library — lets students save vault files for offline revision.
 *
 * Files are stored in the Cache API ("soma-downloads", shared with the
 * service worker) and indexed in localStorage together with a metadata
 * snapshot so the Saved list renders even with no network.
 */
import type { ResourceDTO } from "@/lib/types";

const DOWNLOAD_CACHE = "soma-downloads";
const INDEX_KEY = "soma_offline_index_v1";

export interface OfflineEntry {
  resource: ResourceDTO; // metadata snapshot
  savedAt: string;
  bytes: number;
}

function readIndex(): OfflineEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) ?? "[]") as OfflineEntry[];
  } catch {
    return [];
  }
}

function writeIndex(entries: OfflineEntry[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
}

export function downloadUrl(resourceId: string, inline = false): string {
  return `/api/resources/${resourceId}/download${inline ? "?inline=1" : ""}`;
}

export function listOffline(): OfflineEntry[] {
  return readIndex().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function isOfflineSaved(resourceId: string): boolean {
  return readIndex().some((e) => e.resource.id === resourceId);
}

export async function saveOffline(resource: ResourceDTO): Promise<OfflineEntry> {
  const cache = await caches.open(DOWNLOAD_CACHE);
  const url = downloadUrl(resource.id);
  const response = await fetch(url);
  if (!response.ok) throw new Error("Could not fetch the file for saving.");

  await cache.put(url, response);

  const entry: OfflineEntry = {
    resource,
    savedAt: new Date().toISOString(),
    bytes: resource.fileSize,
  };
  const index = readIndex().filter((e) => e.resource.id !== resource.id);
  writeIndex([entry, ...index]);
  return entry;
}

export async function removeOffline(resourceId: string): Promise<void> {
  const cache = await caches.open(DOWNLOAD_CACHE);
  await cache.delete(downloadUrl(resource.id));
  await cache.delete(downloadUrl(resource.id, true));
  writeIndex(readIndex().filter((e) => e.resource.id !== resourceId));
}

/** Open a saved (or online) resource. Returns a blob URL for viewing. */
export async function openResource(resourceId: string): Promise<string> {
  // Try the cached copy first so this works fully offline.
  const cache = await caches.open(DOWNLOAD_CACHE);
  const cached = await cache.match(downloadUrl(resourceId));
  const response = cached ?? (await fetch(downloadUrl(resourceId, true)));
  if (!response.ok) throw new Error("File unavailable.");
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/** Save-to-device download (browser download, works online). */
export function saveToDevice(resourceId: string): void {
  const a = document.createElement("a");
  a.href = downloadUrl(resourceId);
  a.download = "";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
