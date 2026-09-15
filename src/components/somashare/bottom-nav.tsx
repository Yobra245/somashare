"use client";

import { House, BookOpen, PlusCircle, UserRound } from "lucide-react";
import type { Screen } from "./store";

interface BottomNavProps {
  screen: Screen;
  onNavigate: (s: Screen) => void;
}

const items: { key: Screen; label: string; icon: typeof House }[] = [
  { key: "home", label: "Home", icon: House },
  { key: "browse", label: "Browse", icon: BookOpen },
  { key: "upload", label: "Upload", icon: PlusCircle },
  { key: "profile", label: "Profile", icon: UserRound },
];

export function BottomNav({ screen, onNavigate }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-20 border-t border-line bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-cream/85"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {items.map(({ key, label, icon: Icon }) => {
          const active = screen === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onNavigate(key)}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors ${
                active ? "font-semibold text-forest" : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
