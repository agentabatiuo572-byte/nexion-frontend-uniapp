// WebView side of OtpCodeInput on App-Vue (its renderjs module). uni puts aria-label on the uni-input host only and the
// logic layer has no DOM, so the focusable inner input gets the localized name here. H5 gets it from installFieldNaming.
export const otpFieldNameView = {
  methods: {
    sync(value: { id: string; label: string }) {
      const name = () => document.querySelector(`#${value.id} .uni-input-input`)?.setAttribute("aria-label", value.label);
      name();
      requestAnimationFrame(name);
    },
  },
};
