/**
 * renderjs for the payment PIN layer (App WebView). The logic layer has no window, so while the layer is open this reports
 * the WebView's visual viewport to it: the keyboard shrinks the visual viewport and the WebView pans it to the focused PIN
 * input, while the fixed mask stays on the layout viewport (usePaymentPinViewport).
 */
type Owner = { callMethod(name: string, value: { height: number; offsetTop: number }): void };
type View = { stopViewport?: () => void };

export const paymentPinViewportView = {
  beforeUnmount(this: View) { this.stopViewport?.(); },
  methods: {
    track(this: View, open: boolean, _previous: boolean | undefined, owner: Owner) {
      this.stopViewport?.();
      this.stopViewport = undefined;
      const viewport = window.visualViewport;
      if (!open || !viewport) return;
      const report = () => owner.callMethod("onPinViewport", { height: viewport.height, offsetTop: viewport.offsetTop });
      viewport.addEventListener("resize", report);
      viewport.addEventListener("scroll", report);
      this.stopViewport = () => { viewport.removeEventListener("resize", report); viewport.removeEventListener("scroll", report); };
      report();
    },
  },
};
