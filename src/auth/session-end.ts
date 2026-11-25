import { ref } from "vue";

/** Which sign-in ended this device's session; kept until the next accepted sign-in so Login can explain it. */
export const sessionEndReason = ref<string>();
