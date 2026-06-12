import { api } from '../api-client';

export async function publishNow(input: { post_id: string; account_id?: string }) {
  const result = (await api.publishPost(input.post_id, input.account_id)) as any;
  return {
    results: result.results || result,
    published_at: new Date().toISOString(),
    platforms: result.results ? result.results.map((r: any) => r.platform) : ['instagram'],
  };
}
