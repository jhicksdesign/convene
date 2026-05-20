"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { offerRide, requestRide, matchRide } from "@/app/_actions/carpool";

interface Offer { id: string; pickupArea: string; seatsAvailable: number; departureTime: string; userDisplayName: string }
interface Request { id: string; pickupArea: string; preferredDepartureTime: string; userDisplayName: string }

interface Props {
  eventId: string;
  offers: Offer[];
  requests: Request[];
}

export function CarpoolPanel({ eventId, offers, requests }: Props) {
  const [mode, setMode] = useState<"offer" | "request" | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(form: FormData) {
    setError(null);
    start(async () => {
      try {
        if (mode === "offer") {
          await offerRide({
            eventId,
            pickupArea: form.get("pickupArea"),
            seatsAvailable: Number(form.get("seatsAvailable")),
            departureTime: form.get("departureTime"),
          });
        } else if (mode === "request") {
          await requestRide({
            eventId,
            pickupArea: form.get("pickupArea"),
            preferredDepartureTime: form.get("departureTime"),
          });
        }
        setMode(null);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-4">
      <h3 className="text-sm font-semibold">Carpool</h3>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setMode(mode === "offer" ? null : "offer")}>
          Offer a ride
        </Button>
        <Button size="sm" variant="outline" onClick={() => setMode(mode === "request" ? null : "request")}>
          Request a ride
        </Button>
      </div>
      {mode && (
        <form action={onSubmit} className="space-y-2 rounded border bg-background p-3">
          <div>
            <Label htmlFor="pickupArea">Pickup area</Label>
            <Input id="pickupArea" name="pickupArea" required />
          </div>
          {mode === "offer" && (
            <div>
              <Label htmlFor="seatsAvailable">Seats available</Label>
              <Input id="seatsAvailable" name="seatsAvailable" type="number" min={1} max={20} required />
            </div>
          )}
          <div>
            <Label htmlFor="departureTime">Departure time</Label>
            <Input id="departureTime" name="departureTime" type="datetime-local" required />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button size="sm" type="submit" disabled={pending}>{pending ? "…" : "Save"}</Button>
        </form>
      )}

      {offers.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Offers</h4>
          <ul className="mt-1 space-y-1">
            {offers.map((o) => (
              <li key={o.id} className="text-xs">
                <span className="font-medium">{o.userDisplayName}</span> · {o.pickupArea} · {o.seatsAvailable} seat{o.seatsAvailable === 1 ? "" : "s"} · {new Date(o.departureTime).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}
      {requests.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requests</h4>
          <ul className="mt-1 space-y-1">
            {requests.map((r) => (
              <li key={r.id} className="text-xs">
                <span className="font-medium">{r.userDisplayName}</span> · {r.pickupArea} · {new Date(r.preferredDepartureTime).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
