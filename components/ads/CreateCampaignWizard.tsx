
import React, { useState, useCallback, useRef } from 'react';
import { BrandHubProfile, CampaignGoal, AdCreative, NotificationType, AdCampaign, CampaignStatus, AdPlatform, AD_PLATFORM_ASSETS, MediaItem } from '../../types';
import { generateAdCreative, generateTargetingSuggestions } from '../../services/geminiService';

interface CreateCampaignWizardProps {
    onClose: () => void;
    brandProfile: BrandHubProfile;
    onCampaignCreated: (campaign: AdCampaign) => void;
    addNotification: (type: NotificationType, message: string) => void;
}

const campaignGoals = [
    { key: CampaignGoal.Awareness, label: 'الوعي (Awareness)', icon: 'fa-eye' },
    { key: CampaignGoal.Traffic, label: 'الزيارات (Traffic)', icon: 'fa-mouse-pointer' },
    { key: CampaignGoal.Engagement, label: 'التفاعل (Engagement)', icon: 'fa-comments' },
    { key: CampaignGoal.Conversion, label: 'التحويلات (Conversion)', icon: 'fa-crosshairs' },
];

const steps = ['أساسيات الحملة', 'الاستهداف والميزانية', 'استوديو الإعلانات', 'المراجعة'];

