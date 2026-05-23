"use client";

import { cn } from "@/lib/utils";
import { Check, Globe, KeyRound, Lock, Users } from "lucide-react";

export type GroupVisibility = "PUBLIC_LISTED" | "MEMBERS_VISIBLE" | "INVITE_ONLY";
export type JoinMode = "OPEN" | "REQUEST" | "INVITE_ONLY";

export interface VisibilityPreset {
  id: "public_open" | "public_request" | "members" | "invite_only";
  title: string;
  posture: string;
  body: string;
  visibility: GroupVisibility;
  joinMode: JoinMode;
  icon: typeof Globe;
}

export const PRESETS: VisibilityPreset[] = [
  {
    id: "public_open",
    title: "Public · Open",
    posture: "Anyone in, anytime",
    body: "Listed in the directory. New members join the moment they hit the button.",
    visibility: "PUBLIC_LISTED",
    joinMode: "OPEN",
    icon: Globe,
  },
  {
    id: "public_request",
    title: "Public · Request",
    posture: "Discoverable, but you decide",
    body: "Listed in the directory. Admins approve each request to join.",
    visibility: "PUBLIC_LISTED",
    joinMode: "REQUEST",
    icon: Users,
  },
  {
    id: "members",
    title: "Private · Members",
    posture: "Hidden from strangers",
    body: "Not in the directory. Logged-in members can find it and request to join.",
    visibility: "MEMBERS_VISIBLE",
    joinMode: "REQUEST",
    icon: KeyRound,
  },
  {
    id: "invite_only",
    title: "Invite only",
    posture: "Vouched circles",
    body: "Completely hidden. Members join via an invite link or admin email.",
    visibility: "INVITE_ONLY",
    joinMode: "INVITE_ONLY",
    icon: Lock,
  },
];

export function matchPreset(visibility: GroupVisibility, joinMode: JoinMode): VisibilityPreset | null {
  return PRESETS.find((p) => p.visibility === visibility && p.joinMode === joinMode) ?? null;
}

interface Props {
  visibility: GroupVisibility;
  joinMode: JoinMode;
  onChange: (next: { visibility: GroupVisibility; joinMode: JoinMode }) => void;
}

export function VisibilityPresetPicker({ visibility, joinMode, onChange }: Props) {
  const active = matchPreset(visibility, joinMode);

  return (
    <div role="radiogroup" aria-label="Group visibility" className="grid gap-3 sm:grid-cols-2">
      {PRESETS.map((p) => {
        const isActive = active?.id === p.id;
        const Icon = p.icon;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange({ visibility: p.visibility, joinMode: p.joinMode })}
            className={cn(
              "group relative flex flex-col gap-2 rounded-md border bg-background p-4 text-left transition-all",
              "hover:-translate-y-0.5 hover:shadow-sm",
              isActive
                ? "border-foreground shadow-sm"
                : "border-input",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <Icon
                className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
                aria-hidden
              />
              {isActive && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                  <Check className="h-3 w-3" /> Selected
                </span>
              )}
            </div>

            <p className="font-display text-xs uppercase tracking-[0.18em] text-muted-foreground">
              {p.posture}
            </p>

            <h3 className="font-display text-lg font-medium leading-tight tracking-tight">
              {p.title}
            </h3>

            <div className="h-px w-8 bg-foreground/30" aria-hidden />

            <p className="text-sm leading-snug text-muted-foreground">
              {p.body}
            </p>
          </button>
        );
      })}
    </div>
  );
}
