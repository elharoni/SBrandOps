import React, { useState, useEffect, useCallback } from 'react';
import { GBPData, GBPPost, GBPPostCTA, GBPQuestion, GBPReview, NotificationType } from '../../types';
import { addGBPPost, answerGBPQuestion, replyToGBPReview } from '../../services/gbpService';

interface LocalSEOManagerProps {
    addNotification: (type: NotificationType, message: string) => void;
    initialData: GBPData;
    brandId: string;
}

const InfoCard: React.FC<{ info: GBPData['info'] }> = ({ info }) => (
    <div className="bg-light-bg dark:bg-dark-bg p-4 rounded-lg border border-light-border dark:border-dark-border">
        <h4 className="font-bold text-light-text dark:text-dark-text mb-3">معلومات النشاط التجاري</h4>
        <div className="space-y-2 text-sm">
            <p><strong className="text-light-text-secondary dark:text-dark-text-secondary w-20 inline-block">الاسم:</strong> {info.name}</p>
            <p><strong className="text-light-text-secondary dark:text-dark-text-secondary w-20 inline-block">العنوان:</strong> {info.address}</p>
            <p><strong className="text-light-text-secondary dark:text-dark-text-secondary w-20 inline-block">الهاتف:</strong> {info.phone}</p>
            <p><strong className="text-light-text-secondary dark:text-dark-text-secondary w-20 inline-block">الموقع:</strong> <a href={info.website} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline">{info.website}</a></p>
        </div>
    </div>
);

const RatingStars: React.FC<{ rating: number }> = ({ rating }) => (
    <div className="flex items-center">
        {[...Array(5)].map((_, i) => (
            <i key={i} className={`fas fa-star ${i < rating ? 'text-yellow-400' : 'text-gray-400 dark:text-gray-600'}`}></i>
        ))}
    </div>
);


