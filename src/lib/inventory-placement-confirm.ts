import type { Messages } from "@/i18n/messages/en";
import { fmt } from "@/i18n/format";
import { confirm } from "@/store/ui";

/** Devices a purchase is expected to deliver to Device Inventory instead of activating, at the current free slots (PRD §7.3). */
export type InventoryPlacement = { count: number; full: boolean };

/** Asks before a new order, or before checkout from a bundle, when devices would go to inventory (03 §3.5 决定级). */
export function confirmInventoryPlacement(t: Messages, placement: InventoryPlacement, action: "order" | "checkout", owner?: string): Promise<boolean> {
  const copy = t.tradein;
  return confirm({
    title: placement.full ? copy.inventoryConfirmTitle : fmt(copy.inventoryConfirmPartialTitle, { count: placement.count }),
    message: placement.full ? copy.inventoryConfirmBody : copy.inventoryConfirmPartialBody,
    confirmLabel: action === "order" ? copy.inventoryConfirmOrder : copy.inventoryConfirmCheckout,
    cancelLabel: t.store.coCancel,
    icon: "warn",
    owner,
  });
}
