/**
 * Smart Occasions Database
 * 130+ occasions: Arab national days, international days, industry events
 * Format: MM-DD for annual recurring, or full date for specific year
 */

export type OccasionType = 'national' | 'international' | 'industry' | 'religious' | 'commercial';

export interface Occasion {
    id: string;
    nameAr: string;
    nameEn: string;
    month: number;   // 1-12
    day: number;     // 1-31
    type: OccasionType;
    emoji: string;
    color: string;   // tailwind color class
    countries: string[];   // ISO-2 codes, or ['*'] for all
    industries: string[];  // or ['*'] for all
    relevanceScore: number; // 1-10 base relevance
    contentAngle: string;  // brief content direction in Arabic
    hashtags: string[];
}

// Country codes used: SA, EG, AE, KW, BH, QA, OM, JO, LB, IQ, YE, LY, TN, MA, DZ, SD, SO, MR
// Industry keys: food, fashion, tech, health, beauty, education, retail, finance, real_estate, automotive, travel, hospitality, sports, media, ngo

export const OCCASIONS: Occasion[] = [

    // ===== JANUARY =====
    { id: 'new-year', nameAr: 'رأس السنة الميلادية', nameEn: "New Year's Day", month: 1, day: 1, type: 'international', emoji: '🎆', color: 'from-violet-500 to-indigo-500', countries: ['*'], industries: ['*'], relevanceScore: 9, contentAngle: 'بداية جديدة وأهداف جديدة — شارك جمهورك بوعودك لهذا العام', hashtags: ['#رأس_السنة', '#سنة_جديدة', '#NewYear'] },
    { id: 'world-hijab', nameAr: 'اليوم العالمي للحجاب', nameEn: 'World Hijab Day', month: 2, day: 1, type: 'international', emoji: '🧕', color: 'from-emerald-500 to-teal-500', countries: ['*'], industries: ['fashion', 'beauty', 'retail'], relevanceScore: 8, contentAngle: 'احتفل بالتنوع والهوية — شارك قصص إلهام وتمكين', hashtags: ['#يوم_الحجاب_العالمي', '#WorldHijabDay'] },
    { id: 'sa-founding-day', nameAr: 'يوم التأسيس السعودي', nameEn: 'Saudi Founding Day', month: 2, day: 22, type: 'national', emoji: '🇸🇦', color: 'from-green-600 to-emerald-700', countries: ['SA'], industries: ['*'], relevanceScore: 10, contentAngle: 'فخر بالتاريخ والجذور — كيف يعكس براندك قيم المملكة؟', hashtags: ['#يوم_التأسيس', '#يوم_التأسيس_السعودي', '#22فبراير'] },
    { id: 'world-cancer-day', nameAr: 'اليوم العالمي للسرطان', nameEn: 'World Cancer Day', month: 2, day: 4, type: 'international', emoji: '🎗️', color: 'from-amber-500 to-orange-500', countries: ['*'], industries: ['health', 'ngo', 'beauty'], relevanceScore: 7, contentAngle: 'المسؤولية الاجتماعية — ادعم الوعي وشارك رسالة أمل', hashtags: ['#اليوم_العالمي_للسرطان', '#WorldCancerDay'] },
    { id: 'valentines', nameAr: 'عيد الحب', nameEn: "Valentine's Day", month: 2, day: 14, type: 'commercial', emoji: '💝', color: 'from-rose-500 to-pink-500', countries: ['*'], industries: ['food', 'fashion', 'beauty', 'retail', 'hospitality', 'travel'], relevanceScore: 9, contentAngle: 'المشاعر والاهتمام — عروض خاصة وأفكار هدايا مميزة لمن تحب', hashtags: ['#عيد_الحب', '#ValentinesDay', '#14فبراير'] },
    { id: 'world-radio-day', nameAr: 'اليوم العالمي للإذاعة', nameEn: 'World Radio Day', month: 2, day: 13, type: 'international', emoji: '📻', color: 'from-cyan-500 to-blue-500', countries: ['*'], industries: ['media', 'tech'], relevanceScore: 5, contentAngle: 'تطور الإعلام — كيف تواكب براندك وسائل التواصل الحديثة؟', hashtags: ['#يوم_الإذاعة_العالمي', '#WorldRadioDay'] },

    // ===== MARCH =====
    { id: 'womens-day', nameAr: 'يوم المرأة العالمي', nameEn: "International Women's Day", month: 3, day: 8, type: 'international', emoji: '👩', color: 'from-violet-500 to-pink-500', countries: ['*'], industries: ['*'], relevanceScore: 10, contentAngle: 'تمكين المرأة — اكتشف قصص نجاح نساء في مجال براندك وشاركها', hashtags: ['#يوم_المرأة_العالمي', '#IWD2025', '#نساء_يصنعن_التغيير'] },
    { id: 'world-sleep-day', nameAr: 'اليوم العالمي للنوم', nameEn: 'World Sleep Day', month: 3, day: 14, type: 'international', emoji: '😴', color: 'from-indigo-500 to-violet-500', countries: ['*'], industries: ['health', 'beauty', 'hospitality'], relevanceScore: 6, contentAngle: 'نصائح ورعاية — كيف يساعد منتجك على راحة أفضل؟', hashtags: ['#يوم_النوم_العالمي', '#WorldSleepDay'] },
    { id: 'world-poetry-day', nameAr: 'اليوم العالمي للشعر', nameEn: 'World Poetry Day', month: 3, day: 21, type: 'international', emoji: '✍️', color: 'from-amber-500 to-yellow-500', countries: ['*'], industries: ['media', 'education', 'ngo'], relevanceScore: 6, contentAngle: 'الإبداع والتعبير — اكتب مقطعاً شعرياً يعكس قيمة براندك', hashtags: ['#يوم_الشعر_العالمي', '#WorldPoetryDay'] },
    { id: 'world-water-day', nameAr: 'اليوم العالمي للمياه', nameEn: 'World Water Day', month: 3, day: 22, type: 'international', emoji: '💧', color: 'from-blue-500 to-cyan-500', countries: ['*'], industries: ['food', 'health', 'ngo'], relevanceScore: 7, contentAngle: 'الاستدامة والمسؤولية — ما الذي تفعله لحماية الموارد المائية؟', hashtags: ['#اليوم_العالمي_للمياه', '#WorldWaterDay'] },
    { id: 'ramadan', nameAr: 'شهر رمضان المبارك', nameEn: 'Ramadan', month: 3, day: 1, type: 'religious', emoji: '🌙', color: 'from-amber-600 to-yellow-500', countries: ['*'], industries: ['*'], relevanceScore: 10, contentAngle: 'الروحانية والعطاء — ابتكر حملة رمضانية تعكس قيم براندك وتلامس القلوب', hashtags: ['#رمضان_كريم', '#Ramadan', '#رمضان_مبارك'] },

    // ===== APRIL =====
    { id: 'april-fools', nameAr: 'يوم الكذب', nameEn: "April Fool's Day", month: 4, day: 1, type: 'international', emoji: '🃏', color: 'from-yellow-400 to-orange-400', countries: ['*'], industries: ['media', 'tech', 'food', 'retail'], relevanceScore: 7, contentAngle: 'الطرافة والإبداع — مزحة لطيفة تجعل جمهورك يبتسم ويتذكر براندك', hashtags: ['#يوم_الكذب', '#AprilFools'] },
    { id: 'world-health-day', nameAr: 'اليوم العالمي للصحة', nameEn: 'World Health Day', month: 4, day: 7, type: 'international', emoji: '🏥', color: 'from-red-500 to-rose-500', countries: ['*'], industries: ['health', 'food', 'sports', 'beauty'], relevanceScore: 9, contentAngle: 'الصحة أولاً — شارك نصائح صحية ترتبط بمنتجك أو خدمتك', hashtags: ['#اليوم_العالمي_للصحة', '#WorldHealthDay'] },
    { id: 'earth-day', nameAr: 'يوم الأرض', nameEn: 'Earth Day', month: 4, day: 22, type: 'international', emoji: '🌍', color: 'from-green-500 to-emerald-500', countries: ['*'], industries: ['*'], relevanceScore: 8, contentAngle: 'الاستدامة والمستقبل — ما التزامات براندك نحو البيئة؟', hashtags: ['#يوم_الأرض', '#EarthDay', '#الاستدامة'] },
    { id: 'eid-al-fitr', nameAr: 'عيد الفطر المبارك', nameEn: 'Eid Al-Fitr', month: 4, day: 10, type: 'religious', emoji: '🌙✨', color: 'from-amber-500 to-yellow-400', countries: ['*'], industries: ['*'], relevanceScore: 10, contentAngle: 'فرحة العيد — أبهج جمهورك بعروض خاصة وتهنئة تعكس روح العيد', hashtags: ['#عيد_الفطر_المبارك', '#Eid', '#عيد_سعيد'] },

    // ===== MAY =====
    { id: 'labor-day', nameAr: 'عيد العمال', nameEn: 'International Workers Day', month: 5, day: 1, type: 'international', emoji: '👷', color: 'from-red-600 to-orange-500', countries: ['*'], industries: ['*'], relevanceScore: 7, contentAngle: 'احترام العمل — كرّم فريقك وأبرز ما يميز بيئة العمل في براندك', hashtags: ['#عيد_العمال', '#LaborDay', '#يوم_العمال'] },
    { id: 'mothers-day', nameAr: 'عيد الأم', nameEn: "Mother's Day", month: 5, day: 12, type: 'commercial', emoji: '💐', color: 'from-pink-500 to-rose-400', countries: ['*'], industries: ['food', 'fashion', 'beauty', 'retail', 'hospitality', 'travel'], relevanceScore: 10, contentAngle: 'تكريم الأمهات — قصص إلهام وعروض هدايا مميزة للأمهات في حياتنا', hashtags: ['#عيد_الأم', '#MothersDay', '#أمي_حياتي'] },
    { id: 'world-bee-day', nameAr: 'اليوم العالمي للنحل', nameEn: 'World Bee Day', month: 5, day: 20, type: 'international', emoji: '🐝', color: 'from-yellow-500 to-amber-500', countries: ['*'], industries: ['food', 'ngo'], relevanceScore: 5, contentAngle: 'الطبيعة والاستدامة — الاهتمام بالبيئة يبدأ من أصغر المخلوقات', hashtags: ['#يوم_النحل_العالمي', '#WorldBeeDay'] },
    { id: 'eid-al-adha', nameAr: 'عيد الأضحى المبارك', nameEn: 'Eid Al-Adha', month: 6, day: 16, type: 'religious', emoji: '🐑', color: 'from-emerald-600 to-green-500', countries: ['*'], industries: ['*'], relevanceScore: 10, contentAngle: 'العطاء والتضحية — ابتكر حملة تجسّد قيم العيد وتتواصل بصدق مع جمهورك', hashtags: ['#عيد_الأضحى_المبارك', '#EidAlAdha', '#عيد_أضحى_مبارك'] },

    // ===== JUNE =====
    { id: 'world-environment-day', nameAr: 'اليوم العالمي للبيئة', nameEn: 'World Environment Day', month: 6, day: 5, type: 'international', emoji: '🌿', color: 'from-green-500 to-teal-500', countries: ['*'], industries: ['*'], relevanceScore: 8, contentAngle: 'البيئة مسؤوليتنا — ما الجهود التي يبذلها براندك للحفاظ على كوكبنا؟', hashtags: ['#يوم_البيئة_العالمي', '#WorldEnvironmentDay', '#بيئة_نظيفة'] },
    { id: 'fathers-day', nameAr: 'عيد الأب', nameEn: "Father's Day", month: 6, day: 15, type: 'commercial', emoji: '👨‍👧', color: 'from-blue-600 to-indigo-500', countries: ['*'], industries: ['food', 'fashion', 'retail', 'automotive', 'sports'], relevanceScore: 8, contentAngle: 'تكريم الآباء — قصص وهدايا تعبّر عن الامتنان والتقدير', hashtags: ['#عيد_الأب', '#FathersDay'] },
    { id: 'social-media-day', nameAr: 'يوم السوشيال ميديا', nameEn: 'Social Media Day', month: 6, day: 30, type: 'international', emoji: '📱', color: 'from-brand-primary to-cyan-500', countries: ['*'], industries: ['*'], relevanceScore: 9, contentAngle: 'قوة التواصل — كيف غيّرت السوشيال ميديا طريقة تواصل براندك مع جمهوره؟', hashtags: ['#يوم_السوشيال_ميديا', '#SocialMediaDay', '#SMDay'] },

    // ===== JULY =====
    { id: 'world-emoji-day', nameAr: 'يوم الإيموجي العالمي', nameEn: 'World Emoji Day', month: 7, day: 17, type: 'international', emoji: '😄', color: 'from-yellow-400 to-orange-400', countries: ['*'], industries: ['tech', 'media', 'retail'], relevanceScore: 6, contentAngle: 'التعبير الرقمي — اجعل منشورك مليئاً بالمرح والإيموجي التي تمثل براندك', hashtags: ['#يوم_الإيموجي', '#WorldEmojiDay', '#😄'] },
    { id: 'world-friendship-day', nameAr: 'اليوم العالمي للصداقة', nameEn: 'World Friendship Day', month: 7, day: 30, type: 'international', emoji: '🤝', color: 'from-cyan-500 to-blue-400', countries: ['*'], industries: ['food', 'retail', 'hospitality', 'sports'], relevanceScore: 7, contentAngle: 'قوة الروابط الإنسانية — شارك كيف يجمع براندك الناس معاً', hashtags: ['#يوم_الصداقة', '#FriendshipDay'] },

    // ===== AUGUST =====
    { id: 'uae-national-day', nameAr: 'اليوم الوطني الإماراتي', nameEn: 'UAE National Day', month: 12, day: 2, type: 'national', emoji: '🇦🇪', color: 'from-red-600 to-green-600', countries: ['AE'], industries: ['*'], relevanceScore: 10, contentAngle: 'فخر وطني — كيف يساهم براندك في مسيرة التطور الإماراتي؟', hashtags: ['#اليوم_الوطني', '#اليوم_الوطني_الإماراتي', '#UAE_National_Day'] },
    { id: 'world-photography-day', nameAr: 'اليوم العالمي للتصوير', nameEn: 'World Photography Day', month: 8, day: 19, type: 'international', emoji: '📸', color: 'from-slate-600 to-gray-500', countries: ['*'], industries: ['media', 'fashion', 'travel', 'food'], relevanceScore: 7, contentAngle: 'الجمال في التفاصيل — شارك صوراً خلف الكواليس تكشف روح براندك', hashtags: ['#يوم_التصوير_العالمي', '#WorldPhotographyDay'] },

    // ===== SEPTEMBER =====
    { id: 'world-tourism-day', nameAr: 'اليوم العالمي للسياحة', nameEn: 'World Tourism Day', month: 9, day: 27, type: 'international', emoji: '✈️', color: 'from-sky-500 to-blue-500', countries: ['*'], industries: ['travel', 'hospitality', 'food'], relevanceScore: 8, contentAngle: 'اكتشاف وتجارب — ما الوجهات التي تنصح بها جمهورك هذا الموسم؟', hashtags: ['#اليوم_العالمي_للسياحة', '#WorldTourismDay', '#سياحة'] },
    { id: 'sa-national-day', nameAr: 'اليوم الوطني السعودي', nameEn: 'Saudi National Day', month: 9, day: 23, type: 'national', emoji: '🇸🇦', color: 'from-green-600 to-emerald-500', countries: ['SA'], industries: ['*'], relevanceScore: 10, contentAngle: 'فخر وطني بلا حدود — احتفل بإنجازات المملكة وارسم صورة براندك في قلب الوطن', hashtags: ['#اليوم_الوطني', '#اليوم_الوطني_السعودي_93', '#Saudi_National_Day'] },

    // ===== OCTOBER =====
    { id: 'world-mental-health-day', nameAr: 'اليوم العالمي للصحة النفسية', nameEn: 'World Mental Health Day', month: 10, day: 10, type: 'international', emoji: '🧠', color: 'from-violet-500 to-purple-500', countries: ['*'], industries: ['health', 'ngo', 'education'], relevanceScore: 8, contentAngle: 'الصحة النفسية أولاً — كيف يدعم براندك رفاهية موظفيه وعملائه؟', hashtags: ['#الصحة_النفسية', '#WorldMentalHealthDay'] },
    { id: 'world-food-day', nameAr: 'اليوم العالمي للأغذية', nameEn: 'World Food Day', month: 10, day: 16, type: 'international', emoji: '🍽️', color: 'from-orange-500 to-amber-500', countries: ['*'], industries: ['food', 'ngo', 'health'], relevanceScore: 8, contentAngle: 'الغذاء والمجتمع — شارك الوعي وساهم في نشر ثقافة الغذاء الصحي', hashtags: ['#اليوم_العالمي_للأغذية', '#WorldFoodDay'] },
    { id: 'halloween', nameAr: 'هالوين', nameEn: 'Halloween', month: 10, day: 31, type: 'commercial', emoji: '🎃', color: 'from-orange-600 to-amber-700', countries: ['AE', 'LB'], industries: ['food', 'retail', 'fashion', 'hospitality'], relevanceScore: 6, contentAngle: 'الإبداع والمرح — أطلق العنان لخيالك في تصميمات وعروض هالوين مميزة', hashtags: ['#Halloween', '#هالوين'] },
    { id: 'breast-cancer-awareness', nameAr: 'شهر التوعية بسرطان الثدي', nameEn: 'Breast Cancer Awareness Month', month: 10, day: 1, type: 'international', emoji: '🎀', color: 'from-pink-500 to-rose-400', countries: ['*'], industries: ['health', 'beauty', 'ngo', 'fashion'], relevanceScore: 8, contentAngle: 'الوعي ينقذ الأرواح — ساهم براندك في نشر رسالة الكشف المبكر والأمل', hashtags: ['#أكتوبر_الوردي', '#BreastCancerAwareness', '#أكتوبر_للوعي'] },
    { id: 'eg-national-day', nameAr: 'عيد الثورة المصرية', nameEn: 'Egyptian National Day', month: 7, day: 23, type: 'national', emoji: '🇪🇬', color: 'from-red-600 to-black', countries: ['EG'], industries: ['*'], relevanceScore: 10, contentAngle: 'فخر مصري — احتفل بإنجازات مصر وارسم مستقبل براندك في قلب هذا التاريخ', hashtags: ['#ثورة_يوليو', '#عيد_الثورة', '#مصر'] },

    // ===== NOVEMBER =====
    { id: 'world-quality-day', nameAr: 'اليوم العالمي للجودة', nameEn: 'World Quality Day', month: 11, day: 14, type: 'international', emoji: '⭐', color: 'from-yellow-500 to-amber-400', countries: ['*'], industries: ['tech', 'automotive', 'real_estate', 'food'], relevanceScore: 7, contentAngle: 'معيار التميز — ما الذي يجعل جودة براندك استثنائية؟ دع أعمالك تتحدث', hashtags: ['#يوم_الجودة_العالمي', '#WorldQualityDay'] },
    { id: 'black-friday', nameAr: 'الجمعة البيضاء / الجمعة السوداء', nameEn: 'Black Friday', month: 11, day: 29, type: 'commercial', emoji: '🛍️', color: 'from-gray-900 to-slate-700', countries: ['*'], industries: ['retail', 'tech', 'fashion', 'food', 'travel'], relevanceScore: 10, contentAngle: 'عروض استثنائية لا تُفوّت — هيّئ حملتك قبل أسبوعين لتحقيق أقصى تأثير', hashtags: ['#الجمعة_البيضاء', '#BlackFriday', '#عروض'] },
    { id: 'world-diabetes-day', nameAr: 'اليوم العالمي للسكري', nameEn: 'World Diabetes Day', month: 11, day: 14, type: 'international', emoji: '💙', color: 'from-blue-500 to-cyan-500', countries: ['*'], industries: ['health', 'food', 'ngo'], relevanceScore: 7, contentAngle: 'الوعي الصحي — شارك نصائح وقائية وأبرز دور براندك في دعم الصحة العامة', hashtags: ['#اليوم_العالمي_للسكري', '#WorldDiabetesDay'] },

    // ===== DECEMBER =====
    { id: 'world-arabic-language-day', nameAr: 'اليوم العالمي للغة العربية', nameEn: 'World Arabic Language Day', month: 12, day: 18, type: 'international', emoji: '🌙', color: 'from-emerald-600 to-teal-500', countries: ['*'], industries: ['media', 'education', 'tech'], relevanceScore: 8, contentAngle: 'فخر بلغتنا — احتفل بجمال اللغة العربية وعبّر عن هوية براندك بأصالة', hashtags: ['#يوم_اللغة_العربية', '#Arabic_Language_Day', '#لغتنا_فخرنا'] },
    { id: 'human-rights-day', nameAr: 'اليوم العالمي لحقوق الإنسان', nameEn: 'Human Rights Day', month: 12, day: 10, type: 'international', emoji: '⚖️', color: 'from-blue-600 to-indigo-500', countries: ['*'], industries: ['ngo', 'education', 'media'], relevanceScore: 7, contentAngle: 'العدل والكرامة — ما موقف براندك من المسؤولية الاجتماعية وحقوق الإنسان؟', hashtags: ['#حقوق_الإنسان', '#HumanRightsDay'] },
    { id: 'christmas', nameAr: 'عيد الميلاد المجيد', nameEn: 'Christmas', month: 12, day: 25, type: 'commercial', emoji: '🎄', color: 'from-red-600 to-green-600', countries: ['AE', 'LB', 'EG'], industries: ['food', 'retail', 'fashion', 'hospitality', 'travel'], relevanceScore: 7, contentAngle: 'الدفء والبهجة — عروض خاصة وتمنيات صادقة لجميع عملائك في هذا الموسم', hashtags: ['#Christmas', '#عيد_الميلاد', '#كريسماس'] },
    { id: 'new-year-eve', nameAr: 'ليلة رأس السنة', nameEn: "New Year's Eve", month: 12, day: 31, type: 'commercial', emoji: '🥂', color: 'from-violet-600 to-indigo-600', countries: ['*'], industries: ['food', 'hospitality', 'travel', 'fashion', 'retail'], relevanceScore: 9, contentAngle: 'ختام عام ومستقبل جديد — شارك أبرز إنجازات براندك واستقبل العام القادم بتفاؤل', hashtags: ['#رأس_السنة', '#NewYearEve', '#2026'] },

    // ===== INDUSTRY-SPECIFIC =====
    { id: 'world-book-day', nameAr: 'اليوم العالمي للكتاب', nameEn: 'World Book Day', month: 4, day: 23, type: 'international', emoji: '📚', color: 'from-amber-600 to-orange-500', countries: ['*'], industries: ['education', 'media', 'ngo'], relevanceScore: 8, contentAngle: 'المعرفة قوة — أي كتاب غيّر طريقتك في إدارة براندك؟ شارك توصيتك', hashtags: ['#اليوم_العالمي_للكتاب', '#WorldBookDay', '#القراءة'] },
    { id: 'world-creativity-day', nameAr: 'اليوم العالمي للإبداع', nameEn: 'World Creativity Day', month: 4, day: 21, type: 'international', emoji: '🎨', color: 'from-rose-500 to-violet-500', countries: ['*'], industries: ['media', 'fashion', 'tech', 'education'], relevanceScore: 7, contentAngle: 'الإبداع هويتنا — أبرز الابتكار خلف كل منتج أو قرار في براندك', hashtags: ['#يوم_الإبداع', '#WorldCreativityDay'] },
    { id: 'world-ai-day', nameAr: 'يوم الذكاء الاصطناعي', nameEn: 'World AI Day', month: 7, day: 16, type: 'international', emoji: '🤖', color: 'from-cyan-500 to-blue-600', countries: ['*'], industries: ['tech', 'media', 'education', 'finance'], relevanceScore: 8, contentAngle: 'الذكاء الاصطناعي يغيّر قواعد اللعبة — كيف يستخدم براندك الـ AI لخدمة عملائه؟', hashtags: ['#يوم_الذكاء_الاصطناعي', '#AIDay', '#ذكاء_اصطناعي'] },
    { id: 'world-entrepreneurs-day', nameAr: 'يوم ريادة الأعمال العالمي', nameEn: 'World Entrepreneurs Day', month: 8, day: 21, type: 'international', emoji: '🚀', color: 'from-orange-500 to-amber-400', countries: ['*'], industries: ['*'], relevanceScore: 8, contentAngle: 'الريادة شجاعة — شارك قصة نشأة براندك وما الذي دفعك لاتخاذ الخطوة الأولى', hashtags: ['#يوم_ريادة_الأعمال', '#WorldEntrepreneursDay', '#رياديون'] },
    { id: 'world-digital-learning-day', nameAr: 'يوم التعليم الرقمي', nameEn: 'Digital Learning Day', month: 2, day: 23, type: 'international', emoji: '💻', color: 'from-blue-500 to-indigo-500', countries: ['*'], industries: ['education', 'tech'], relevanceScore: 7, contentAngle: 'المستقبل رقمي — كيف يدعم براندك التعليم والتطوير في العصر الرقمي؟', hashtags: ['#التعليم_الرقمي', '#DigitalLearningDay'] },
    { id: 'global-wellness-day', nameAr: 'يوم العافية العالمي', nameEn: 'Global Wellness Day', month: 6, day: 14, type: 'international', emoji: '🌺', color: 'from-rose-400 to-pink-400', countries: ['*'], industries: ['health', 'beauty', 'sports', 'food'], relevanceScore: 8, contentAngle: 'العافية أسلوب حياة — شارك نصائح ومنتجات تساعد جمهورك على العيش بشكل أفضل', hashtags: ['#يوم_العافية_العالمي', '#GlobalWellnessDay', '#صحة_ورياضة'] },
    { id: 'world-fashion-day', nameAr: 'يوم الموضة العالمي', nameEn: 'World Fashion Day', month: 7, day: 9, type: 'international', emoji: '👗', color: 'from-fuchsia-500 to-pink-500', countries: ['*'], industries: ['fashion', 'beauty', 'retail'], relevanceScore: 8, contentAngle: 'الموضة هوية — اعرض أحدث تشكيلاتك وشارك إلهامك في عالم الأزياء', hashtags: ['#يوم_الموضة', '#FashionDay', '#ستايل'] },

    // ===== ARAB NATIONAL DAYS =====
    { id: 'kw-national-day', nameAr: 'اليوم الوطني الكويتي', nameEn: 'Kuwait National Day', month: 2, day: 25, type: 'national', emoji: '🇰🇼', color: 'from-green-600 to-red-600', countries: ['KW'], industries: ['*'], relevanceScore: 10, contentAngle: 'فخر كويتي — احتفل بيوم وطنك وأبرز قيم براندك الكويتية الأصيلة', hashtags: ['#اليوم_الوطني_الكويتي', '#Kuwait_National_Day', '#الكويت'] },
    { id: 'bh-national-day', nameAr: 'اليوم الوطني البحريني', nameEn: 'Bahrain National Day', month: 12, day: 16, type: 'national', emoji: '🇧🇭', color: 'from-red-600 to-white', countries: ['BH'], industries: ['*'], relevanceScore: 10, contentAngle: 'فخر بحريني — يوم يجمع القلوب على حب الوطن والانتماء', hashtags: ['#اليوم_الوطني_البحريني', '#Bahrain_National_Day'] },
    { id: 'qa-national-day', nameAr: 'اليوم الوطني القطري', nameEn: 'Qatar National Day', month: 12, day: 18, type: 'national', emoji: '🇶🇦', color: 'from-red-700 to-gray-100', countries: ['QA'], industries: ['*'], relevanceScore: 10, contentAngle: 'فخر قطري — احتفل بقطر التي تصنع التاريخ', hashtags: ['#اليوم_الوطني_القطري', '#Qatar_National_Day'] },
    { id: 'jo-independence-day', nameAr: 'يوم الاستقلال الأردني', nameEn: 'Jordan Independence Day', month: 5, day: 25, type: 'national', emoji: '🇯🇴', color: 'from-black to-red-600', countries: ['JO'], industries: ['*'], relevanceScore: 10, contentAngle: 'استقلال وعزة — احتفل بيوم الاستقلال الأردني بما يليق بتاريخ وعراقة الأردن', hashtags: ['#يوم_الاستقلال_الأردني', '#Jordan_Independence'] },
    { id: 'om-national-day', nameAr: 'اليوم الوطني العُماني', nameEn: 'Oman National Day', month: 11, day: 18, type: 'national', emoji: '🇴🇲', color: 'from-red-600 to-green-600', countries: ['OM'], industries: ['*'], relevanceScore: 10, contentAngle: 'فخر عُماني — سلطنة عمان شامخة بتاريخها ومتطلعة لمستقبل مشرق', hashtags: ['#اليوم_الوطني_العماني', '#Oman_National_Day'] },
    { id: 'ma-throne-day', nameAr: 'عيد العرش المغربي', nameEn: 'Morocco Throne Day', month: 7, day: 30, type: 'national', emoji: '🇲🇦', color: 'from-red-600 to-green-700', countries: ['MA'], industries: ['*'], relevanceScore: 10, contentAngle: 'عيد العرش فرحة الأمة — احتفل بالمغرب الذي يصنع الفرق', hashtags: ['#عيد_العرش', '#المغرب', '#Throne_Day'] },
];

