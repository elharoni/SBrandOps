
import { supabase } from './supabaseClient';
import { BrandHubProfile, PostPerformance, AIPostAnalysis, IdeaTestPlan, AdCreative, CampaignGoal, BrandVoiceAnalysis, HashtagSuggestion, BrandConsistencyEvaluation, SocialSearchAnalysisResult, AIContentIdea, SocialPlatform, OperationalError, AIErrorAnalysis, AnalyticsData, AIAnalyticsInsights, BrainstormedIdea, InboxConversation, ConversationIntent, ConversationSentiment, BrandProfileAnalysis, AIQualityCheckResult, ContentGoal, AdPlatform, AiContentPlan, AiContentPlanItem, AiPriorityRecommendation, AiMonthlyPlan, PlanObjectiveType, SeoKeyword, SeoArticle, BrandBrainContext, ConversationScenario, ConversationReply, OccasionOpportunity } from '../types';
import { buildBrandSystemPrompt } from './brandBrainService';
import type { Occasion } from '../data/occasions';

// Local schema type constants — mirrors the values from @google/genai Type enum
const Type = {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    ARRAY: 'ARRAY',
    BOOLEAN: 'BOOLEAN',
} as const;

// No-op kept for backward compatibility (AI client is now server-side)
export function resetAIClient(): void { /* key is managed server-side */ }

// ── Server-side AI proxy call ─────────────────────────────────────────────────

type ProxyTextParams = {
    model: string;
    prompt?: string;
    contents?: unknown;
    schema?: unknown;
    feature?: string;
    brand_id?: string | null;
};

type ProxyTextResponse = {
    text: string;
    usageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number };
};

async function callAIProxy(params: ProxyTextParams): Promise<ProxyTextResponse> {
    const { data, error } = await supabase.functions.invoke('ai-proxy', { body: params });
    if (error) throw new Error(error.message ?? 'AI proxy error');
    if (!data) throw new Error('Empty response from AI proxy');
    return data as ProxyTextResponse;
}

async function callAIImageProxy(params: {
    model: string;
    prompt: string;
    count: number;
    aspect_ratio: string;
}): Promise<string[]> {
    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: { mode: 'image', ...params },
    });
    if (error) throw new Error(error.message ?? 'AI image proxy error');
    return (data as { images: string[] })?.images ?? [];
}

// --- Image Generation ---
export type AIImageProvider = 'google' | 'pollinations' | 'gemini-native';

export async function generateImageFromPrompt(
    prompt: string,
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' = '1:1',
    provider: AIImageProvider = 'google',
    count: number = 1
): Promise<string[]> {
    const clampedCount = Math.min(Math.max(1, count), 4);
    try {
        if (provider === 'pollinations') {
            let width = 1024;
            let height = 1024;
            if (aspectRatio === '16:9') { width = 1024; height = 576; }
            if (aspectRatio === '9:16') { width = 576; height = 1024; }
            if (aspectRatio === '4:3') { width = 1024; height = 768; }
            if (aspectRatio === '3:4') { width = 768; height = 1024; }

            const encodedPrompt = encodeURIComponent(prompt);
            const urls = await Promise.all(
                Array.from({ length: clampedCount }, async () => {
                    const seed = Math.floor(Math.random() * 1000000);
                    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;
                    const res = await fetch(url);
                    if (!res.ok) throw new Error("Failed to generate image with Pollinations");
                    return url;
                })
            );
            return urls;
        }

        if (provider === 'gemini-native') {
            const { data, error } = await supabase.functions.invoke('ai-proxy', {
                body: {
                    mode: 'gemini-image',
                    model: 'gemini-2.0-flash-exp',
                    prompt,
                    count: clampedCount,
                },
            });
            if (error) throw new Error(error.message ?? 'Gemini image proxy error');
            return (data as { images: string[] })?.images ?? [];
        }

        return await callAIImageProxy({
            model: 'imagen-4.0-generate-001',
            prompt,
            count: clampedCount,
            aspect_ratio: aspectRatio,
        });
    } catch (error) {
        console.error("Image generation failed:", error);
        throw error;
    }
}

// --- Inbox Ops ---
export async function analyzeConversation(conversation: InboxConversation, brandProfile: BrandHubProfile): Promise<{ summary: string; intent: ConversationIntent; sentiment: ConversationSentiment; suggestedReplies: string[] }> {
    const conversationHistory = conversation.messages.map(m => `${m.sender === 'user' ? conversation.user.name : 'Agent'}: ${m.text}`).join('\n');

    const prompt = `
    أنت مساعد خدمة عملاء خبير لبراند اسمه "${brandProfile.brandName}". مهمتك هي تحليل محادثة مع عميل وتقديم المساعدة.

    هوية البراند:
    - النبرة: ${brandProfile.brandVoice.toneDescription.join(', ')}
    - الكلمات المفتاحية: ${brandProfile.brandVoice.keywords.join(', ')}
    - الإرشادات: ${brandProfile.brandVoice.voiceGuidelines?.dos.join('. ')}

    سجل المحادثة:
    ${conversationHistory}

    المطلوب منك:
    1.  **summary**: اكتب ملخصًا قصيرًا جدًا من جملة واحدة للموقف الحالي.
    2.  **intent**: حدد نية العميل الرئيسية من بين الخيارات التالية فقط: ["${Object.values(ConversationIntent).join('", "')}"]
    3.  **sentiment**: صنّف الحالة الشعورية العامة للعميل من بين القيم فقط: ["positive", "neutral", "negative"]
    4.  **suggestedReplies**: اقترح 3 ردود مختلفة ومناسبة، مع الالتزام التام بنبرة البراند. يجب أن تكون الردود جاهزة للإرسال مباشرة.

    أعد النتائج بصيغة JSON فقط.
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-pro",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                intent: { type: Type.STRING, enum: Object.values(ConversationIntent) },
                sentiment: { type: Type.STRING, enum: ['positive', 'neutral', 'negative'] },
                suggestedReplies: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['summary', 'intent', 'sentiment', 'suggestedReplies']
        },
        feature: 'inbox_analyze',
    });
    return JSON.parse(response.text);
}


// --- Post & Caption Generation ---

export async function generatePostCaption(topic: string, tone: string, brandProfile: BrandHubProfile): Promise<string[]> {
    const prompt = `
    Based on the brand profile below, generate 3 unique and engaging social media captions for the topic "${topic}" with a "${tone}" tone.

    Brand Profile:
    - Brand Name: ${brandProfile.brandName}
    - Industry: ${brandProfile.industry}
    - Core Values: ${brandProfile.values.join(', ')}
    - Key Selling Points: ${brandProfile.keySellingPoints.join(', ')}
    - Target Audience: ${brandProfile.brandAudiences.map(a => a.personaName).join(', ')}
    - Brand Voice Keywords: ${brandProfile.brandVoice.keywords.join(', ')}
    - Prohibited Keywords: ${brandProfile.brandVoice.negativeKeywords.join(', ')}

    Return the captions in a JSON array of strings.
    `;

    const response = await callAIProxy({
        model: "gemini-2.5-flash",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                captions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
            required: ['captions']
        },
        feature: 'content_gen',
    });

    const result = JSON.parse(response.text);
    return result.captions || [];
}


export async function analyzeCaptionForBrandVoice(caption: string, brandProfile: BrandHubProfile): Promise<BrandVoiceAnalysis> {
    const prompt = `
    Analyze the following social media caption for its alignment with the provided brand voice profile.

    Caption to Analyze: "${caption}"

    Brand Voice Profile:
    - Tone Description: ${brandProfile.brandVoice.toneDescription.join(', ')}
    - Keywords to use: ${brandProfile.brandVoice.keywords.join(', ')}
    - Keywords to avoid: ${brandProfile.brandVoice.negativeKeywords.join(', ')}
    - Dos: ${brandProfile.brandVoice.voiceGuidelines?.dos.join(', ')}
    - Don'ts: ${brandProfile.brandVoice.voiceGuidelines?.donts.join(', ')}

    Provide a score from 0 to 100 on how well it fits the brand voice.
    Provide concise feedback on why it received that score.
    Provide 2-3 specific suggestions for improvement.

    Return a JSON object.
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-flash",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                score: { type: Type.NUMBER, description: "A score from 0-100 for brand voice alignment." },
                feedback: { type: Type.STRING, description: "Brief feedback explaining the score." },
                suggestions: {
                    type: Type.ARRAY,
                    description: "An array of 2-3 actionable suggestions for improvement.",
                    items: { type: Type.STRING }
                }
            },
            required: ['score', 'feedback', 'suggestions']
        },
        feature: 'caption_voice_check',
    });
    return JSON.parse(response.text);
}


export async function suggestHashtags(caption: string, platforms: SocialPlatform[]): Promise<HashtagSuggestion[]> {
    const prompt = `
    Based on the following caption, suggest relevant hashtags grouped by category (e.g., General, Niche, Location-based).
    The hashtags should be optimized for the following social media platforms: ${platforms.join(', ')}.
    Caption: "${caption}"
    Return a JSON object.
    `;
    const response = await callAIProxy({
        model: 'gemini-2.5-flash',
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                hashtagGroups: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            category: { type: Type.STRING },
                            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                         required: ['category', 'hashtags']
                    }
                }
            },
            required: ['hashtagGroups']
        },
        feature: 'hashtag_suggest',
    });
    return JSON.parse(response.text).hashtagGroups;
}

// --- Analytics & Insights ---

export async function analyzePostWithAI(post: PostPerformance, brandProfile: BrandHubProfile): Promise<AIPostAnalysis> {
    const prompt = `
    Analyze the performance of the following social media post based on the brand's profile.

    Post Content: "${post.content}"
    Engagement Score: ${post.engagement}

    Brand Profile:
    - Goal: Drive sales and build trust.
    - Key Selling Points: ${brandProfile.keySellingPoints.join(', ')}
    - Target Audience: ${brandProfile.brandAudiences.map(a => a.description).join('; ')}

    Tasks:
    1.  Provide a "Brand Fit Score" (0-100) based on how well the post content aligns with the brand profile.
    2.  List 2-3 key strengths of the post.
    3.  List 2-3 key weaknesses or missed opportunities.
    4.  Provide 3 actionable recommendations for future posts to improve performance and brand alignment.

    Return as a JSON object.
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-pro",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                brandFitScore: { type: Type.NUMBER },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['brandFitScore', 'strengths', 'weaknesses', 'recommendations']
        },
        feature: 'caption_analyze',
    });
    return JSON.parse(response.text);
}


export async function generateAnalyticsInsights(data: AnalyticsData): Promise<AIAnalyticsInsights> {
    const prompt = `
    Analyze the following social media analytics data and provide insights.

    Data:
    - Overall Followers: ${data.overallStats.totalFollowers}
    - Total Impressions: ${data.overallStats.impressions}
    - Total Engagement: ${data.overallStats.engagement}
    - Follower Growth Trend: ${JSON.stringify(data.followerGrowth.slice(-2))}
    - Top Performing Post Engagement: ${data.topPosts[0]?.engagement} for content "${data.topPosts[0]?.content}"

    Tasks:
    1. Write a brief, high-level summary of the overall performance.
    2. Identify one key positive or negative trend from the data.
    3. Provide three concise, actionable recommendations to improve performance next month.

    Return as a JSON object.
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-pro",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                trends: { type: Type.STRING },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['summary', 'trends', 'recommendations']
        },
        feature: 'analytics_insights',
    });
    return JSON.parse(response.text);
}

