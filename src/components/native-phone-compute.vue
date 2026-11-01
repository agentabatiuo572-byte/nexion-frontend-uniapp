<template>
  <!-- @vue-ignore -->
  <view class="native-phone-compute" aria-hidden="true" :compute-command="command" :change:compute-command="phoneView.apply" />
</template>
<script lang="ts">
import { defineComponent } from "vue";
import { phoneComputeCommand, mountNativePhoneCompute, unmountNativePhoneCompute, receiveNativePhoneCompute } from "@/services/phone-compute";
export default defineComponent({
  setup() { return { command: phoneComputeCommand }; },
  mounted() { mountNativePhoneCompute(); },
  beforeUnmount() { unmountNativePhoneCompute(); },
  methods: { receivePhoneCompute(value: unknown) { receiveNativePhoneCompute(value); } },
});
</script>
<script module="phoneView" lang="renderjs">
// @ts-expect-error uni-app renderjs is a separate WebView script.
export default {
  mounted() {
    this.worker = null;
    this.owner = null;
    this.commandId = 0;
    document.addEventListener("visibilitychange", () => { if (document.hidden) this.stop("APP_PAUSED"); });
    window.addEventListener("pagehide", () => this.stop("APP_PAUSED"));
  },
  methods: {
    stop(reason, id) {
      if (this.worker) { this.worker.terminate(); this.worker = null; }
      this.owner?.callMethod("receivePhoneCompute", { id: id || this.commandId, state: "EXITED", reason });
    },
    apply(command, previous, owner) {
      if (!command || command.id === previous?.id) return;
      this.owner = owner;
      this.commandId = command.id;
      if (command.action === "stop") { this.stop(command.reason, command.id); return; }
      try {
        if (command.action === "init") {
          if (this.worker) this.worker.terminate();
          const base = new URL("./static/phone-compute/", document.baseURI).href;
          this.worker = new Worker(`${base}phone-embedding-worker.js`);
          this.worker.onmessage = event => owner.callMethod("receivePhoneCompute", event.data);
          this.worker.onerror = event => owner.callMethod("receivePhoneCompute", { id: command.id, state: "ERROR", error: event.message || "PHONE_WORKER_LOAD_FAILED" });
          this.worker.postMessage({ id: command.id, action: "init", assetsBase: base, modelUrl: new URL(command.modelUrl, document.baseURI).href });
        } else if (command.action === "run") {
          if (!this.worker) throw new Error("PHONE_WORKER_MISSING");
          this.worker.postMessage(command);
        }
      } catch (error) {
        owner.callMethod("receivePhoneCompute", { id: command.id, state: "ERROR", error: error.message || String(error) });
      }
    },
  },
};
</script>
<style>
.native-phone-compute { position: absolute; width: 0; height: 0; overflow: hidden; pointer-events: none; }
</style>
