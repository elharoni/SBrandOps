import React, { useEffect, useState } from 'react';
import { SocialPlatform, MediaItem, PLATFORM_ASSETS } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface PostPreviewProps {
    content: string;
    platforms: SocialPlatform[];
    media: MediaItem[];
    activeTab: SocialPlatform | null;
    onTabChange: (platform: SocialPlatform | null) => void;
    instagramFirstComment?: string;
    locations?: Partial<Record<SocialPlatform, string>>;
    brandName?: string;
}

const MediaCarousel: React.FC<{ media: MediaItem[]; platform: SocialPlatform }> = ({ media }) => {
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

    useEffect(() => {
        setCurrentMediaIndex(0);
    }, [media]);

    if (media.length === 0) return null;

    const goToPrevious = () => setCurrentMediaIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
    const goToNext = () => setCurrentMediaIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
    const currentMedia = media[currentMediaIndex];
    const isVideo = currentMedia?.type === 'video';

    return (
        <div className="group relative overflow-hidden rounded-lg border border-light-border dark:border-dark-border">
            <div className="aspect-square bg-light-bg dark:bg-black flex items-center justify-center">
                {isVideo ? (
                    <video src={currentMedia.url} className="max-h-full max-w-full object-contain" />
                ) : (
                    <img src={currentMedia.url} alt="Preview media" className="max-h-full max-w-full object-contain" />
                )}
                {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50">
                            <i className="fas fa-play text-white" />
                        </div>
                    </div>
                )}
            </div>

            {media.length > 1 && (
                <>
                    <button onClick={goToPrevious} className="absolute left-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100">
                        <i className="fas fa-chevron-left text-xs" />
                    </button>
                    <button onClick={goToNext} className="absolute right-2 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/70 group-hover:opacity-100">
                        <i className="fas fa-chevron-right text-xs" />
                    </button>
                    <div className="absolute right-2 top-2 z-10 rounded-full bg-black/60 px-2 py-0.5 text-xs text-white">
                        {isVideo ? <i className="fas fa-video me-1" /> : <i className="fas fa-images me-1" />}
                        {currentMediaIndex + 1} / {media.length}
                    </div>
                </>
            )}
        </div>
    );
};

const InstagramPreview: React.FC<Omit<PlatformPreviewProps, 'platform'>> = ({ content, media, instagramFirstComment, location, brandName }) => (
    <div className="flex h-full w-full flex-col rounded-lg border border-light-border bg-white p-3 text-sm text-black dark:border-dark-border dark:bg-black dark:text-white">
        <header className="flex items-center gap-2 p-2">
            <img src="https://picsum.photos/seed/brandlogo/100" className="h-8 w-8 rounded-full border border-gray-300" alt={brandName} />
            <div className="flex-grow">
                <p className="text-xs font-bold">{brandName}</p>
                {location && <p className="text-xs text-gray-600 dark:text-gray-400">{location}</p>}
            </div>
            <i className="fas fa-ellipsis-h text-gray-600 dark:text-gray-400" />
        </header>
        <MediaCarousel media={media} platform={SocialPlatform.Instagram} />
        <div className="flex-grow space-y-1.5 p-2">
            <div className="flex items-center justify-between text-xl">
                <div className="flex items-center gap-3">
                    <i className="far fa-heart" />
                    <i className="far fa-comment" />
                    <i className="far fa-paper-plane" />
                </div>
                <i className="far fa-bookmark" />
            </div>
            <p className="text-xs font-bold">1,234 likes</p>
            <p className="whitespace-pre-wrap text-xs"><strong className="font-bold">{brandName}</strong> {content}</p>
            {instagramFirstComment && (
                <div className="pt-1 text-gray-500 dark:text-gray-400">
                    <p className="whitespace-pre-wrap text-xs"><strong className="font-bold text-black dark:text-white">{brandName}</strong> {instagramFirstComment}</p>
                </div>
            )}
        </div>
        <footer className="border-t border-gray-100 p-2 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-600">Add a comment...</footer>
    </div>
);

