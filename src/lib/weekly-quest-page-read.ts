import type { InjectionKey, Ref } from "vue";

/** The host owns fetching and recovery while its weekly panel is mounted. */
export const WEEKLY_QUEST_PAGE_READ_SETTLED: InjectionKey<Readonly<Ref<boolean>>> = Symbol("weekly-quest-page-read-settled");
