import { ref, watch } from "vue";

const STORAGE_KEY = "uvel-session-end-reason";
const storage = typeof sessionStorage === "undefined" ? null : sessionStorage;

/**
 * Which sign-in ended this device's session. Kept until the next accepted sign-in so Login can explain it,
 * also across a browser reload (the refresh cookie is gone by then, so the server cannot say it again).
 */
export const sessionEndReason = ref<string | undefined>(storage?.getItem(STORAGE_KEY) ?? undefined);
watch(sessionEndReason, (reason) => {
  if (reason) storage?.setItem(STORAGE_KEY, reason);
  else storage?.removeItem(STORAGE_KEY);
});
