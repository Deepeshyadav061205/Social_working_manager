import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="flex min-h-[75vh] items-center justify-center px-4 py-16">
      <Card className="max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-line bg-surface-2 text-foreground">
          <Compass className="h-6 w-6 text-blue" aria-hidden />
        </div>
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm text-muted">
          The page or draft you’re looking for doesn’t exist or may have been deleted.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild variant="primary">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Home</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
