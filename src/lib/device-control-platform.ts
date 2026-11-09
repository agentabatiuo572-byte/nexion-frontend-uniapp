import type { Device } from "@/store/types";

/** H5 observes phone lifecycle; purchased devices keep their shared controls. */
export function canControlDevice(device: Pick<Device, "kind">): boolean {
  if (device.kind === "unknown") return false;
  // #ifdef H5
  if (device.kind === "phone") return false;
  // #endif
  return true;
}
