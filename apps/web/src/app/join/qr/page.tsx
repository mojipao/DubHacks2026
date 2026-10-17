"use client";

import { useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { BUSINESS } from "@/lib/business";

const subscribe = () => () => {};

/** Full-screen QR for a second screen at the table. */
export default function JoinQrPage() {
  // The origin only exists in the browser; the server renders a placeholder and the client fills it in.
  const origin = useSyncExternalStore(subscribe, () => window.location.origin, () => null);
  const url = origin ? `${origin}/join` : null;

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6 py-10 text-center">
      <div>
        <p className="font-mono text-[14px] tracking-[0.22em] text-amber uppercase">{BUSINESS.name} · Back of House</p>
        <h1 className="mt-3 font-serif text-7xl tracking-tight text-fg">Text the bakery.</h1>
        <p className="mx-auto mt-3 max-w-xl text-[19px] leading-relaxed text-muted">
          Scan, get the shop&apos;s number, and text it like a regular. Try to trick it, too: every reply waits for the
          owner.
        </p>
      </div>
      <div className="ticket-paper relative overflow-hidden rounded-[10px] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
        <div className="ticket-perforation absolute inset-x-0 top-0 h-2" />
        {url ? (
          <QRCodeSVG value={url} size={320} bgColor="transparent" fgColor="#1B1714" level="M" marginSize={0} />
        ) : (
          <div className="size-[320px]" />
        )}
      </div>
      <ol className="flex flex-wrap justify-center gap-x-8 gap-y-2 font-mono text-[15px] text-fg/80">
        <li>
          <span className="text-amber">1</span> scan
        </li>
        <li>
          <span className="text-amber">2</span> enter your number
        </li>
        <li>
          <span className="text-amber">3</span> text the shop
        </li>
      </ol>
      <p className="font-mono text-[14px] text-muted">{url ?? " "}</p>
    </main>
  );
}
