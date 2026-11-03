import { uiLocale } from "@/i18n";

export const TRUST_CATEGORY_KEYS = ['hosting', 'warranty', 'security', 'audit'] as const;
export type TrustCategoryKey = typeof TRUST_CATEGORY_KEYS[number];

export function trustResources(locale: string) {
  const copy = ({
    zh: {
      disclosures: "平台信息", pending: "资料尚未发布", viewDocument: "查看资料", categoryTitles: ["设备托管", "保修与售后", "账户与资金安全", "审计与储备证明"],
      about: "关于 UVEL", headline: "了解平台，再参与", subtitle: "平台说明、服务条款与风险信息，集中查看。", resources: "规则与资料", data: "平台运行数据", documents: "公开资料",
      items: [["UVT 使用说明", "获取、使用与相关规则"], ["服务条款", "服务范围、费用与你的权利"], ["隐私政策", "个人信息的使用与保护"], ["风险披露", "参与前了解适用风险与限制"]],
    },
    en: {
      disclosures: "Platform information", pending: "Documents not yet published", viewDocument: "View document", categoryTitles: ["Device hosting", "Warranty and after-sales", "Account and fund security", "Audits and reserves"],
      about: "About UVEL", headline: "Understand before you participate", subtitle: "Platform information, terms and risks in one place.", resources: "Rules and resources", data: "Platform activity", documents: "Published documents",
      items: [["UVT guide", "How to earn and use UVT, and applicable rules"], ["Terms of service", "Service scope, fees and your rights"], ["Privacy policy", "How personal information is used and protected"], ["Risk disclosure", "Review applicable risks and limitations"]],
    },
    vi: {
      disclosures: "Thông tin nền tảng", pending: "Tài liệu chưa được công bố", viewDocument: "Xem tài liệu", categoryTitles: ["Lưu trữ thiết bị", "Bảo hành và hậu mãi", "An toàn tài khoản và tiền", "Kiểm toán và dự trữ"],
      about: "Về UVEL", headline: "Tìm hiểu trước khi tham gia", subtitle: "Thông tin nền tảng, điều khoản và rủi ro tại một nơi.", resources: "Quy tắc và tài liệu", data: "Hoạt động nền tảng", documents: "Tài liệu công khai",
      items: [["Hướng dẫn UVT", "Cách nhận, sử dụng và các quy tắc liên quan"], ["Điều khoản dịch vụ", "Phạm vi dịch vụ, phí và quyền người dùng"], ["Chính sách quyền riêng tư", "Cách sử dụng và bảo vệ thông tin cá nhân"], ["Công bố rủi ro", "Rủi ro và giới hạn cần biết trước khi tham gia"]],
    },
    id: {
      disclosures: "Informasi platform", pending: "Dokumen belum diterbitkan", viewDocument: "Lihat dokumen", categoryTitles: ["Pengelolaan perangkat", "Garansi dan purnajual", "Keamanan akun dan dana", "Audit dan bukti cadangan"],
      about: "Tentang UVEL", headline: "Pahami platformnya sebelum ikut serta", subtitle: "Informasi platform, ketentuan, dan risiko di satu tempat.", resources: "Aturan dan dokumen", data: "Aktivitas platform", documents: "Dokumen yang diterbitkan",
      items: [["Panduan UVT", "Cara mendapatkan dan memakai UVT, serta aturan yang berlaku"], ["Ketentuan layanan", "Cakupan layanan, biaya, dan hak Anda"], ["Kebijakan privasi", "Cara informasi pribadi dipakai dan dilindungi"], ["Pengungkapan risiko", "Tinjau risiko dan batasan yang berlaku"]],
    },
    ms: {
      disclosures: "Maklumat platform", pending: "Dokumen belum diterbitkan", viewDocument: "Lihat dokumen", categoryTitles: ["Pengehosan peranti", "Waranti dan selepas jualan", "Keselamatan akaun dan dana", "Audit dan rizab"],
      about: "Tentang UVEL", headline: "Fahami platform sebelum menyertai", subtitle: "Maklumat platform, terma dan risiko di satu tempat.", resources: "Peraturan dan sumber", data: "Aktiviti platform", documents: "Dokumen diterbitkan",
      items: [["Panduan UVT", "Cara memperoleh dan menggunakan UVT, serta peraturannya"], ["Terma perkhidmatan", "Skop perkhidmatan, caj dan hak anda"], ["Dasar privasi", "Cara maklumat peribadi digunakan dan dilindungi"], ["Pendedahan risiko", "Semak risiko dan had yang terpakai"]],
    },
    fil: {
      disclosures: "Impormasyon ng platform", pending: "Hindi pa nailalathala ang dokumento", viewDocument: "Buksan", categoryTitles: ["Hosting ng device", "Warranty at after-sales", "Seguridad ng account at pondo", "Audit at reserba"],
      about: "Tungkol sa UVEL", headline: "Unawain muna bago sumali", subtitle: "Impormasyon ng platform, terms at panganib sa iisang lugar.", resources: "Patakaran at resources", data: "Aktibidad ng platform", documents: "Inilathalang dokumento",
      items: [["Gabay sa UVT", "Paano kumuha at gumamit ng UVT, at ang mga patakaran"], ["Tuntunin ng serbisyo", "Saklaw ng serbisyo, fee at mga karapatan mo"], ["Patakaran sa privacy", "Paano ginagamit at pinoprotektahan ang personal na impormasyon"], ["Paalala sa panganib", "Alamin ang naaangkop na panganib at limitasyon bago sumali"]],
    },
    ru: {
      disclosures: "О платформе", pending: "Документы ещё не опубликованы", viewDocument: "Открыть", categoryTitles: ["Размещение устройств", "Гарантия и обслуживание", "Безопасность аккаунта и средств", "Аудиты и резервы"],
      about: "Об UVEL", headline: "Узнайте больше, прежде чем участвовать", subtitle: "Сведения о платформе, условия и риски — в одном месте.", resources: "Правила и материалы", data: "Активность платформы", documents: "Опубликованные документы",
      items: [["Об UVT", "Как получить и использовать UVT, правила"], ["Условия использования", "Объём услуг, комиссии и ваши права"], ["Конфиденциальность", "Как используются и защищаются личные данные"], ["Информация о рисках", "Риски и ограничения перед участием"]],
    },
    kk: {
      disclosures: "Платформа ақпараты", pending: "Құжаттар әлі жарияланбаған", viewDocument: "Құжатты қарау", categoryTitles: ["Құрылғы хостингі", "Кепілдік және сатудан кейінгі қызмет", "Аккаунт пен қаражат қауіпсіздігі", "Аудит және резервтер"],
      about: "UVEL туралы", headline: "Қатыспас бұрын түсініп алыңыз", subtitle: "Платформа ақпараты, шарттар мен тәуекелдер — бір жерде.", resources: "Ережелер мен ресурстар", data: "Платформа белсенділігі", documents: "Жарияланған құжаттар",
      items: [["UVT нұсқаулығы", "UVT-ні табу, қолдану және ережелер"], ["Қызмет шарттары", "Қызмет аясы, ақылар және сіздің құқықтарыңыз"], ["Құпиялылық саясаты", "Жеке ақпарат қалай қолданылады және қорғалады"], ["Тәуекелдер туралы ақпарат", "Қолданылатын тәуекелдер мен шектеулерді қараңыз"]],
    },
    uz: {
      disclosures: "Platforma maʼlumotlari", pending: "Hujjatlar hali eʼlon qilinmagan", viewDocument: "Hujjatni koʻrish", categoryTitles: ["Qurilma xostingi", "Kafolat va xariddan keyingi xizmat", "Akkaunt va mablagʻ xavfsizligi", "Auditlar va zaxiralar"],
      about: "UVEL haqida", headline: "Qatnashishdan oldin tanishing", subtitle: "Platforma maʼlumotlari, shartlar va xatarlar — bir joyda.", resources: "Qoidalar va hujjatlar", data: "Platforma faolligi", documents: "Eʼlon qilingan hujjatlar",
      items: [["UVT qoʻllanmasi", "UVT qanday olinadi va ishlatiladi, tegishli qoidalar"], ["Xizmat shartlari", "Xizmat doirasi, komissiyalar va huquqlaringiz"], ["Maxfiylik siyosati", "Shaxsiy maʼlumotlar qanday ishlatiladi va himoyalanadi"], ["Xatarlar haqida", "Amaldagi xatarlar va cheklovlar bilan tanishing"]],
    },
  })[uiLocale(locale)];
  const paths = ["/pages/trust/nex", "/pages/onboarding/terms", "/pages/onboarding/privacy", "/pages/me/risk-disclosure"];
  return { ...copy, categories: TRUST_CATEGORY_KEYS.map((key,index) => ({key,title:copy.categoryTitles[index]})), items: copy.items.map(([title, body], i) => ({ title, body, href: paths[i] })) };
}
