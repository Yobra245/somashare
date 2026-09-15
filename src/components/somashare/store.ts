"use client";

/** Client-side app state (screens, filters, search) — Zustand store. */
import { create } from "zustand";
import type { ResourceType } from "@/lib/types";

export type Screen = "home" | "browse" | "upload" | "profile";
export type TypeFilter = "ALL" | ResourceType;

interface AppState {
  screen: Screen;
  selectedUnitId: string | null; // null in browse => all units
  unitShortLabel: string | null; // chip filter on home ("EET Elec")
  typeFilter: TypeFilter;
  yearFilter: string; // "ALL" | "2024"...
  semFilter: string; // "ALL" | "1" | "2"
  searchQuery: string;
  searchMode: boolean;

  setScreen: (s: Screen) => void;
  openUnit: (unitId: string | null) => void;
  setChip: (shortLabel: string | null) => void;
  setTypeFilter: (t: TypeFilter) => void;
  setYearFilter: (y: string) => void;
  setSemFilter: (s: string) => void;
  setSearchQuery: (q: string) => void;
  setSearchMode: (m: boolean) => void;
  resetBrowse: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  screen: "home",
  selectedUnitId: null,
  unitShortLabel: null,
  typeFilter: "ALL",
  yearFilter: "ALL",
  semFilter: "ALL",
  searchQuery: "",
  searchMode: false,

  setScreen: (screen) => set({ screen }),
  openUnit: (selectedUnitId) =>
    set({ selectedUnitId, searchMode: false, typeFilter: "ALL", yearFilter: "ALL", semFilter: "ALL" }),
  setChip: (unitShortLabel) =>
    set({ unitShortLabel, selectedUnitId: null, typeFilter: "ALL", yearFilter: "ALL", semFilter: "ALL" }),
  setTypeFilter: (typeFilter) => set({ typeFilter }),
  setYearFilter: (yearFilter) => set({ yearFilter }),
  setSemFilter: (semFilter) => set({ semFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSearchMode: (searchMode) => set({ searchMode, selectedUnitId: null }),
  resetBrowse: () =>
    set({ selectedUnitId: null, typeFilter: "ALL", yearFilter: "ALL", semFilter: "ALL", searchMode: false, searchQuery: "" }),
}));
