import { get, post, patch, del } from './client';

const prefix = '/admin';

export interface AiPromptStatsResponse {
  total: number;
  active: number;
  inactive: number;
  totalVersions: number;
}

export interface AiPromptListItem {
  id: string;
  key: string;
  name: string;
  description: string | null;
  version: string;
  isActive: boolean;
  promptTextPreview: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiPromptVersionItem {
  id: string;
  version: string;
  changeNote: string | null;
  promptTextPreview: string;
  createdAt: string;
  createdBy: string | null;
}

export interface AiPromptDetail {
  id: string;
  key: string;
  name: string;
  description: string | null;
  promptText: string;
  version: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  versions: AiPromptVersionItem[];
}

export interface AiPromptVersionDetail {
  id: string;
  templateKey: string;
  version: string;
  promptText: string;
  changeNote: string | null;
  createdAt: string;
  createdBy: string | null;
}

export async function fetchAiPromptStats() {
  return get<AiPromptStatsResponse>(`${prefix}/ai-prompts/stats`);
}

export async function fetchAiPrompts(params?: {
  limit?: number;
  offset?: number;
  isActive?: boolean;
  search?: string;
}) {
  const query: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit ?? 50,
    offset: params?.offset ?? 0,
  };
  if (params?.isActive !== undefined) query.isActive = params.isActive;
  if (params?.search) query.search = params.search;
  return get<AiPromptListItem[]>(`${prefix}/ai-prompts`, query);
}

export async function fetchAiPromptDetail(id: string) {
  return get<AiPromptDetail>(`${prefix}/ai-prompts/${id}`);
}

export async function fetchAiPromptVersionDetail(versionId: string) {
  return get<AiPromptVersionDetail>(`${prefix}/ai-prompts/versions/${versionId}`);
}

export async function createAiPrompt(body: {
  key: string;
  name: string;
  description?: string | null;
  promptText: string;
  version?: string;
  isActive?: boolean;
}) {
  return post<AiPromptListItem>(`${prefix}/ai-prompts`, body);
}

export async function updateAiPrompt(
  id: string,
  body: {
    name?: string;
    description?: string | null;
    promptText?: string;
    isActive?: boolean;
    changeNote?: string;
  },
) {
  return patch<AiPromptListItem>(`${prefix}/ai-prompts/${id}`, body);
}

export async function restoreAiPromptVersion(id: string, versionId: string) {
  return post<{ message: string }>(`${prefix}/ai-prompts/${id}/restore-version/${versionId}`, {});
}

export async function deleteAiPrompt(id: string) {
  return del<{ success: boolean; message: string }>(`${prefix}/ai-prompts/${id}`);
}
