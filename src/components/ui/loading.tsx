import { cn } from "@/src/utils/ui";
import { Loader2 } from "lucide-react";

interface LoadingProps {
  className?: string;
}

export function Loading({ className }: LoadingProps) {
  return (
    <div
      className={cn(
        "flex h-screen w-screen items-center justify-center bg-background",
        className
      )}
    >
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
