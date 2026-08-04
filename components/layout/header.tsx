import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
          <BarChart3 className="size-5 text-primary" />
          <span className="bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
            CreatorLens
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm">工作台</Button>
          </Link>
          <Link href="/projects/new">
            <Button size="sm">新建分析</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