// --- Brand Hub & Strategy ---

export async function analyzeBrandProfile(brandProfile: BrandHubProfile): Promise<BrandProfileAnalysis> {
    const prompt = `
    Act as a senior brand strategist. Analyze the following brand profile for consistency, clarity, and effectiveness.

    Brand Profile:
    - Name: ${brandProfile.brandName}
    - Industry: ${brandProfile.industry}
    - Values: ${brandProfile.values.join(', ')}
    - Key Selling Points: ${brandProfile.keySellingPoints.join(', ')}
    - Voice Tone: ${brandProfile.brandVoice.toneDescription.join(', ')}
    - Voice Keywords: ${brandProfile.brandVoice.keywords.join(', ')}
    - Target Audience Persona: ${brandProfile.brandAudiences[0]?.personaName} - ${brandProfile.brandAudiences[0]?.description}
    - Audience Pain Points: ${brandProfile.brandAudiences[0]?.painPoints.join(', ')}

    Your Tasks:
    1.  **overallScore**: Provide a single score from 0 to 100 representing the overall strength and consistency of this brand profile.
    2.  **strengths**: List 2-3 key strengths of the profile. What is done well?
    3.  **weaknesses**: List 2-3 potential weaknesses or areas of ambiguity. Where could the profile be clearer or more aligned?
    4.  **recommendations**: Provide 3 actionable recommendations for improving the brand profile.

    Return the analysis as a JSON object.
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-pro",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                overallScore: { type: Type.NUMBER },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['overallScore', 'strengths', 'weaknesses', 'recommendations']
        },
        feature: 'brand_analyze',
    });
    return JSON.parse(response.text);
}


export async function generateInitialBrandProfile(description: string, brandName: string): Promise<Partial<BrandHubProfile>> {
    const prompt = `
    Based on the following business description for "${brandName}", generate a foundational brand profile.

    Description: "${description}"

    Generate the following fields:
    - industry: The primary industry.
    - values: An array of 3-4 core brand values.
    - keySellingPoints: An array of 3-4 key features or benefits.
    - brandVoice.toneDescription: An array of 3-4 adjectives describing the tone (e.g., "Friendly", "Professional").
    - brandVoice.keywords: An array of 5-7 relevant SEO and brand keywords in Arabic.
    - brandAudiences: An array with ONE primary target audience persona object, including personaName, description, keyEmotions, and painPoints.

    Return only the JSON object.
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-pro",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                industry: { type: Type.STRING },
                values: { type: Type.ARRAY, items: { type: Type.STRING } },
                keySellingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                brandVoice: {
                    type: Type.OBJECT,
                    properties: {
                        toneDescription: { type: Type.ARRAY, items: { type: Type.STRING } },
                        keywords: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                     required: ['toneDescription', 'keywords']
                },
                brandAudiences: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            personaName: { type: Type.STRING },
                            description: { type: Type.STRING },
                            keyEmotions: { type: Type.ARRAY, items: { type: Type.STRING } },
                            painPoints: { type: Type.ARRAY, items: { type: Type.STRING } }
                        },
                        required: ['personaName', 'description', 'keyEmotions', 'painPoints']
                    }
                }
            },
            required: ['industry', 'values', 'keySellingPoints', 'brandVoice', 'brandAudiences']
        },
        feature: 'brand_gen',
    });
    return JSON.parse(response.text);
}

export async function evaluateContentConsistency(content: string, brandProfile: BrandHubProfile): Promise<BrandConsistencyEvaluation> {
     const prompt = `
    Evaluate the consistency of the provided content against the brand profile.

    Content: "${content}"

    Brand Profile:
    - Values: ${brandProfile.values.join(', ')}
    - Voice Keywords: ${brandProfile.brandVoice.keywords.join(', ')}
    - Tone: ${brandProfile.brandVoice.toneDescription.join(', ')}

    Tasks:
    1.  Provide a consistency score (0-100).
    2.  Provide brief feedback explaining the score.
    3.  List 2 actionable recommendations for improving consistency.

    Return as a JSON object.
    `;
     const response = await callAIProxy({
        model: "gemini-2.5-flash",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                score: { type: Type.NUMBER },
                feedback: { type: Type.STRING },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['score', 'feedback', 'recommendations']
        },
        feature: 'content_consistency',
    });
    return JSON.parse(response.text);
}


// --- Ads ---

export async function generateAdCreative(
    platform: AdPlatform,
    goal: CampaignGoal,
    productInfo: string,
    brandProfile: BrandHubProfile,
    targetAudience: string
): Promise<Pick<AdCreative, 'headline' | 'primaryText'>[]> {
    let platformInstructions = "";

    if (platform === AdPlatform.TikTok) {
        platformInstructions = `
        Generate content for TikTok.
        - 'headline' field: Should be the video CAPTION (short, punchy, with hashtags).
        - 'primaryText' field: Should be a Video SCRIPT divided into [Hook], [Value Prop], and [CTA] sections.
        `;
    } else if (platform === AdPlatform.Google) {
        platformInstructions = `
        Generate content for Google Search Ads.
        - 'headline' field: Generate 2-3 short headlines separated by ' | ' (max 30 chars each).
        - 'primaryText' field: Generate a compelling description (max 90 chars).
        Focus on high-intent keywords.
        `;
    } else {
        platformInstructions = `
        Generate content for Meta (Facebook/Instagram) Ads.
        - 'headline' field: A catchy headline (max 40 chars).
        - 'primaryText' field: The main ad body text (125 chars recommended, focus on benefits).
        `;
    }

    const prompt = `
    Generate 3 distinct ad creative options for a "${platform}" campaign.

    Campaign Goal: "${goal}"
    Product/Service: "${productInfo}"
    Target Audience Profile: "${targetAudience}"
    Brand Name: ${brandProfile.brandName}
    Brand Tone: ${brandProfile.brandVoice.toneDescription.join(', ')}

    Instructions:
    ${platformInstructions}

    Return a JSON object with a "creatives" array containing objects with "headline" and "primaryText".
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-flash",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                creatives: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            headline: { type: Type.STRING },
                            primaryText: { type: Type.STRING }
                        },
                         required: ['headline', 'primaryText']
                    }
                }
            },
            required: ['creatives']
        },
        feature: 'ad_creative_gen',
    });
    return JSON.parse(response.text).creatives;
}

export async function generateTargetingSuggestions(
    platform: AdPlatform,
    productDescription: string,
    brandProfile: BrandHubProfile
): Promise<string[]> {
    let term = "interests";
    if (platform === AdPlatform.Google) term = "keywords";
    if (platform === AdPlatform.TikTok) term = "hashtags and interests";

    const prompt = `
    Act as a senior media buyer. Suggest 10 highly relevant ${term} for targeting on ${platform}.

    Product: "${productDescription}"
    Brand Industry: ${brandProfile.industry}

    Return a JSON array of strings.
    `;

    const response = await callAIProxy({
        model: "gemini-2.5-flash",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                suggestions: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
            required: ['suggestions']
        },
        feature: 'ad_targeting_suggest',
    });
    return JSON.parse(response.text).suggestions;
}


// --- Idea Ops ---

export async function generateIdeaTestPlan(idea: string, audience: string, brandProfile: BrandHubProfile): Promise<IdeaTestPlan> {
    const prompt = `
    Create a test plan for a new content idea for the brand "${brandProfile.brandName}".

    Idea: "${idea}"
    Target Audience: "${audience}"

    Tasks:
    1.  Provide a brief AI summary of the testing strategy.
    2.  Recommend 2-3 platforms and formats (e.g., Instagram Reel, X Thread). Justify each choice.
    3.  List 3-4 key talking points to include in the content.
    4.  Suggest one strong Call to Action (CTA).
    5.  List 3 key success metrics to track (e.g., "Engagement Rate > 3%", "Saves > 100").

    Return as a JSON object.
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-pro",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                aiSummary: { type: Type.STRING },
                recommendedPlatforms: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            platform: { type: Type.STRING },
                            format: { type: Type.STRING },
                            justification: { type: Type.STRING }
                        },
                         required: ['platform', 'format', 'justification']
                    }
                },
                keyTalkingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
                suggestedCTA: { type: Type.STRING },
                successMetrics: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['aiSummary', 'recommendedPlatforms', 'keyTalkingPoints', 'suggestedCTA', 'successMetrics']
        },
        feature: 'idea_test_plan',
    });
    return JSON.parse(response.text);
}

