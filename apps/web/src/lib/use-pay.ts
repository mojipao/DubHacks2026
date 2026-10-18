"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useStore } from "@/lib/data/store";
import { money } from "@/lib/format";

/**
 * "Customer pays (sandbox)": lane 2's POST /dev/square-pay pays the order's real Square sandbox link,
 * and the signed webhook flips it (both halves of a split) to paid. When the order has no Square link
 * or Square isn't configured, offer the mark-paid fallback instead of failing silently.
 */
export function usePay() {
  const { customerPays, markPaid } = useStore();
  const [paying, setPaying] = useState<string | null>(null);

  const pay = useCallback(
    async (orderId: string, who?: string | null) => {
      setPaying(orderId);
      try {
        const { amountCents } = await customerPays(orderId);
        toast.success(`${who ?? "Customer"} paid${amountCents ? ` ${money(amountCents)}` : ""}`, {
          description: "Square sandbox payment. The order flips to paid when the webhook lands.",
        });
      } catch (err) {
        const status = typeof err === "object" && err && "status" in err ? Number((err as { status: unknown }).status) : 0;
        if (status === 409 || status === 503 || status === 400) {
          toast.error(err instanceof Error ? err.message : "Square couldn't take this payment", {
            action: {
              label: "Mark paid",
              onClick: () =>
                void markPaid(orderId)
                  .then(() => toast.success("Marked paid"))
                  .catch((e: Error) => toast.error(e.message)),
            },
          });
        } else {
          toast.error(err instanceof Error ? err.message : "Payment failed");
        }
      } finally {
        setPaying(null);
      }
    },
    [customerPays, markPaid],
  );

  return { pay, paying };
}
