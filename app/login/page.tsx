import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function signInWithEmail(formData: FormData) {
  "use server";
  const email = formData.get("email") as string;
  await signIn("email", { email, redirectTo: "/" });
}

async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

async function signInWithTelegram() {
  "use server";
  await signIn("telegram", { redirectTo: "/" });
}

async function signInWithDiscord() {
  "use server";
  await signIn("discord", { redirectTo: "/" });
}

export default function LoginPage() {
  const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
  const telegramEnabled = !!(process.env.TELEGRAM_CLIENT_ID && process.env.TELEGRAM_CLIENT_SECRET);
  const discordEnabled = !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
  const anyOAuth = googleEnabled || telegramEnabled || discordEnabled;

  return (
    <section className="relative -mx-4 -my-6 flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden px-4 py-12">
      {/* Atmospheric backdrop — corner-anchored radial gradients on a
          single fixed full-viewport div. Stops are percentages so the
          falloff adapts to any viewport shape; center stays clean. */}
      <div aria-hidden="true" className="hero-atmosphere pointer-events-none fixed inset-0 -z-10" />

      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1
            className="font-display text-6xl font-medium leading-none tracking-tight"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 30' }}
          >
            Eventide
          </h1>
        </div>

        <div
          className="rounded-2xl border bg-card/85 p-6 backdrop-blur-sm"
          style={{ boxShadow: "var(--shadow-lift)" }}
        >
          {anyOAuth && (
            <div className="space-y-2.5">
              {googleEnabled && (
                <form action={signInWithGoogle}>
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full justify-center gap-2.5 bg-white text-zinc-900 hover:bg-zinc-50 hover:text-zinc-900"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.55c2.08-1.92 3.29-4.74 3.29-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.55-2.76c-.98.66-2.24 1.06-3.73 1.06-2.87 0-5.3-1.94-6.16-4.54H2.18v2.85A10.99 10.99 0 0 0 12 23z" fill="#34A853" />
                      <path d="M5.84 14.1A6.6 6.6 0 0 1 5.48 12c0-.73.13-1.44.36-2.1V7.05H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.95l3.66-2.85z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.07.56 4.21 1.65l3.15-3.15C17.46 2.1 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.05l3.66 2.85C6.7 7.31 9.13 5.38 12 5.38z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                  </Button>
                </form>
              )}

              {telegramEnabled && (
                <form action={signInWithTelegram}>
                  <Button
                    type="submit"
                    className="w-full justify-center gap-2.5 text-white hover:opacity-95"
                    style={{ backgroundColor: "#229ED9" }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24Zm5.56 8.16-1.84 8.66c-.14.62-.5.77-1.02.48l-2.82-2.08-1.36 1.31c-.15.15-.28.28-.57.28l.2-2.88 5.24-4.74c.23-.2-.05-.31-.35-.11l-6.48 4.08-2.79-.87c-.6-.19-.62-.6.13-.9l10.91-4.2c.5-.18.94.12.75.97Z" />
                    </svg>
                    Continue with Telegram
                  </Button>
                </form>
              )}

              {discordEnabled && (
                <form action={signInWithDiscord}>
                  <Button
                    type="submit"
                    className="w-full justify-center gap-2.5 text-white hover:opacity-95"
                    style={{ backgroundColor: "#5865F2" }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                      <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    Continue with Discord
                  </Button>
                </form>
              )}

              <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <span className="font-mono uppercase tracking-widest">or with email</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </div>
          )}

          <form action={signInWithEmail} className="space-y-3">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" placeholder="you@where-you-are.com" />
            </div>
            <Button type="submit" className="w-full" size="lg">
              Send magic link
            </Button>
          </form>
        </div>

      </div>
    </section>
  );
}
