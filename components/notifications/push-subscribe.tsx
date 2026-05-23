"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { savePushSubscription, deletePushSubscription } from "@/app/_actions/push";

// Convert a base64url VAPID public key to the Uint8Array WebPush needs.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushSubscribe({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    setSupported(true);
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => {
      if (!reg) return;
      const sub = await reg.pushManager.getSubscription();
      setSubscribed(!!sub);
    });
  }, []);

  async function subscribe() {
    setError(null);
    if (!vapidPublicKey) {
      setError("Push notifications aren't configured on this server.");
      return;
    }
    start(async () => {
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setError("Notification permission denied.");
          return;
        }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
        });
        const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
          setError("Subscription was incomplete — try again.");
          return;
        }
        await savePushSubscription({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        });
        setSubscribed(true);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to subscribe");
      }
    });
  }

  async function unsubscribe() {
    start(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          await deletePushSubscription(sub.endpoint);
          await sub.unsubscribe();
        }
        setSubscribed(false);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to unsubscribe");
      }
    });
  }

  if (!supported) {
    return (
      <p className="text-xs text-muted-foreground">
        Your browser doesn't support Web Push. Use email notifications above.
      </p>
    );
  }

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-3">
      <p className="text-sm">
        <span className="font-medium">Browser push notifications</span> — get pinged in your OS for friend requests,
        waitlist promotions, and event cancellations even when Eventide's tab is closed.
      </p>
      {subscribed ? (
        <Button size="sm" variant="outline" onClick={unsubscribe} disabled={pending}>
          {pending ? "…" : "Unsubscribe from push"}
        </Button>
      ) : (
        <Button size="sm" onClick={subscribe} disabled={pending}>
          {pending ? "…" : "Enable push notifications"}
        </Button>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
