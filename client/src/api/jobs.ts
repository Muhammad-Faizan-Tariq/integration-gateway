import apiClient from './client';
import type { Job } from '../types/api';

export async function getJobs(): Promise<Job[]> {
  const { data } = await apiClient.get<Job[]>('/jobs');
  return data;
}

export async function getJob(id: string): Promise<Job> {
  const { data } = await apiClient.get<Job>(`/jobs/${id}`);
  return data;
}

export async function createJob(formData: FormData, extraHeaders: Record<string, string> = {}): Promise<Job> {
  const { data } = await apiClient.post<Job>('/jobs', formData, {
    headers: { 'Content-Type': 'multipart/form-data', ...extraHeaders },
  });
  return data;
}

export async function getDownloadUrl(id: string): Promise<{ downloadUrl: string }> {
  const { data } = await apiClient.get<{ downloadUrl: string }>(`/jobs/${id}/download`);
  return data;
}

export async function retryWebhook(id: string): Promise<{ message: string }> {
  const { data } = await apiClient.post<{ message: string }>(`/jobs/${id}/retry-webhook`);
  return data;
}
