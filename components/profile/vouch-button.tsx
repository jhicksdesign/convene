"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { giveVouch, revokeVouch } from "@/app/_actions/vouches";

export function VouchButton({ otherUserId, groupId, hasVouched }: { otherUserId: string; groupId: string; hasVouched: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant={hasVouched ? "outline" : "default"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          if (hasVouched) await revokeVouch(otherUserId, groupId);
          else await giveVouch(otherUserId, groupId);
        })
      }
    >
      {hasVouched ? "Revoke vouch" : "Vouch"}
    </Button>
  );
}
