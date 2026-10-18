import type { Metadata } from "next";
import { Geist_Mono, Manrope, Marcellus, Reem_Kufi } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SHOP_NAME } from "@/lib/business";
import "./globals.css";

/** Every working word: labels, buttons, data. Arwa's own UI face. */
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

/** Only the shop name and page titles: a flared, carved-stone serif, like lettering over a doorway. */
const marcellus = Marcellus({
  variable: "--font-marcellus",
  subsets: ["latin"],
  weight: "400",
});

/** The shop's name in Arabic beside the wordmark. */
const reemKufi = Reem_Kufi({
  variable: "--font-reem-kufi",
  subsets: ["arabic"],
  weight: ["500"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${SHOP_NAME} · Back of House`,
  description: `Operations control room for ${SHOP_NAME}. Agents draft replies; the owner approves each one.`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${marcellus.variable} ${reemKufi.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          {children}
          <Toaster theme="light" position="top-center" />
        </TooltipProvider>
      </body>
    </html>
  );
}