export const CreateCampaignWizard: React.FC<CreateCampaignWizardProps> = ({ onClose, brandProfile, onCampaignCreated, addNotification }) => {
    const [step, setStep] = useState(1);
    
    // --- Step 1: Campaign Basics ---
    const [campaignName, setCampaignName] = useState('');
    const [platform, setPlatform] = useState<AdPlatform>(AdPlatform.Meta);
    const [goal, setGoal] = useState<CampaignGoal>(CampaignGoal.Traffic);
    const [campaignBudgetOptimization, setCampaignBudgetOptimization] = useState(false);
    
    // --- Step 2: Targeting & Budget ---
    const [budget, setBudget] = useState(500);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    
    // Detailed Targeting State
    const [locations, setLocations] = useState(['المملكة العربية السعودية']);
    const [newLocation, setNewLocation] = useState('');
    const [ageRange, setAgeRange] = useState({ min: 18, max: 65 });
    const [gender, setGender] = useState<'All' | 'Men' | 'Women'>('All');
    const [detailedTargeting, setDetailedTargeting] = useState<string[]>([]); // Interests/Behaviors
    const [newInterest, setNewInterest] = useState('');
    const [customAudience, setCustomAudience] = useState('None');
    const [lookalikeAudience, setLookalikeAudience] = useState('None');
    const [isGeneratingInterests, setIsGeneratingInterests] = useState(false);
    
    // --- Step 3: Creative ---
    const [productInfo, setProductInfo] = useState('');
    const [creatives, setCreatives] = useState<Pick<AdCreative, 'headline' | 'primaryText'>[]>([]);
    const [selectedCreativeIndex, setSelectedCreativeIndex] = useState(-1);
    const [adMedia, setAdMedia] = useState<MediaItem[]>([]);
    const [isGeneratingCreative, setIsGeneratingCreative] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handlers
    const handleGenerateCreatives = useCallback(async () => {
        if (!productInfo) {
            addNotification(NotificationType.Warning, 'يرجى وصف المنتج أو الخدمة.');
            return;
        }
        setIsGeneratingCreative(true);
        try {
            const audienceSummary = `${locations.join(', ')} - ${gender} - ${ageRange.min}-${ageRange.max} - ${detailedTargeting.join(', ')}`;
            const result = await generateAdCreative(platform, goal, productInfo, brandProfile, audienceSummary);
            setCreatives(result);
            setSelectedCreativeIndex(0); // Auto-select first option
        } catch (error) {
            addNotification(NotificationType.Error, 'فشل في توليد الإعلانات.');
            console.error(error);
        } finally {
            setIsGeneratingCreative(false);
        }
    }, [platform, goal, productInfo, brandProfile, locations, gender, ageRange, detailedTargeting, addNotification]);

    const handleGenerateTargeting = async () => {
        if(!productInfo && !brandProfile.industry) {
             addNotification(NotificationType.Warning, 'يرجى كتابة وصف المنتج في الخطوة التالية أولاً أو التأكد من إكمال ملف البراند.');
             return;
        }
        setIsGeneratingInterests(true);
        try {
            const suggestions = await generateTargetingSuggestions(platform, productInfo || brandProfile.industry, brandProfile);
            setDetailedTargeting(prev => [...new Set([...prev, ...suggestions])]);
            addNotification(NotificationType.Success, 'تمت إضافة اقتراحات الاستهداف.');
        } catch (error) {
             addNotification(NotificationType.Error, 'فشل في جلب الاقتراحات.');
        } finally {
            setIsGeneratingInterests(false);
        }
    };

    const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            const newMediaItems: MediaItem[] = files.map((file: File) => ({
                id: crypto.randomUUID(),
                type: file.type.startsWith('video') ? 'video' : 'image',
                url: URL.createObjectURL(file),
                file: file
            }));
            setAdMedia(prev => [...prev, ...newMediaItems]);
        }
        if (e.target) e.target.value = '';
    };

    const handleRemoveMedia = (id: string) => {
        setAdMedia(prev => prev.filter(m => m.id !== id));
    }

    const handleAddLocation = () => {
        if (newLocation.trim()) {
            setLocations([...locations, newLocation.trim()]);
            setNewLocation('');
        }
    };

    const handleAddInterest = () => {
        if (newInterest.trim()) {
            setDetailedTargeting([...detailedTargeting, newInterest.trim()]);
            setNewInterest('');
        }
    };
    
    const handleFinalSubmit = () => {
        if (!campaignName) {
            addNotification(NotificationType.Warning, 'يرجى إدخال اسم الحملة.');
            return;
        }

        const newCampaign: AdCampaign = {
            id: `camp-${crypto.randomUUID()}`,
            name: campaignName,
            platform: platform,
            status: CampaignStatus.Draft,
            budget: budget,
            dailyBudget: budget / 30, // Simple daily calc
            metrics: { spend: 0, roas: 0, cpa: 0, ctr: 0, impressions: 0 },
            goal: goal,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            creatives: creatives.length > 0 && selectedCreativeIndex > -1 ? [{
                id: `cr-${crypto.randomUUID()}`,
                ...creatives[selectedCreativeIndex]
            }] : [],
        };
        onCampaignCreated(newCampaign);
    };

    const renderPlatformSelector = () => (
        <div className="grid grid-cols-3 gap-4 mb-6">
            {Object.values(AdPlatform).map(p => {
                const asset = AD_PLATFORM_ASSETS[p];
                const isSelected = platform === p;
                return (
                    <button
                        key={p}
                        onClick={() => setPlatform(p)}
                        className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${isSelected ? 'border-brand-pink bg-brand-pink/10 shadow-lg' : 'border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg hover:border-gray-400'}`}
                    >
                        <i className={`${asset.icon} text-2xl mb-2`} style={{ color: asset.color }}></i>
                        <span className="font-bold text-sm text-light-text dark:text-dark-text">{p}</span>
                    </button>
                );
            })}
        </div>
    );

    const renderStep = () => {
        switch (step) {
            case 1: // Campaign Basics
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <label className="block text-sm font-bold text-light-text dark:text-dark-text mb-2">1. اختر المنصة الإعلانية</label>
                            {renderPlatformSelector()}
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-light-text dark:text-dark-text mb-2">2. اسم الحملة</label>
                            <input 
                                type="text" 
                                value={campaignName} 
                                onChange={e => setCampaignName(e.target.value)}
                                placeholder="مثال: حملة العودة للمدارس 2024"
                                className="w-full p-3 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg focus:ring-brand-pink focus:border-brand-pink text-light-text dark:text-dark-text"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-light-text dark:text-dark-text mb-2">3. هدف الحملة</label>
                            <div className="grid grid-cols-2 gap-3">
                                {campaignGoals.map(g => (
                                    <button key={g.key} onClick={() => setGoal(g.key)}
                                        className={`p-3 rounded-lg border text-right transition-colors flex items-center gap-3 ${goal === g.key ? 'bg-brand-primary/10 border-brand-primary text-brand-primary' : 'bg-light-bg dark:bg-dark-bg border-light-border dark:border-dark-border hover:border-gray-400 text-light-text dark:text-dark-text'}`}>
                                        <i className={`fas ${g.icon}`}></i>
                                        <span className="text-sm font-semibold">{g.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center justify-between bg-light-bg dark:bg-dark-bg p-3 rounded-lg border border-light-border dark:border-dark-border">
                             <div>
                                <p className="font-bold text-sm text-light-text dark:text-dark-text">تحسين ميزانية الحملة (CBO)</p>
                                <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">توزيع الميزانية تلقائيًا على المجموعات الإعلانية الأفضل أداءً.</p>
                             </div>
                             <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={campaignBudgetOptimization} onChange={e => setCampaignBudgetOptimization(e.target.checked)} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-brand-primary"></div>
                            </label>
                        </div>
                    </div>
                );
            case 2: // Targeting & Budget (Enhanced)
                return (
                    <div className="space-y-6 animate-fade-in">
                        {/* Budget & Schedule */}
                        <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg border border-light-border dark:border-dark-border">
                            <h3 className="font-bold text-brand-primary mb-3 border-b border-light-border dark:border-dark-border pb-2">الميزانية والجدول الزمني</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">الميزانية الإجمالية ($)</label>
                                    <input type="number" value={budget} onChange={e => setBudget(Number(e.target.value))} className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded text-light-text dark:text-dark-text" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">تاريخ البدء</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded text-light-text dark:text-dark-text" style={{ colorScheme: 'dark' }}/>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">تاريخ الانتهاء</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded text-light-text dark:text-dark-text" style={{ colorScheme: 'dark' }}/>
                                </div>
                            </div>
                        </div>

                        {/* Audience Definition */}
                        <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg border border-light-border dark:border-dark-border">
                            <h3 className="font-bold text-brand-primary mb-3 border-b border-light-border dark:border-dark-border pb-2">تعريف الجمهور</h3>
                            
                            <div className="space-y-4">
                                {/* Location */}
                                <div>
                                    <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">الموقع الجغرافي</label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {locations.map((loc, i) => (
                                            <span key={i} className="bg-brand-primary/20 text-brand-primary px-2 py-1 rounded text-xs flex items-center gap-1">
                                                {loc} <button onClick={() => setLocations(locations.filter(l => l !== loc))}>&times;</button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input type="text" value={newLocation} onChange={e => setNewLocation(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddLocation()} placeholder="أضف مدينة أو دولة..." className="flex-1 p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded text-sm text-light-text dark:text-dark-text" />
                                        <button onClick={handleAddLocation} className="px-3 bg-brand-secondary text-white rounded text-sm">+</button>
                                    </div>
                                </div>

                                {/* Demographics */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">العمر</label>
                                        <div className="flex items-center gap-2">
                                            <input type="number" min="13" max="65" value={ageRange.min} onChange={e => setAgeRange({...ageRange, min: Number(e.target.value)})} className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded text-center text-light-text dark:text-dark-text" />
                                            <span className="text-light-text-secondary dark:text-dark-text-secondary">-</span>
                                            <input type="number" min="13" max="65" value={ageRange.max} onChange={e => setAgeRange({...ageRange, max: Number(e.target.value)})} className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded text-center text-light-text dark:text-dark-text" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">الجنس</label>
                                        <div className="flex bg-light-card dark:bg-dark-card rounded border border-light-border dark:border-dark-border p-1">
                                            {['All', 'Men', 'Women'].map(g => (
                                                <button key={g} onClick={() => setGender(g as any)} className={`flex-1 text-xs py-1.5 rounded ${gender === g ? 'bg-brand-primary text-white' : 'text-light-text-secondary dark:text-dark-text-secondary'}`}>
                                                    {g === 'All' ? 'الكل' : g === 'Men' ? 'رجال' : 'نساء'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Detailed Targeting */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs font-bold text-light-text dark:text-dark-text">الاستهداف التفصيلي (اهتمامات، سلوكيات)</label>
                                        <button onClick={handleGenerateTargeting} disabled={isGeneratingInterests} className="text-xs text-brand-pink hover:underline flex items-center gap-1">
                                            {isGeneratingInterests ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>} اقتراح بالذكاء الاصطناعي
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-2 bg-light-card dark:bg-dark-card p-2 rounded border border-light-border dark:border-dark-border min-h-[40px]">
                                        {detailedTargeting.length === 0 && <span className="text-xs text-light-text-secondary dark:text-dark-text-secondary opacity-50">لا توجد اهتمامات محددة</span>}
                                        {detailedTargeting.map((tag, i) => (
                                            <span key={i} className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs flex items-center gap-1">
                                                {tag} <button onClick={() => setDetailedTargeting(detailedTargeting.filter(t => t !== tag))}>&times;</button>
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex gap-2">
                                        <input type="text" value={newInterest} onChange={e => setNewInterest(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddInterest()} placeholder="أضف اهتمامًا..." className="flex-1 p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded text-sm text-light-text dark:text-dark-text" />
                                        <button onClick={handleAddInterest} className="px-3 bg-brand-secondary text-white rounded text-sm">+</button>
                                    </div>
                                </div>

                                {/* Custom Audiences */}
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-light-border dark:border-dark-border">
                                    <div>
                                        <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">جمهور مخصص</label>
                                        <select value={customAudience} onChange={e => setCustomAudience(e.target.value)} className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded text-sm text-light-text dark:text-dark-text">
                                            <option value="None">بدون</option>
                                            <option value="Website Visitors">زوار الموقع (آخر 30 يوم)</option>
                                            <option value="Customer List">قائمة العملاء VIP</option>
                                            <option value="Engaged Users">المتفاعلون مع انستغرام</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-light-text dark:text-dark-text mb-1">جمهور مشابه (Lookalike)</label>
                                        <select value={lookalikeAudience} onChange={e => setLookalikeAudience(e.target.value)} className="w-full p-2 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded text-sm text-light-text dark:text-dark-text">
                                            <option value="None">بدون</option>
                                            <option value="Lookalike 1% - Purchase">مشابه 1% (مشترين)</option>
                                            <option value="Lookalike 5% - Traffic">مشابه 5% (زيارات)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            case 3: // AI Creative Studio (Enhanced)
                return (
                    <div className="space-y-6 animate-fade-in">
                        {/* Media Upload Section */}
                        <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg border border-light-border dark:border-dark-border">
                            <h4 className="font-bold text-light-text dark:text-dark-text mb-3">وسائط الإعلان (صور/فيديو)</h4>
                             <div className="grid grid-cols-4 gap-3">
                                {adMedia.map(m => (
                                    <div key={m.id} className="relative group aspect-square rounded-md overflow-hidden border border-light-border dark:border-dark-border">
                                        <img src={m.url} className="w-full h-full object-cover" alt="ad media" />
                                        <button onClick={() => handleRemoveMedia(m.id)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                            &times;
                                        </button>
                                    </div>
                                ))}
                                <button onClick={() => fileInputRef.current?.click()} className="aspect-square flex flex-col items-center justify-center bg-light-card dark:bg-dark-card border-2 border-dashed border-light-border dark:border-dark-border rounded-md hover:border-brand-primary text-light-text-secondary dark:text-dark-text-secondary hover:text-brand-primary transition-colors">
                                    <i className="fas fa-cloud-upload-alt text-2xl mb-1"></i>
                                    <span className="text-xs">رفع ميديا</span>
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleMediaUpload} multiple accept="image/*,video/*" className="hidden" />
                             </div>
                        </div>

                        {/* AI Text Generation */}
                        <div className="bg-brand-primary/5 border border-brand-primary/20 p-4 rounded-lg">
                            <h4 className="font-bold text-brand-primary mb-2 flex items-center gap-2">
                                <i className="fas fa-magic"></i> مولد النصوص الإعلانية
                            </h4>
                            <p className="text-sm text-light-text dark:text-dark-text mb-3">صف المنتج أو الخدمة لتوليد {platform === AdPlatform.TikTok ? 'سكريبت فيديو' : platform === AdPlatform.Google ? 'عناوين وأوصاف' : 'نصوص إعلانية'} مخصصة.</p>
                            <textarea value={productInfo} onChange={e => setProductInfo(e.target.value)}
                                placeholder="صف المنتج، العرض الخاص، والميزات الرئيسية..."
                                rows={3} className="w-full p-3 bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg text-light-text dark:text-dark-text focus:ring-brand-primary" />
                            <button onClick={handleGenerateCreatives} disabled={isGeneratingCreative} className="w-full mt-3 bg-gradient-to-r from-brand-pink to-brand-purple text-white font-bold py-2 rounded-lg shadow-lg disabled:opacity-70">
                                {isGeneratingCreative ? 'جاري التوليد...' : 'توليد نصوص مقترحة'}
                            </button>
                        </div>

                        {creatives.length > 0 && (
                            <div className="space-y-3 max-h-60 overflow-y-auto">
                                <h5 className="font-bold text-sm text-light-text dark:text-dark-text">خيارات النصوص (اختر الأفضل):</h5>
                                {creatives.map((cr, index) => (
                                    <div key={index} onClick={() => setSelectedCreativeIndex(index)}
                                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${selectedCreativeIndex === index ? 'border-brand-pink bg-brand-pink/5' : 'border-light-border dark:border-dark-border bg-light-bg dark:bg-dark-bg hover:border-gray-400'}`}>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-xs font-bold text-brand-secondary">خيار {index + 1}</span>
                                            {selectedCreativeIndex === index && <i className="fas fa-check-circle text-brand-pink"></i>}
                                        </div>
                                        <p className="font-bold text-light-text dark:text-dark-text text-sm">{cr.headline}</p>
                                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1 whitespace-pre-wrap">{cr.primaryText}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            case 4: // Review
                const platformAsset = AD_PLATFORM_ASSETS[platform];
                 return (
                    <div className="space-y-4 animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg border border-light-border dark:border-dark-border text-sm space-y-2">
                                <h4 className="font-bold border-b border-light-border dark:border-dark-border pb-1 mb-2 text-light-text dark:text-dark-text">تفاصيل الحملة</h4>
                                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">الاسم:</span> <span className="font-bold text-light-text dark:text-dark-text">{campaignName}</span></div>
                                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">المنصة:</span> <span className="font-bold flex items-center gap-2"><i className={platformAsset.icon} style={{color: platformAsset.color}}></i> {platform}</span></div>
                                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">الهدف:</span> <span className="font-bold text-light-text dark:text-dark-text">{goal}</span></div>
                                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">الميزانية:</span> <span className="font-bold text-light-text dark:text-dark-text">${budget}</span></div>
                            </div>
                            <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg border border-light-border dark:border-dark-border text-sm space-y-2">
                                <h4 className="font-bold border-b border-light-border dark:border-dark-border pb-1 mb-2 text-light-text dark:text-dark-text">الجمهور والاستهداف</h4>
                                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">الموقع:</span> <span className="font-bold text-light-text dark:text-dark-text">{locations[0]} {locations.length > 1 && `+${locations.length - 1}`}</span></div>
                                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">العمر/الجنس:</span> <span className="font-bold text-light-text dark:text-dark-text">{ageRange.min}-{ageRange.max} / {gender}</span></div>
                                <div className="flex justify-between"><span className="text-light-text-secondary dark:text-dark-text-secondary">الاهتمامات:</span> <span className="font-bold text-light-text dark:text-dark-text">{detailedTargeting.length > 0 ? `${detailedTargeting.length} محددة` : 'عام'}</span></div>
                            </div>
                        </div>

                        <div className="border-t border-light-border dark:border-dark-border pt-4">
                            <h4 className="font-bold text-light-text dark:text-dark-text mb-2 text-center">معاينة الإعلان</h4>
                             {selectedCreativeIndex > -1 ? (
                               <div className="bg-white dark:bg-black border border-gray-200 dark:border-gray-800 p-4 rounded-lg shadow-sm max-w-xs mx-auto">
                                    {/* Mock Platform Header */}
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                                        <div>
                                            <div className="w-24 h-2 bg-gray-300 rounded mb-1"></div>
                                            <div className="w-12 h-2 bg-gray-200 rounded"></div>
                                        </div>
                                    </div>
                                    {/* Ad Content */}
                                    {platform === AdPlatform.Google ? (
                                        <div className="space-y-1">
                                            <p className="text-blue-600 dark:text-blue-400 font-bold text-lg leading-tight hover:underline cursor-pointer">{creatives[selectedCreativeIndex].headline}</p>
                                            <div className="flex gap-1 text-xs text-green-700 dark:text-green-500 font-bold">
                                                <span className="border border-green-600 rounded px-1">Ad</span>
                                                <span>example.com</span>
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-gray-400">{creatives[selectedCreativeIndex].primaryText}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-3">{creatives[selectedCreativeIndex].primaryText}</p>
                                            <div className="w-full h-48 bg-gray-200 dark:bg-gray-800 rounded flex items-center justify-center text-gray-400 mb-2 overflow-hidden">
                                                {adMedia.length > 0 ? (
                                                    <img src={adMedia[0].url} className="w-full h-full object-cover" alt="Ad media"/>
                                                ) : (
                                                    <i className="fas fa-image text-3xl"></i>
                                                )}
                                            </div>
                                            <div className="bg-gray-100 dark:bg-gray-900 p-2 rounded flex justify-between items-center">
                                                <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{creatives[selectedCreativeIndex].headline}</span>
                                                <button className="bg-gray-300 dark:bg-gray-700 px-3 py-1 rounded text-xs font-bold">Learn More</button>
                                            </div>
                                        </>
                                    )}
                               </div>
                           ) : <p className="text-center text-red-400">لم يتم تحديد محتوى للإعلان.</p>}
                        </div>
                    </div>
                );
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <style>{`
                @keyframes fade-in { 0% { opacity: 0; transform: translateY(10px); } 100% { opacity: 1; transform: translateY(0); } }
                .animate-fade-in { animation: fade-in 0.3s ease-out; }
            `}</style>
            <div className="bg-light-card dark:bg-dark-card rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-light-border dark:border-dark-border flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-light-text dark:text-dark-text">إنشاء حملة إعلانية جديدة</h2>
                        <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary mt-1">خطوة {step} من 4: {steps[step-1]}</p>
                    </div>
                    <button onClick={onClose} className="text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text dark:hover:text-dark-text text-2xl">&times;</button>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-light-bg dark:bg-dark-bg h-1.5">
                    <div className="bg-brand-pink h-1.5 transition-all duration-300" style={{ width: `${(step / 4) * 100}%` }}></div>
                </div>

                <div className="p-6 overflow-y-auto flex-grow">
                    {renderStep()}
                </div>
                
                <div className="p-4 bg-light-bg/50 dark:bg-dark-bg/50 border-t border-light-border dark:border-dark-border flex justify-between items-center rounded-b-xl">
                    <button 
                        onClick={() => setStep(s => s - 1)} 
                        disabled={step === 1} 
                        className="text-light-text-secondary dark:text-dark-text-secondary font-bold py-2 px-4 rounded-lg hover:bg-light-card dark:hover:bg-dark-card disabled:opacity-30"
                    >
                        السابق
                    </button>
                    {step < 4 ? (
                        <button 
                            onClick={() => setStep(s => s + 1)} 
                            disabled={step === 1 && !campaignName}
                            className="bg-brand-primary text-white font-bold py-2 px-8 rounded-lg shadow hover:bg-brand-secondary disabled:bg-gray-500"
                        >
                            التالي
                        </button>
                    ) : (
                        <button onClick={handleFinalSubmit} className="bg-green-600 text-white font-bold py-2 px-8 rounded-lg shadow hover:bg-green-700">
                            <i className="fas fa-rocket me-2"></i>إطلاق الحملة
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
