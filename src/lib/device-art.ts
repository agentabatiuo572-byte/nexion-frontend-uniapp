import type { DeviceKind } from "@/store/types";

export function rankingDeviceImage(kind: DeviceKind): string | null {
  switch (kind) {
    case "stellarrack-p1":
    case "stellarrack-p2":
      return "/static/img/products/nexionrack-p1-ranking.png";
    case "stellarbox-pro":
    case "stellarbox-pro-v2":
      return "/static/img/products/nexionbox-pro-ranking.png";
    case "stellarbox-s1":
      return "/static/img/products/nexionbox-s1-ranking.png";
    case "phone":
      return "/static/img/devices/real-phone-ui.png";
    default:
      return null;
  }
}
