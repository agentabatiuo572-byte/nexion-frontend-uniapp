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

export function readHostPackage(platform: Device["platform"]): string | undefined {
  try {
    if (platform === "android") return String(plus.android.invoke(plus.android.runtimeMainActivity(), "getPackageName"));
    const bundle = plus.ios.invoke("NSBundle", "mainBundle");
    try { return String(plus.ios.invoke(bundle, "bundleIdentifier")); }
    finally { plus.ios.deleteObject(bundle); }
  } catch {
    // Whole-package updates are still available when the native package name cannot be read.
    return undefined;
  }
}

export function verifiedResource(origin: string, platform: string, p: ResourcePolicy, device: Device): boolean {
  const debugHost = p.appId === "HBuilder" && platform === "android" && device.hostPackage === "io.dcloud.HBuilder"
    && p.minNativeBuild === 1532 && p.maxNativeBuild === 1532;
  const productHost = p.appId === appId && device.hostPackage === "ai.uvel.app";
  if (origin.replace(/\/+$/, "") !== testResourceOrigin || p.updateType !== "resource" || p.minBuild !== 1
      || platform !== device.platform || (!debugHost && !productHost) || plus.runtime.appid !== p.appId
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
  let target = `_doc/uvel-test-updates/${p.sha256}-${Date.now()}.wgt`;
  let entry: PlusIoFileEntry | undefined;
  let stage = "download";
  try {
    target = await new Promise<string>((resolve, reject) => {
      const download = plus.downloader.createDownload(p.downloadUrl, { filename: target, timeout: 30, retry: 0 }, (task, status) => {
        if (status === 200 && task.filename) resolve(task.filename); else reject(Error(`download status ${status}`));
      });
      download.addEventListener("statechanged", task => {
        if (Number(task.downloadedSize) > p.sizeBytes!) { download.abort(); reject(Error("resource too large")); }
      });
      download.start();
    });
    stage = "open";
    entry = await new Promise<PlusIoFileEntry>((resolve, reject) => plus.io.resolveLocalFileSystemURL(target, file => resolve(file as unknown as PlusIoFileEntry), reject));
    const file = await new Promise<PlusIoFile>((resolve, reject) => entry!.file(resolve, reject));
    if (!file.size || file.size !== p.sizeBytes) throw Error("resource size");
    stage = "read";
    const hash = sha256.create();
    const chunkSize = 256 * 1024;
    for (let offset = 0; offset < file.size; offset += chunkSize) {
      const length = Math.min(chunkSize, file.size - offset);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new plus.io.FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        // HTML5+ File.slice includes its end byte (unlike the Web Blob API).
        reader.readAsDataURL(file.slice(offset, offset + length - 1));
      });
      const comma = dataUrl.indexOf(",");
      if (comma < 0 || !dataUrl.slice(0, comma).endsWith(";base64")) throw Error("resource read");
      const bytes = new Uint8Array(uni.base64ToArrayBuffer(dataUrl.slice(comma + 1)));
      if (bytes.length !== length) throw Error("resource chunk size");
      hash.update(bytes);
    }
    stage = "digest";
    if (bytesToHex(hash.digest()) !== p.sha256) throw Error("resource digest");
    stage = "install";
    await new Promise<void>((resolve, reject) => plus.runtime.install(target, { force: false }, () => resolve(), reject));
  } catch (error) {
    const detail = error instanceof Error ? error.message : (error as {code?: number})?.code;
    console.warn("[app-update] resource failure", stage, detail);
    throw error;
  } finally {
    if (entry) entry.remove();
    else plus.io.resolveLocalFileSystemURL(target, partial => partial.remove(), () => {});
  }
}
