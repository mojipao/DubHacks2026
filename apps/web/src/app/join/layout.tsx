import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Text Larch & Rye",
  description: "Text a demo bakery on iMessage. An AI drafts the reply; the owner approves it.",
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