export async function expandOnTopic(topic: string, mainIdea: string): Promise<string[]> {
    const prompt = `
    Given the main content idea "${mainIdea}", expand on the sub-topic "${topic}" by generating 3 related, more specific sub-points or ideas.
    Return a JSON array of strings.
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-flash",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                subTopics: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
             required: ['subTopics']
        },
        feature: 'idea_expand',
    });
    return JSON.parse(response.text).subTopics;
}

export async function brainstormContentIdeas(topic: string, brandProfile: BrandHubProfile): Promise<BrainstormedIdea[]> {
    if (topic === "summer campaign") {
        return Promise.resolve([
            {
                title: "صيف بارد، نوم أعمق",
                description: "سلسلة من 3 صور كاروسيل تشرح كيف تساعد تقنية جل التبريد في وسائدنا على التغلب على حرارة الصيف والحصول على نوم مريح.",
                platform: SocialPlatform.Instagram,
                format: "Carousel",
                angle: "Educational"
            },
            {
                title: "استعد لمغامرات الصيف بنوم هانئ",
                description: "فيديو قصير (ريل) يعرض لقطات سريعة لأشخاص يستمتعون بأنشطة صيفية (بحر، سفر) ثم ينتقل لمشهد نوم مريح، مع رسالة \"طاقة يومك تبدأ من راحة ليلتك\".",
                platform: SocialPlatform.TikTok,
                format: "Reel",
                angle: "Aspirational"
            },
            {
                title: "ما هي أكبر مشكلة تواجهك في النوم صيفًا؟",
                description: "استطلاع رأي تفاعلي على ستوري انستغرام (Poll Sticker) يسأل المتابعين عن مشاكلهم (الحر، الأرق، الإزعاج) ويقدم حلولاً سريعة.",
                platform: SocialPlatform.Instagram,
                format: "Story",
                angle: "Interactive"
            },
            {
                title: "عرض الصيف: انتعش بنوم أفضل",
                description: "تصميم ثابت وجذاب يعلن عن خصم خاص على المنتجات المزودة بتقنية التبريد، مع التركيز على الفائدة المباشرة: \"تغلب على حر الصيف\".",
                platform: SocialPlatform.Facebook,
                format: "Static",
                angle: "Sales-focused"
            },
            {
                title: "علم البرودة: كيف نعمل؟",
                description: "فيديو قصير يظهر لقطات مقربة (Behind-the-scenes) لطبقة جل التبريد وكيفية دمجها في الميموري فوم، لبناء الثقة وإظهار الجودة.",
                platform: SocialPlatform.Instagram,
                format: "Reel",
                angle: "Behind-the-scenes"
            }
        ]);
    }

    const prompt = `
    Brainstorm 5 creative content ideas about "${topic}" for the brand "${brandProfile.brandName}".
    For each idea, provide a title, a short description, a suggested platform, a format (e.g., Reel, Carousel, Story), and a creative angle (e.g., "Educational", "Humorous", "Behind-the-scenes").
    Consider seasonal events, trending topics, and the brand's voice.
    Return a JSON array.
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-pro",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                ideas: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            platform: { type: Type.STRING, enum: Object.values(SocialPlatform) },
                            format: { type: Type.STRING },
                            angle: { type: Type.STRING }
                        },
                         required: ['title', 'description', 'platform', 'format', 'angle']
                    }
                }
            },
            required: ['ideas']
        },
        feature: 'idea_brainstorm',
    });
    return JSON.parse(response.text).ideas;
}


// --- Social Search & Error Center ---

export async function analyzeSocialSearchQuery(query: string): Promise<SocialSearchAnalysisResult> {
    console.log(`Analyzing social search for: ${query}`);
    await new Promise(res => setTimeout(res, 2000));

    const normalizedQuery = query.trim();
    const compactQuery = normalizedQuery.replace(/\s+/g, ' ').trim();
    const keywordRoot = compactQuery.split(' ')[0] || 'brand';
    const competitorBase = keywordRoot.replace(/[^a-zA-Z0-9؀-ۿ]/g, '') || 'brand';
    const mockResult: SocialSearchAnalysisResult = {
        aiSummary: `Search signals for "${compactQuery}" are strongest on Instagram and LinkedIn, with conversations leaning positive around quality, positioning, and buyer confidence. The clearest opportunity is to publish proof-based content that differentiates your offer from fast-growing competitors.`,
        sentiment: { positive: 68, neutral: 22, negative: 10 },
        contentIdeas: [
            {
                type: 'Reel',
                title: `Why customers choose ${competitorBase}`,
                description: `Create a short comparison-style reel that frames why buyers mention ${compactQuery} and what differentiates your offer in practice.`,
            },
            {
                type: 'Static',
                title: `Top objections around ${compactQuery}`,
                description: `Turn the most repeated questions and concerns into a single static post with a clear CTA and proof point.`,
            },
            {
                type: 'Campaign',
                title: `Category proof campaign`,
                description: `Bundle testimonials, product proof, and one strong competitor differentiator into a weekly content campaign.`,
            },
        ],
        platformPerformance: [
            {
                platform: SocialPlatform.Instagram,
                resultsCount: 1420,
                engagementRate: '5.8%',
                weeklyGrowth: 14,
                topCompetitors: [`${competitorBase} Pro`, `${competitorBase} Plus`],
            },
            {
                platform: SocialPlatform.LinkedIn,
                resultsCount: 760,
                engagementRate: '4.1%',
                weeklyGrowth: 9,
                topCompetitors: [`${competitorBase} Labs`, `${competitorBase} Pro`],
            },
            {
                platform: SocialPlatform.X,
                resultsCount: 640,
                engagementRate: '2.3%',
                weeklyGrowth: -3,
                topCompetitors: [`${competitorBase} Plus`, `${competitorBase} Now`],
            },
        ],
        topHashtags: [
            { tag: `#${competitorBase}`, growth: 19 },
            { tag: '#socialproof', growth: 13 },
            { tag: '#buyersguide', growth: 9 },
        ],
        relatedKeywords: [
            `${compactQuery} review`,
            `${compactQuery} comparison`,
            `${compactQuery} best option`,
            `${compactQuery} audience`,
        ],
    };
    return mockResult;
}


export async function analyzeOperationalErrors(errors: OperationalError[]): Promise<AIErrorAnalysis> {
    const prompt = `
    Analyze the following list of operational errors from a social media management tool.
    Errors: ${JSON.stringify(errors.map(e => ({ title: e.title, source: e.source, severity: e.severity })))}

    Tasks:
    1.  Provide a high-level summary of the current situation.
    2.  Hypothesize a potential root cause if a pattern exists.
    3.  Provide a prioritized list of 2-3 recommendations to resolve these issues.

    Return as a JSON object.
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-pro",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                summary: { type: Type.STRING },
                rootCause: { type: Type.STRING },
                recommendations: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            priority: { type: Type.NUMBER },
                            text: { type: Type.STRING }
                        },
                         required: ['priority', 'text']
                    }
                }
            },
            required: ['summary', 'rootCause', 'recommendations']
        },
        feature: 'error_analyze',
    });
    return JSON.parse(response.text);
}

// --- Content Ops ---
export async function generateAIContentIdeas(strategy: 'Seasonal' | 'Trending' | 'Brand-based' | 'Competitor', brandProfile: BrandHubProfile): Promise<BrainstormedIdea[]> {
    const prompt = `
    Brainstorm 5 creative content ideas for the brand "${brandProfile.brandName}" based on a "${strategy}" strategy.
    For each idea, provide a title, a short description, a suggested platform, a format (e.g., Reel, Carousel, Story), and a creative angle (e.g., "Educational", "Humorous", "Behind-the-scenes").
    Consider seasonal events, trending topics, and the brand's voice.
    Return a JSON array of BrainstormedIdea objects.
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-pro",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                ideas: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            platform: { type: Type.STRING, enum: Object.values(SocialPlatform) },
                            format: { type: Type.STRING },
                            angle: { type: Type.STRING }
                        },
                         required: ['title', 'description', 'platform', 'format', 'angle']
                    }
                }
            },
            required: ['ideas']
        },
        feature: 'content_ideas',
    });
    return (JSON.parse(response.text).ideas || []) as BrainstormedIdea[];
}

export async function modifyContent(
    modificationType: 'improve' | 'shorten' | 'expand' | 'fix_grammar' | 'make_punchy' | 'add_emojis' | 'generate-cta' | 'add_hashtags' | 'translate' | 'custom',
    content: string,
    brandProfile: BrandHubProfile,
    additionalParams?: { targetLanguage?: string, customInstruction?: string }
): Promise<string> {
    let instruction = '';
    switch (modificationType) {
        case 'improve': instruction = 'Improve clarity, flow, and impact.'; break;
        case 'shorten': instruction = 'Shorten the text significantly while keeping the key message. Make it concise.'; break;
        case 'expand': instruction = 'Expand on the ideas, adding more detail, examples, or depth.'; break;
        case 'fix_grammar': instruction = 'Fix all grammar, spelling, and punctuation errors without changing the tone.'; break;
        case 'make_punchy': instruction = 'Make it punchy, energetic, and exciting using short sentences and active voice.'; break;
        case 'add_emojis': instruction = 'Add relevant emojis to enhance visual appeal without overdoing it.'; break;
        case 'generate-cta': instruction = 'Add a strong, goal-oriented Call to Action (CTA) at the end.'; break;
        case 'add_hashtags': instruction = 'Append 3-5 relevant, high-traffic hashtags at the end.'; break;
        case 'translate': instruction = `Translate the content to ${additionalParams?.targetLanguage || 'English'}. Keep the formatting and emojis.`; break;
        case 'custom': instruction = additionalParams?.customInstruction || 'Improve the text.'; break;
    }

    const prompt = `
    Role: Social Media Editor for brand "${brandProfile.brandName}".
    Task: ${instruction}

    Original Content:
    "${content}"

    Brand Voice Guidelines:
    - Tone: ${brandProfile.brandVoice.toneDescription.join(', ')}
    - Do not use: ${brandProfile.brandVoice.negativeKeywords.join(', ')}

    Return ONLY the modified content as a single JSON string value in a property called "modifiedContent".
    `;

    const response = await callAIProxy({
        model: "gemini-2.5-flash",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                modifiedContent: { type: Type.STRING }
            },
            required: ['modifiedContent']
        },
        feature: 'content_modify',
    });

    return JSON.parse(response.text).modifiedContent;
}

export async function generateContentVariations(content: string, brandProfile: BrandHubProfile): Promise<string[]> {
    const prompt = `
    You are an expert A/B testing copywriter for the brand "${brandProfile.brandName}".
    Based on the following original content, generate 3 distinct variations for A/B testing.
    The variations should test different angles, hooks, or calls to action while staying true to the brand voice.

    Original Content:
    "${content}"

    Return the 3 variations in a JSON array of strings in a property called "variations".
    `;

    const response = await callAIProxy({
        model: "gemini-2.5-flash",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                variations: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                }
            },
            required: ['variations']
        },
        feature: 'content_variations',
    });
    return JSON.parse(response.text).variations || [];
}

