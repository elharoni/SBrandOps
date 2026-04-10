import { GoogleGenAI, Type } from "@google/genai";
import { SocialPlatform, ScheduleSuggestion } from '../types';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

export interface SchedulingParams {
    platforms: SocialPlatform[];
    topic: string;
    targetAudience: string;
    goal: string;
    preferredDays?: string[];
    preferredTime?: string;
}

export async function getOptimalPostingTimes(params: SchedulingParams): Promise<ScheduleSuggestion[]> {
    let prompt = `
    أنت خبير في استراتيجيات وسائل التواصل الاجتماعي لبراند منتجات راحة منزلية. بناءً على المعلومات التالية، اقترح أفضل 3 أوقات وتواريخ للنشر خلال الأسبوع القادم.
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
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    platform: { type: Type.STRING, description: 'المنصة الاجتماعية المقترحة (مثل Facebook, Instagram).' },
                                    date: { type: Type.STRING, description: 'التاريخ المقترح بصيغة YYYY-MM-DD.' },
                                    time: { type: Type.STRING, description: 'الوقت المقترح بصيغة HH:mm (توقيت 24 ساعة).' },
                                    reasoning: { type: Type.STRING, description: 'سبب مختصر ومنطقي لاختيار هذا الوقت باللغة العربية.' }
                                },
                                required: ['platform', 'date', 'time', 'reasoning']
                            }
                        }
                    },
                    required: ['suggestions']
                }
            }
        });
        
        const result = JSON.parse(response.text);
        
        if (result && result.suggestions) {
            return result.suggestions as ScheduleSuggestion[];
        } else {
             throw new Error("AI response did not contain 'suggestions'.");
        }

    } catch (error) {
        console.error("Error getting optimal times from Gemini:", error);
        throw new Error("Failed to communicate with the AI model or parse its response.");
    }
}