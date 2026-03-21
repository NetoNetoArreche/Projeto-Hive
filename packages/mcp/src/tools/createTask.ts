import { api } from '../api-client';
import { CreateTaskInput } from '../types';

export async function createTask(input: CreateTaskInput) {
  const task = (await api.createTask({
    title: input.title,
    description: input.description,
    platform: input.platform,
    priority: input.priority || 'MEDIUM',
    recordDate: input.recordDate,
    publishDate: input.publishDate,
    script: input.script,
    scriptFileUrl: input.scriptFileUrl,
    driveLink: input.driveLink,
    isSponsored: input.isSponsored || false,
    sponsorName: input.sponsorName,
    sponsorBriefing: input.sponsorBriefing,
    briefingFileUrl: input.briefingFileUrl,
    sponsorContact: input.sponsorContact,
    sponsorDeadline: input.sponsorDeadline,
    projectId: input.projectId,
  })) as any;

  return {
    task_id: task.id,
    title: task.title,
    platform: task.platform,
    status: task.status,
    priority: task.priority,
    recordDate: task.recordDate,
    publishDate: task.publishDate,
    isSponsored: task.isSponsored,
    projectId: task.projectId,
  };
}
