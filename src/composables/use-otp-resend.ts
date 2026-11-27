import { ref } from "vue";

export function useOtpResend() {
  const resendLeft = ref(0);
  let resendDeadline = 0;
  let resendTimer: ReturnType<typeof setInterval> | undefined;

  function refreshResend() {
    resendLeft.value = Math.max(0, Math.ceil((resendDeadline - Date.now()) / 1000));
    if (resendLeft.value === 0 && resendTimer) {
      clearInterval(resendTimer);
      resendTimer = undefined;
    }
    return resendLeft.value;
  }

  function startResend(seconds: number) {
    if (resendTimer) clearInterval(resendTimer);
    resendDeadline = Date.now() + seconds * 1000;
    resendTimer = setInterval(refreshResend, 1000);
    refreshResend();
  }

  function clearResend() {
    resendDeadline = 0;
    refreshResend();
  }

  return { resendLeft, refreshResend, startResend, clearResend };
}
