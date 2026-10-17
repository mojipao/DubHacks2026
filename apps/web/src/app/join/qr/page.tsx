"use client";

import { QRCodeSVG } from "qrcode.react";
import { BUSINESS } from "@/lib/business";

export default function JoinQrPage() {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const url = `${origin}/join`;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-bg px-6 text-center">
      <div>
        <p className="font-mono text-[13px] tracking-[0.2em] text-amber uppercase">
          {BUSINESS.name}
        </p>
        <h1 className="mt-2 text-4xl font-semibold text-fg">Scan to text the shop</h1>
        <p className="mt-2 text-[16px] text-muted">
          Judges join here, then attack Guard from their phones.
        </p>
      </div>
      <div className="rounded-2xl bg-ticket p-6 shadow-2xl">
        <QRCodeSVG value={url} size={280} bgColor="#F5EFE4" fgColor="#1B1714" />
      </div>
      <p className="font-mono text-[14px] text-muted">{url}</p>
    </main>
  );
}
