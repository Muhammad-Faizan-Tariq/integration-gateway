import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getJobs, getJob, retryWebhook, getDownloadUrl } from '../api/jobs';
import type { Job } from '../types/api';

export function useJobs() {
  return useQuery({
    queryKey: ['jobs'],
    queryFn: getJobs,
    refetchInterval: 5000,
  });
}

export function useJob(id: string) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => getJob(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'SUBMITTED' || status === 'PROCESSING' ? 3000 : false;
    },
  });
}

export function useJobStats(jobs: Job[] | undefined) {
  const total = jobs?.length ?? 0;
  const completed = jobs?.filter((j) => j.status === 'COMPLETED').length ?? 0;
  const failed = jobs?.filter((j) => j.status === 'FAILED' || j.status === 'WEBHOOK_FAILED').length ?? 0;
  const processing = jobs?.filter((j) => j.status === 'PROCESSING' || j.status === 'SUBMITTED').length ?? 0;
  return { total, completed, failed, processing };
}

export function useRetryWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryWebhook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useDownloadUrl() {
  return useMutation({ mutationFn: getDownloadUrl });
}
