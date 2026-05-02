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

const MediaCarousel: React.FC<{ media: MediaItem[]; platform: SocialPlatform }> = ({ media, platform }) => {
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

    useEffect(() => {
        setCurrentMediaIndex(0);
    }, [media]);

    if (media.length === 0) return null;

    const goToPrevious = () => setCurrentMediaIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
    const goToNext = () => setCurrentMediaIndex((prev) => (prev === media.length - 1 ? 0 : prev + 1));
    const currentMedia = media[currentMediaIndex];
    const isVideo = currentMedia?.type === 'video';
    const isInsta = platform === SocialPlatform.Instagram;

    return (
        <div className="group relative overflow-hidden bg-light-bg dark:bg-black border-y border-light-border/40 dark:border-dark-border/40">
            <div className={`flex items-center justify-center w-full ${isInsta ? 'aspect-square' : 'max-h-[500px]'}`}>
                {isVideo ? (
                    <video src={currentMedia.url} className={`max-h-[500px] w-full ${isInsta ? 'h-full object-cover' : 'object-contain'}`} />
                ) : (
                    <img src={currentMedia.url} alt="Preview media" className={`max-h-[500px] w-full ${isInsta ? 'h-full object-cover' : 'object-contain'}`} />
                )}
                {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm text-white shadow-lg transition-transform hover:scale-110 cursor-pointer">
                            <i className="fas fa-play text-lg ms-1" />
                        </div>
                    </div>
                )}
            </div>

            {media.length > 1 && (
                <>
                    <button onClick={goToPrevious} className="absolute left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 dark:bg-black/60 text-black dark:text-white opacity-0 shadow-md backdrop-blur-sm transition-all hover:scale-110 group-hover:opacity-100">
                        <i className="fas fa-chevron-left text-sm" />
                    </button>
                    <button onClick={goToNext} className="absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 dark:bg-black/60 text-black dark:text-white opacity-0 shadow-md backdrop-blur-sm transition-all hover:scale-110 group-hover:opacity-100">
                        <i className="fas fa-chevron-right text-sm" />
                    </button>
                    {isInsta ? (
                        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-1.5">
                            {media.map((_, idx) => (
                                <div key={idx} className={`h-1.5 rounded-full transition-all ${idx === currentMediaIndex ? 'w-1.5 bg-blue-500' : 'w-1.5 bg-white/50'}`} />
                            ))}
                        </div>
                    ) : (
                        <div className="absolute right-3 top-3 z-10 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                            {isVideo ? <i className="fas fa-video me-1.5" /> : <i className="fas fa-images me-1.5" />}
                            {currentMediaIndex + 1} / {media.length}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const InstagramPreview: React.FC<Omit<PlatformPreviewProps, 'platform'>> = ({ content, media, instagramFirstComment, location, brandName }) => (
    <div className="mx-auto flex w-full max-w-sm flex-col overflow-hidden rounded-[2rem] border border-light-border/60 bg-white text-sm text-black shadow-xl dark:border-dark-border/60 dark:bg-black dark:text-white">
        <header className="flex items-center gap-3 px-4 py-3">
            <div className="rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-fuchsia-600 p-[2px]">
                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(brandName)}&background=fff&color=000`} className="h-8 w-8 rounded-full border-2 border-white dark:border-black" alt={brandName} />
            </div>
            <div className="flex-grow">
                <p className="text-[13px] font-bold leading-tight">{brandName}</p>
                {location && <p className="text-[11px] text-gray-500 dark:text-gray-400">{location}</p>}
            </div>
            <i className="fas fa-ellipsis-h text-gray-600 dark:text-gray-400" />
        </header>
        <MediaCarousel media={media} platform={SocialPlatform.Instagram} />
        <div className="flex-grow space-y-2.5 px-4 py-3">
            <div className="flex items-center justify-between text-xl">
                <div className="flex items-center gap-4">
                    <i className="far fa-heart hover:text-red-500 transition-colors cursor-pointer" />
                    <i className="far fa-comment cursor-pointer hover:opacity-70 transition-opacity" />
                    <i className="far fa-paper-plane cursor-pointer hover:opacity-70 transition-opacity" />
                </div>
                <i className="far fa-bookmark cursor-pointer hover:opacity-70 transition-opacity" />
            </div>
            <p className="text-[13px] font-bold">1,234 likes</p>
            <div className="text-[13px] leading-relaxed">
                <strong className="font-bold me-1.5">{brandName}</strong>
                <span className="whitespace-pre-wrap">{content}</span>
            </div>
            {instagramFirstComment && (
                <div className="mt-2 border-l-2 border-gray-200 pl-3 dark:border-gray-800">
                    <p className="text-[12px] text-gray-500 dark:text-gray-400"><strong className="font-bold text-black dark:text-white me-1.5">{brandName}</strong> <span className="whitespace-pre-wrap">{instagramFirstComment}</span></p>
                </div>
            )}
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide pt-1">2 hours ago</p>
        </div>
    </div>
);

const FacebookPreview: React.FC<Omit<PlatformPreviewProps, 'platform' | 'instagramFirstComment'>> = ({ content, media, brandName }) => (
    <div className="mx-auto flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-light-border/60 bg-white text-sm text-black shadow-xl dark:border-dark-border/60 dark:bg-[#242526] dark:text-white">
        <header className="flex items-center gap-3 px-4 py-3">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(brandName)}&background=0866FF&color=fff`} className="h-10 w-10 rounded-full" alt={brandName} />
            <div>
                <p className="text-[14px] font-bold leading-tight">{brandName}</p>
                <div className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                    <span>Just now</span>
                    <span>·</span>
                    <i className="fas fa-globe-americas text-[10px]" />
                </div>
            </div>
            <div className="ms-auto flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <i className="fas fa-ellipsis h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer transition-colors" />
                <i className="fas fa-xmark h-8 w-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer transition-colors" />
            </div>
        </header>
        <div className="px-4 pb-3">
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{content}</p>
        </div>
        <MediaCarousel media={media} platform={SocialPlatform.Facebook} />
        <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-800 flex justify-between text-gray-500 dark:text-gray-400 text-[13px]">
            <div className="flex items-center gap-1">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[8px]"><i className="fas fa-thumbs-up" /></span>
                <span>124</span>
            </div>
            <div className="flex gap-3">
                <span>12 comments</span>
                <span>3 shares</span>
            </div>
        </div>
        <div className="flex justify-around px-2 py-1 text-[13px] font-semibold text-gray-600 dark:text-gray-400">
            <button className="flex flex-1 items-center justify-center gap-2 rounded-md py-2 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"><i className="far fa-thumbs-up text-lg" /> Like</button>
            <button className="flex flex-1 items-center justify-center gap-2 rounded-md py-2 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"><i className="far fa-comment-alt text-lg" /> Comment</button>
            <button className="flex flex-1 items-center justify-center gap-2 rounded-md py-2 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"><i className="fas fa-share text-lg" /> Share</button>
        </div>
    </div>
);

const XPreview: React.FC<Omit<PlatformPreviewProps, 'platform' | 'instagramFirstComment'>> = ({ content, media, brandName }) => (
    <div className="mx-auto flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-light-border/60 bg-white text-sm text-black shadow-xl dark:border-dark-border/60 dark:bg-black dark:text-white">
        <div className="flex items-start gap-3 px-4 py-3">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(brandName)}&background=000&color=fff`} className="h-10 w-10 rounded-full flex-shrink-0" alt={brandName} />
            <div className="flex-grow min-w-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                        <p className="font-bold text-[15px] truncate">{brandName}</p>
                        <i className="fas fa-circle-check text-[13px] text-blue-500" />
                        <p className="text-[14px] text-gray-500 truncate">@{brandName.toLowerCase().replace(/\s+/g, '')} · 2h</p>
                    </div>
                    <i className="fas fa-ellipsis text-gray-500 hover:text-blue-500 cursor-pointer transition-colors" />
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[15px] leading-normal">{content}</p>
                {media.length > 0 && <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800"><MediaCarousel media={media} platform={SocialPlatform.X} /></div>}
                <div className="mt-3 flex justify-between text-gray-500 dark:text-gray-400">
                    <button className="flex items-center gap-2 hover:text-blue-500 transition-colors group"><div className="flex h-8 w-8 items-center justify-center rounded-full group-hover:bg-blue-500/10"><i className="far fa-comment" /></div><span className="text-[13px]">12</span></button>
                    <button className="flex items-center gap-2 hover:text-green-500 transition-colors group"><div className="flex h-8 w-8 items-center justify-center rounded-full group-hover:bg-green-500/10"><i className="fas fa-retweet" /></div><span className="text-[13px]">34</span></button>
                    <button className="flex items-center gap-2 hover:text-pink-500 transition-colors group"><div className="flex h-8 w-8 items-center justify-center rounded-full group-hover:bg-pink-500/10"><i className="far fa-heart" /></div><span className="text-[13px]">56</span></button>
                    <button className="flex items-center gap-2 hover:text-blue-500 transition-colors group"><div className="flex h-8 w-8 items-center justify-center rounded-full group-hover:bg-blue-500/10"><i className="far fa-chart-bar" /></div><span className="text-[13px]">7.8K</span></button>
                    <button className="flex items-center hover:text-blue-500 transition-colors group"><div className="flex h-8 w-8 items-center justify-center rounded-full group-hover:bg-blue-500/10"><i className="far fa-bookmark" /></div></button>
                </div>
            </div>
        </div>
    </div>
);

const LinkedInPreview: React.FC<Omit<PlatformPreviewProps, 'platform' | 'instagramFirstComment'>> = ({ content, media, brandName }) => (
    <div className="mx-auto flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-light-border/60 bg-white text-sm text-black shadow-xl dark:border-dark-border/60 dark:bg-[#1b1f23] dark:text-white">
        <header className="flex items-start gap-3 px-4 py-3">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(brandName)}&background=0A66C2&color=fff`} className="h-12 w-12 rounded-sm" alt={brandName} />
            <div>
                <div className="flex items-center justify-between">
                    <p className="text-[14px] font-bold leading-tight hover:text-blue-600 hover:underline cursor-pointer transition-colors">{brandName}</p>
                    <i className="fas fa-ellipsis text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10 h-8 w-8 flex items-center justify-center rounded-full cursor-pointer transition-colors" />
                </div>
                <p className="text-[12px] text-gray-500 dark:text-gray-400">1,234 followers</p>
                <div className="flex items-center gap-1 text-[12px] text-gray-500 dark:text-gray-400">
                    <span>1h</span>
                    <span>·</span>
                    <i className="fas fa-globe-americas text-[10px]" />
                </div>
            </div>
        </header>
        <div className="px-4 pb-2">
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed">{content}</p>
        </div>
        <MediaCarousel media={media} platform={SocialPlatform.LinkedIn} />
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800 flex justify-between text-[12px] text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
                <div className="flex -space-x-1">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-white text-[8px] z-20 border border-white dark:border-[#1b1f23]"><i className="fas fa-thumbs-up" /></span>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[8px] z-10 border border-white dark:border-[#1b1f23]"><i className="fas fa-heart" /></span>
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-white text-[8px] z-0 border border-white dark:border-[#1b1f23]"><i className="fas fa-sign-language" /></span>
                </div>
                <span className="ms-1">245</span>
            </div>
            <div className="flex gap-2">
                <span>34 comments</span>
                <span>·</span>
                <span>12 reposts</span>
            </div>
        </div>
        <div className="flex justify-between px-2 py-1 text-[13px] font-semibold text-gray-500 dark:text-gray-400">
            <button className="flex items-center justify-center gap-1.5 rounded-lg py-3 px-4 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"><i className="far fa-thumbs-up text-lg" /> <span className="hidden sm:inline">Like</span></button>
            <button className="flex items-center justify-center gap-1.5 rounded-lg py-3 px-4 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"><i className="far fa-comment-dots text-lg" /> <span className="hidden sm:inline">Comment</span></button>
            <button className="flex items-center justify-center gap-1.5 rounded-lg py-3 px-4 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"><i className="fas fa-redo text-lg" /> <span className="hidden sm:inline">Repost</span></button>
            <button className="flex items-center justify-center gap-1.5 rounded-lg py-3 px-4 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"><i className="fas fa-paper-plane text-lg" /> <span className="hidden sm:inline">Send</span></button>
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

const TikTokPreview: React.FC<Omit<PlatformPreviewProps, 'platform' | 'instagramFirstComment'>> = ({ content, media, brandName }) => (
    <div className="mx-auto flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-light-border/60 bg-black text-white shadow-xl dark:border-dark-border/60">
        <div className="relative flex flex-col" style={{ minHeight: 520 }}>
            {media.length > 0 ? (
                <div className="relative flex-grow overflow-hidden rounded-t-2xl bg-black">
                    <MediaCarousel media={media} platform={SocialPlatform.TikTok} />
                </div>
            ) : (
                <div className="flex flex-grow items-center justify-center rounded-t-2xl bg-gray-900" style={{ minHeight: 360 }}>
                    <i className="fab fa-tiktok text-6xl text-white/20" />
                </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent rounded-b-2xl">
                <div className="flex items-end gap-3">
                    <div className="flex-grow min-w-0">
                        <p className="text-[13px] font-bold mb-1">@{brandName.toLowerCase().replace(/\s+/g, '_')}</p>
                        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-white/90 line-clamp-3">{content}</p>
                        <div className="mt-2 flex items-center gap-1 text-[11px] text-white/60">
                            <i className="fas fa-music text-[10px]" />
                            <span className="truncate">{brandName} · Original Sound</span>
                        </div>
                    </div>
                    <div className="flex flex-col items-center gap-4 pb-2">
                        <div className="relative">
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(brandName)}&background=333&color=fff`} className="h-12 w-12 rounded-full border-2 border-white" alt={brandName} />
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex h-5 w-5 items-center justify-center rounded-full bg-[#fe2c55] text-white text-[10px]">
                                <i className="fas fa-plus" />
                            </div>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                            <i className="far fa-heart text-2xl" />
                            <span className="text-[11px]">45.2K</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                            <i className="far fa-comment text-2xl" />
                            <span className="text-[11px]">1,234</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5">
                            <i className="fas fa-share text-2xl" />
                            <span className="text-[11px]">Share</span>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-[#fe2c55] via-white to-[#25f4ee] p-[2px]">
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-black">
                                <i className="fas fa-music text-white text-sm" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

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
        case SocialPlatform.TikTok:
            return <TikTokPreview {...props} />;
        default:
            return <FacebookPreview {...props} />;
    }
};

export const PostPreview: React.FC<PostPreviewProps> = ({ content, platforms, media, activeTab, onTabChange, instagramFirstComment, locations, brandName = 'Brand' }) => {
    const { language } = useLanguage();
    const ar = language === 'ar';

    if (platforms.length === 0) {
        return (
            <div className="flex h-full flex-col items-center justify-center rounded-[1.5rem] border-2 border-dashed border-light-border/60 bg-light-bg/50 p-8 text-center dark:border-dark-border/60 dark:bg-dark-bg/50">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm dark:bg-dark-card">
                    <i className="fas fa-mobile-screen text-2xl text-light-text-secondary dark:text-dark-text-secondary" />
                </div>
                <h2 className="text-lg font-bold text-light-text dark:text-dark-text">{ar ? 'معاينة المنشور' : 'Post preview'}</h2>
                <p className="mt-2 max-w-xs text-sm text-light-text-secondary dark:text-dark-text-secondary">{ar ? 'اختر منصة واحدة على الأقل لإظهار شكل المنشور قبل النشر.' : 'Select at least one platform to preview the post before publishing.'}</p>
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col rounded-[1.5rem] border border-light-border/40 bg-white/40 p-4 shadow-lg backdrop-blur-md dark:border-dark-border/40 dark:bg-slate-900/40">
            <style>{`
                @keyframes fade-in-fast { 0% { opacity: 0; transform: scale(0.98); } 100% { opacity: 1; transform: scale(1); } }
                .animate-fade-in-fast { animation: fade-in-fast 0.3s ease-out forwards; }
            `}</style>
            <div className="mb-5 flex-shrink-0">
                <nav className="flex items-center gap-1.5 overflow-x-auto rounded-xl bg-light-bg/80 p-1.5 backdrop-blur-sm dark:bg-dark-bg/80">
                    {platforms.map((platform) => {
                        const asset = PLATFORM_ASSETS[platform];
                        const isActive = activeTab === platform;
                        return (
                            <button
                                key={platform}
                                onClick={() => onTabChange(platform)}
                                className={`group flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2.5 text-xs font-bold transition-all duration-300 ${isActive
                                        ? 'bg-white text-light-text shadow-sm dark:bg-dark-card dark:text-white'
                                        : 'text-light-text-secondary hover:bg-white/50 hover:text-light-text dark:text-dark-text-secondary dark:hover:bg-white/5 dark:hover:text-white'
                                    }`}
                            >
                                <span className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${isActive ? asset.textColor + ' bg-opacity-10' : 'text-current opacity-70 group-hover:opacity-100'}`} style={isActive ? { backgroundColor: `${asset.hexColor}20` } : {}}>
                                    <i className={`${asset.icon} text-[14px]`} style={isActive ? { color: asset.hexColor } : {}} />
                                </span>
                                <span>{platform}</span>
                            </button>
                        );
                    })}
                </nav>
            </div>
            <div className="min-h-0 flex-grow overflow-y-auto rounded-xl bg-slate-50/50 p-2 dark:bg-black/20">
                <div className="mx-auto max-w-sm animate-fade-in-fast">
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
        </div>
    );
};