export async function reformatContent(format: 'Ad Copy' | 'Video Script' | 'Thread', content: string, brandProfile: BrandHubProfile): Promise<string> {
    let formatInstruction = '';
    if (format === 'Ad Copy') formatInstruction = 'Generate a compelling headline and a short, persuasive primary text.';
    if (format === 'Video Script') formatInstruction = 'Generate a short hook, a main body with key points or scene descriptions, and a call to action.';
    if (format === 'Thread') formatInstruction = 'Break the content into a thread of 3-5 engaging tweets/posts.';

    const prompt = `
    You are an expert content strategist for the brand "${brandProfile.brandName}".
    Your task is to reformat the following content into a "${format}".

    Original Content:
    "${content}"

    Instruction: ${formatInstruction}

    Return ONLY the reformatted content as a single JSON string value in a property called "reformattedContent".
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-flash",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                reformattedContent: { type: Type.STRING }
            },
            required: ['reformattedContent']
        },
        feature: 'content_reformat',
    });

    return JSON.parse(response.text).reformattedContent;
}

export async function generateStructuredContent(
    goal: ContentGoal,
    topic: string,
    brandProfile: BrandHubProfile,
    platform: SocialPlatform = SocialPlatform.Instagram,
    tone: string = 'Professional'
): Promise<{ title: string; content: string }> {
    const prompt = `
    You are an expert social media content creator for the brand "${brandProfile.brandName}".

    Task: Create a social media post.
    Platform: ${platform}
    Topic: "${topic}"
    Goal: "${goal}"
    Tone Instruction: "${tone}"

    Brand Voice Guidelines:
    - Keywords: ${brandProfile.brandVoice.keywords.join(', ')}
    - Brand Tone: ${brandProfile.brandVoice.toneDescription.join(', ')} (Prioritize the "Tone Instruction" above if they conflict)
    - Avoid: ${brandProfile.brandVoice.negativeKeywords.join(', ')}

    Generate a catchy internal working title and the post content (including emojis and hashtags if appropriate for the platform).

    Return the result as a JSON object with two keys: "title" and "content".
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-flash",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
            },
            required: ['title', 'content']
        },
        feature: 'content_structured_gen',
    });
    return JSON.parse(response.text);
}

export async function improveContentWithAI(content: string, brandProfile: BrandHubProfile): Promise<string> {
    const prompt = `
    You are an expert social media copywriter for the brand "${brandProfile.brandName}".
    Your task is to improve the following piece of content. Make it more engaging, clear, and aligned with the brand voice.

    Brand Voice:
    - Tone: ${brandProfile.brandVoice.toneDescription.join(', ')}
    - Keywords: ${brandProfile.brandVoice.keywords.join(', ')}
    - Guidelines: ${brandProfile.brandVoice.voiceGuidelines?.dos.join('. ')}

    Content to improve:
    "${content}"

    Return ONLY the improved content as a single JSON string value.
    `;

    const response = await callAIProxy({
        model: "gemini-2.5-flash",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                improvedContent: { type: Type.STRING }
            },
            required: ['improvedContent']
        },
        feature: 'content_improve',
    });

    const result = JSON.parse(response.text);
    return result.improvedContent;
}

export async function performAIQualityCheck(content: string, brandProfile: BrandHubProfile): Promise<AIQualityCheckResult> {
    const prompt = `
    Act as an AI Quality Assurance agent. Analyze the provided content based on the brand profile across four distinct criteria: Grammar, Tone of Voice, Brand Fit, and Call to Action (CTA).

    Content to Analyze:
    "${content}"

    Brand Profile:
    - Voice Keywords: ${brandProfile.brandVoice.keywords.join(', ')}
    - Tone Description: ${brandProfile.brandVoice.toneDescription.join(', ')}
    - Dos: ${brandProfile.brandVoice.voiceGuidelines?.dos.join(', ')}
    - Don'ts: ${brandProfile.brandVoice.voiceGuidelines?.donts.join(', ')}

    For each of the four criteria (grammar, toneOfVoice, brandFit, cta), provide a score from 0 to 100 and brief, constructive feedback in Arabic explaining the score.

    - **grammar**: Check for spelling mistakes, grammatical errors, and punctuation.
    - **toneOfVoice**: How well does it match the brand's described tone (${brandProfile.brandVoice.toneDescription.join(', ')})?
    - **brandFit**: Does the content align with the brand's values, keywords, and overall identity?
    - **cta**: Is there a clear Call to Action? Is it compelling and effective? If no CTA is present, score it low and suggest one.

    Return a single JSON object with the specified structure.
    `;
    const response = await callAIProxy({
        model: "gemini-2.5-pro",
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                grammar: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING } }, required: ['score', 'feedback'] },
                toneOfVoice: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING } }, required: ['score', 'feedback'] },
                brandFit: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING } }, required: ['score', 'feedback'] },
                cta: { type: Type.OBJECT, properties: { score: { type: Type.NUMBER }, feedback: { type: Type.STRING } }, required: ['score', 'feedback'] },
            },
            required: ['grammar', 'toneOfVoice', 'brandFit', 'cta']
        },
        feature: 'content_quality_check',
    });
    return JSON.parse(response.text);
}

export async function analyzeImageForContent(base64Image: string): Promise<{ description: string; altText: string; tags: string[] }> {
    const contents = [
        {
            parts: [
                { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
                {
                    text: `Analyze this image and provide the following in Arabic:
        1. A captivating one-sentence social media description.
        2. A descriptive SEO-friendly alt text.
        3. An array of 5-7 relevant tags.

        Return as a JSON object.`
                }
            ]
        }
    ];

    const response = await callAIProxy({
        model: 'gemini-2.5-flash',
        contents,
        schema: {
            type: Type.OBJECT,
            properties: {
                description: { type: Type.STRING },
                altText: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['description', 'altText', 'tags']
        },
        feature: 'image_analyze',
    });

    return JSON.parse(response.text);
}

// ── AI Strategy Engine ────────────────────────────────────────────────────────

export async function generateContentPlan(
    brandProfile: BrandHubProfile,
    params: {
        objective: string;
        objectiveType: PlanObjectiveType;
        platforms: SocialPlatform[];
        targetAudience: string;
        budget: number;
        durationDays: number;
    }
): Promise<AiContentPlan> {
    const platformList = params.platforms.join(', ');
    const prompt = `
أنت خبير تسويق رقمي. مهمتك إنشاء خطة محتوى تفصيلية لبراند اسمه "${brandProfile.brandName}".

معلومات البراند:
- الصناعة: ${brandProfile.industry}
- القيم: ${brandProfile.values.join(', ')}
- نقاط القوة: ${brandProfile.keySellingPoints.join(', ')}
- نبرة الصوت: ${brandProfile.brandVoice.toneDescription.join(', ')}
- الكلمات المفتاحية: ${brandProfile.brandVoice.keywords.join(', ')}

متطلبات الخطة:
- الهدف: ${params.objective}
- المنصات: ${platformList}
- الجمهور المستهدف: ${params.targetAudience}
- الميزانية: ${params.budget} ريال
- المدة: ${params.durationDays} يوم

أنشئ خطة المحتوى وأعد JSON فقط.
`;
    try {
        const response = await callAIProxy({
            model: 'gemini-2.5-pro',
            prompt,
            schema: {
                type: Type.OBJECT,
                properties: {
                    overview:    { type: Type.STRING },
                    totalPosts:  { type: Type.NUMBER },
                    weeklyFocus: { type: Type.ARRAY, items: { type: Type.STRING } },
                    platformDistribution: {
                        type: Type.OBJECT,
                        properties: {
                            Facebook:  { type: Type.NUMBER },
                            Instagram: { type: Type.NUMBER },
                            X:         { type: Type.NUMBER },
                            LinkedIn:  { type: Type.NUMBER },
                            TikTok:    { type: Type.NUMBER },
                            Pinterest: { type: Type.NUMBER },
                        },
                    },
                    budgetSuggestion: {
                        type: Type.OBJECT,
                        properties: {
                            Facebook:  { type: Type.NUMBER },
                            Instagram: { type: Type.NUMBER },
                            X:         { type: Type.NUMBER },
                            LinkedIn:  { type: Type.NUMBER },
                            TikTok:    { type: Type.NUMBER },
                            Pinterest: { type: Type.NUMBER },
                        },
                    },
                    items: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id:             { type: Type.STRING },
                                dayNumber:      { type: Type.NUMBER },
                                platform:       { type: Type.STRING },
                                postType:       { type: Type.STRING },
                                topic:          { type: Type.STRING },
                                caption:        { type: Type.STRING },
                                hashtags:       { type: Type.ARRAY, items: { type: Type.STRING } },
                                suggestedTime:  { type: Type.STRING },
                                objective:      { type: Type.STRING },
                                estimatedReach: { type: Type.STRING },
                            },
                            required: ['id', 'dayNumber', 'platform', 'postType', 'topic', 'caption', 'hashtags', 'suggestedTime', 'objective'],
                        },
                    },
                },
                required: ['overview', 'totalPosts', 'weeklyFocus', 'platformDistribution', 'items'],
            },
            feature: 'content_plan_gen',
        });
        const parsed = JSON.parse(response.text) as AiContentPlan;
        return { ...parsed, generatedAt: new Date().toISOString() };
    } catch (err) {
        console.error('generateContentPlan failed:', err);
        throw err;
    }
}

export async function generatePriorityRecommendations(
    brandProfile: BrandHubProfile,
    context: { recentPostsCount?: number; avgEngagementRate?: number; activeAdsCampaigns?: number; avgRoas?: number; totalCustomers?: number; }
): Promise<AiPriorityRecommendation[]> {
    const prompt = `
أنت مستشار تسويق رقمي خبير. حلّل وضع البراند "${brandProfile.brandName}" وأعطِ أهم 5 توصيات عملية لهذا الأسبوع.
البراند: ${brandProfile.industry} | القيم: ${brandProfile.values.join(', ')}
الأداء: منشورات=${context.recentPostsCount ?? '?'}, تفاعل=${context.avgEngagementRate ?? '?'}%, ROAS=${context.avgRoas ?? '?'}, عملاء=${context.totalCustomers ?? '?'}
أعد مصفوفة JSON من 5 توصيات فقط.
`;
    try {
        const response = await callAIProxy({
            model: 'gemini-2.5-flash',
            prompt,
            schema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        id:              { type: Type.STRING },
                        rank:            { type: Type.NUMBER },
                        title:           { type: Type.STRING },
                        description:     { type: Type.STRING },
                        actionLabel:     { type: Type.STRING },
                        category:        { type: Type.STRING },
                        estimatedImpact: { type: Type.STRING },
                        urgency:         { type: Type.STRING },
                    },
                    required: ['id', 'rank', 'title', 'description', 'actionLabel', 'category', 'estimatedImpact', 'urgency'],
                },
            },
            feature: 'priority_recs',
        });
        return JSON.parse(response.text) as AiPriorityRecommendation[];
    } catch (err) {
        console.error('generatePriorityRecommendations failed:', err);
        return MOCK_PRIORITY_RECS;
    }
}

