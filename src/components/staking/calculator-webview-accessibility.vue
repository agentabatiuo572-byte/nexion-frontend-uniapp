<template>
  <!-- @vue-ignore: renderjs module exists only in the WebView compilation. -->
  <view style="display: none" aria-hidden="true" :prop="amountLabel" :change:prop="calculatorA11y.sync" />
</template>

<script lang="ts">
export default {
  props: { amountLabel: { type: String, required: true } },
};
</script>

<script module="calculatorA11y" lang="renderjs">
import { moveCalculatorRadio, syncAmountName } from "./calculator-webview-accessibility";
// App-Vue's logic layer has no DOM. This Options API child runs in the WebView.
export default {
  mounted() {
    this.card = this.$el.closest(".nx-compound-calculator");
    if (!this.card) return;
    this.card.addEventListener("keydown", this.onKeydown, true);
    if (!this.sync(this.prop)) {
      this.observer = new MutationObserver(() => {
        if (this.sync(this.prop)) this.observer.disconnect();
      });
      this.observer.observe(this.card, { childList: true, subtree: true });
    }
  },
  methods: {
    sync(label) {
      return syncAmountName(this.card, label);
    },
    onKeydown(event) {
      moveCalculatorRadio(this.card, event);
    },
  },
};
</script>
