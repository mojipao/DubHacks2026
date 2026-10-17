"use client";

import dynamic from "next/dynamic";
import { DataProvider } from "@/lib/data/store";

// Client-only for the same reason as the control room: times render in the viewer's clock.
const AuditTable = dynamic(
  () => import("@/components/audit-table").then((m) => m.AuditTable),
  {
    ssr: false,
    loading: () => <div className="p-8 font-mono text-[13px] text-muted">Loading audit log…</div>,
  },
);

export default function AuditPage() {
  return (
    <DataProvider>
      <AuditTable />
    </DataProvider>
  );
}
