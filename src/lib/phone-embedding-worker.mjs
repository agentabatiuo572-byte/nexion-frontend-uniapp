import { sha256 } from "js-sha256";
import { PHONE_EMBEDDING_MODEL } from "./phone-embedding-model.ts";

const MODEL_REVISION = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41";
const MODEL_SHA = "6fd5d72fe4589f189f8ebc006442dbb529bb7ce38f8082112682524616046452";
const RUNTIME_KEY = "phone-minilm-wasm-v1";
const BINDING_FIELDS = ["taskNo", "generation", "inputHash", "taskClass", "runtimeKey", "modelRevision", "workload", "seed"];
let session;
let busy = false;

function canonical(value) {
  return JSON.stringify(value, (_key, item) => item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
}
function readBytes(url) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", url); xhr.responseType = "arraybuffer";
    xhr.onload = () => xhr.status === 200 || xhr.status === 0 ? resolve(xhr.response) : reject(new Error(`PHONE_ASSET_HTTP_${xhr.status}`));
    xhr.onerror = () => reject(new Error("PHONE_ASSET_READ_FAILED"));
    xhr.send();
  });
}
function base64(bytes) {
  let text = "";
  for (let offset = 0; offset < bytes.length; offset += 16384) text += String.fromCharCode(...bytes.subarray(offset, offset + 16384));
  return btoa(text);
}
function validateTask(task) {
  if (task.taskClass !== "EM" || task.runtimeKey !== RUNTIME_KEY || task.modelRevision !== MODEL_REVISION
    || task.modelDigest !== PHONE_EMBEDDING_MODEL.modelDigest || !/^CV2-[0-9A-F]{32}$/.test(task.taskNo)
    || !Number.isSafeInteger(task.generation) || task.generation <= 0 || !/^[a-f0-9]{64}$/.test(task.inputHash)
    || !Number.isInteger(task.seed) || task.seed < 0 || task.seed > 2147483647) throw new Error("PHONE_TASK_BINDING_INVALID");
  const work = task.workload;
  if (!work || Object.keys(work).some(key => !["inputIds", "attentionMask", "tokenTypeIds", "texts"].includes(key))) throw new Error("PHONE_WORKLOAD_INVALID");
  let seq;
  for (const [name, maximum] of [["inputIds", 30521], ["attentionMask", 1], ["tokenTypeIds", 1]]) {
    if (!Array.isArray(work[name]) || work[name].length !== 2) throw new Error("PHONE_BATCH_INVALID");
    for (const row of work[name]) {
      if (!Array.isArray(row) || row.length < 2 || row.length > 128) throw new Error("PHONE_SEQUENCE_INVALID");
      seq ??= row.length;
      if (row.length !== seq || row.some(value => !Number.isInteger(value) || value < 0 || value > maximum)) throw new Error("PHONE_TENSOR_INVALID");
    }
  }
  if (work.attentionMask.some(row => row.reduce((sum, value) => sum + value, 0) < 2)) throw new Error("PHONE_ATTENTION_EMPTY");
  return seq;
}

self.onmessage = async ({ data }) => {
  const { id, action } = data;
  try {
    if (action === "init") {
      const base = data.assetsBase;
      importScripts(`${base}ort.wasm.min.js`);
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
      ort.env.wasm.wasmPaths = base;
      const bytes = await readBytes(data.modelUrl);
      if (sha256(bytes) !== MODEL_SHA) throw new Error("PHONE_MODEL_DIGEST_INVALID");
      session = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], executionMode: "sequential" });
      self.postMessage({ id, state: "READY", modelSha256: MODEL_SHA, modelRevision: MODEL_REVISION, runtimeKey: RUNTIME_KEY });
      return;
    }
    if (action !== "run" || !session || busy) throw new Error("PHONE_ENGINE_NOT_READY");
    busy = true;
    const task = data.task;
    const seq = validateTask(task);
    const feeds = {};
    for (const [name, key] of [["input_ids", "inputIds"], ["attention_mask", "attentionMask"], ["token_type_ids", "tokenTypeIds"]]) {
      feeds[name] = new ort.Tensor("int64", BigInt64Array.from(task.workload[key].flat().map(value => BigInt(value))), [2, seq]);
    }
    const started = performance.now();
    const output = await session.run(feeds);
    const hidden = output[session.outputNames[0]];
    if (hidden.dims.join(",") !== `2,${seq},384`) throw new Error("PHONE_ENCODER_SHAPE_INVALID");
    const values = hidden.data;
    const vectors = new Float32Array(768);
    for (let batch = 0; batch < 2; batch++) {
      const count = task.workload.attentionMask[batch].reduce((sum, value) => sum + value, 0);
      let squared = 0;
      for (let dimension = 0; dimension < 384; dimension++) {
        let sum = 0;
        for (let token = 0; token < seq; token++) sum += values[(batch * seq + token) * 384 + dimension] * task.workload.attentionMask[batch][token];
        const value = sum / count;
        if (!Number.isFinite(value)) throw new Error("PHONE_NONFINITE_EMBEDDING");
        vectors[batch * 384 + dimension] = value;
        squared += value * value;
      }
      if (!(squared > 0)) throw new Error("PHONE_ZERO_EMBEDDING");
      const norm = Math.sqrt(squared);
      for (let dimension = 0; dimension < 384; dimension++) vectors[batch * 384 + dimension] /= norm;
    }
    const bytes = new Uint8Array(3072);
    const view = new DataView(bytes.buffer);
    vectors.forEach((value, index) => view.setFloat32(index * 4, value, true));
    const result = { schemaVersion: 1, taskClass: "EM", runtimeKey: RUNTIME_KEY, modelRevision: MODEL_REVISION,
      inputHash: task.inputHash, taskBindingHash: sha256(canonical(Object.fromEntries(BINDING_FIELDS.map(key => [key, task[key]])))),
      artifact: { path: "embedding.f32", mediaType: "application/octet-stream", sha256: sha256(bytes), sizeBytes: 3072 },
      metrics: { batchSize: 2, sequenceLength: seq, dimensions: 384, cpuThreads: 1 } };
    const bundle = new TextEncoder().encode(canonical({ result, artifactBase64: base64(bytes) }));
    self.postMessage({ id, state: "RESULT", result, resultHash: sha256(bundle), resultArtifactBase64: base64(bundle), actualDurationMs: Math.round(performance.now() - started) });
    busy = false;
  } catch (error) {
    busy = false;
    self.postMessage({ id, state: "ERROR", error: error instanceof Error ? error.message : String(error) });
  }
};
