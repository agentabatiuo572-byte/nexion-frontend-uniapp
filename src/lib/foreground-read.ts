import { ref } from "vue";

export const appReadForeground = ref(false);
export const appReadOnline = ref(true);
export const documentReadVisible = ref(true);

export function foregroundReadAllowed(): boolean {
  return appReadForeground.value && appReadOnline.value && documentReadVisible.value;
}
