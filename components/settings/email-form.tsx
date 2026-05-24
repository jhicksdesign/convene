"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestEmailVerify } from "@/app/_actions/email-verify";

export function EmailForm({ currentEmail }: { currentEmail: string | null }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  return (
    <form
      action={() =>
        start(async () => {
          const result = await requestEmailVerify(email);
          if (result.ok) {
            setSent(true);
            toast.success("Check your email for a confirmation link.");
          } else {
            toast.error(result.error);
          }
        })
      }
      className="space-y-3"
    >
      <div>
        <Label htmlFor="email">{currentEmail ? "New email" : "Email"}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@where-you-are.com"
        />
      </div>
      <Button type="submit" disabled={pending || sent || !email}>
        {sent ? "Link sent" : pending ? "Sending…" : "Send confirmation link"}
      </Button>
    </form>
  );
}
