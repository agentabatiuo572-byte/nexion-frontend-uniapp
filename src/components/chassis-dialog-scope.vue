<!--
  ChassisDialogScope — wraps the chassis scroller's own slots. Dialogs mounted there take their scroll lock from here,
  and that lock also lifts the scroller over the header, the tab bar and the bottom trays: iOS WebKit stacks a fixed
  dialog inside the scroller with the scroller itself, so only a lifted scroller lets such a dialog cover the chrome.
  Dialogs outside the scroller (#pageFixed, the global overlay host, chassis sheets) take the chassis' plain lock: the
  page holds still under them, and the page content stays under the trays' glass while their mask covers all of it.
-->
<template>
  <slot />
</template>

<script setup lang="ts">
import { provide } from "vue";
import { DIALOG_SCROLL_LOCK } from "@/composables/use-dialog-a11y";

const props = defineProps<{ acquire: () => () => void }>();
provide(DIALOG_SCROLL_LOCK, props.acquire);
</script>
