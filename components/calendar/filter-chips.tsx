"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";

interface GroupChip { id: string; name: string; color: string }

import { UNIVERSAL_ACCESSIBILITY_FLAGS } from "@/lib/schemas";

const RSVP_OPTIONS = ["GOING", "INTERESTED", "MAYBE"] as const;
// Calendar/map filter chips show the universal accessibility flags. Per-group
// custom flags (e.g. "wheelchair_friendly") are filter-able via tag chips on the
// group's own events page; surfacing every community's vocabulary here would
// produce a noisy chip row across mixed groups.
const A11Y_OPTIONS = UNIVERSAL_ACCESSIBILITY_FLAGS;

interface Props {
  groups: GroupChip[];
  showMyGroupsToggle?: boolean;
  myGroupIds?: string[];
  showRsvpFilter?: boolean;
  showAccessibilityFilter?: boolean;
}

export function FilterChips({
  groups,
  showMyGroupsToggle = true,
  myGroupIds = [],
  showRsvpFilter = true,
  showAccessibilityFilter = true,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const selectedGroups = new Set(params.getAll("g"));
  const selectedRsvp = new Set(params.getAll("r"));
  const selectedA11y = new Set(params.getAll("a"));
  const mineOnly = params.get("mine") === "1";

  function push(next: URLSearchParams) {
    router.push(`?${next.toString()}`);
  }

  function toggleParam(key: string, value: string, current: Set<string>) {
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    const after = current.has(value)
      ? Array.from(current).filter((v) => v !== value)
      : [...Array.from(current), value];
    after.forEach((v) => next.append(key, v));
    push(next);
  }

  function toggleMine() {
    const next = new URLSearchParams(params.toString());
    if (mineOnly) next.delete("mine");
    else next.set("mine", "1");
    push(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {showMyGroupsToggle && myGroupIds.length > 0 && (
          <button onClick={toggleMine} className="focus:outline-none">
            <Badge variant={mineOnly ? "default" : "outline"} className="cursor-pointer">My groups only</Badge>
          </button>
        )}
        {groups.map((g) => {
          const isActive = selectedGroups.size === 0 || selectedGroups.has(g.id);
          return (
            <button key={g.id} onClick={() => toggleParam("g", g.id, selectedGroups)} className="focus:outline-none">
              <Badge
                variant={isActive ? "default" : "outline"}
                style={
                  isActive
                    ? { backgroundColor: g.color, borderColor: g.color, color: "white" }
                    : { borderColor: g.color, color: g.color }
                }
                className="cursor-pointer"
              >
                {g.name}
              </Badge>
            </button>
          );
        })}
      </div>
      {(showRsvpFilter || showAccessibilityFilter) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {showRsvpFilter && RSVP_OPTIONS.map((r) => (
            <button key={r} onClick={() => toggleParam("r", r, selectedRsvp)} className="focus:outline-none">
              <Badge variant={selectedRsvp.has(r) ? "default" : "outline"} className="cursor-pointer">
                {r.toLowerCase()}
              </Badge>
            </button>
          ))}
          {showAccessibilityFilter && A11Y_OPTIONS.map((a) => (
            <button key={a} onClick={() => toggleParam("a", a, selectedA11y)} className="focus:outline-none">
              <Badge variant={selectedA11y.has(a) ? "default" : "outline"} className="cursor-pointer">
                {a.replace(/_/g, " ")}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
