<template>
  <PhoneOnboardingFlow v-if="options" ref="flow" entry="connect" :options="options" :visible="visible" />
</template>

<script setup lang="ts">
import { onBackPress, onHide, onLoad, onShow } from "@dcloudio/uni-app";
import { ref } from "vue";
import PhoneOnboardingFlow from "@/components/onboarding/phone-onboarding-flow.vue";
import { navReset } from "@/lib/route";

const options = ref<Record<string, string> | null>(null);
const flow = ref<{ handleBack(event: object): void } | null>(null);
const visible = ref(true);
onLoad((query) => {
  // #ifdef H5
  navReset({ url: "/pages/register/success?download=1", fail: () => {} });
  return;
  // #endif
  options.value = query ?? {};
});
onShow(() => { visible.value = true; });
onHide(() => { visible.value = false; });
onBackPress((event) => {
  flow.value?.handleBack(event);
  return true;
});
</script>
