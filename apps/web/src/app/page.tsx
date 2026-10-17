"use client";

import { ControlRoom } from "@/components/control-room";
import { DataProvider } from "@/lib/data/store";

export default function HomePage() {
  return (
    <DataProvider>
      <ControlRoom />
    </DataProvider>
  );
}
