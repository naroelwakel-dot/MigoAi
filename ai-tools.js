// ==============================================================================
// باقات الذكاء الاصطناعي و مفاتيح APIs
// ==============================================================================

const aiProducts = [
    // عائلة كلود (Claude AI)
    { id: 'ai_claude_max5', name: 'Claude Max 5x', tag: '5 أضعاف Pro', price: 4340, desc: 'حساب خاص مفعل على بريدك وبدون VPN' },
    { id: 'ai_claude_max20', name: 'Claude Max 20x', tag: 'الاستخدام الأقصى 20x', price: 9200, desc: 'أعلى باقة للشركات بدون حدود إرسال' },
    { id: 'ai_claude_pro', name: 'Claude AI Pro', tag: 'شهر واحد', price: 1200, desc: 'تفعيل رسمي على إيميلك الشخصي مباشرة' },
    { id: 'ai_claude_team', name: 'Claude Team Workspace', tag: 'فريق عمل', price: 2900, desc: 'مساحة عمل مخصصة لفريقك حتى 5 أعضاء' },
    
    // مفاتيح الـ API للمطورين
    { id: 'ai_api_claude10', name: 'API Claude 10M Tokens', tag: 'يومي للمطورين', price: 75, desc: 'تسليم فوري للمفتاح مخصص للبرمجة' },
    { id: 'ai_api_claude50', name: 'API Claude 50M Tokens', tag: 'توكنز مرتفعة', price: 210, desc: 'صلاحية يومين للاستخدام المكثف' },
    { id: 'ai_api_claude_100', name: 'API Claude 30D $100', tag: 'رصيد 100 دولار', price: 150, desc: 'صلاحية شهر كامل لدعم مشاريعك' },
    { id: 'ai_api_codex10', name: 'API CODEX 10M Tokens', tag: 'أكواد وبرمجة', price: 75, desc: 'مخصص لمحررات الأكواد والمطورين' },
    { id: 'ai_api_codex50', name: 'API CODEX 50M Tokens', tag: 'توكنز برمجية 50M', price: 185, desc: 'صلاحية يومين مع دعم كامل' },
    { id: 'ai_api_codex100', name: 'API CODEX 100M Tokens', tag: 'توكنز برمجية 100M', price: 310, desc: 'صلاحية 3 أيام للمشاريع الكبيرة' },

    // محركات ومساعدات المطورين والبحث
    { id: 'ai_github_copilot', name: 'GitHub Copilot (شهر)', tag: 'مساعد البرمجة الذكي', price: 420, desc: 'إكمال الأكواد البرمجية وتحليل الأخطاء داخل VS Code مباشرة' },
    { id: 'ai_cursor_pro', name: 'Cursor AI Pro', tag: 'محرر المبرمجين الذكي', price: 1250, desc: 'أقوى IDE برمجي مدعوم بالذكاء الاصطناعي لكتابة المشاريع' },
    { id: 'ai_chatgpt', name: 'ChatGPT Plus (شهر)', tag: 'GPT-4o الأصلي', price: 480, desc: 'حساب مفعل بكامل مميزات التحليل، التصفح وتوليد الصور DALL-E' },
    { id: 'ai_perplexity_pro', name: 'Perplexity Pro', tag: 'محرك البحث الذكي', price: 450, desc: 'بحث علمي وتحليلي متقدم مع Claude 3.5 و GPT-4o' },
    { id: 'ai_super_grok', name: 'Super Grok (xAI)', tag: 'إيلون ماسك الذكي', price: 980, desc: 'اشتراك رسمي في أقوى نماذج Grok غير المقيدة' },

    // الصوت، الموسيقى، والصور
    { id: 'ai_midjourney_std', name: 'Midjourney Standard', tag: 'توليد الصور الاحترافي', price: 1850, desc: 'ساعات Fast كاملة وتوليد صور غير محدود في وضع Relax' },
    { id: 'ai_midjourney_pro', name: 'Midjourney Pro', tag: 'وضع التخفي (Stealth)', price: 3700, desc: 'الوضع السري وحرية تجارية كاملة للمصممين والشركات' },
    { id: 'ai_suno_pro', name: 'Suno AI Pro (شهر)', tag: 'إنتاج الأغاني والموسيقى', price: 620, desc: '2,500 نقطة (500 أغنية) مع حقوق الملكية التجارية الكاملة' },
    { id: 'ai_elevenlabs', name: 'ElevenLabs Creator', tag: 'دوبلاج وأصوات AI', price: 1350, desc: '100,000 حرف شهرياً واستنساخ الأصوات بدقة بشرية فائقة' },
    { id: 'ai_muse', name: 'Muse AI', tag: 'توليد ومونتاج ذكي', price: 140, desc: 'حساب كامل مخصص للإنتاج المرئي' }
];
