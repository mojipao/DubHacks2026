"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinDemo } from "@/lib/actions";
import { BUSINESS } from "@/lib/business";

export default function JoinPage() {
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ agentNumber: string } | null>(null);
  const [loading, setLoading] = useState(false);

  if (result) {
    const sms = `sms:${result.agentNumber}&body=${encodeURIComponent("Hi! Can I order for Saturday?")}`;
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
        <p className="font-mono text-[12px] tracking-[0.18em] text-amber uppercase">
          {BUSINESS.name}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">
          Text this number
        </h1>
        <p className="mt-6 font-mono text-4xl font-bold text-ticket">
          {result.agentNumber}
        </p>
        <Button asChild className="mt-8 h-12 bg-sky text-base text-white hover:bg-sky/90">
          <a href={sms}>Open iMessage</a>
        </Button>
        <p className="mt-4 text-[14px] leading-relaxed text-muted">
          Send from the same number you entered, as an iMessage (blue bubble).
        </p>
        <Link href="/" className="mt-8 text-[13px] text-amber hover:underline">
          Back to control room
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <p className="font-mono text-[12px] tracking-[0.18em] text-amber uppercase">
        {BUSINESS.name}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-fg">
        Text like a regular
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted">
        Text Larch & Rye like a regular. An AI drafts the reply; the owner
        approves it.
      </p>

      <form
        className="mt-8 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setLoading(true);
          setError(null);
          try {
            const data = await joinDemo({ name: name.trim(), handle: handle.trim() });
            setResult({ agentNumber: data.agentNumber });
          } catch (err) {
            setError(err instanceof Error ? err.message : "Ask the team at the table");
          } finally {
            setLoading(false);
          }
        }}
      >
        <div>
          <label className="mb-1 block text-[13px] text-muted" htmlFor="name">
            Name
          </label>
          <Input
            id="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 border-line bg-panel text-fg"
            placeholder="Sam"
          />
        </div>
        <div>
          <label className="mb-1 block text-[13px] text-muted" htmlFor="handle">
            Phone or iMessage email
          </label>
          <Input
            id="handle"
            required
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="h-11 border-line bg-panel text-fg"
            placeholder="+12065550123"
          />
        </div>
        <p className="text-[12px] leading-relaxed text-muted">
          We&apos;ll only reply to messages you send. Synthetic demo shop, no
          real orders.
        </p>
        {error && <p className="text-[13px] text-tomato">{error}</p>}
        <Button
          type="submit"
          disabled={loading}
          className="h-12 w-full bg-ticket text-ink hover:bg-ticket/90"
        >
          {loading ? "Assigning…" : "Get a number"}
        </Button>
      </form>
    </main>
  );
}