const MOCK_PRIORITY_RECS: AiPriorityRecommendation[] = [
    { id: 'rec-1', rank: 1, title: 'انشر Reel تعليمي هذا الأسبوع', description: 'المحتوى التعليمي يحقق تفاعلاً أعلى بنسبة 34% من الترويجي.', actionLabel: 'إنشاء Reel', category: 'content', estimatedImpact: '+30% Reach', urgency: 'high' },
    { id: 'rec-2', rank: 2, title: 'راجع أداء حملاتك الإعلانية', description: 'ROAS دون 2x يعني تحسين مطلوب في الاستهداف أو النسخة الإعلانية.', actionLabel: 'مراجعة الحملات', category: 'ads', estimatedImpact: '+25% ROAS', urgency: 'high' },
    { id: 'rec-3', rank: 3, title: 'أعد تفعيل العملاء غير النشطين', description: 'العملاء الذين لم يتفاعلوا 30 يوماً يحتاجون عرضاً خاصاً.', actionLabel: 'إنشاء حملة Re-engagement', category: 'crm', estimatedImpact: '+15% Retention', urgency: 'medium' },
    { id: 'rec-4', rank: 4, title: 'أضف محتوى SEO طويل الذيل', description: 'كلمات مفتاحية طويلة = CVR أعلى مع منافسة أقل.', actionLabel: 'بحث الكلمات المفتاحية', category: 'seo', estimatedImpact: '+40% Organic', urgency: 'medium' },
    { id: 'rec-5', rank: 5, title: 'Stories يومية لرفع الظهور', description: 'Poll أو Question Sticker يومياً يرفع معدل الظهور في الخوارزمية.', actionLabel: 'جدول Stories', category: 'engagement', estimatedImpact: '+20% Reach', urgency: 'low' },
];

export async function generateMonthlyPlan(
    brandProfile: BrandHubProfile,
    params: { month: string; goals: { reach?: number; leads?: number; revenue?: number } }
): Promise<AiMonthlyPlan> {
    const goalsStr = [
        params.goals.reach   ? `وصول: ${params.goals.reach.toLocaleString()}` : '',
        params.goals.leads   ? `عملاء: ${params.goals.leads}` : '',
        params.goals.revenue ? `إيراد: ${params.goals.revenue.toLocaleString()} ريال` : '',
    ].filter(Boolean).join(' | ');

    const prompt = `
أنشئ خطة تشغيلية كاملة لشهر ${params.month} لبراند "${brandProfile.brandName}" (${brandProfile.industry}).
الأهداف: ${goalsStr || 'نمو عام'}
الخطة تشمل 4 أسابيع، كل أسبوع له محور و5-8 مهام مع تاريخ الاستحقاق (dueDay 1-28).
أعد JSON فقط.
`;
    try {
        const response = await callAIProxy({
            model: 'gemini-2.5-pro',
            prompt,
            schema: {
                type: Type.OBJECT,
                properties: {
                    month:    { type: Type.STRING },
                    goals:    { type: Type.OBJECT, properties: { reach: { type: Type.NUMBER }, leads: { type: Type.NUMBER }, revenue: { type: Type.NUMBER } } },
                    overview: { type: Type.STRING },
                    weeks: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                weekNumber: { type: Type.NUMBER },
                                focus:      { type: Type.STRING },
                                tasks: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            title:    { type: Type.STRING },
                                            category: { type: Type.STRING },
                                            dueDay:   { type: Type.NUMBER },
                                            platform: { type: Type.STRING },
                                        },
                                        required: ['title', 'category', 'dueDay'],
                                    },
                                },
                            },
                            required: ['weekNumber', 'focus', 'tasks'],
                        },
                    },
                    kpis: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['month', 'overview', 'weeks', 'kpis'],
            },
            feature: 'monthly_plan_gen',
        });
        const parsed = JSON.parse(response.text) as AiMonthlyPlan;
        return { ...parsed, generatedAt: new Date().toISOString() };
    } catch (err) {
        console.error('generateMonthlyPlan failed:', err);
        return { month: params.month, goals: params.goals, overview: 'فشل التوليد.', weeks: [], kpis: [], generatedAt: new Date().toISOString() };
    }
}

// ── SEO Ops AI Functions ──────────────────────────────────────────────────────

export async function generateKeywordResearch(
    topic: string,
    brandProfile: BrandHubProfile
): Promise<Omit<SeoKeyword, 'id' | 'brandId' | 'createdAt'>[]> {
    const prompt = `
أنت خبير SEO متخصص. أنشئ قائمة بحث كلمات مفتاحية لموضوع "${topic}" لبراند "${brandProfile.brandName}" في مجال "${brandProfile.industry}".
أنشئ 15 كلمة مفتاحية متنوعة (قصيرة وطويلة الذيل) مع:
- keyword: الكلمة المفتاحية (عربية أو إنجليزية حسب السياق)
- searchIntent: informational|navigational|commercial|transactional
- difficulty: low|medium|high
- priorityScore: 1-100 (أهمية للبراند)
- monthlyVolume: تقدير الحجم الشهري (نص: "1,000-5,000")
- notes: ملاحظة استراتيجية قصيرة
أعد JSON فقط.
`;
    try {
        const response = await callAIProxy({
            model: 'gemini-2.5-flash',
            prompt,
            schema: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        keyword:       { type: Type.STRING },
                        searchIntent:  { type: Type.STRING },
                        difficulty:    { type: Type.STRING },
                        priorityScore: { type: Type.NUMBER },
                        monthlyVolume: { type: Type.STRING },
                        notes:         { type: Type.STRING },
                    },
                    required: ['keyword', 'searchIntent', 'difficulty', 'priorityScore', 'monthlyVolume'],
                },
            },
            feature: 'seo_keyword_research',
        });
        return JSON.parse(response.text);
    } catch (err) {
        console.error('generateKeywordResearch failed:', err);
        return [];
    }
}

export async function generateSeoArticle(
    keyword: string,
    brandProfile: BrandHubProfile
): Promise<Pick<SeoArticle, 'h1' | 'h2s' | 'intro' | 'body' | 'faq' | 'metaTitle' | 'metaDescription'>> {
    const prompt = `
أنت كاتب محتوى SEO خبير. اكتب مقالاً متكاملاً لكلمة مفتاحية "${keyword}" لبراند "${brandProfile.brandName}".
نبرة البراند: ${brandProfile.brandVoice.toneDescription.join(', ')}
الكلمات المفتاحية المساعدة: ${brandProfile.brandVoice.keywords.join(', ')}

المقال يجب أن:
- يكون بين 800-1200 كلمة
- يتضمن الكلمة المفتاحية بشكل طبيعي
- يتبع بنية SEO واضحة
- يكون باللغة العربية الفصحى البسيطة

أعد JSON يحتوي على:
- h1: العنوان الرئيسي (يتضمن الكلمة المفتاحية)
- h2s: مصفوفة العناوين الفرعية (3-5 عناوين)
- intro: مقدمة جذابة (100-150 كلمة)
- body: جسم المقال (600-800 كلمة، يتضمن الـ H2s كعناوين داخلية)
- faq: مصفوفة من 3-5 أسئلة وأجوبة، كل منها { question, answer }
- metaTitle: عنوان السيو (50-60 حرف، يتضمن الكلمة المفتاحية)
- metaDescription: وصف السيو (150-160 حرف)

أعد JSON فقط.
`;
    try {
        const response = await callAIProxy({
            model: 'gemini-2.5-pro',
            prompt,
            schema: {
                type: Type.OBJECT,
                properties: {
                    h1:              { type: Type.STRING },
                    h2s:             { type: Type.ARRAY, items: { type: Type.STRING } },
                    intro:           { type: Type.STRING },
                    body:            { type: Type.STRING },
                    faq: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                question: { type: Type.STRING },
                                answer:   { type: Type.STRING },
                            },
                            required: ['question', 'answer'],
                        },
                    },
                    metaTitle:       { type: Type.STRING },
                    metaDescription: { type: Type.STRING },
                },
                required: ['h1', 'h2s', 'intro', 'body', 'faq', 'metaTitle', 'metaDescription'],
            },
            feature: 'seo_article_gen',
        });
        return JSON.parse(response.text);
    } catch (err) {
        console.error('generateSeoArticle failed:', err);
        throw err;
    }
}

// ── SEO-3: Generate content brief from real page data ─────────────────────────

export interface SeoPageBriefInput {
    pageUrl: string;
    currentTitle?: string | null;
    currentMeta?: string | null;
    currentH1?: string | null;
    targetKeyword: string;
    secondaryKeywords?: string[];
    currentPosition?: number | null;
    impressions30d?: number;
    clicks30d?: number;
    ctr30d?: number;
    issues?: string[];
    brandProfile: BrandHubProfile;
}

export interface SeoPageBriefOutput {
    suggestedTitle: string;
    suggestedMeta: string;
    suggestedH1: string;
    h2Suggestions: Array<{ text: string; angle: string; keyword?: string }>;
    faqSuggestions: Array<{ question: string; answer_hint: string }>;
    internalLinksSuggestions: Array<{ anchor: string; reason: string }>;
    contentGaps: string[];
    keywordUsageNotes: string;
    wordCountTarget: number;
    schemaType: string;
}

