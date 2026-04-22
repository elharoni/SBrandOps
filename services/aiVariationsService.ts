/**
 * AI Content Variations Service
 * خدمة توليد نسخ متعددة من المحتوى
 */

import { callAIProxy, Type } from './aiProxy';
import { BrandHubProfile, PublisherBrief, SocialPlatform } from '../types';

export interface ContentVariation {
    id: string;
    platform: SocialPlatform;
    content: string;
    tone: string;
    length: 'short' | 'medium' | 'long';
    score: number;
}

export interface VariationOptions {
    platforms?: SocialPlatform[];
    tones?: string[];
    count?: number;
    brandVoice?: string;
}

export async function generateContentVariations(
    originalContent: string,
    options: VariationOptions = {}
): Promise<ContentVariation[]> {
    const {
        platforms = [SocialPlatform.Facebook, SocialPlatform.Instagram, SocialPlatform.X],
        tones = ['professional', 'casual', 'friendly'],
        count = 5,
        brandVoice = ''
    } = options;

    const prompt = `
أنت خبير في كتابة المحتوى لوسائل التواصل الاجتماعي. مهمتك هي إنشاء ${count} نسخ مختلفة من المحتوى التالي:

المحتوى الأصلي:
"${originalContent}"

المنصات المستهدفة: ${platforms.join(', ')}
النبرات المطلوبة: ${tones.join(', ')}
${brandVoice ? `صوت العلامة التجارية: ${brandVoice}` : ''}

متطلبات:
1. كل نسخة يجب أن تكون فريدة ومختلفة
2. حافظ على الرسالة الأساسية
3. قم بتحسين كل نسخة للمنصة المحددة:
   - Twitter/X: قصير ومباشر (280 حرف)
   - Instagram: جذاب مع emojis
   - Facebook: متوسط الطول مع تفاصيل
   - LinkedIn: احترافي وموجه للأعمال
4. استخدم نبرات مختلفة (رسمي، ودود، مرح، إلخ)
5. أضف emojis مناسبة حيثما كان ذلك مناسباً
6. قيّم كل نسخة من 1-10 بناءً على جودتها وملاءمتها

أعد النتائج بصيغة JSON فقط.
`;

    try {
        const response = await callAIProxy({
            model: "gemini-2.5-flash",
            prompt,
            schema: {
                type: Type.OBJECT,
                properties: {
                    variations: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                platform: { type: Type.STRING },
                                content: { type: Type.STRING },
                                tone: { type: Type.STRING },
                                length: { type: Type.STRING },
                                score: { type: Type.NUMBER }
                            },
                            required: ['platform', 'content', 'tone', 'length', 'score']
                        }
                    }
                },
                required: ['variations']
            },
            feature: 'content_variations',
        });

        const result = JSON.parse(response.text);

        if (result?.variations) {
            return result.variations.map((v: any, index: number) => ({
                id: `variation-${Date.now()}-${index}`,
                platform: v.platform as SocialPlatform,
                content: v.content,
                tone: v.tone,
                length: v.length,
                score: v.score
            }));
        }

        return [];
    } catch (error) {
        console.error('Error generating content variations:', error);
        throw new Error('فشل في توليد نسخ المحتوى');
    }
}

export async function generateVariantsFromBrief(
    brief: PublisherBrief,
    brandProfile: BrandHubProfile
): Promise<ContentVariation[]> {
    const sourceContent = [
        brief.title,
        brief.objective,
        brief.angle,
        brief.cta ? `CTA: ${brief.cta}` : '',
        brief.hashtags.length > 0 ? `Hashtags: ${brief.hashtags.join(' ')}` : '',
    ]
        .filter(Boolean)
        .join('\n\n');

    const preferredPlatforms = brief.suggestedPlatforms.length > 0
        ? brief.suggestedPlatforms.slice(0, 3)
        : [SocialPlatform.Instagram, SocialPlatform.LinkedIn, SocialPlatform.Facebook];

    return generateContentVariations(sourceContent, {
        platforms: preferredPlatforms,
        tones: ['professional', 'friendly', 'casual'],
        count: 3,
        brandVoice: [
            brandProfile.brandVoice.toneDescription.join(', '),
            brandProfile.brandVoice.keywords.join(', '),
        ].filter(Boolean).join(' | '),
    });
}

