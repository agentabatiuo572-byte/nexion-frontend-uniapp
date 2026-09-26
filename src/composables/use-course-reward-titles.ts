import { onShow } from "@dcloudio/uni-app";
import { computed, onUnmounted, ref, watch } from "vue";
import { learningApi } from "@/api/learning-runtime";
import { remoteApiEnabled, sessionVault } from "@/api/runtime";
import { binarySessionReady } from "@/lib/binary-session-ready";
import { useApp } from "@/store/app";
import { useAuth } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";

/** Published, localized course names; historical source references stay on the bill. */
export function useCourseRewardTitles() {
  const app = useApp();
  const auth = useAuth();
  const locale = useLocaleStore();
  const language = computed(() => ["zh", "vi", "en"].includes(locale.code) ? locale.code : "zh");
  const ready = computed(() => binarySessionReady({
    remote: remoteApiEnabled,
    authenticated: auth.isAuthenticated,
    accountId: auth.accountId,
    appAccountKey: app.accountKey,
    sessionUserId: sessionVault.read()?.user.userId ?? null,
  }));
  const titles = ref<Record<string, string>>({});
  let generation = 0;

  async function refresh() {
    const current = ++generation;
    titles.value = {};
    if (!remoteApiEnabled || !ready.value) return;
    try {
      const overview = await learningApi.courses(language.value);
      if (current === generation) {
        titles.value = Object.fromEntries(overview.courses.map((course) => [`${course.id}@${course.version}`, course.title]));
      }
    } catch { /* The generic localized reward label remains available. */ }
  }

  onShow(() => { refresh().catch(() => {}); });
  watch([language, ready, () => app.accountBindingEpoch], () => { refresh().catch(() => {}); });
  onUnmounted(() => { generation += 1; });
  return titles;
}
