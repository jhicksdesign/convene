"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { joinOrRequest } from "@/app/_actions/memberships";

export function JoinButton({ groupId, initialState }: { groupId: string; initialState: "none" | "pending" | "member" }) {
  const [state, setState] = useState(initialState);
  const [pending, start] = useTransition();

  if (state === "member") return <Button disabled variant="outline">Joined</Button>;
  if (state === "pending") return <Button disabled variant="outline">Request pending</Button>;

  return (
    <Button
      onClick={() =>
        start(async () => {
          const r = await joinOrRequest(groupId);
          if (r.status === "joined") setState("member");
          else if (r.status === "requested") setState("pending");
        })
      }
      disabled={pending}
    >
      {pending ? "…" : "Join group"}
    </Button>
  );
}