export async function optimizeForPlatform(
    content: string,
    platform: SocialPlatform,
    brandVoice?: string
): Promise<string> {
    const platformGuidelines: Record<SocialPlatform, string> = {
        [SocialPlatform.Facebook]: 'متوسط الطول، جذاب، يشجع على التفاعل',
        [SocialPlatform.Instagram]: 'جذاب بصرياً، استخدم emojis، هاشتاجات في النهاية',
        [SocialPlatform.X]: 'قصير ومباشر (280 حرف)، مؤثر، استخدم هاشتاجات',
        [SocialPlatform.LinkedIn]: 'احترافي، موجه للأعمال، قيمة مضافة',
        [SocialPlatform.TikTok]: 'عصري، ترفيهي، يشجع على المشاركة',
        [SocialPlatform.Pinterest]: 'وصفي، ملهم، يركز على الصور'
    };

    const prompt = `
قم بتحسين المحتوى التالي ليكون مثالياً لـ ${platform}:

المحتوى الأصلي:
"${content}"

إرشادات ${platform}:
${platformGuidelines[platform]}

${brandVoice ? `صوت العلامة التجارية: ${brandVoice}` : ''}

أعد فقط المحتوى المحسّن بدون أي شرح إضافي.
`;

    try {
        const response = await callAIProxy({ model: "gemini-2.5-flash", prompt, feature: 'platform_optimize' });
        return response.text.trim();
    } catch (error) {
        console.error('Error optimizing content:', error);
        throw new Error('فشل في تحسين المحتوى');
    }
}

export async function rewriteWithTone(
    content: string,
    tone: 'professional' | 'casual' | 'humorous' | 'urgent' | 'friendly' | 'formal'
): Promise<string> {
    const toneDescriptions = {
        professional: 'احترافي ورسمي',
        casual: 'غير رسمي وودود',
        humorous: 'مرح وفكاهي',
        urgent: 'عاجل ومهم',
        friendly: 'ودود وقريب',
        formal: 'رسمي جداً'
    };

    const prompt = `
أعد كتابة المحتوى التالي بنبرة ${toneDescriptions[tone]}:

"${content}"

احتفظ بالرسالة الأساسية ولكن غيّر الأسلوب والنبرة فقط.
أعد فقط المحتوى المُعاد كتابته بدون أي شرح.
`;

    try {
        const response = await callAIProxy({ model: "gemini-2.5-flash", prompt, feature: 'tone_rewrite' });
        return response.text.trim();
    } catch (error) {
        console.error('Error rewriting content:', error);
        throw new Error('فشل في إعادة كتابة المحتوى');
    }
}

export async function adjustLength(
    content: string,
    targetLength: 'shorter' | 'longer',
    maxChars?: number
): Promise<string> {
    const prompt = `
${targetLength === 'shorter' ? 'اختصر' : 'طوّل'} المحتوى التالي:

"${content}"

${maxChars ? `الحد الأقصى للأحرف: ${maxChars}` : ''}
${targetLength === 'shorter' ? 'احتفظ بالنقاط الرئيسية فقط.' : 'أضف تفاصيل وأمثلة إضافية.'}

أعد فقط المحتوى المعدّل بدون أي شرح.
`;

    try {
        const response = await callAIProxy({ model: "gemini-2.5-flash", prompt, feature: 'length_adjust' });
        return response.text.trim();
    } catch (error) {
        console.error('Error adjusting length:', error);
        throw new Error('فشل في تعديل طول المحتوى');
    }
}

export async function addCallToAction(
    content: string,
    ctaType: 'visit' | 'buy' | 'signup' | 'learn' | 'share' | 'comment'
): Promise<string> {
    const ctaExamples = {
        visit: 'زر موقعنا الآن',
        buy: 'اشترِ الآن',
        signup: 'سجّل الآن',
        learn: 'اعرف المزيد',
        share: 'شارك مع أصدقائك',
        comment: 'شاركنا رأيك في التعليقات'
    };

    const prompt = `
أضف دعوة لاتخاذ إجراء (Call-to-Action) مناسبة للمحتوى التالي:

"${content}"

نوع CTA المطلوب: ${ctaExamples[ctaType]}

أضف CTA بشكل طبيعي في نهاية المحتوى.
أعد المحتوى الكامل مع CTA بدون أي شرح.
`;

    try {
        const response = await callAIProxy({ model: "gemini-2.5-flash", prompt, feature: 'add_cta' });
        return response.text.trim();
    } catch (error) {
        console.error('Error adding CTA:', error);
        throw new Error('فشل في إضافة CTA');
    }
}