const FacebookPreview: React.FC<Omit<PlatformPreviewProps, 'platform' | 'instagramFirstComment'>> = ({ content, media, brandName }) => (
    <div className="flex h-full w-full flex-col rounded-lg border border-light-border bg-white p-3 text-sm text-black dark:border-dark-border dark:bg-[#18191A] dark:text-white">
        <header className="flex items-center gap-2 p-2">
            <img src="https://picsum.photos/seed/brandlogo/100" className="h-10 w-10 rounded-full" alt={brandName} />
            <div>
                <p className="font-bold">{brandName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Just now · <i className="fas fa-globe-americas" /></p>
            </div>
        </header>
        <div className="space-y-2 px-2 pb-2">
            <p className="whitespace-pre-wrap">{content}</p>
        </div>
        <MediaCarousel media={media} platform={SocialPlatform.Facebook} />
        <div className="mt-2 flex justify-around border-t border-gray-200 p-2 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-400">
            <button className="flex items-center gap-2 rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700"><i className="far fa-thumbs-up" /> Like</button>
            <button className="flex items-center gap-2 rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700"><i className="far fa-comment-alt" /> Comment</button>
            <button className="flex items-center gap-2 rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700"><i className="fas fa-share" /> Share</button>
        </div>
    </div>
);

const XPreview: React.FC<Omit<PlatformPreviewProps, 'platform' | 'instagramFirstComment'>> = ({ content, media, brandName }) => (
    <div className="flex h-full w-full flex-col rounded-lg border border-light-border bg-white p-3 text-sm text-black dark:border-dark-border dark:bg-black dark:text-white">
        <div className="flex items-start gap-3 p-2">
            <img src="https://picsum.photos/seed/brandlogo/100" className="h-10 w-10 rounded-full" alt={brandName} />
            <div className="flex-grow">
                <div className="flex items-center gap-1">
                    <p className="font-bold">{brandName}</p>
                    <p className="text-gray-500">@{brandName.toLowerCase().replace(/\s+/g, '')} · Now</p>
                </div>
                <p className="whitespace-pre-wrap">{content}</p>
                {media.length > 0 && <div className="mt-2"><MediaCarousel media={media} platform={SocialPlatform.X} /></div>}
                <div className="mt-3 flex max-w-sm justify-between text-xs text-gray-500 dark:text-gray-400">
                    <button className="flex items-center gap-1 hover:text-blue-500"><i className="far fa-comment" /> 12</button>
                    <button className="flex items-center gap-1 hover:text-green-500"><i className="fas fa-retweet" /> 34</button>
                    <button className="flex items-center gap-1 hover:text-pink-500"><i className="far fa-heart" /> 56</button>
                    <button className="flex items-center gap-1 hover:text-blue-500"><i className="far fa-chart-bar" /> 7.8K</button>
                    <button className="hover:text-blue-500"><i className="fas fa-share-square" /></button>
                </div>
            </div>
        </div>
    </div>
);

const LinkedInPreview: React.FC<Omit<PlatformPreviewProps, 'platform' | 'instagramFirstComment'>> = ({ content, media, brandName }) => (
    <div className="flex h-full w-full flex-col rounded-lg border border-light-border bg-white p-3 text-sm text-black dark:border-dark-border dark:bg-[#1b1f23] dark:text-white">
        <header className="flex items-center gap-2 p-2">
            <img src="https://picsum.photos/seed/brandlogo/100" className="h-12 w-12 rounded-full" alt={brandName} />
            <div>
                <p className="font-bold">{brandName}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">1,234 followers</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Promoted</p>
            </div>
        </header>
        <div className="space-y-2 px-2 pb-2">
            <p className="whitespace-pre-wrap">{content}</p>
        </div>
        <MediaCarousel media={media} platform={SocialPlatform.LinkedIn} />
        <div className="mt-2 flex justify-around border-t border-gray-200 p-2 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:text-gray-400">
            <button className="flex flex-col items-center gap-1 rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700"><i className="far fa-thumbs-up" /> Like</button>
            <button className="flex flex-col items-center gap-1 rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700"><i className="far fa-comment-dots" /> Comment</button>
            <button className="flex flex-col items-center gap-1 rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700"><i className="fas fa-redo" /> Repost</button>
            <button className="flex flex-col items-center gap-1 rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-700"><i className="fas fa-paper-plane" /> Send</button>
        </div>
    </div>
);

interface PlatformPreviewProps {
    platform: SocialPlatform;
    content: string;
    media: MediaItem[];
    instagramFirstComment?: string;
    location?: string;
    brandName: string;
}

const PlatformPreview: React.FC<PlatformPreviewProps> = (props) => {
    switch (props.platform) {
        case SocialPlatform.Instagram:
            return <InstagramPreview {...props} />;
        case SocialPlatform.Facebook:
            return <FacebookPreview {...props} />;
        case SocialPlatform.X:
            return <XPreview {...props} />;
        case SocialPlatform.LinkedIn:
            return <LinkedInPreview {...props} />;
        default:
            return <FacebookPreview {...props} />;
    }
};

export const PostPreview: React.FC<PostPreviewProps> = ({ content, platforms, media, activeTab, onTabChange, instagramFirstComment, locations, brandName = 'Brand' }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    if (platforms.length === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-light-border bg-light-card p-6 text-center shadow dark:border-dark-border dark:bg-dark-card">
                <i className="fas fa-eye mb-3 text-4xl text-light-text-secondary dark:text-dark-text-secondary" />
                <h2 className="font-bold text-light-text dark:text-dark-text">{ar ? 'معاينة المنشور' : 'Post preview'}</h2>
                <p className="mt-1 text-sm text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'اختر منصة واحدة على الأقل لإظهار شكل المنشور قبل النشر.' : 'Select at least one platform to preview the post before publishing.'}</p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col rounded-lg border border-light-border bg-light-card p-4 shadow dark:border-dark-border dark:bg-dark-card">
            <style>{`
                @keyframes fade-in-fast { 0% { opacity: 0.5; } 100% { opacity: 1; } }
                .animate-fade-in-fast { animation: fade-in-fast 0.2s ease-in-out; }
            `}</style>
            <div className="mb-4 flex-shrink-0">
                <nav className="flex items-center gap-1 overflow-x-auto rounded-lg bg-light-bg p-1 dark:bg-dark-bg">
                    {platforms.map((platform) => {
                        const asset = PLATFORM_ASSETS[platform];
                        return (
                            <button
                                key={platform}
                                onClick={() => onTabChange(platform)}
                                className={`flex-1 whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold transition-all duration-300 ${
                                    activeTab === platform
                                        ? 'bg-gradient-to-r from-brand-pink to-brand-purple text-white shadow-lg shadow-brand-purple/20'
                                        : 'text-light-text-secondary hover:bg-light-card hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-dark-card dark:hover:text-dark-text'
                                }`}
                            >
                                <span className="inline-flex items-center gap-2">
                                    <i className={`${asset.icon} text-base`} />
                                    <span>{platform}</span>
                                </span>
                            </button>
                        );
                    })}
                </nav>
            </div>
            <div className="min-h-0 flex-grow animate-fade-in-fast">
                {activeTab && (
                    <PlatformPreview
                        key={activeTab}
                        platform={activeTab}
                        content={content}
                        media={media}
                        instagramFirstComment={instagramFirstComment}
                        location={locations?.[activeTab]}
                        brandName={brandName}
                    />
                )}
            </div>
        </div>
    );
};
