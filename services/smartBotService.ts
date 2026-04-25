// services/smartBotService.ts
import { supabase } from './supabaseClient';
import {
    BotPersona, BotConversation, BotMessage,
    BotStatus, BotScenario, BotLanguage, BotPersonality,
    Brand, BrandHubProfile,
} from '../types';

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapPersonaRow(row: any): BotPersona {
    return {
        id:                row.id,
        brandId:           row.brand_id,
        name:              row.name,
        avatarEmoji:       row.avatar_emoji || '🤖',
        scenario:          row.scenario as BotScenario,
        personality:       row.personality as BotPersonality,
        language:          row.language as BotLanguage,
        persuasionLevel:   (row.persuasion_level || 2) as 1 | 2 | 3,
        systemPrompt:      row.system_prompt || '',
        greetingMessage:   row.greeting_message || '',
        closingMessage:    row.closing_message || '',
        trigger:           row.trigger_type,
        triggerKeywords:   Array.isArray(row.trigger_keywords) ? row.trigger_keywords : [],
        status:            row.status as BotStatus,
        conversationCount: row.conversation_count || 0,
        conversionRate:    Number(row.conversion_rate) || 0,
        createdAt:         row.created_at,
        updatedAt:         row.updated_at,
    };
}

function mapConversationRow(row: any): BotConversation {
    return {
        id:           row.id,
        brandId:      row.brand_id,
        personaId:    row.persona_id,
        platform:     row.platform,
        customerName: row.customer_name || 'عميل',
        customerId:   row.customer_id || '',
        status:       row.status,
        messages:     Array.isArray(row.messages) ? row.messages : [],
        createdAt:    row.created_at,
        updatedAt:    row.updated_at,
    };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getBotPersonas(brandId: string): Promise<BotPersona[]> {
    const { data, error } = await supabase
        .from('bot_personas')
        .select('*')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false });

    if (error) { console.error('getBotPersonas:', error); return []; }
    return (data || []).map(mapPersonaRow);
}

