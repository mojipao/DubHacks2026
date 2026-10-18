"use client";

import { useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { SHOP_NAME } from "@/lib/business";

const subscribe = () => () => {};

/** Public site origin when set (Vercel); otherwise fall back to the page origin. */
function configuredOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/** Full-screen QR for a second screen at the table. */
export default function JoinQrPage() {
  const configured = configuredOrigin();
  // Prefer NEXT_PUBLIC_SITE_URL so a laptop showing /join/qr still encodes the
  // public Vercel URL judges can open. Fall back to window.origin when unset.
  const origin = useSyncExternalStore(
    subscribe,
    () => configured ?? window.location.origin,
    () => configured,
  );
  const url = origin ? `${origin}/join` : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-10 text-center">
      <div>
        <h1 className="mt-3 heading text-7xl tracking-tight text-fg">Text the shop.</h1>
        <p className="mx-auto mt-3 max-w-xl text-[19px] leading-relaxed text-muted">
          Scan, get {SHOP_NAME}&apos;s number, and text it like a regular. Try to trick it, too: every reply waits for the
          owner.
        </p>
      </div>
      <div className="ticket-paper ticket-strip relative overflow-hidden rounded-[24px] p-8">
        {url ? (
          <QRCodeSVG value={url} size={320} bgColor="transparent" fgColor="#1B1714" level="M" marginSize={0} />
        ) : (
          <div className="size-[320px]" />
        )}
      </div>
      <ol className="flex flex-wrap justify-center gap-x-8 gap-y-2 text-[16px] text-ink/80">
        <li>
          <span className="mr-1 inline-flex size-6 items-center justify-center rounded-full bg-brew text-[13px] font-bold text-paper">1</span> scan
        </li>
        <li>
          <span className="mr-1 inline-flex size-6 items-center justify-center rounded-full bg-brew text-[13px] font-bold text-paper">2</span> enter your number
        </li>
        <li>
          <span className="mr-1 inline-flex size-6 items-center justify-center rounded-full bg-brew text-[13px] font-bold text-paper">3</span> text the shop
        </li>
      </ol>
      <p className="font-mono text-[14px] text-muted">{url ?? " "}</p>
    </main>
  );
}
