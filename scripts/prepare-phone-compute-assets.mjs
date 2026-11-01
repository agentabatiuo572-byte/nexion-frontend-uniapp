import { mkdir, readFile, writeFile, rename, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const directory = path.join(root, "src/static/phone-compute");
const revision = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41";
const expected = "6fd5d72fe4589f189f8ebc006442dbb529bb7ce38f8082112682524616046452";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
await mkdir(directory, { recursive: true });
const modelPath = path.join(directory, "model.onnx");
if (!existsSync(modelPath) || digest(await readFile(modelPath)) !== expected) {
  const response = await fetch(`https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/${revision}/onnx/model.onnx`);
  if (!response.ok) throw new Error(`PHONE_MODEL_DOWNLOAD_${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (digest(bytes) !== expected) throw new Error("PHONE_MODEL_DOWNLOAD_DIGEST_INVALID");
  await writeFile(`${modelPath}.download`, bytes);
  await rename(`${modelPath}.download`, modelPath);
}
const packageRoot = path.join(root, "node_modules/onnxruntime-web");
const pkg = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
if (pkg.version !== "1.23.2") throw new Error("PHONE_ORT_VERSION_INVALID");
const files = ["ort.wasm.min.js", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"];
for (const name of files) await copyFile(path.join(packageRoot, "dist", name), path.join(directory, name));
for (const [name, url] of [
  ["ONNXRUNTIME-LICENSE.txt", "https://raw.githubusercontent.com/microsoft/onnxruntime/v1.23.2/LICENSE"],
  ["MINILM-MODEL-CARD.md", `https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/raw/${revision}/README.md`],
  ["APACHE-LICENSE-2.0.txt", "https://www.apache.org/licenses/LICENSE-2.0.txt"],
]) {
  if (existsSync(path.join(directory, name))) continue;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`PHONE_LICENSE_DOWNLOAD_${response.status}`);
  await writeFile(path.join(directory, name), await response.text());
}
await build({ entryPoints: [path.join(root, "src/lib/phone-embedding-worker.mjs")], outfile: path.join(directory, "phone-embedding-worker.js"),
  bundle: true, format: "iife", platform: "browser", target: "es2022", minify: true });
const assets = {};
for (const name of ["model.onnx", ...files, "phone-embedding-worker.js", "ONNXRUNTIME-LICENSE.txt", "MINILM-MODEL-CARD.md", "APACHE-LICENSE-2.0.txt"]) {
  const bytes = await readFile(path.join(directory, name));
  assets[name] = { sha256: digest(bytes), sizeBytes: bytes.length };
}
await writeFile(path.join(directory, "manifest.json"), JSON.stringify({ schemaVersion: 1, modelRevision: revision,
  modelDigest: "sha256:4fd205f37776262f8e8d3224ce5a4ed0b19bd106129046da04322a6bd19b4562", ortVersion: pkg.version, assets }, null, 2) + "\n");
console.log(JSON.stringify({ prepared: true, directory, modelRevision: revision, ortVersion: pkg.version, assets }));
