// services/seoAuditService.ts
import { TechnicalSEOAuditResult, AuditIssue } from '../types';

export async function runTechnicalSEOAudit(url: string): Promise<TechnicalSEOAuditResult> {
    // Simulate a longer API call for a comprehensive audit
    await new Promise(res => setTimeout(res, 3500));
    
    // Simulate some issues based on the URL for variety
    const hasHttp = url.includes('http:');
    const hasSlowParam = url.includes('slow');

    const crawlingIssues: AuditIssue[] = [];
    if (hasHttp) {
        crawlingIssues.push({
            id: 'cr-1',
            severity: 'error',
            title: 'الموقع لا يستخدم HTTPS',
            description: 'تم العثور على صفحات يتم تقديمها عبر بروتوكول HTTP غير الآمن.',
            recommendation: 'قم بترحيل موقعك بالكامل إلى HTTPS لتأمين بيانات المستخدمين وتحسين ثقة محركات البحث.'
        });
    }
    crawlingIssues.push({
        id: 'cr-2',
        severity: 'warning',
        title: '3 صفحات تحتوي على وسم "noindex"',
        description: 'هذه الصفحات لن يتم فهرستها بواسطة محركات البحث، مما قد يكون مقصودًا أو غير مقصود.',
        recommendation: 'راجع الصفحات ذات وسم "noindex" وتأكد من أنك لا تمنع فهرسة محتوى مهم عن طريق الخطأ.'
    });

    const performanceIssues: AuditIssue[] = [];
    if (hasSlowParam) {
        performanceIssues.push({
            id: 'pf-1',
            severity: 'error',
            title: 'حجم DOM كبير جدًا',
            description: 'تحتوي بعض الصفحات على عدد كبير من عناصر DOM، مما يبطئ من سرعة العرض والتفاعل.',
            recommendation: 'حاول تبسيط بنية الصفحة، وإزالة العناصر غير الضرورية، واستخدام التحميل الكسول (lazy loading) للأقسام غير الظاهرة.'
        });
    }
     performanceIssues.push({
        id: 'pf-2',
        severity: 'warning',
        title: 'بعض الصور غير مضغوطة',
        description: 'تم العثور على 8 صور يمكن ضغطها بشكل أفضل لتوفير حوالي 450 كيلوبايت.',
        recommendation: 'استخدم أدوات ضغط الصور أو صيغ الصور الحديثة مثل WebP/AVIF لتقليل حجم الملفات وتسريع التحميل.'
    });

    const structuredDataIssues: AuditIssue[] = [
        {
            id: 'sd-1',
            severity: 'warning',
            title: 'بيانات Article Schema مفقودة',
            description: 'هناك 5 مقالات لا تحتوي على بيانات منظمة من نوع "Article"، مما يضيع فرصة الظهور بشكل مميز في نتائج البحث.',
            recommendation: 'أضف Article schema لجميع مقالات المدونة لتزويد محركات البحث بسياق أفضل حول المحتوى.'
        }
    ];

    const overallScore = 100 - (crawlingIssues.length * 5) - (performanceIssues.length * 8) - (structuredDataIssues.length * 4);

    return {
        overallScore: Math.max(0, overallScore),
        url: url,
        auditedAt: new Date(),
        crawling: {
            totalUrls: 542,
            status200: 530,
            status301: 8,
            status404: 4,
            issues: crawlingIssues,
        },
        performance: {
            vitals: {
                lcp: { value: hasSlowParam ? 3.1 : 2.2, rating: hasSlowParam ? 'poor' : 'good' },
                cls: { value: 0.15, rating: 'average' },
                inp: { value: 180, rating: 'good' },
            },
            issues: performanceIssues,
        },
        structuredData: {
            typesFound: ['Organization', 'Website', 'Product', 'BreadcrumbList'],
            issues: structuredDataIssues,
        },
    };
}