export const LocalSEOManager: React.FC<LocalSEOManagerProps> = ({ addNotification, initialData, brandId }) => {
    const [gbpData, setGbpData] = useState<GBPData | null>(initialData);
    
    // States for forms
    const [newPostContent, setNewPostContent] = useState('');
    const [newPostCta, setNewPostCta] = useState<GBPPostCTA>(GBPPostCTA.LearnMore);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [replies, setReplies] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState<string | null>(null); // To track which item is submitting

    useEffect(() => {
        const processedData: GBPData = {
            ...initialData,
            posts: initialData.posts.map(post => ({
                ...post,
                createdAt: new Date(post.createdAt as unknown as string),
            })),
            reviews: initialData.reviews.map(review => ({
                ...review,
                createdAt: new Date(review.createdAt as unknown as string),
            })),
        };
        setGbpData(processedData);
    }, [initialData]);

    const refreshData = useCallback(async () => {
        try {
            const { getGBPData } = await import('../../services/gbpService');
            const freshData = await getGBPData(brandId);
            setGbpData(freshData);
            addNotification(NotificationType.Info, "تم تحديث بيانات GBP.");
        } catch {
            addNotification(NotificationType.Error, "فشل تحديث البيانات.");
        }
    }, [brandId, addNotification]);

    const handleCreatePost = async () => {
        if (!newPostContent.trim()) {
            addNotification(NotificationType.Warning, 'محتوى المنشور لا يمكن أن يكون فارغًا.');
            return;
        }
        setIsSubmitting('new-post');
        try {
            await addGBPPost(brandId, { content: newPostContent, cta: newPostCta });
            addNotification(NotificationType.Success, 'تم نشر منشور GBP بنجاح.');
            setNewPostContent('');
            void refreshData();
        } catch (e) {
            addNotification(NotificationType.Error, 'فشل في نشر منشور GBP.');
        } finally {
            setIsSubmitting(null);
        }
    };

    const handleAnswerQuestion = async (questionId: string) => {
        const answerText = answers[questionId];
        if (!answerText || !answerText.trim()) return;
        setIsSubmitting(questionId);
        try {
            await answerGBPQuestion(brandId, questionId, answerText);
            addNotification(NotificationType.Success, 'تمت إضافة الإجابة بنجاح.');
            setAnswers(prev => ({...prev, [questionId]: ''}));
            void refreshData();
        } catch (e) {
            addNotification(NotificationType.Error, 'فشل في إضافة الإجابة.');
        } finally {
            setIsSubmitting(null);
        }
    };
    
    const handleReplyToReview = async (reviewId: string) => {
        const replyText = replies[reviewId];
        if (!replyText || !replyText.trim()) return;
        setIsSubmitting(reviewId);
        try {
            await replyToGBPReview(brandId, reviewId, replyText);
            addNotification(NotificationType.Success, 'تمت إضافة الرد بنجاح.');
            setReplies(prev => ({...prev, [reviewId]: ''}));
            void refreshData();
        } catch (e) {
            addNotification(NotificationType.Error, 'فشل في إضافة الرد.');
        } finally {
            setIsSubmitting(null);
        }
    };


    if (!gbpData) {
        return <p className="text-center py-10 text-red-400">لا يمكن عرض بيانات GBP.</p>;
    }

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="space-y-6">
                <InfoCard info={gbpData.info} />
                {/* GBP Posts */}
                <div className="bg-light-card dark:bg-dark-card p-4 rounded-lg border border-light-border dark:border-dark-border">
                    <h3 className="font-bold text-light-text dark:text-dark-text mb-3 flex items-center"><i className="fas fa-bullhorn me-2 text-green-400"></i>منشورات Google</h3>
                    <div className="space-y-3 bg-light-bg dark:bg-dark-bg p-3 rounded-md">
                        <textarea
                            value={newPostContent}
                            onChange={(e) => setNewPostContent(e.target.value)}
                            placeholder="ما الجديد؟ اكتب منشورك هنا..."
                            rows={3}
                            className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg p-2 focus:ring-brand-primary focus:border-brand-primary"
                        />
                        <div className="flex justify-between items-center">
                            <select value={newPostCta} onChange={e => setNewPostCta(e.target.value as GBPPostCTA)} className="bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg py-2 px-3 text-sm focus:ring-brand-primary focus:border-brand-primary">
                                {Object.values(GBPPostCTA).map(cta => <option key={cta} value={cta}>{cta}</option>)}
                            </select>
                            <button onClick={handleCreatePost} disabled={isSubmitting === 'new-post'} className="bg-brand-primary hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-500">
                                {isSubmitting === 'new-post' ? 'جارٍ النشر...' : 'نشر'}
                            </button>
                        </div>
                    </div>
                     <div className="mt-4 space-y-3 max-h-60 overflow-y-auto pr-2">
                        {gbpData.posts.map(post => (
                            <div key={post.id} className="bg-light-bg dark:bg-dark-bg p-3 rounded-md">
                                <p className="text-sm text-light-text dark:text-dark-text">{post.content}</p>
                                <div className="flex justify-between items-center mt-2 text-xs">
                                    <span className="text-light-text-secondary dark:text-dark-text-secondary">{post.createdAt.toLocaleDateString('ar-EG')}</span>
                                    <span className="font-bold text-brand-secondary">{post.cta}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                 {/* Reviews */}
                <div className="bg-light-card dark:bg-dark-card p-4 rounded-lg border border-light-border dark:border-dark-border">
                     <h3 className="font-bold text-light-text dark:text-dark-text mb-3 flex items-center"><i className="fas fa-star-half-alt me-2 text-yellow-400"></i>المراجعات</h3>
                     <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                         {gbpData.reviews.map(review => (
                             <div key={review.id} className="bg-light-bg dark:bg-dark-bg p-3 rounded-md">
                                 <div className="flex justify-between items-center">
                                    <span className="font-bold text-light-text dark:text-dark-text">{review.author}</span>
                                    <RatingStars rating={review.rating} />
                                 </div>
                                 <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary my-2 italic">"{review.comment}"</p>
                                 {review.reply ? (
                                     <div className="border-t border-light-border dark:border-dark-border pt-2 mt-2">
                                         <p className="text-xs font-bold text-light-text dark:text-dark-text">ردك:</p>
                                         <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{review.reply}</p>
                                     </div>
                                 ) : (
                                     <div className="flex items-center gap-2 mt-2">
                                        <input type="text" value={replies[review.id] || ''} onChange={e => setReplies(prev => ({...prev, [review.id]: e.target.value}))} placeholder="اكتب ردك..." className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg p-1 text-sm"/>
                                        <button onClick={() => handleReplyToReview(review.id)} disabled={isSubmitting === review.id} className="text-xs bg-brand-secondary text-white px-3 py-1 rounded-lg flex-shrink-0">رد</button>
                                     </div>
                                 )}
                             </div>
                         ))}
                     </div>
                </div>
                 {/* Q&A */}
                <div className="bg-light-card dark:bg-dark-card p-4 rounded-lg border border-light-border dark:border-dark-border">
                     <h3 className="font-bold text-light-text dark:text-dark-text mb-3 flex items-center"><i className="fas fa-question-circle me-2 text-blue-400"></i>الأسئلة والأجوبة</h3>
                      <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                         {gbpData.questions.map(q => (
                             <div key={q.id} className="bg-light-bg dark:bg-dark-bg p-3 rounded-md">
                                <p className="text-sm text-light-text-secondary dark:text-dark-text-secondary"><strong className="text-light-text dark:text-dark-text">{q.author}:</strong> "{q.questionText}"</p>
                                 {q.answerText ? (
                                     <div className="border-t border-light-border dark:border-dark-border pt-2 mt-2">
                                         <p className="text-xs font-bold text-light-text dark:text-dark-text">إجابتك:</p>
                                         <p className="text-xs text-light-text-secondary dark:text-dark-text-secondary">{q.answerText}</p>
                                     </div>
                                 ) : (
                                     <div className="flex items-center gap-2 mt-2">
                                        <input type="text" value={answers[q.id] || ''} onChange={e => setAnswers(prev => ({...prev, [q.id]: e.target.value}))} placeholder="أجب على السؤال..." className="w-full bg-light-card dark:bg-dark-card border border-light-border dark:border-dark-border rounded-lg p-1 text-sm"/>
                                        <button onClick={() => handleAnswerQuestion(q.id)} disabled={isSubmitting === q.id} className="text-xs bg-brand-secondary text-white px-3 py-1 rounded-lg flex-shrink-0">أجب</button>
                                     </div>
                                 )}
                             </div>
                         ))}
                     </div>
                </div>
            </div>
        </div>
    );
};