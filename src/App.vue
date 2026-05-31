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

/* H5 only: keep scrolling but hide desktop scrollbars inside uni scroll-view. */
::-webkit-scrollbar,
page::-webkit-scrollbar,
body::-webkit-scrollbar,
uni-page-body::-webkit-scrollbar,
uni-scroll-view::-webkit-scrollbar,
.uni-scroll-view::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

page,
body,
uni-page-body,
uni-scroll-view,
.uni-scroll-view {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
