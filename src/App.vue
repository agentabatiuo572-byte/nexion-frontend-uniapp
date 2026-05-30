<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useAuthStore } from '@/store/auth'

onLaunch(() => {
  useAuthStore().restore()
})
</script>

<style>
page {
  min-height: 100%;
  background: #07080a;
  color: #f8fafc;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

button,
uni-button {
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1;
}

button::after,
uni-button::after {
  border: 0;
}

input {
  color: inherit;
}
</style>
