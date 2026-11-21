import { supportApi } from "@/api/runtime";
import { learningApi } from "@/api/learning-runtime";
import type { LearningCourse } from "@/api/learning-api";
import { passiveTabReadScope } from "@/lib/passive-tab-read";
import { createPassiveReadWindow } from "@/lib/passive-read-window";
import { readPublishedFaqPages } from "@/lib/published-faq-pages";

// These are display snapshots, including the server's published version.
// Learning commands and receipt recovery always use the live API directly.
const CONTENT_MAX_AGE_MS = 300_000;
// Content survives unrelated business writes. Learning mutations invalidate it explicitly.
const content = createPassiveReadWindow();
const contentScope = () => passiveTabReadScope(false);
const courseQuery = (id: string, language: string) => [id, language];
let versionScope = "";
const courseVersions = new Map<string, string>();
function observeVersions(courses: LearningCourse[], language: string, changedResource: string) {
  const scope = contentScope();
  if (versionScope !== scope) { courseVersions.clear(); versionScope = scope; }
  for (const course of courses) {
    const key = JSON.stringify([language, course.id]);
    const previous = courseVersions.get(key);
    if (previous !== undefined && previous !== course.version) content.invalidate(changedResource);
    courseVersions.set(key, course.version);
  }
}

export function readPublishedFaqPage(language: string, pageNum = 1, pageSize = 20, force = false) {
  if (force) content.invalidate("published-faqs");
  return content.run(contentScope(), "published-faqs", () => supportApi.faqPage(language, undefined, "Help Center", pageNum, pageSize),
    [language, "Help Center", pageNum, pageSize], undefined, CONTENT_MAX_AGE_MS);
}

export function readPublishedFaqs(language: string, isCurrent: () => boolean, force = false) {
  if (force) content.invalidate("published-faqs");
  const scope = contentScope();
  return readPublishedFaqPages({ faqPage: (locale, _category, _surface, pageNum, pageSize) =>
    readPublishedFaqPage(locale, pageNum, pageSize) }, language, () => isCurrent() && scope === contentScope());
}

export function invalidateLearningContent() {
  content.invalidate("learning-courses");
  content.invalidate("learning-course");
}

export function projectStartedLearningCourse(course: LearningCourse, language: string) {
  observeVersions([course], language, "learning-course");
  content.invalidate("learning-courses");
  content.remember(contentScope(), "learning-course", Promise.resolve(course), courseQuery(course.id, language));
}

export function readLearningCourses(language: string, force = false) {
  if (force) invalidateLearningContent();
  const scope = contentScope();
  return content.run(scope, "learning-courses", () => learningApi.courses(language).then(value => {
    if (scope === contentScope()) observeVersions(value.courses, language, "learning-course");
    return value;
  }),
    language, undefined, CONTENT_MAX_AGE_MS);
}

export function readLearningCourse(courseId: string, language: string) {
  const scope = contentScope();
  return content.run(scope, "learning-course", () => learningApi.course(courseId, language).then(value => {
    if (scope === contentScope()) observeVersions([value], language, "learning-courses");
    return value;
  }),
    courseQuery(courseId, language), undefined, CONTENT_MAX_AGE_MS);
}
