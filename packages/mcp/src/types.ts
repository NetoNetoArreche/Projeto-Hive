export interface CreatePostInput {
  caption?: string;
  image_prompt?: string;
  image_prompts?: string[];
  image_urls?: string[];
  aspect_ratio?: '1:1' | '4:5' | '9:16';
  scheduled_at?: string;
  hashtags?: string[];
  tone?: string;
}

export interface AddImageToPostInput {
  post_id: string;
  image_prompt?: string;
  image_url?: string;
}

export interface GenerateImageInput {
  prompt: string;
  style?: string;
  aspect_ratio?: '1:1' | '9:16' | '4:5';
}

export interface GenerateCaptionInput {
  topic: string;
  tone?: 'educativo' | 'inspirador' | 'humor' | 'noticia';
  hashtags_count?: number;
  language?: string;
  max_length?: number;
}

export interface SchedulePostInput {
  post_id: string;
  datetime: string;
}

export interface ListPostsInput {
  status?: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
  limit?: number;
  offset?: number;
}

export interface PublishNowInput {
  post_id: string;
}

export interface UploadImageInput {
  image_base64: string;
  filename: string;
}

export interface GetAnalyticsInput {
  period?: '7d' | '30d' | '90d';
}

// Tasks
export interface CreateTaskInput {
  title: string;
  description?: string;
  platform: 'YOUTUBE' | 'INSTAGRAM' | 'META_ADS' | 'TIKTOK' | 'OTHER';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  recordDate?: string;
  publishDate?: string;
  script?: string;
  scriptFileUrl?: string;
  driveLink?: string;
  isSponsored?: boolean;
  sponsorName?: string;
  sponsorBriefing?: string;
  briefingFileUrl?: string;
  sponsorContact?: string;
  sponsorDeadline?: string;
  projectId?: string;
}

export interface ListTasksInput {
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  platform?: 'YOUTUBE' | 'INSTAGRAM' | 'META_ADS' | 'TIKTOK' | 'OTHER';
  projectId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface UpdateTaskInput {
  task_id: string;
  title?: string;
  description?: string;
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  platform?: 'YOUTUBE' | 'INSTAGRAM' | 'META_ADS' | 'TIKTOK' | 'OTHER';
  recordDate?: string;
  publishDate?: string;
  script?: string;
  scriptFileUrl?: string;
  driveLink?: string;
  isSponsored?: boolean;
  sponsorName?: string;
  sponsorBriefing?: string;
  briefingFileUrl?: string;
  sponsorContact?: string;
  sponsorDeadline?: string;
  projectId?: string;
}

export interface DeleteTaskInput {
  task_id: string;
}

// Projects
export interface CreateProjectInput {
  title: string;
  description?: string;
  modules?: Array<{ title: string; content?: string }>;
}

export interface ListProjectsInput {
  status?: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
  limit?: number;
  offset?: number;
}

export interface GetProjectInput {
  project_id: string;
}

export interface UpdateProjectInput {
  project_id: string;
  title?: string;
  description?: string;
  status?: 'PLANNING' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';
}

export interface DeleteProjectInput {
  project_id: string;
}

// Modules
export interface AddModuleInput {
  project_id: string;
  title: string;
  content?: string;
  order?: number;
}

export interface UpdateModuleInput {
  project_id: string;
  module_id: string;
  title?: string;
  content?: string;
  isRecorded?: boolean;
  driveLink?: string;
}

export interface DeleteModuleInput {
  project_id: string;
  module_id: string;
}
