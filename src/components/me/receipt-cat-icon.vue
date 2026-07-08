<!--
  ReceiptCatIcon — inline SVG per ReceiptCategory for the receipts list + modal.
  Replaces lucide-style category icons with inline SVG paths.
  stroke=currentColor driven by :color. Rendered in H5 + App (webview).
-->
<template>
  <svg
    width="16"
    height="16"
    :viewBox="categoryViewBox"
    :fill="category === 'FT' ? 'currentColor' : 'none'"
    :stroke="category === 'FT' ? 'none' : color"
    :stroke-width="categoryStrokeWidth"
    :style="{ color }"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <!-- IG: Image -->
    <template v-if="category === 'IG'">
      <rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </template>
    <!-- VG: Video -->
    <template v-else-if="category === 'VG'">
      <path d="M3 2.5h10c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5H3A1.5 1.5 0 0 1 1.5 13V4c0-.83.67-1.5 1.5-1.5m-1.5 3h13" />
      <path d="m3.5 5.5 2-3m1.5 3 2-3m1.5 3 2-3M6.5 8v4l4-2z" />
    </template>
    <!-- LL: MessageCircleMore -->
    <template v-else-if="category === 'LL'">
      <path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
    </template>
    <!-- FT: Setup -->
    <template v-else-if="category === 'FT'">
      <path d="M224 160a64 64 0 0 0-64 64v576a64 64 0 0 0 64 64h576a64 64 0 0 0 64-64V224a64 64 0 0 0-64-64zm0-64h576a128 128 0 0 1 128 128v576a128 128 0 0 1-128 128H224A128 128 0 0 1 96 800V224A128 128 0 0 1 224 96" />
      <path d="M384 416a64 64 0 1 0 0-128a64 64 0 0 0 0 128m0 64a128 128 0 1 1 0-256a128 128 0 0 1 0 256" />
      <path d="M480 320h256q32 0 32 32t-32 32H480q-32 0-32-32t32-32m160 416a64 64 0 1 0 0-128a64 64 0 0 0 0 128m0 64a128 128 0 1 1 0-256a128 128 0 0 1 0 256" />
      <path d="M288 640h256q32 0 32 32t-32 32H288q-32 0-32-32t32-32" />
    </template>
    <!-- EM: Embedding -->
    <template v-else-if="category === 'EM'">
      <path d="m13.11 7.664 1.78 2.672" />
      <path d="m14.162 12.788-3.324 1.424" />
      <path d="M20 4 13.94 5.515" />
      <path d="M3 3v16a2 2 0 0 0 2 2h16" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="16" cy="12" r="2" />
      <circle cx="9" cy="15" r="2" />
    </template>
    <!-- SP: Audio -->
    <template v-else-if="category === 'SP'">
      <path d="M11.5 6C7.022 6 4.782 6 3.391 7.172S2 10.229 2 14s0 5.657 1.391 6.828S7.021 22 11.5 22c4.478 0 6.718 0 8.109-1.172S21 17.771 21 14c0-1.17 0-2.158-.041-3" />
      <path d="m18.5 2 .258.697c.338.914.507 1.371.84 1.704.334.334.791.503 1.705.841L22 5.5l-.697.258c-.914.338-1.371.507-1.704.84-.334.334-.503.791-.841 1.705L18.5 9l-.258-.697c-.338-.914-.507-1.371-.84-1.704-.334-.334-.791-.503-1.705-.841L15 5.5l.697-.258c.914-.338 1.371-.507 1.704-.84.334-.334.503-.791.841-1.705z" />
      <path d="M12 10v8m-3-6v4m-3-3v2m9-3v4m3-3v2" />
    </template>
    <!-- KY: ShieldCheck -->
    <template v-else>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" /><path d="m9 12 2 2 4-4" />
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ReceiptCategory } from "@/mock/receipt";

const props = defineProps<{ category: ReceiptCategory; color: string }>();

const categoryViewBox = computed(() => {
  if (props.category === "VG") return "0 0 16 16";
  return props.category === "FT" ? "0 0 1024 1024" : "0 0 24 24";
});

const categoryStrokeWidth = computed(() => {
  if (props.category === "LL") return 2.25;
  if (props.category === "VG") return 1;
  return props.category === "SP" ? 1.5 : 2;
});
</script>
