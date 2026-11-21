import { p256 } from "@noble/curves/p256";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex } from "@noble/hashes/utils";
import trust from "./test-resource-trust.json";

const { origin: testResourceOrigin, appId, publicKey: testPublicKey } = trust;
const maxBytes = 32 * 1024 * 1024;

export interface ResourceFields {
  appId?: string;
  minNativeBuild?: number;
  maxNativeBuild?: number;
  sizeBytes?: number;
  signature?: string;
}

interface ResourcePolicy extends ResourceFields {
  latestBuild: number;
  minBuild: number;
  updateType: string;
  versionName: string;
  downloadUrl: string;
  sha256: string;
}

type Device = { platform: "android" | "ios"; build: number; resourceBuild?: number; hostPackage?: string };

export function verifiedResource(origin: string, platform: string, p: ResourcePolicy, device: Device): boolean {
  const debugHost = p.appId === "HBuilder" && platform === "android" && device.hostPackage === "io.dcloud.HBuilder"
    && p.minNativeBuild === 1532 && p.maxNativeBuild === 1532;
  if (origin.replace(/\/+$/, "") !== testResourceOrigin || p.updateType !== "resource" || p.minBuild !== 1
      || platform !== device.platform || (!debugHost && p.appId !== appId) || plus.runtime.appid !== p.appId
      || !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(p.versionName)
      || !/^[0-9a-f]{64}$/.test(p.sha256) || !/^[0-9a-f]{128}$/.test(p.signature ?? "")
      || !Number.isSafeInteger(p.latestBuild) || p.latestBuild <= 0
      || !Number.isSafeInteger(p.minNativeBuild) || !Number.isSafeInteger(p.maxNativeBuild)
      || p.minNativeBuild! < 1 || device.build < p.minNativeBuild! || device.build > p.maxNativeBuild!
      || !Number.isSafeInteger(p.sizeBytes) || p.sizeBytes! < 1 || p.sizeBytes! > maxBytes
      || p.downloadUrl !== `${testResourceOrigin}/app-updates/${platform}/${p.sha256}.wgt`) return false;
  const message = ["uvel-test-resource-v1", platform, p.appId, p.versionName, p.latestBuild,
    p.minNativeBuild, p.maxNativeBuild, p.sizeBytes, p.sha256].join("\n");
  // The signed fields are ASCII and do not require TextEncoder support in the App JS engine.
  const digest = sha256(Uint8Array.from(message, char => char.charCodeAt(0)));
  return p256.verify(p.signature!, digest, testPublicKey, { prehash: false, lowS: false, format: "compact" });
}

export async function installResource(origin: string, platform: string, p: ResourcePolicy, device: Device) {
  if (!verifiedResource(origin, platform, p, device) || !device.resourceBuild || device.resourceBuild >= p.latestBuild) throw Error("untrusted resource");
  // The downloader writes an app-private file with the extension expected by runtime.install.
  const target = `_doc/uvel-test-updates/${p.sha256}-${Date.now()}.wgt`;
  let entry: PlusIoFileEntry | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      const download = plus.downloader.createDownload(p.downloadUrl, { filename: target, timeout: 30, retry: 0 }, (_, status) => {
        if (status === 200) resolve(); else reject(Error("resource download"));
      });
      download.addEventListener("statechanged", task => {
        if (Number(task.downloadedSize) > p.sizeBytes!) { download.abort(); reject(Error("resource too large")); }
      });
      download.start();
    });
    entry = await new Promise<PlusIoFileEntry>((resolve, reject) => plus.io.resolveLocalFileSystemURL(target, file => resolve(file as unknown as PlusIoFileEntry), reject));
    const file = await new Promise<PlusIoFile>((resolve, reject) => entry!.file(resolve, reject));
    if (file.size !== p.sizeBytes) throw Error("resource size");
    const hash = sha256.create();
    const chunkSize = 256 * 1024;
    for (let offset = 0; offset < file.size!; offset += chunkSize) {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new plus.io.FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file.slice(offset, Math.min(file.size!, offset + chunkSize)));
      });
      const comma = dataUrl.indexOf(",");
      if (comma < 0 || !dataUrl.slice(0, comma).endsWith(";base64")) throw Error("resource read");
      hash.update(new Uint8Array(uni.base64ToArrayBuffer(dataUrl.slice(comma + 1))));
    }
    if (bytesToHex(hash.digest()) !== p.sha256) throw Error("resource digest");
    await new Promise<void>((resolve, reject) => plus.runtime.install(target, { force: false }, () => resolve(), reject));
  } finally {
    if (entry) entry.remove();
    else plus.io.resolveLocalFileSystemURL(target, partial => partial.remove(), () => {});
  }
}
