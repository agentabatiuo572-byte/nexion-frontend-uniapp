import { ref } from "vue";

export const appReadForeground = ref(false);
export const appReadOnline = ref(true);
// Native reads also wait for the first network probe. Only an observed disconnect sets this flag.
export const appDeviceOffline = ref(false);
export const documentReadVisible = ref(true);

export function foregroundReadAllowed(): boolean {
  return appReadForeground.value && appReadOnline.value && documentReadVisible.value;
}
