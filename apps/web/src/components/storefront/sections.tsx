import Link from "next/link";
import factsJson from "../../../../../data/seed/product-facts.json";
import { GypsumFrieze, Qamariya } from "@/components/storefront/ornament";
import { BUSINESS, PRODUCT_NAMES, PRODUCT_PRICES, SHOP_NAME, SHOP_NAME_AR } from "@/lib/business";
import { money } from "@/lib/format";

const FACTS = factsJson as Record<string, { description?: string; size?: string }>;

// The board as it hangs over the counter. Names and prices come from the seed.
const BOARD: { title: string; ar: string; items: string[] }[] = [
  { title: "Coffee and tea", ar: "قهوة وشاي", items: ["yemeni-coffee", "mokha-latte", "qishr", "adeni-chai", "cold-brew"] },
  { title: "Sweets", ar: "حلويات", items: ["milk-cake", "bint-al-sahn", "pistachio-maamoul"] },
  { title: "From the oven", ar: "من الفرن", items: ["malawah", "sabaya", "sesame-kaak"] },
];

const DAYS: { key: keyof typeof BUSINESS.hours; label: string }[] = [
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
  { key: "mon", label: "Monday" },
];

/** "06:30" → "6:30 am", "15:00" → "3 pm". */
export function clock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 || 12;
  return m ? `${hour}:${String(m).padStart(2, "0")} ${suffix}` : `${hour} ${suffix}`;
}

function MenuRow({ id }: { id: string }) {
  const description = FACTS[id]?.description;
  return (
    <li className="py-4">
      <div className="flex items-baseline">
        <span className="text-[18px] font-semibold text-ink">{PRODUCT_NAMES[id]}</span>
        <span className="leader" aria-hidden />
        <span className="text-[17px] font-semibold text-ink tabular">{money(PRODUCT_PRICES[id] ?? 0)}</span>
      </div>
      {description && <p className="mt-1 max-w-[46ch] text-[15px] leading-relaxed text-muted">{description}</p>}
    </li>
  );
}

