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

export function ConflictWarning({ report }: { report: ConflictReportSerialized }) {
  if (report.hits.length === 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="rounded-md border bg-muted p-3"
    >
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4" />
        Conflicts detected — warnings only, you can dismiss and proceed.
      </div>
      <ul className="mb-3 space-y-1.5">
        {report.hits.map((h) => (
          <li key={h.id + h.startsAt} className="flex items-center gap-2 text-sm">
            <Badge className={SEVERITY[h.severity]}>{h.severity}</Badge>
            <span className="font-medium">{h.title}</span>
            <span className="text-xs text-muted-foreground">{h.groupName}</span>
            {h.overlapPct != null && (
              <span className="ml-auto text-xs text-muted-foreground">
                ~{Math.round(h.overlapPct * 100)}% attendee overlap
              </span>
            )}
          </li>
        ))}
      </ul>
      {report.alternatives.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Open dates nearby:{" "}
          {report.alternatives.map((d) => new Date(d).toLocaleDateString()).join(" · ")}
        </div>
      )}
    </motion.div>
  );
}
