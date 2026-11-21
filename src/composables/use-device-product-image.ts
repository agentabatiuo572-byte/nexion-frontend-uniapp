import { computed } from "vue";
import type { Device } from "@/store/types";
import { getProductMedia } from "@/lib/product-media";
import { revalidateProductCatalog } from "@/store/product-catalog";
import { onShow } from "@/composables/use-tab-page-lifecycle";
import { useProductImage } from "./use-product-image";

// These retired SKUs use the explicitly assigned series artwork in the device inventory.
const retiredDeviceArtwork = new Map([
  ["uvel-sku-009", "cloud-share"],
  ["uvel-sku-007", "stellarbox-s1"],
  ["uvel-sku-955", "stellarbox-s1"],
]);

export function useDeviceProductImage(device: () => Pick<Device, "kind" | "productCode" | "capacitySource">) {
  const source = computed(() => {
    const row = device();
    if (row.kind === "phone") return "/static/img/home-glass-20260928/phone.webp";
    const sku = row.productCode?.trim() || (row.capacitySource !== "server" ? row.kind : "");
    if (!sku) return undefined;
    return getProductMedia(sku)?.src
      ?? ("id" in row ? getProductMedia(retiredDeviceArtwork.get(sku.toLowerCase()))?.src : undefined);
  });
  onShow(() => { if (device().kind !== "phone") void revalidateProductCatalog(); });
  return useProductImage(() => source.value);
}
