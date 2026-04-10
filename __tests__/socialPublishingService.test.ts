import { describe, it, expect, vi } from 'vitest';
import * as supa from '../services/supabaseClient';
import { publishPost } from '../services/socialPublishingService';
import { SocialPlatform } from '../types';

vi.mock('../services/supabaseClient', () => {
  return {
    supabase: {
      functions: {
        invoke: vi.fn(),
      },
    },
  };
});

describe('socialPublishingService.publishPost', () => {
  it('maps Edge results into PublishResult[]', async () => {
    (supa as any).supabase.functions.invoke.mockResolvedValueOnce({
      data: [
        { platform: 'Facebook', success: true, post_id: 'fb-1' },
        { platform: 'X', success: false, error: 'rate limited' },
      ],
      error: null,
    });

    const res = await publishPost('brand-1', {
      id: 'p1',
      content: 'Hello',
      platforms: [SocialPlatform.Facebook, SocialPlatform.X],
      media: [],
      status: 'Draft' as any,
      scheduledAt: null,
    } as any);

    expect(res).toEqual([
      { platform: SocialPlatform.Facebook, success: true, postId: 'fb-1', error: undefined },
      { platform: SocialPlatform.X, success: false, postId: undefined, error: 'rate limited' },
    ]);
  });
});