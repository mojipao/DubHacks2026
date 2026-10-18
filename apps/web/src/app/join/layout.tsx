import type { Metadata } from "next";
import { BUSINESS } from "@/lib/business";

export const metadata: Metadata = {
  title: `Text ${BUSINESS.name}`,
  description: "Text a demo coffee shop on iMessage. An AI drafts the reply; the owner approves it.",
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
