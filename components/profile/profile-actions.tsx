"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { requestFriend, acceptFriend, removeFriend } from "@/app/_actions/friends";
import { blockUser, unblockUser } from "@/app/_actions/blocks";

type FriendState = "none" | "pending_outgoing" | "pending_incoming" | "accepted";

export function ProfileActions({
  otherUserId,
  friendState,
  isBlocked,
}: {
  otherUserId: string;
  friendState: FriendState;
  isBlocked: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {!isBlocked && friendState === "none" && (
        <Button onClick={() => start(() => requestFriend(otherUserId))} disabled={pending} size="sm">
          Add friend
        </Button>
      )}
      {!isBlocked && friendState === "pending_outgoing" && <Button disabled size="sm" variant="outline">Request sent</Button>}
      {!isBlocked && friendState === "pending_incoming" && (
        <Button onClick={() => start(() => acceptFriend(otherUserId))} disabled={pending} size="sm">
          Accept friend request
        </Button>
      )}
      {!isBlocked && friendState === "accepted" && (
        <Button onClick={() => start(() => removeFriend(otherUserId))} disabled={pending} size="sm" variant="outline">
          Remove friend
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isBlocked ? (
            <DropdownMenuItem onSelect={() => start(() => unblockUser(otherUserId))}>Unblock</DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => start(() => blockUser(otherUserId))}>Block</DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <a href={`/reports/new?subject=${otherUserId}`}>Report</a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
