import type { Device } from "@/store/types";
import { useProductImage } from "./use-product-image";

export function useDeviceProductImage(device: () => Pick<Device, "kind" | "imageUrl"> | undefined) {
  return useProductImage(() => {
    const row = device();
    return row?.kind === "phone" ? "/static/img/home-glass-20260928/phone.webp" : row?.imageUrl;
  });
}
