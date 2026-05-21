"use client";

import { useState } from "react";
import { Copy, Check, MapPin } from "lucide-react";
import { toast } from "sonner";

interface Props {
  address: string;
  venueName?: string | null;
}

export function VenueAddress({ address, venueName }: Props) {
  const [copied, setCopied] = useState(false);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 -mx-1 -my-0.5 hover:bg-accent"
      >
        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
        {venueName && <span className="font-medium">{venueName}</span>}
        <span className="text-muted-foreground">{venueName ? "· " : ""}{address}</span>
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label="Copy address"
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
