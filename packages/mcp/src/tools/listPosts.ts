import { api } from '../api-client';
import { ListPostsInput } from '../types';

export async function listPosts(input: ListPostsInput) {
  const params: Record<string, string> = {};
  if (input.status) params.status = input.status;
  if (input.limit) params.limit = String(input.limit);
  if (input.offset) params.page = String(Math.floor(input.offset / (input.limit || 20)) + 1);
  if (input.brand_id) params.brandId = input.brand_id;

  const result = await api.listPosts(params);
  const posts = result.items.map((p: any) => ({
    ...p,
    brand_id: p.brandId || null,
    platforms: p.platforms || [],
  }));
  return { posts, total: result.total };
}
