"use client";

import { useState, useTransition } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  kind: "avatar" | "flyer" | "evidence" | "comment";
  onUploaded: (publicUrl: string) => void;
  multiple?: boolean;
  label?: string;
}

/**
 * Single source of truth for client-side file uploads.
 * 1. Asks /api/upload/sign for a presigned PUT URL.
 * 2. PUTs the file directly to R2.
 * 3. Calls onUploaded(publicUrl).
 *
 * Used by avatar / flyer / evidence flows. Don't reimplement.
 */
export function Uploader({ kind, onUploaded, multiple = false, label }: Props) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    start(async () => {
      setBusy(true);
      try {
        for (const file of Array.from(files)) {
          const signRes = await fetch("/api/upload/sign", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, mime: file.type, sizeBytes: file.size }),
          });
          if (!signRes.ok) {
            const j = await signRes.json().catch(() => ({}));
            throw new Error(j.error ?? "Sign failed");
          }
          const { url, publicUrl } = (await signRes.json()) as { url: string; publicUrl: string };
          const put = await fetch(url, {
            method: "PUT",
            headers: { "Content-Type": file.type },
            body: file,
          });
          if (!put.ok) throw new Error(`Upload failed (${put.status})`);
          onUploaded(publicUrl);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Upload error";
        setError(msg);
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <div className="space-y-1">
      {label && <p className="text-sm font-medium">{label}</p>}
      <Input
        type="file"
        multiple={multiple}
        onChange={(e) => upload(e.target.files)}
        disabled={busy || pending}
      />
      {busy && <p className="text-xs text-muted-foreground">Uploading…</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
