import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Facade } from "@/components/storefront/facade";
import { clock, CoffeeSection, MenuSection, StoreFooter, VisitSection } from "@/components/storefront/sections";
import "@/components/storefront/storefront.css";
import { BUSINESS, SHOP_NAME } from "@/lib/business";

export const metadata: Metadata = {
  title: `${SHOP_NAME} · Yemeni coffee in Seattle`,
  description: "Haraz coffee, Adeni chai, and milk cake made each morning. Text us your order and it'll be waiting at the counter.",
};

function SideNote({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="heading text-[26px] text-ink">{title}</h2>
      <div className="mt-3 space-y-2 text-[16px] leading-relaxed text-ink/80">{children}</div>
    </div>
  );
}

/** The shop's own homepage: the front of the house. Its staff door is the way into Back of House. */
export default async function StorefrontPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  // The control room used to live here; old links like /?tab=today or /?sim=1 still land in it.
  const params = await searchParams;
  if (params.tab !== undefined || params.sim !== undefined) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      for (const v of [value].flat()) if (v !== undefined) query.append(key, v);
    }
    redirect(`/shop?${query}`);
  }

  const span = (h: { open: string; close: string } | null) => (h ? `${clock(h.open)} to ${clock(h.close)}` : "closed");

  return (
    <div className="bg-[#efe3cf]">
      {/* The street: sand either side of the house, the facade carrying the first viewport. */}
      <div className="mx-auto grid max-w-[1600px] gap-10 px-4 pt-6 pb-0 sm:px-8 lg:grid-cols-[1fr_minmax(0,min(62vw,960px))_1fr] lg:gap-12 lg:pt-6">
        <aside className="order-2 hidden self-center lg:order-1 lg:block lg:pb-24 lg:text-right">
          <SideNote title="Hours">
            <p>
              Tuesday to Friday
              <span className="block whitespace-nowrap text-ink">{span(BUSINESS.hours.tue)}</span>
            </p>
            <p>
              Saturday and Sunday
              <span className="block whitespace-nowrap text-ink">{span(BUSINESS.hours.sat)}</span>
            </p>
            <p className="text-muted">Closed Mondays</p>
          </SideNote>
        </aside>
        <div className="order-1 lg:order-2 lg:h-[calc(100dvh-24px)] lg:min-h-[700px]">
          <Facade />
        </div>
        <aside className="order-3 self-center pb-10 lg:pb-24">
          <SideNote title="Order ahead">
            <p>Text what you&apos;d like and when.</p>
            <p>We&apos;ll send your total and a link to pay.</p>
            <p className="text-muted">On the Ave, Seattle</p>
          </SideNote>
        </aside>
      </div>
      <div className="h-3 bg-[#cbb59b]" aria-hidden />

      <MenuSection />
      <CoffeeSection />
      <VisitSection />
      <StoreFooter />
    </div>
  );
}