/** Inside the house: the board on the plaster wall, under a frieze and a small fanlight. */
export function MenuSection() {
  return (
    <section id="menu" className="storefront-plaster scroll-mt-0">
      <GypsumFrieze className="block" tone="#6e3d1f" />
      <div className="mx-auto max-w-6xl px-5 pt-16 pb-20 sm:px-10 lg:pt-20 lg:pb-28">
        <div className="flex flex-col items-center text-center">
          <Qamariya size="sm" className="w-[120px]" />
          <h2 className="heading mt-4 text-[clamp(40px,5vw,64px)] leading-none text-ink">The menu</h2>
          <p lang="ar" dir="rtl" className="mt-3 font-[family-name:var(--font-arabic)] text-[24px] leading-none text-qishr-ink">
            قائمة الطعام
          </p>
        </div>
        <div className="mt-12 border-2 border-[#6e3d1f] bg-paper px-5 py-8 outline outline-1 outline-offset-[6px] outline-[#6e3d1f]/40 sm:px-10 lg:px-12 lg:py-12">
          <div className="grid gap-x-14 gap-y-12 lg:grid-cols-3">
            {BOARD.map((group) => (
              <div key={group.title}>
                <div className="flex items-baseline justify-between border-b-2 border-ink pb-3">
                  <h3 className="heading text-[28px] text-ink">{group.title}</h3>
                  <span lang="ar" dir="rtl" className="font-[family-name:var(--font-arabic)] text-[20px] text-qishr-ink">
                    {group.ar}
                  </span>
                </div>
                <ul className="divide-y divide-line">
                  {group.items.map((id) => (
                    <MenuRow key={id} id={id} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div id="catering" className="mt-12 grid scroll-mt-10 gap-x-14 gap-y-4 border-t-2 border-ink pt-6 lg:grid-cols-[1fr_2fr]">
            <h3 className="heading text-[28px] text-ink">For the office</h3>
            <ul className="divide-y divide-line">
              {["coffee-box", "yemeni-beans"].map((id) => (
                <MenuRow key={id} id={id} />
              ))}
              <li className="py-4 text-[15px] leading-relaxed text-muted">
                Two dozen or more needs {BUSINESS.cateringLeadHours / 24} days&apos; notice. Text us the date and headcount.
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-8 text-center text-[16px] text-muted">
          Made here each morning. When a tray runs out, it&apos;s gone until tomorrow.
        </p>
      </div>
    </section>
  );
}

export function CoffeeSection() {
  return (
    <section id="coffee" className="storefront-wall scroll-mt-0 text-paper">
      <GypsumFrieze className="block" />
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-10 lg:grid-cols-[1.1fr_1fr] lg:gap-20 lg:py-28">
        <h2 className="heading text-[clamp(36px,4.4vw,58px)] leading-[1.08]">
          Coffee took its name from a port in Yemen. We brew it the way they still do there.
        </h2>
        <div className="space-y-5 text-[17px] leading-relaxed text-paper/85">
          <p>
            Our beans come from the terraced mountains of Haraz. We brew them with cardamom and pour them into small cups, the way
            coffee is still served in Sana&apos;a.
          </p>
          <p>
            Nothing is wasted. The dried husks of the coffee cherry become qishr, a spiced tea with ginger and cinnamon that most of
            our regulars drink in the afternoon.
          </p>
          <p className="text-qishr">Ask for a taste of qishr at the counter.</p>
        </div>
      </div>
      <GypsumFrieze className="block" />
    </section>
  );
}

export function VisitSection() {
  return (
    <section id="visit" className="scroll-mt-0 bg-[#efe3cf]">
      <div className="mx-auto grid max-w-6xl gap-14 px-5 py-20 sm:px-10 lg:grid-cols-2 lg:gap-24 lg:py-28">
        <div>
          <h2 className="heading text-[clamp(36px,4.4vw,56px)] text-ink">Come by, or text ahead</h2>
          <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-ink/85">
            Text us what you&apos;d like and when you&apos;ll be in. We&apos;ll confirm with your total and a link to pay, and it&apos;ll be
            waiting at the counter.
          </p>
          <p className="mt-8 text-[20px] text-ink">
            Text your order to <span className="font-bold whitespace-nowrap tabular">(206) 555-0142</span>
          </p>
          <p className="mt-3 text-[18px] text-ink/85">We&apos;re on the Ave, in Seattle&apos;s University District.</p>
        </div>
        <div>
          <h3 className="heading text-[28px] text-ink">Hours</h3>
          <dl className="mt-4 divide-y divide-line border-y border-line">
            {DAYS.map(({ key, label }) => {
              const h = BUSINESS.hours[key];
              return (
                <div key={key} className="flex items-baseline py-3.5 text-[17px]">
                  <dt className="text-ink">{label}</dt>
                  <span className="leader" aria-hidden />
                  <dd className={h ? "text-ink tabular" : "text-muted"}>{h ? `${clock(h.open)} to ${clock(h.close)}` : "Closed"}</dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>
    </section>
  );
}

export function StoreFooter() {
  return (
    <footer className="bg-shell text-shell-fg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 px-5 py-10 sm:px-10">
        <p className="flex items-baseline gap-3">
          <span className="heading text-[24px]">{SHOP_NAME}</span>
          <span lang="ar" dir="rtl" className="font-[family-name:var(--font-arabic)] text-[18px] text-qishr">
            {SHOP_NAME_AR}
          </span>
        </p>
        <p className="text-[14px] text-shell-fg/70">
          Orders, payments, and stock run on{" "}
          <Link href="/shop" className="font-semibold text-shell-fg underline decoration-qishr underline-offset-4 hover:text-qishr">
            Back of House
          </Link>
          .
        </p>
      </div>
    </footer>
  );
}