export async function generateSeoContentBriefFromPage(
    input: SeoPageBriefInput
): Promise<SeoPageBriefOutput> {
    const {
        pageUrl, currentTitle, currentMeta, currentH1,
        targetKeyword, secondaryKeywords = [],
        currentPosition, impressions30d = 0, clicks30d = 0, ctr30d = 0,
        issues = [], brandProfile,
    } = input;

    const performanceContext = currentPosition
        ? `الصفحة تحتل حالياً الموضع ${currentPosition.toFixed(1)} في نتائج البحث بـ ${impressions30d.toLocaleString()} ظهور و${clicks30d.toLocaleString()} نقرة شهرياً (CTR: ${(ctr30d * 100).toFixed(2)}%).`
        : `لا توجد بيانات أداء متاحة للصفحة بعد.`;

    const issuesContext = issues.length > 0
        ? `المشاكل المكتشفة في الصفحة:\n${issues.map(i => `  - ${i}`).join('\n')}`
        : 'لا توجد مشاكل تقنية مكتشفة.';

    const prompt = `
أنت خبير SEO استراتيجي. أنشئ content brief متكامل لتحسين صفحة موجودة فعلاً.

## بيانات الصفحة الحالية (حقيقية من audit):
- URL: ${pageUrl}
- العنوان الحالي: ${currentTitle ?? 'مفقود'}
- Meta Description الحالي: ${currentMeta ?? 'مفقود'}
- H1 الحالي: ${currentH1 ?? 'مفقود'}

## أداء الصفحة في محركات البحث:
${performanceContext}

## المشاكل المكتشفة:
${issuesContext}

## الكلمة المفتاحية الأساسية: "${targetKeyword}"
## الكلمات المساعدة: ${secondaryKeywords.length > 0 ? secondaryKeywords.join(', ') : 'لا توجد'}

## سياق البراند:
- اسم البراند: ${brandProfile.brandName}
- المجال: ${brandProfile.industry}
- الجمهور: ${(brandProfile as any).targetAudience ?? 'غير محدد'}
- النبرة: ${brandProfile.brandVoice?.toneDescription?.join(', ') ?? 'احترافية'}

## المهمة:
أنشئ content brief يعالج المشاكل المكتشفة ويحسن أداء الصفحة. ركّز على:
1. عنوان محسّن يتضمن الكلمة المفتاحية بشكل طبيعي (≤60 حرف)
2. وصف meta يشجع على النقر (≤160 حرف)
3. H2s تغطي نية البحث بالكامل
4. FAQs مبنية على الأسئلة الشائعة في هذا المجال
5. فرص للربط الداخلي
6. الثغرات المحتوائية التي يجب سدّها

أعد JSON فقط.
`;

    const response = await callAIProxy({
        model: 'gemini-2.5-flash',
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                suggestedTitle:    { type: Type.STRING },
                suggestedMeta:     { type: Type.STRING },
                suggestedH1:       { type: Type.STRING },
                h2Suggestions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            text:    { type: Type.STRING },
                            angle:   { type: Type.STRING },
                            keyword: { type: Type.STRING },
                        },
                        required: ['text', 'angle'],
                    },
                },
                faqSuggestions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            question:    { type: Type.STRING },
                            answer_hint: { type: Type.STRING },
                        },
                        required: ['question', 'answer_hint'],
                    },
                },
                internalLinksSuggestions: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            anchor: { type: Type.STRING },
                            reason: { type: Type.STRING },
                        },
                        required: ['anchor', 'reason'],
                    },
                },
                contentGaps:       { type: Type.ARRAY, items: { type: Type.STRING } },
                keywordUsageNotes: { type: Type.STRING },
                wordCountTarget:   { type: Type.NUMBER },
                schemaType:        { type: Type.STRING },
            },
            required: ['suggestedTitle', 'suggestedMeta', 'suggestedH1', 'h2Suggestions', 'faqSuggestions', 'contentGaps', 'keywordUsageNotes'],
        },
        feature: 'seo_content_brief',
    });

    return JSON.parse(response.text) as SeoPageBriefOutput;
}

// ── Design Ops ────────────────────────────────────────────────────────────────

export async function enhanceArabicDesignPrompt(
    rawPrompt: string,
    brandName?: string,
    brandColors?: string
): Promise<{ enhancedPrompt: string; arabicTextSuggestions: string[] }> {
    const systemContext = brandName
        ? `أنت خبير تصميم جرافيك متخصص في المحتوى العربي لبراند اسمه "${brandName}"${brandColors ? ` بألوان: ${brandColors}` : ''}.`
        : 'أنت خبير تصميم جرافيك متخصص في المحتوى العربي والتسويق الرقمي.';

    const prompt = `${systemContext}

المهمة: تحسين وترجمة الـ prompt التالي لتوليد صورة احترافية بـ Imagen AI.

الـ Prompt الأصلي:
"${rawPrompt}"

المطلوب (رد بـ JSON فقط بدون أي نص إضافي):
{
  "enhancedPrompt": "prompt إنجليزي احترافي محسّن لـ Imagen — يصف الصورة بدقة، الألوان، الأسلوب البصري، والتكوين. لا تذكر نص عربي داخل الصورة لأن Imagen لا يدعم العربية.",
  "arabicTextSuggestions": ["اقتراح نص عربي 1 يمكن إضافته فوق الصورة", "اقتراح 2", "اقتراح 3"]
}`;

    const response = await callAIProxy({
        model: 'gemini-2.5-flash',
        prompt,
        feature: 'design_prompt_enhance',
    });

    try {
        const raw  = response.text.replace(/```json|```/g, '').trim();
        const json = JSON.parse(raw);
        return {
            enhancedPrompt:        json.enhancedPrompt        || rawPrompt,
            arabicTextSuggestions: json.arabicTextSuggestions || [],
        };
    } catch {
        return { enhancedPrompt: rawPrompt, arabicTextSuggestions: [] };
    }
}

export async function generateDesignPromptIdeas(
    topic: string,
    brandName?: string
): Promise<string[]> {
    const prompt = `أنت مساعد تصميم إبداعي${brandName ? ` لبراند "${brandName}"` : ''}.

اقترح 4 أفكار تصميم مختلفة لهذا الموضوع: "${topic}"
كل فكرة تكون جملة أو جملتين بالعربي تصف التصميم المقترح.

رد بـ JSON فقط:
{"ideas": ["فكرة 1", "فكرة 2", "فكرة 3", "فكرة 4"]}`;

    const response = await callAIProxy({
        model: 'gemini-2.5-flash',
        prompt,
        feature: 'design_prompt_ideas',
    });

    try {
        const raw  = response.text.replace(/```json|```/g, '').trim();
        const json = JSON.parse(raw);
        return json.ideas || [];
    } catch {
        return [];
    }
}

// ══════════════════════════════════════════════════════════════════════════════
// BRAND BRAIN — وظائف نواة عقل البراند
// ══════════════════════════════════════════════════════════════════════════════

// --- Occasion → Marketing Opportunity ─────────────────────────────────────────
// يحوّل المناسبة من "تاريخ في تقويم" إلى "فرصة تسويقية كاملة"
// المخرج: 3 زوايا محتوى + فكرة Reel + فكرة عرض + نبرة الرسالة + كابشن جاهز

export async function generateOccasionOpportunity(
    occasion: Occasion,
    brandBrain: BrandBrainContext,
    daysUntil: number,
): Promise<OccasionOpportunity> {
    const systemPrompt = buildBrandSystemPrompt(brandBrain);
    const urgency: OccasionOpportunity['urgency'] =
        daysUntil <= 3 ? 'high' : daysUntil <= 7 ? 'medium' : 'low';

    const prompt = `
${systemPrompt}

══════════════════════════════════════════
المهمة: تحويل مناسبة إلى فرصة تسويقية
══════════════════════════════════════════
المناسبة: ${occasion.nameAr} (${occasion.nameEn})
الموعد: بعد ${daysUntil} يوم
الزاوية الأساسية للمناسبة: ${occasion.contentAngle}
الهاشتاقات الافتراضية: ${occasion.hashtags.join(' ')}

المطلوب:
1. **contentAngles**: اقترح 3 زوايا محتوى مختلفة ومبتكرة تناسب هذا البراند تحديداً — ليست عامة
2. **reelIdea**: فكرة Reel واحدة محددة وقابلة للتنفيذ (10-15 ثانية، ماذا يحدث في كل ثانية؟)
3. **offerIdea**: فكرة عرض أو ترويج مرتبطة بالمناسبة تناسب طبيعة البراند ومنتجاته
4. **messageTone**: جملة واحدة تصف النبرة المناسبة لهذا البراند في هذه المناسبة تحديداً
5. **sampleCaption**: كابشن جاهز بالعربي (3-4 أسطر) مناسب للنشر فوراً، يعكس البراند تماماً
6. **hashtags**: 5-8 هاشتاق مناسبة (ادمج الهاشتاقات الافتراضية مع هاشتاقات البراند والمجال)

القاعدة الذهبية: لا تقل "بمناسبة كذا نقدم لكم..."
قل شيئاً يجعل العميل يتوقف ويقرأ.
`.trim();

    const response = await callAIProxy({
        model: 'gemini-2.5-flash',
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                contentAngles: { type: Type.ARRAY, items: { type: Type.STRING } },
                reelIdea:      { type: Type.STRING },
                offerIdea:     { type: Type.STRING },
                messageTone:   { type: Type.STRING },
                sampleCaption: { type: Type.STRING },
                hashtags:      { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['contentAngles', 'reelIdea', 'offerIdea', 'messageTone', 'sampleCaption', 'hashtags'],
        },
        feature: 'occasion_opportunity',
        brand_id: brandBrain.brandId,
    });

    const result = JSON.parse(response.text);
    return {
        occasionId:    occasion.id,
        occasionName:  occasion.nameAr,
        daysUntil,
        urgency,
        contentAngles: result.contentAngles ?? [],
        reelIdea:      result.reelIdea ?? '',
        offerIdea:     result.offerIdea ?? '',
        messageTone:   result.messageTone ?? '',
        sampleCaption: result.sampleCaption ?? '',
        hashtags:      result.hashtags ?? occasion.hashtags,
    };
}

// --- Brand Conversation Engine ────────────────────────────────────────────────
// محرك محادثات البراند — يرد بصوت البراند حسب سيناريو المحادثة
// يكتشف السيناريو تلقائياً ويولّد رداً جاهزاً للإرسال

