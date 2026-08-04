// CreatorLens 内存存储
// Day 2 使用 globalThis 单例，服务重启后清空；后续迁移 Supabase

import type { Project, VideoRecord, Report, ValidationResult } from "@/types";

interface Store {
  projects: Map<string, Project>;
  records: Map<string, VideoRecord[]>;
  reports: Map<string, Report>;
  validationResults: Map<string, ValidationResult>;
}

function createStore(): Store {
  return {
    projects: new Map(),
    records: new Map(),
    reports: new Map(),
    validationResults: new Map(),
  };
}

// globalThis 单例，降低 Next.js 热更新丢失
const globalStore = (globalThis as unknown as { __creatorlens_store?: Store });
if (!globalStore.__creatorlens_store) {
  globalStore.__creatorlens_store = createStore();
}

export const store = globalStore.__creatorlens_store;

// 辅助方法
export function getProject(id: string): Project | undefined {
  return store.projects.get(id);
}

export function setProject(project: Project): void {
  store.projects.set(project.id, project);
}

export function getAllProjects(): Project[] {
  return Array.from(store.projects.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getRecords(projectId: string): VideoRecord[] {
  return store.records.get(projectId) ?? [];
}

export function setRecords(projectId: string, records: VideoRecord[]): void {
  store.records.set(projectId, records);
}

export function getReport(reportId: string): Report | undefined {
  return store.reports.get(reportId);
}

export function setReport(reportId: string, report: Report): void {
  store.reports.set(reportId, report);
}

export function getValidationResult(projectId: string): ValidationResult | undefined {
  return store.validationResults.get(projectId);
}

export function setValidationResult(projectId: string, result: ValidationResult): void {
  store.validationResults.set(projectId, result);
}
