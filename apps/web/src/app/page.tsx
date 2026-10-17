"use client";

import dynamic from "next/dynamic";
import { ControlRoomSkeleton } from "@/components/control-room-skeleton";
import { DataProvider } from "@/lib/data/store";

// Client-only: every panel shows live clocks and relative times, which can't match a server render.
const ControlRoom = dynamic(
  () => import("@/components/control-room").then((m) => m.ControlRoom),
  { ssr: false, loading: () => <ControlRoomSkeleton /> },
);

export default function HomePage() {
  return (
    <DataProvider>
      <ControlRoom />
    </DataProvider>
  );
}