export async function generateConversationReply(
    messages: Array<{ sender: 'customer' | 'agent'; text: string }>,
    brandBrain: BrandBrainContext,
): Promise<ConversationReply> {
    const systemPrompt = buildBrandSystemPrompt(brandBrain);
    const conversationText = messages
        .map(m => `${m.sender === 'customer' ? 'العميل' : 'الوكيل'}: ${m.text}`)
        .join('\n');

    const scenarioDescriptions: Record<ConversationScenario, string> = {
        [ConversationScenario.FirstInquiry]:       'استفسار أول مرة — العميل يسأل عن المنتج أو الخدمة للمرة الأولى',
        [ConversationScenario.PriceAsk]:           'سؤال عن السعر — العميل يسأل كم السعر؟',
        [ConversationScenario.CompetitorCompare]:  'مقارنة بمنافس — العميل يذكر منافساً أو يقارن',
        [ConversationScenario.PriceObjection]:     'اعتراض على السعر — "غالي" أو "عندي عروض أفضل"',
        [ConversationScenario.ShippingIssue]:      'مشكلة شحن أو توصيل — تأخير أو مشكلة في الطلب',
        [ConversationScenario.Complaint]:          'شكوى — العميل غير راضٍ عن تجربته',
        [ConversationScenario.ProductUnavailable]: 'منتج غير متوفر — المنتج المطلوب غير موجود',
        [ConversationScenario.AppointmentRequest]: 'حجز موعد — العميل يريد تحديد موعد',
        [ConversationScenario.FollowUp]:           'متابعة — لم يرد أحد أو المحادثة توقفت',
        [ConversationScenario.LeadCapture]:        'تحويل لبيع — العميل مهتم ويمكن إغلاق البيع',
        [ConversationScenario.General]:            'استفسار عام — سؤال عام لا ينتمي لفئة محددة',
        [ConversationScenario.Escalate]:           'يحتاج تدخل بشري — الموقف معقد أو حساس',
    };

    const prompt = `
${systemPrompt}

══════════════════════════════════════════
المهمة: الرد على محادثة عميل بصوت البراند
══════════════════════════════════════════
سجل المحادثة:
${conversationText}

المطلوب:
1. **scenario**: صنّف هذه المحادثة بالضبط من بين هذه السيناريوهات:
${Object.entries(scenarioDescriptions).map(([k, v]) => `   "${k}": ${v}`).join('\n')}

2. **reply**: اكتب رداً جاهزاً بصوت البراند "${brandBrain.identity.name}" تماماً.
   - لا تبدأ بـ "أهلاً وسهلاً" إذا كانت المحادثة مستمرة بالفعل
   - الرد يكون مباشراً، إنسانياً، ومتسقاً مع نبرة البراند
   - إذا كان الرد يتضمن سعراً، استخدم بيانات قاعدة المعرفة أعلاه
   - الرد لا يتجاوز 3-4 جمل إلا إذا كان ضرورياً

3. **escalate**: true فقط إذا الموقف يتطلب تدخل بشري (شكوى معقدة، مشكلة مالية، تهديد)

4. **followUpSuggestion**: جملة يمكن إرسالها كمتابعة بعد 24 ساعة إذا لم يرد العميل (اختياري)

5. **internalNote**: ملاحظة داخلية للفريق (اختياري، مثل "العميل بدا مهتماً بالمنتج X" أو "يحتاج متابعة")
`.trim();

    const response = await callAIProxy({
        model: 'gemini-2.5-pro',
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                scenario:           { type: Type.STRING },
                reply:              { type: Type.STRING },
                escalate:           { type: Type.BOOLEAN },
                followUpSuggestion: { type: Type.STRING },
                internalNote:       { type: Type.STRING },
            },
            required: ['scenario', 'reply', 'escalate'],
        },
        feature: 'conversation_reply',
        brand_id: brandBrain.brandId,
    });

    const result = JSON.parse(response.text);
    return {
        reply:              result.reply ?? '',
        scenario:           (result.scenario as ConversationScenario) ?? ConversationScenario.General,
        escalate:           result.escalate ?? false,
        followUpSuggestion: result.followUpSuggestion,
        internalNote:       result.internalNote,
    };
}

// --- Content Generation with Brand Brain ─────────────────────────────────────
// نسخة محسّنة من توليد المحتوى — تستخدم سياق عقل البراند الكامل

export async function generateBrandContent(
    topic: string,
    platform: SocialPlatform,
    brandBrain: BrandBrainContext,
    format: 'post' | 'reel_script' | 'story' | 'ad' = 'post',
): Promise<{ captions: string[]; bestPick: string; reasoning: string }> {
    const systemPrompt = buildBrandSystemPrompt(brandBrain);
    const formatInstructions: Record<typeof format, string> = {
        post:        'منشور نصي للسوشيال ميديا (3-5 أسطر)',
        reel_script: 'سكريبت Reel (Hook 3 ثواني + جسم + CTA)',
        story:       'نص Story قصير لا يتجاوز سطرين مع CTA',
        ad:          'نص إعلان مباشر يركز على القيمة والـ CTA',
    };

    const prompt = `
${systemPrompt}

══════════════════════════════════════════
المهمة: توليد محتوى براند حقيقي
══════════════════════════════════════════
الموضوع: ${topic}
المنصة: ${platform}
النوع: ${formatInstructions[format]}

المطلوب:
1. **captions**: 3 نسخ مختلفة من المحتوى — كل نسخة بزاوية مختلفة
2. **bestPick**: رقم النسخة الأفضل (1، 2، أو 3)
3. **reasoning**: جملة واحدة توضح لماذا هذه النسخة الأفضل لهذا البراند تحديداً

تذكر: المخرج يجب أن يعكس "${brandBrain.identity.name}" — ليس أي براند آخر.
`.trim();

    const response = await callAIProxy({
        model: 'gemini-2.5-flash',
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                captions:  { type: Type.ARRAY, items: { type: Type.STRING } },
                bestPick:  { type: Type.STRING },
                reasoning: { type: Type.STRING },
            },
            required: ['captions', 'bestPick', 'reasoning'],
        },
        feature: 'brand_content_gen',
        brand_id: brandBrain.brandId,
    });

    const result = JSON.parse(response.text);
    const pickIndex = parseInt(result.bestPick, 10) - 1;
    return {
        captions:  result.captions ?? [],
        bestPick:  result.captions?.[pickIndex] ?? result.captions?.[0] ?? '',
        reasoning: result.reasoning ?? '',
    };
}

// ── Campaign Brief ─────────────────────────────────────────────────────────────

export async function generateCampaignBrief(
    goal: string,
    budget: string,
    duration: string,
    brandBrain: BrandBrainContext,
    model = 'gemini-2.5-pro',
): Promise<{
    objective: string;
    targetAudience: string;
    keyMessages: string[];
    channels: string[];
    kpis: string[];
    timeline: string;
}> {
    const { buildBrandSystemPrompt } = await import('./brandBrainService');
    const systemPrompt = buildBrandSystemPrompt(brandBrain, 'full');

    const prompt = `
${systemPrompt}

══ المهمة: بريف حملة تسويقية ══
الهدف: ${goal}
الميزانية: ${budget}
المدة: ${duration}

اكتب بريف حملة تسويقية احترافية يشمل:
1. objective: جملة واحدة واضحة تصف هدف الحملة
2. targetAudience: وصف دقيق للجمهور المستهدف (شريحة من جمهور البراند)
3. keyMessages: 3 رسائل تسويقية رئيسية
4. channels: القنوات الأمثل بناءً على الجمهور والميزانية
5. kpis: 3-5 مؤشرات قياس واضحة
6. timeline: جدول زمني مختصر للحملة
`.trim();

    const response = await callAIProxy({
        model,
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                objective:      { type: Type.STRING },
                targetAudience: { type: Type.STRING },
                keyMessages:    { type: Type.ARRAY, items: { type: Type.STRING } },
                channels:       { type: Type.ARRAY, items: { type: Type.STRING } },
                kpis:           { type: Type.ARRAY, items: { type: Type.STRING } },
                timeline:       { type: Type.STRING },
            },
            required: ['objective', 'targetAudience', 'keyMessages', 'channels', 'kpis', 'timeline'],
        },
        feature: 'campaign_brief',
        brand_id: brandBrain.brandId,
    });

    return JSON.parse(response.text);
}

// ── Content Calendar ───────────────────────────────────────────────────────────

export interface CalendarItem {
    day: number;
    topic: string;
    format: string;    // post | reel | story | carousel
    platform: string;
    angle: string;
    occasionLink?: string;
}

export async function generateContentCalendar(
    month: number,
    year: number,
    postsPerWeek: number,
    brandBrain: BrandBrainContext,
    upcomingOccasions: Array<{ name: string; day: number }> = [],
    model = 'gemini-2.5-flash',
): Promise<CalendarItem[]> {
    const { buildBrandSystemPrompt } = await import('./brandBrainService');
    const systemPrompt = buildBrandSystemPrompt(brandBrain, 'standard');

    const monthNames = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
    const monthName = monthNames[month - 1] ?? String(month);

    const occasionsText = upcomingOccasions.length
        ? `مناسبات هذا الشهر:\n${upcomingOccasions.map(o => `• يوم ${o.day}: ${o.name}`).join('\n')}`
        : '';

    const totalPosts = Math.round(postsPerWeek * 4.3);

    const prompt = `
${systemPrompt}

══ المهمة: تقويم محتوى ${monthName} ${year} ══
إيقاع النشر: ${postsPerWeek} منشورات/أسبوع (${totalPosts} منشور في الشهر)
${occasionsText}

اقترح ${totalPosts} منشوراً موزعة على أيام الشهر.
لكل منشور: اليوم + الموضوع + الفورمات (post/reel/story/carousel) + المنصة + زاوية المحتوى
راعِ المناسبات الواردة أعلاه عند تحديد التواريخ.
`.trim();

    const response = await callAIProxy({
        model,
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            day:            { type: Type.NUMBER },
                            topic:          { type: Type.STRING },
                            format:         { type: Type.STRING },
                            platform:       { type: Type.STRING },
                            angle:          { type: Type.STRING },
                            occasionLink:   { type: Type.STRING },
                        },
                        required: ['day', 'topic', 'format', 'platform', 'angle'],
                    },
                },
            },
            required: ['items'],
        },
        feature: 'content_calendar',
        brand_id: brandBrain.brandId,
    });

    return JSON.parse(response.text).items ?? [];
}

// ── Lead Qualification ─────────────────────────────────────────────────────────

export interface LeadQualResult {
    stage: 'awareness' | 'consideration' | 'decision' | 'retention';
    score: number;         // 0-100
    nextAction: string;
    personalizedMessage: string;
    urgency: 'high' | 'medium' | 'low';
}

export async function qualifyLead(
    conversationHistory: string,
    brandBrain: BrandBrainContext,
    model = 'gemini-2.5-pro',
): Promise<LeadQualResult> {
    const { buildBrandSystemPrompt } = await import('./brandBrainService');
    const systemPrompt = buildBrandSystemPrompt(brandBrain, 'full');

    const prompt = `
${systemPrompt}

══ المهمة: تأهيل عميل محتمل ══
سجل المحادثة:
${conversationHistory}

حدد:
1. stage: مرحلة العميل (awareness/consideration/decision/retention)
2. score: درجة تأهيل من 0-100 (100 = جاهز للشراء الآن)
3. nextAction: الخطوة التالية الأمثل من فريق المبيعات
4. personalizedMessage: رسالة مخصصة لإرسالها للعميل الآن بأسلوب البراند
5. urgency: أولوية المتابعة (high/medium/low)
`.trim();

    const response = await callAIProxy({
        model,
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                stage:               { type: Type.STRING },
                score:               { type: Type.NUMBER },
                nextAction:          { type: Type.STRING },
                personalizedMessage: { type: Type.STRING },
                urgency:             { type: Type.STRING },
            },
            required: ['stage', 'score', 'nextAction', 'personalizedMessage', 'urgency'],
        },
        feature: 'lead_qualification',
        brand_id: brandBrain.brandId,
    });

    return JSON.parse(response.text);
}

