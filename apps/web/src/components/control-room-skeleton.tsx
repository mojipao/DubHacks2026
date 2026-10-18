import { Skeleton } from "@/components/ui/skeleton";

/** First paint while the client-only control room boots; mirrors its three columns. */
export function ControlRoomSkeleton() {
  return (
    <div className="flex h-dvh min-h-[720px] flex-col" aria-busy="true" aria-label="Loading the control room">
      <div className="h-[49px] border-b border-line bg-panel/80" />
      <div className="h-[37px] border-b border-line bg-bg/70" />
      <div className="flex min-h-0 flex-1">
        <div className="w-[320px] shrink-0 space-y-3 border-r border-line p-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 bg-panel" />
          ))}
        </div>
        <div className="grid flex-1 grid-cols-2 content-start gap-4 p-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-80 rounded-[6px] bg-ticket/10" />
          ))}
        </div>
        <div className="w-[340px] shrink-0 space-y-3 p-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-6 bg-panel" />
          ))}
        </div>
      </div>
      <div className="h-10 border-t border-line bg-[#100e0c]" />
    </div>
  );
}
