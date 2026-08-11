import type { ApiClient } from "./api-client";
import { ApiError } from "./errors";

export interface LearningQuestion { questionId: string; question: string; options: string[]; }
export interface LearningCourse { id: string; title: string; body: string; category: string; format: string; level: string; duration: string; rewardNex: string | number; featured: boolean; version: string; progress: number; completed: boolean; questions: LearningQuestion[]; }
export interface LearningOverview { courses: LearningCourse[]; completedCourses: number; totalCourses: number; earnedNex: string | number; }
export interface LearningResult { courseId: string; version: string; score: number; passed: boolean; completed: boolean; rewardGranted: boolean; rewardNex: string | number; attempts: number; }
export interface LearningApi {
  courses(language: string): Promise<LearningOverview>;
  course(courseId: string, language: string): Promise<LearningCourse>;
  start(courseId: string, language: string): Promise<LearningCourse>;
  submitQuiz(courseId: string, answers: number[], idempotencyKey: string): Promise<LearningResult>;
  complete(courseId: string): Promise<LearningResult>;
}
function invalid(): never { throw new ApiError({ kind: "protocol", message: "LEARNING_RESPONSE_INVALID" }); }
function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== "object" || Array.isArray(value)) return invalid(); return value as Record<string, unknown>; }
function text(value: unknown): string { if (typeof value !== "string" || !value.trim()) return invalid(); return value.trim(); }
function integer(value: unknown, min = 0): number { const result = Number(value); if (!Number.isSafeInteger(result) || result < min) return invalid(); return result; }
function reward(value: unknown): string | number { if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value; if (typeof value === "string" && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.trim())) return value.trim(); return invalid(); }
function course(value: unknown): LearningCourse {
  const row = record(value);
  if (!Array.isArray(row.questions) || typeof row.featured !== "boolean" || typeof row.completed !== "boolean") return invalid();
  const progress = integer(row.progress);
  if (progress > 100 || (row.completed && progress !== 100)) return invalid();
  return { id: text(row.id), title: text(row.title), body: text(row.body), category: text(row.category), format: text(row.format), level: text(row.level), duration: text(row.duration), rewardNex: reward(row.rewardNex), featured: row.featured, version: text(row.version), progress, completed: row.completed, questions: row.questions.map((value) => { const item = record(value); if (!Array.isArray(item.options)) return invalid(); return { questionId: text(item.questionId), question: text(item.question), options: item.options.map(text) }; }) };
}
function overview(value: unknown): LearningOverview { const row = record(value); if (!Array.isArray(row.courses)) return invalid(); return { courses: row.courses.map(course), completedCourses: integer(row.completedCourses), totalCourses: integer(row.totalCourses), earnedNex: row.earnedNex as string | number }; }
function result(value: unknown): LearningResult { const row = record(value); if (typeof row.passed !== "boolean" || typeof row.completed !== "boolean" || typeof row.rewardGranted !== "boolean") return invalid(); const score = integer(row.score); if (score > 100 || (row.passed && !row.completed)) return invalid(); return { courseId: text(row.courseId), version: text(row.version), score, passed: row.passed, completed: row.completed, rewardGranted: row.rewardGranted, rewardNex: reward(row.rewardNex), attempts: integer(row.attempts, 1) }; }
function id(value: string): string { return text(value); }
function key(value: string): string { const normalized = text(value); if (normalized.length < 8 || normalized.length > 128) return invalid(); return normalized; }
export function createLearningApi(client: ApiClient): LearningApi { return {
  courses: async (language) => overview(await client.request({ method: "GET", path: `/api/content/learning/courses?language=${encodeURIComponent(language)}` })),
  course: async (courseId, language) => course(await client.request({ method: "GET", path: `/api/content/learning/courses/${encodeURIComponent(id(courseId))}?language=${encodeURIComponent(language)}` })),
  start: async (courseId, language) => course(await client.request({ method: "POST", path: `/api/content/learning/courses/${encodeURIComponent(id(courseId))}/start?language=${encodeURIComponent(language)}` })),
  submitQuiz: async (courseId, answers, idempotencyKey) => result(await client.request({ method: "POST", path: `/api/content/learning/courses/${encodeURIComponent(id(courseId))}/quiz`, idempotencyKey: key(idempotencyKey), body: { answers } })),
  complete: async (courseId) => result(await client.request({ method: "POST", path: `/api/content/learning/courses/${encodeURIComponent(id(courseId))}/complete` })),
}; }
