import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function signInWithEmail(formData: FormData) {
  "use server";
  const email = formData.get("email") as string;
  await signIn("email", { email, redirectTo: "/" });
}

async function signInWithDiscord() {
  "use server";
  await signIn("discord", { redirectTo: "/" });
}

export default function LoginPage() {
  const discordEnabled = !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);

  return (
    <section className="relative -mx-4 -my-6 flex min-h-[calc(100vh-3.5rem)] items-center justify-center overflow-hidden px-4 py-12">
      {/* Atmospheric backdrop — warm gradients evoking dusk, not a login form. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-40 top-0 h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-[24rem] w-[24rem] rounded-full bg-secondary/60 blur-3xl" />
        <div className="absolute left-1/2 top-1/3 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="mb-7 text-center">
          <h1
            className="font-display text-6xl font-medium leading-none tracking-tight"
            style={{ fontVariationSettings: '"opsz" 144, "SOFT" 30' }}
          >
            Convene
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Sign in — we'll email you a magic link.
          </p>
        </div>

        <div
          className="rounded-2xl border bg-card/85 p-6 backdrop-blur-sm"
          style={{ boxShadow: "var(--shadow-lift)" }}
        >
          {discordEnabled && (
            <>
              <form action={signInWithDiscord}>
                <Button
                  type="submit"
                  className="w-full"
                  style={{ backgroundColor: "#5865F2", color: "white" }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                    <path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.029zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                  </svg>
                  Continue with Discord
                </Button>
              </form>
              <div className="my-4 flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                <span className="font-mono uppercase tracking-widest">or with email</span>
                <div className="h-px flex-1 bg-border" />
              </div>
            </>
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

        <p className="mt-4 text-center text-xs text-muted-foreground">
          No password to forget. The link works for 15 minutes.
        </p>
      </div>
    </section>
  );
}
