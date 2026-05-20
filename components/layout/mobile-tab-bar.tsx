import Link from "next/link";
import { Calendar, Map, Sparkles, User } from "lucide-react";

export function MobileTabBar() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t bg-background md:hidden">
      <Link href="/calendar" className="flex flex-col items-center gap-1 py-2 text-xs">
        <Calendar className="h-5 w-5" /> Calendar
      </Link>
      <Link href="/map" className="flex flex-col items-center gap-1 py-2 text-xs">
        <Map className="h-5 w-5" /> Map
      </Link>
      <Link href="/" className="flex flex-col items-center gap-1 py-2 text-xs">
        <Sparkles className="h-5 w-5" /> For you
      </Link>
      <Link href="/me" className="flex flex-col items-center gap-1 py-2 text-xs">
        <User className="h-5 w-5" /> Profile
      </Link>
    </nav>
  );
}
