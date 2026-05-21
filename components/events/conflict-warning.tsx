"use client";

import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";

export interface ConflictReportSerialized {
  hits: {
    severity: "hard" | "soft" | "adjacent";
    kind: "event" | "soft_claim" | "convention";
    id: string;
    title: string;
    groupName: string | null;
    startsAt: string;
    endsAt: string;
    overlapPct: number | null;
  }[];
  alternatives: string[];
}

const SEVERITY: Record<string, string> = {
  hard: "bg-destructive text-destructive-foreground",
  soft: "bg-amber-500 text-white",
  adjacent: "bg-slate-400 text-white",
};

interface Props {
  report: ConflictReportSerialized;
  onPickAlternative?: (iso: string) => void;
}

export function ConflictWarning({ report, onPickAlternative }: Props) {
  if (report.hits.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40"
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        Conflicts detected — these are warnings; you can save anyway.
      </div>
      <ul className="mb-3 space-y-1.5">
        {report.hits.map((h) => (
          <li key={h.id + h.startsAt} className="flex flex-wrap items-center gap-2 text-sm">
            <Badge className={SEVERITY[h.severity]}>{h.severity}</Badge>
            <span className="font-medium">{h.title}</span>
            {h.groupName && <span className="text-xs text-muted-foreground">{h.groupName}</span>}
            {h.overlapPct != null && (
              <span className="ml-auto text-xs text-muted-foreground">
                ~{Math.round(h.overlapPct * 100)}% attendee overlap
              </span>
            )}
          </li>
        ))}
      </ul>
      {report.alternatives.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Suggested dates without conflicts:</p>
          <div className="flex flex-wrap gap-2">
            {report.alternatives.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onPickAlternative?.(d)}
                disabled={!onPickAlternative}
                className="rounded-full border border-amber-300 bg-background px-3 py-1 text-xs font-medium transition-colors hover:bg-amber-100 disabled:cursor-default disabled:opacity-60 dark:border-amber-800 dark:hover:bg-amber-900/40"
              >
                {new Date(d).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