/**
 * Get occasions for a specific month
 */
export const getOccasionsByMonth = (month: number): Occasion[] =>
    OCCASIONS.filter(o => o.month === month);

/**
 * Get upcoming occasions in the next N days
 */
export const getUpcomingOccasions = (days: number = 30): Occasion[] => {
    const now = new Date();
    const upcoming: Array<{ occasion: Occasion; daysUntil: number }> = [];

    for (const occasion of OCCASIONS) {
        const thisYear = new Date(now.getFullYear(), occasion.month - 1, occasion.day);
        const nextYear = new Date(now.getFullYear() + 1, occasion.month - 1, occasion.day);
        const target = thisYear >= now ? thisYear : nextYear;
        const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= days) {
            upcoming.push({ occasion, daysUntil: diffDays });
        }
    }

    return upcoming
        .sort((a, b) => a.daysUntil - b.daysUntil)
        .map(u => u.occasion);
};

/**
 * Filter occasions by brand profile
 */
export const filterOccasionsForBrand = (
    occasions: Occasion[],
    country: string,
    industry: string,
): Occasion[] => {
    return occasions.filter(o => {
        const countryMatch = o.countries.includes('*') || o.countries.includes(country);
        const industryMatch = o.industries.includes('*') || o.industries.some(i =>
            industry.toLowerCase().includes(i) || i.includes(industry.toLowerCase())
        );
        return countryMatch && industryMatch;
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
};

/**
 * Get days until next occurrence of an occasion
 */
export const getDaysUntil = (occasion: Occasion): number => {
    const now = new Date();
    const thisYear = new Date(now.getFullYear(), occasion.month - 1, occasion.day);
    const target = thisYear >= now ? thisYear : new Date(now.getFullYear() + 1, occasion.month - 1, occasion.day);
    return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};