export async function createBotPersona(
    brandId: string,
    persona: Omit<BotPersona, 'id' | 'brandId' | 'createdAt' | 'updatedAt' | 'conversationCount' | 'conversionRate'>
): Promise<BotPersona> {
    const { data, error } = await supabase
        .from('bot_personas')
        .insert({
            brand_id:         brandId,
            name:             persona.name,
            avatar_emoji:     persona.avatarEmoji,
            scenario:         persona.scenario,
            personality:      persona.personality,
            language:         persona.language,
            persuasion_level: persona.persuasionLevel,
            system_prompt:    persona.systemPrompt,
            greeting_message: persona.greetingMessage,
            closing_message:  persona.closingMessage,
            trigger_type:     persona.trigger,
            trigger_keywords: persona.triggerKeywords,
            status:           persona.status,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return mapPersonaRow(data);
}

export async function updateBotPersonaStatus(
    brandId: string,
    personaId: string,
    status: BotStatus
): Promise<void> {
    const { error } = await supabase
        .from('bot_personas')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', personaId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

export async function deleteBotPersona(brandId: string, personaId: string): Promise<void> {
    const { error } = await supabase
        .from('bot_personas')
        .delete()
        .eq('id', personaId)
        .eq('brand_id', brandId);

    if (error) throw new Error(error.message);
}

export async function getBotConversations(brandId: string): Promise<BotConversation[]> {
    const { data, error } = await supabase
        .from('bot_conversations')
        .select('*')
        .eq('brand_id', brandId)
        .order('updated_at', { ascending: false })
        .limit(50);

    if (error) { console.error('getBotConversations:', error); return []; }
    return (data || []).map(mapConversationRow);
}

export async function saveBotConversation(
    brandId: string,
    personaId: string,
    messages: BotMessage[]
): Promise<BotConversation> {
    const { data, error } = await supabase
        .from('bot_conversations')
        .insert({
            brand_id:      brandId,
            persona_id:    personaId,
            platform:      'demo',
            customer_name: 'تجربة مباشرة',
            customer_id:   'demo-' + Date.now(),
            status:        'closed',
            messages,
        })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return mapConversationRow(data);
}

// ── System Prompt Builder ─────────────────────────────────────────────────────

export function buildBotSystemPrompt(
    persona: Pick<BotPersona, 'name' | 'scenario' | 'personality' | 'language' | 'persuasionLevel'>,
    brand: Brand | null,
    brandProfile: BrandHubProfile | null,
    extraKnowledge = ''
): string {
    const brandName     = brandProfile?.brandName || brand?.name || 'البراند';
    const industry      = brandProfile?.industry || '';
    const toneWords     = brandProfile?.brandVoice?.toneDescription?.join('، ') || '';
    const sellingPoints = brandProfile?.keySellingPoints?.join(' • ') || '';
    const valueProps    = sellingPoints;

    const personalityDesc: Record<string, string> = {
        professional: 'محترف وواثق من نفسك',
        friendly:     'ودود ودافئ كصديق',
        urgent:       'عاجل ومحفّز لاتخاذ القرار',
        luxury:       'راقٍ وفاخر — يتكلم لغة الخبراء',
        enthusiastic: 'متحمس وإيجابي ومليء بالطاقة',
    };

    const persuasionLabel = ['', 'خفيف (يُعرّف ويدع القرار للعميل)', 'متوسط (يُرشد ويقنع)', 'قوي (يُغلق ويُحفّز بقوة)'][persona.persuasionLevel];

    const scenarioInstructions: Record<BotScenario, string> = {
        'sales-closing': `
## هدفك: إغلاق البيعة بشكل طبيعي ومقنع
1. ابدأ بسؤال مفتوح لاكتشاف الاحتياج
2. استمع → أقرّ → اعرض الحل المناسب → قدّم دليلاً اجتماعياً
3. عند الاعتراض: "أفهم قصدك تماماً، بس خليني أوضح لك..."
4. أغلق دائماً بـ CTA واضح: "هل تريد [الخطوة التالية]؟"
5. مستوى الإقناع: ${persuasionLabel}
6. لا تذكر أسعاراً إلا إذا سألك العميل مباشرة`,

        'lead-qualification': `
## هدفك: تأهيل العميل وتصنيفه
1. اسأل 3-4 أسئلة لمعرفة: الاحتياج، الميزانية، التوقيت، صانع القرار
2. صنّف العميل: 🔥 حار / 🌡️ دافئ / ❄️ بارد
3. للحارين: احجز مكالمة مباشرة مع الفريق
4. للباردين: أرسل معلومات وعد بالتواصل لاحقاً
5. كن مباشراً ولا تضيع وقت أي طرف`,

        'faq': `
## هدفك: الإجابة الدقيقة والمفيدة
1. أجب بوضوح ودقة في 2-3 جمل كحد أقصى
2. إذا السؤال خارج معرفتك: "لا أملك هذه المعلومة تحديداً، لكن فريقنا سيجيبك خلال [وقت]"
3. دائماً انتهِ بـ "هل هناك شيء آخر يمكنني مساعدتك به؟"
4. لا تختلق معلومات — الصدق أولاً`,

        'product-advisor': `
## هدفك: توصية المنتج المناسب
1. اسأل: "ما هو استخدامك المطلوب؟" و "ما ميزانيتك التقريبية؟"
2. بعد الفهم: وصّح منتجاً واحداً مع 3 فوائد واضحة
3. إذا تردد: قدّم مقارنة بين خيارين بشكل جدول مبسط
4. اختم بـ CTA: "أقدر أحجزه لك أو أرسل لك رابط الشراء المباشر؟"`,

        'retention': `
## هدفك: الاحتفاظ بالعميل وإعادة الغائبين
1. ابدأ بالتعاطف التام — لا تدافع عن البراند فوراً
2. اسأل: "أخبرني أكثر عن تجربتك — أنا هنا للاستماع"
3. اعرض حلاً أو تعويضاً مناسباً
4. أعد تقديم قيمة البراند من زاوية جديدة
5. للحالات الحرجة: "خلّني أربطك بمدير الخدمة مباشرة"`,

        'appointment': `
## هدفك: حجز موعد أو استشارة
1. اسأل: "متى يناسبك؟ صباحاً أم مساءً؟"
2. قدّم 2-3 مواعيد محددة للاختيار
3. أكّد الموعد مع: التاريخ، الوقت، نوع الاستشارة
4. أضف: "سيصلك تذكير قبل الموعد بساعة"
5. اجمع الاسم ورقم الهاتف للتأكيد`,
    };

    const languageInstruction: Record<BotLanguage, string> = {
        arabic:    'تحدث بالعربية فقط — فصحى مبسطة وواضحة',
        english:   'Speak only in English — clear and professional',
        bilingual: 'تحدث بالعربية أساساً، إذا تكلم العميل بالإنجليزية رد بالإنجليزية',
    };

    return `أنت ${persona.name}، مساعد ذكي متخصص لـ ${brandName}.

## شخصيتك:
- أسلوبك: ${personalityDesc[persona.personality] || 'محترف ودافئ'}
- ${languageInstruction[persona.language]}
- ردودك قصيرة: 2-3 جمل كحد أقصى في الرسالة الواحدة
- لا تكرر نفسك ولا تكرر ما قاله العميل
- استخدم الإيموجي باعتدال لإضافة الدفء

## معلومات البراند:
- الاسم: ${brandName}${industry ? `\n- المجال: ${industry}` : ''}${toneWords ? `\n- أسلوب التواصل: ${toneWords}` : ''}${valueProps ? `\n- نقاط بيع رئيسية: ${valueProps}` : ''}
${extraKnowledge ? `\n## معلومات إضافية عن المنتجات والأسعار:\n${extraKnowledge}` : ''}

${scenarioInstructions[persona.scenario as BotScenario] || ''}

## قواعد لا تُكسر:
- لا تذكر أي منافس أبداً
- إذا طُلب التكلم مع إنسان: "بالتأكيد، سيتواصل معك أحد من فريقنا قريباً جداً 🙏"
- إذا سُئلت عن شيء لا تعرفه: أقر بذلك بصدق ولا تختلق معلومة
- كن دائماً متفائلاً ومحترماً مهما كان أسلوب العميل`;
}

// ── AI Chat (Demo Mode) ───────────────────────────────────────────────────────

export async function getBotReply(
    systemPrompt: string,
    conversationHistory: { role: 'bot' | 'customer'; content: string }[]
): Promise<string> {
    // Gemini doesn't support system_instruction via the proxy yet,
    // so we prime the context with a user/model exchange before the real conversation.
    const primedContents = [
        { role: 'user',  parts: [{ text: `[تعليمات النظام]\n${systemPrompt}\n[نهاية التعليمات]\n\nهل استوعبت دورك؟` }] },
        { role: 'model', parts: [{ text: 'نعم، استوعبت دوري تماماً وسأتصرف بدقة وفق التعليمات.' }] },
        ...conversationHistory.map(msg => ({
            role:  msg.role === 'bot' ? 'model' : 'user',
            parts: [{ text: msg.content }],
        })),
    ];

    const { data, error } = await supabase.functions.invoke('ai-proxy', {
        body: {
            model:    'gemini-2.5-flash',
            feature:  'smart-bot-demo',
            contents: primedContents,
        },
    });

    if (error) throw new Error(error.message ?? 'AI proxy error');
    return (data as any)?.text?.trim() || 'حدث خطأ، يرجى المحاولة مرة أخرى.';
}
