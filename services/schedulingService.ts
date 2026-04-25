import { callAIProxy, Type } from './aiProxy';
import { SocialPlatform, ScheduleSuggestion } from '../types';

export interface SchedulingParams {
    platforms: SocialPlatform[];
    topic: string;
    targetAudience: string;
    goal: string;
    preferredDays?: string[];
    preferredTime?: string;
    brandIndustry?: string;
    brandName?: string;
}

export async function getOptimalPostingTimes(params: SchedulingParams): Promise<ScheduleSuggestion[]> {
    const brandContext = params.brandName && params.brandIndustry
        ? `براند "${params.brandName}" في مجال "${params.brandIndustry}"`
        : params.brandName
            ? `براند "${params.brandName}"`
            : 'براند تجاري';

    let prompt = `
    أنت خبير في استراتيجيات وسائل التواصل الاجتماعي لـ ${brandContext}. بناءً على المعلومات التالية، اقترح أفضل 3 أوقات وتواريخ للنشر خلال الأسبوع القادم.
    مهمتك هي الموازنة بين تفضيلات المستخدم وأوقات الذروة الطبيعية لكل منصة لتقديم أفضل الاقتراحات الممكنة.

    المعلومات الأساسية:
    - المنصات: ${params.platforms.join(', ') || 'غير محدد'}
    - موضوع المنشور: "${params.topic}"
    - الجمهور المستهدف: "${params.targetAudience}"
    - الهدف من المنشور: "${params.goal}"
    `;

    if (params.preferredDays && params.preferredDays.length > 0) {
        prompt += `\n\nتفضيلات المستخدم (يجب أخذها في الاعتبار بقوة):\n- الأيام المفضلة: ${params.preferredDays.join(', ')}`;
    }
    if (params.preferredTime && params.preferredTime !== 'any') {
        const timeRanges: { [key: string]: string } = {
            morning: 'الصباح (8 صباحًا - 12 ظهرًا)',
            afternoon: 'بعد الظهر (12 ظهرًا - 5 مساءً)',
            evening: 'المساء (5 مساءً - 9 مساءً)',
        };
        prompt += `\n- الوقت المفضل: ${timeRanges[params.preferredTime] || 'أي وقت'}`;
    }

    prompt += `

    الإرشادات:
    1. قدم 3 اقتراحات.
    2. يجب أن تكون الأوقات متنوعة ومناسبة للمنصات والجمهور المذكور مع مراعاة تفضيلات المستخدم إن وجدت.
    3. يجب أن يكون كل اقتراح مصحوبًا بسبب منطقي ومختصر يوضح لماذا هذا الوقت جيد (مثال: "وقت ذروة تفاعل الجمهور المستهدف على Instagram في المساء").
    4. أعد النتائج بصيغة JSON فقط.
    5. يجب أن يكون التاريخ بصيغة 'YYYY-MM-DD'.
    6. يجب أن يكون الوقت بصيغة 24 ساعة 'HH:mm'.
    `;

    try {
        const response = await callAIProxy({
            model: "gemini-2.5-flash",
            prompt,
            schema: {
                type: Type.OBJECT,
                properties: {
                    suggestions: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                platform: { type: Type.STRING },
                                date: { type: Type.STRING },
                                time: { type: Type.STRING },
                                reasoning: { type: Type.STRING }
                            },
                            required: ['platform', 'date', 'time', 'reasoning']
                        }
                    }
                },
                required: ['suggestions']
            },
            feature: 'scheduling_suggest',
        });

        const result = JSON.parse(response.text);

        if (result?.suggestions) {
            return result.suggestions as ScheduleSuggestion[];
        }

        throw new Error("AI response did not contain 'suggestions'.");
    } catch (error) {
        console.error("Error getting optimal times:", error);
        throw new Error("Failed to communicate with the AI model or parse its response.");
    }
}
