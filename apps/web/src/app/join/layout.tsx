import type { Metadata } from "next";
import { SHOP_NAME } from "@/lib/business";

export const metadata: Metadata = {
  title: `Text ${SHOP_NAME}`,
  description: "Text a demo coffee house on iMessage. An AI drafts the reply; the owner approves it.",
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
