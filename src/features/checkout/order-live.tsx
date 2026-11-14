"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { clearCart } from "@/features/cart/store";

// Keeps the confirmation page current while the bank confirms a payment,
// and empties the cart once the order is safely placed or paid.
export function OrderLive({ status, paymentMethod }: { status: string; paymentMethod: string }) {
  const router = useRouter();
  const settled = status !== "awaiting_payment";
  const placed = paymentMethod === "cod" ? status !== "cancelled" : !["awaiting_payment", "cancelled"].includes(status);

  useEffect(() => {
    if (placed) clearCart();
  }, [placed]);

  useEffect(() => {
    if (settled) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      router.refresh();
      if (tries >= 24) window.clearInterval(timer);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [settled, router]);

  return null;
}
