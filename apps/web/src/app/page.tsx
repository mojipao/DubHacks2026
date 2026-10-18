import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Frieze } from "@/components/frieze";
import { SHOP_NAME } from "@/lib/business";

export const metadata: Metadata = {
  title: "Back of House",
  description: "AI agents draft a small shop's replies, orders, and restocks. The owner approves each one.",
};

/** The front door: what Back of House is, and the way into the shop's control room. */
export default async function LandingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The control room used to live here; old links like /?tab=today or /?sim=1 still land in it.
  const params = await searchParams;
  if (params.tab !== undefined || params.sim !== undefined) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      for (const v of [value].flat()) if (v !== undefined) query.append(key, v);
    }
    redirect(`/shop?${query}`);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex h-16 items-center justify-end bg-shell px-4 text-shell-fg sm:px-8">
        <Link
          href="/shop"
          className="inline-flex h-9 items-center rounded-full whitespace-nowrap border border-shell-fg/30 px-4 text-[14px] font-semibold text-shell-fg transition-colors duration-150 hover:bg-shell-fg/10"
        >
          Log into {SHOP_NAME}
        </Link>
      </header>
      <Frieze />

      <main className="flex flex-1 items-center px-4 py-16 sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <h1 className="heading text-[44px] text-ink sm:text-[60px]">Back of House</h1>
          <p className="mt-4 max-w-xl text-[19px] leading-relaxed text-ink/85">
            Customers text or call the shop. AI agents draft the reply, the order, and the restock. Nothing is charged or ordered until the
            owner approves it.
          </p>
        </div>
      </main>
    </div>
  );
}
