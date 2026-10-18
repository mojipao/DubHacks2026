import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrickBand, GypsumFrieze, Parapet, Qamariya } from "@/components/storefront/ornament";
import { SHOP_NAME, SHOP_NAME_AR } from "@/lib/business";

const WINDOWS = [
  { href: "#menu", label: "Menu" },
  { href: "#coffee", label: "Our coffee" },
  { href: "#visit", label: "Visit" },
  { href: "#catering", label: "Catering" },
];

/** An arched window: a small fanlight over a deep opening, framed in gypsum. The opening is a link. */
function Window({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="storefront-window group flex w-[22%] max-w-[150px] flex-col items-center lg:w-[min(14vh,150px)]">
      <Qamariya size="sm" className="w-[86%]" />
      <span className="storefront-lattice flex aspect-[4/5] w-full items-center justify-center border-[5px] border-paper px-1 text-center text-[12px] leading-tight font-semibold text-paper transition-colors duration-200 group-hover:text-qishr group-focus-visible:text-qishr sm:border-[7px] sm:text-[15px] lg:text-[16px]">
        {label}
      </span>
    </a>
  );
}

/**
 * The front of the house. Top floor: the fanlight and the name. Middle: four windows, the site's
 * navigation. Ground: the main door, and beside it the staff door into Back of House.
 */
export function Facade() {
  return (
    <div className="storefront-wall relative flex h-full w-full flex-col border-x-[8px] border-paper sm:border-x-[10px]">
      <Parapet className="block shrink-0" />

      {/* Top floor */}
      <div className="flex min-h-0 flex-[1.25] flex-col items-center justify-center px-6 pt-6 pb-7 text-center text-paper">
        <Qamariya className="aspect-[240/132] w-[min(300px,62%)] lg:h-[13.5vh] lg:w-auto" />
        <h1 className="heading mt-[2.2vh] text-[clamp(36px,9vw,48px)] leading-[1.04] lg:text-[clamp(38px,6.6vh,70px)]">{SHOP_NAME}</h1>
        <p lang="ar" dir="rtl" className="mt-2 font-[family-name:var(--font-arabic)] text-[clamp(22px,2.2vw,32px)] leading-none text-qishr">
          {SHOP_NAME_AR}
        </p>
      </div>

      <GypsumFrieze className="block shrink-0" />
      <BrickBand />

      {/* Middle floor: the windows are the navigation. */}
      <nav aria-label="Sections" className="flex min-h-0 flex-1 items-center justify-center gap-x-[3.5%] px-[4%] py-6 lg:py-[2.4vh]">
        {WINDOWS.map((w) => (
          <Window key={w.href} {...w} />
        ))}
      </nav>

      <GypsumFrieze className="block shrink-0" />
      <BrickBand />

      {/* Ground floor */}
      <div className="flex min-h-0 flex-[1.1] items-end justify-center gap-[6%] px-[6%] pt-8 lg:pt-[3vh]">
        <a
          href="#visit"
          className="storefront-door flex h-[230px] w-[min(250px,52%)] flex-col items-center justify-end rounded-t-full border-[8px] border-b-0 border-paper px-5 pb-6 text-center text-paper sm:border-[9px] lg:h-[min(26vh,280px)] lg:w-[min(23vh,250px)]"
        >
          <span className="flex w-full flex-col items-center gap-1 px-1 pb-2">
            <span className="heading text-[19px] leading-tight whitespace-nowrap lg:text-[clamp(18px,2.4vh,26px)]">Order by text</span>
            <span className="text-[13.5px] font-semibold whitespace-nowrap text-qishr tabular lg:text-[clamp(13px,1.6vh,15px)]">(206) 555-0142</span>
          </span>
        </a>

        <Link
          href="/shop"
          className="storefront-staff group relative flex h-[160px] w-[112px] flex-col border-[6px] border-b-0 border-paper lg:h-[min(18vh,190px)] lg:w-[min(13vh,130px)]"
        >
          {/* What's behind the door: the brown band of the control room. */}
          <span aria-hidden className="absolute inset-0 flex flex-col items-end bg-[#3a2215] pt-3 pr-1.5">
            <span className="flex items-center gap-1 text-[10px] font-bold text-paper">
              Orders <span className="rounded-full bg-qishr px-1 text-[9px] leading-[14px] text-[#2b1a10]">3</span>
            </span>
            <span className="mt-1 h-[2px] w-9 bg-qishr" />
            <span className="mt-3 h-[3px] w-10 rounded-full bg-paper/50" />
            <span className="mt-1.5 h-[3px] w-7 rounded-full bg-paper/30" />
            <span className="mt-3 h-[3px] w-10 rounded-full bg-paper/50" />
            <span className="mt-1.5 h-[3px] w-6 rounded-full bg-paper/30" />
          </span>
          <span className="storefront-staff-leaf relative flex h-full flex-col items-center justify-center gap-1.5 bg-[#2b1a10] px-2 text-center">
            <span className="text-[13.5px] leading-snug font-semibold text-paper">Back of House view</span>
            <ArrowRight aria-hidden className="size-4 text-qishr" />
            <span aria-hidden className="absolute top-[76%] right-2 size-1.5 rounded-full bg-qishr" />
          </span>
        </Link>
      </div>

      {/* The plinth and the step up from the street. */}
      <div className="h-5 shrink-0 bg-[#4a2915]" />
    </div>
  );
}