// ── Follow-up Sequence ─────────────────────────────────────────────────────────

export interface FollowUpMessage {
    order: number;
    delayHours: number;   // إرسال بعد كم ساعة
    channel: string;      // whatsapp | email | instagram | sms
    text: string;
    goal: string;         // الهدف من هذه الرسالة
}

export async function generateFollowUpSequence(
    trigger: string,
    numberOfMessages: number,
    brandBrain: BrandBrainContext,
    model = 'gemini-2.5-flash',
): Promise<FollowUpMessage[]> {
    const { buildBrandSystemPrompt } = await import('./brandBrainService');
    const systemPrompt = buildBrandSystemPrompt(brandBrain, 'full');

    const prompt = `
${systemPrompt}

══ المهمة: سلسلة رسائل متابعة ══
المحفّز (trigger): ${trigger}
عدد الرسائل: ${numberOfMessages}

اكتب سلسلة متابعة احترافية بأسلوب البراند:
- كل رسالة لها تأخير زمني منطقي من الرسالة السابقة
- الرسائل تتصاعد من ودية → قيمة مضافة → عرض → إغلاق
- كل رسالة تبدو طبيعية وإنسانية — ليست آلية
- اذكر القناة المناسبة (whatsapp/email/instagram)
`.trim();

    const response = await callAIProxy({
        model,
        prompt,
        schema: {
            type: Type.OBJECT,
            properties: {
                messages: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            order:      { type: Type.NUMBER },
                            delayHours: { type: Type.NUMBER },
                            channel:    { type: Type.STRING },
                            text:       { type: Type.STRING },
                            goal:       { type: Type.STRING },
                        },
                        required: ['order', 'delayHours', 'channel', 'text', 'goal'],
                    },
                },
            },
            required: ['messages'],
        },
        feature: 'follow_up_sequence',
        brand_id: brandBrain.brandId,
    });

    return JSON.parse(response.text).messages ?? [];
}

// ══════════════════════════════════════════════════════════════════════════════
// MEDIA PRODUCTION FLOW — AI Brief Builder + Idea Matrix
// ══════════════════════════════════════════════════════════════════════════════

import type { CreativeBrief, IdeaMatrixAngle, CreativeRequestForm } from '../types';

/**
 * buildCreativeBrief
 * يحوّل طلب Creative Request + Brand Profile → Brief احترافي منظم
 */
export async function buildCreativeBrief(
    request: CreativeRequestForm,
    brandProfile: BrandHubProfile,
): Promise<CreativeBrief> {
    const brandContext = `
البراند: ${brandProfile.brandName}
القطاع: ${brandProfile.industry}
نبرة الصوت: ${brandProfile.brandVoice.toneDescription.join(', ')}
الجمهور: ${brandProfile.brandAudiences.map(a => a.personaName).join(', ')}
نقاط البيع: ${brandProfile.keySellingPoints.slice(0, 3).join(' / ')}
كلمات ممنوعة: ${brandProfile.brandVoice.negativeKeywords.slice(0, 5).join(', ')}
`.trim();

    const requestContext = `
عنوان المشروع: ${request.title}
الهدف: ${request.goal}
نوع المخرج: ${request.outputType}
الحملة أو المناسبة: ${request.campaign || 'غير محدد'}
المنتج أو العرض: ${request.productOffer || 'غير محدد'}
الـ CTA المطلوب: ${request.cta || 'غير محدد'}
المنصات: ${request.platforms.join(', ') || 'غير محدد'}
الموعد النهائي: ${request.deadline || 'غير محدد'}
ملاحظات: ${request.notes || 'لا توجد'}
`.trim();

    const response = await callAIProxy({
        model: 'gemini-2.5-flash',
        prompt: `أنت خبير استراتيجية إبداعية متخصص في بناء Creative Briefs احترافية.

بناءً على معلومات البراند التالية والطلب المُدخَل، اكتب Brief إبداعي منظم ومفصّل باللغة العربية.

معلومات البراند:
${brandContext}

الطلب:
${requestContext}

أنتج Brief يشمل: الهدف الواضح، الجمهور المستهدف، الرسالة الجوهرية، العرض، النبرة المناسبة، الاتجاه البصري، مواصفات الفورمات، المخرجات المطلوبة، العناصر الإلزامية، المحظورات، الـ CTA، ومعايير النجاح.`,
        schema: {
            type: Type.OBJECT,
            properties: {
                objective:         { type: Type.STRING },
                audience:          { type: Type.STRING },
                coreMessage:       { type: Type.STRING },
                offer:             { type: Type.STRING },
                tone:              { type: Type.STRING },
                visualDirection:   { type: Type.STRING },
                formatSpecs:       { type: Type.STRING },
                deliverables:      { type: Type.ARRAY, items: { type: Type.STRING } },
                mandatoryElements: { type: Type.ARRAY, items: { type: Type.STRING } },
                prohibitions:      { type: Type.ARRAY, items: { type: Type.STRING } },
                cta:               { type: Type.STRING },
                successCriteria:   { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
                'objective','audience','coreMessage','offer','tone',
                'visualDirection','formatSpecs','deliverables',
                'mandatoryElements','prohibitions','cta','successCriteria',
            ],
        },
        feature: 'creative_brief',
        brand_id: null,
    });

    return JSON.parse(response.text) as CreativeBrief;
}

/**
 * generateIdeaMatrix
 * يحوّل البريف + البراند → مصفوفة أفكار: 3 زوايا × hooks × formats
 */
export async function generateIdeaMatrix(
    brief: CreativeBrief,
    request: Pick<CreativeRequestForm, 'goal' | 'outputType' | 'platforms'>,
    brandProfile: BrandHubProfile,
): Promise<IdeaMatrixAngle[]> {
    const briefSummary = `
الهدف: ${brief.objective}
الجمهور: ${brief.audience}
الرسالة الجوهرية: ${brief.coreMessage}
النبرة: ${brief.tone}
الاتجاه البصري: ${brief.visualDirection}
نوع المخرج: ${request.outputType}
المنصات: ${request.platforms.join(', ')}
`.trim();

    const response = await callAIProxy({
        model: 'gemini-2.5-flash',
        prompt: `أنت Creative Strategist خبير في بناء Idea Matrix للمحتوى الرقمي.

بناءً على Brief التالي وهوية البراند "${brandProfile.brandName}"، اقترح 3 زوايا إبداعية مختلفة.

Brief:
${briefSummary}

لكل زاوية: اذكر اسمها، Hook واضح وجذاب، المبرر لماذا تناسب البراند والهدف، وقائمة بالفورمات المناسبة لها (من بين: Static / Reel / Carousel / Story / Ad).

الزوايا يجب أن تكون متنوعة ومختلفة تمامًا:
- زاوية 1: تركز على المشكلة والحل (Pain Point)
- زاوية 2: تركز على الإثبات الاجتماعي (Social Proof)
- زاوية 3: تركز على العرض والإلحاح (Offer / Urgency)`,
        schema: {
            type: Type.OBJECT,
            properties: {
                angles: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            angle:     { type: Type.STRING },
                            hook:      { type: Type.STRING },
                            rationale: { type: Type.STRING },
                            formats: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        type:        { type: Type.STRING },
                                        description: { type: Type.STRING },
                                    },
                                    required: ['type', 'description'],
                                },
                            },
                        },
                        required: ['angle', 'hook', 'rationale', 'formats'],
                    },
                },
            },
            required: ['angles'],
        },
        feature: 'idea_matrix',
        brand_id: null,
    });

    return JSON.parse(response.text).angles ?? [];
}

/**
 * generateCampaignDebrief
 * يحلل الحملة المكتملة ويولد درسًا مستفادًا وتوصية للمشروع القادم
 */
export async function generateCampaignDebrief(
    projectTitle: string,
    brief: CreativeBrief | null,
    pieces: Array<{ title: string; format?: string; variantLabel?: string; status: string; isMaster: boolean }>,
    brandProfile: BrandHubProfile,
): Promise<{ whatWorked: string; whatToImprove: string; nextCampaignRecommendation: string; creativeScore: number }> {
    const publishedCount = pieces.filter(p => p.status === 'published').length;
    const masterCount    = pieces.filter(p => p.isMaster).length;
    const variantCount   = pieces.length - masterCount;
    const formats        = [...new Set(pieces.map(p => p.format).filter(Boolean))].join(', ');

    const briefSummary = brief
        ? `الهدف: ${brief.objective}\nالرسالة: ${brief.coreMessage}\nالجمهور: ${brief.audience}\nالنبرة: ${brief.tone}`
        : 'لا يوجد بريف مسجّل';

    const piecesList = pieces
        .map(p => `- "${p.title}" [${p.format ?? p.variantLabel ?? 'غير محدد'}] — ${p.status === 'published' ? 'تم النشر' : p.status}`)
        .join('\n');

    const response = await callAIProxy({
        model: 'gemini-2.5-flash',
        prompt: `أنت مدير إبداعي خبير يراجع حملة بعد انتهائها ويكتب تقرير دروس مستفادة.

البراند: "${brandProfile.brandName}"
المشروع: "${projectTitle}"
البريف:
${briefSummary}

مخرجات الحملة (${pieces.length} قطعة، ${publishedCount} تم نشرها، ${variantCount} نسخة):
${piecesList}
الفورمات المنتجة: ${formats || 'غير محددة'}

اكتب تقرير مختصر وعملي باللغة العربية يشمل:
1. ما الذي نجح في هذه الحملة؟ (الزوايا، الفورمات، التنوع)
2. ما الذي يمكن تحسينه في المرة القادمة؟ (الثغرات، الفرص الضائعة)
3. ما هي التوصية للمشروع الإبداعي القادم؟ (نوع المحتوى، المنصات، الزاوية)
4. درجة الأداء الإبداعي من 100 (بناءً على جودة التخطيط والتنوع والتنفيذ)`,
        schema: {
            type: Type.OBJECT,
            properties: {
                whatWorked:                   { type: Type.STRING },
                whatToImprove:                { type: Type.STRING },
                nextCampaignRecommendation:   { type: Type.STRING },
                creativeScore:                { type: Type.NUMBER },
            },
            required: ['whatWorked', 'whatToImprove', 'nextCampaignRecommendation', 'creativeScore'],
        },
        feature: 'campaign_debrief',
        brand_id: null,
    });

    return JSON.parse(response.text);
}
