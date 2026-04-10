import { AdAccount, AdPlatform, AccountStatus } from '../types';

let mockAdAccounts: AdAccount[] = [
    {
        id: 'ad-meta-1',
        platform: AdPlatform.Meta,
        name: 'Confort-Tex Ads (Primary)',
        accountId: 'act_123456789012345',
        status: AccountStatus.Connected,
    },
    {
        id: 'ad-tiktok-1',
        platform: AdPlatform.TikTok,
        name: 'Confort-Tex TikTok Business',
        accountId: '7098765432109876543',
        status: AccountStatus.NeedsReauth,
    },
];

export async function getAdAccounts(): Promise<AdAccount[]> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));
    return [...mockAdAccounts];
}

export async function linkAdAccount(platform: AdPlatform, currentAccounts: AdAccount[]): Promise<AdAccount[]> {
    // Simulate OAuth flow delay
    await new Promise(resolve => setTimeout(resolve, 2500));

    const newAccountId = `act_${Math.floor(Math.random() * 1e15)}`;
    const newAccount: AdAccount = {
        id: `ad-${platform.toLowerCase()}-${Math.random().toString(36).substring(7)}`,
        platform,
        name: `Confort-Tex ${platform} (${Math.floor(Math.random() * 100)})`,
        accountId: newAccountId,
        status: AccountStatus.Connected,
    };
    
    // In a real app, we would just re-fetch, but here we'll update the mock data.
    mockAdAccounts.push(newAccount);

    return [...mockAdAccounts];
}