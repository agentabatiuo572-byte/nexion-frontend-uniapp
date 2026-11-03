import { platformDisplayText } from "./brand-copy";
import { formatGroupedAmount as formatAmount } from "./amount-display";
import type { HowContentDocument } from "@/api/how-content-api";
import type { CommissionGuideRates, CommissionGuideRules } from "@/api/commission-guide-api";
import type { DirectReferralPolicy, DirectReferralRule } from "@/api/direct-referral-api";
import type { CanonicalVRankRow } from "@/api/v-rank-api";
import { formatHowNumber } from "./rank-how-content";
import { uiLocale } from "@/i18n";

export interface CommissionsHowSnapshot { document: HowContentDocument; rates?: CommissionGuideRates; directPolicy: DirectReferralPolicy; guide: CommissionGuideRules; ranks: CanonicalVRankRow[] }
// Keep public settlement facts; current direct policy values come from the server.
const COPY = {
  zh: {
    purchaseBudget: "好友购买奖励比例", purchaseReplacement: "奖励中的 UVT 部分已包含该笔购买的额外 UVT 奖励，不重复发放", purchaseOriginal: "好友购买和团队购买奖励按当前规则发放", networkPurchase: "团队购买奖励含额外 UVT 奖励，以实际发放为准", deviceScope: "好友设备收益奖励只发给邀请人，由平台额外发放，不影响好友自己的收益",
    loading: "正在加载说明…", unavailable: "说明暂时无法加载，请重新加载。", missing: "规则暂时无法加载", none: "暂无可展示的奖励", retry: "重新加载",
    days: "天", settlementPeriod: "发放周期", minRank: "参与起点",
    daily: "每日", weekly: "每周", monthly: "每月", paused: "已暂停", unpaused: "正常发放",
    hold: "团队激励池暂未开放发放", unsupported: "暂未开放", supported: "以实际发放为准",
    network: "团队奖励以实际发放为准。", records: "奖励以实际发放为准。", cultivation: "好友升级奖励以实际发放为准。",
    exampleScope: "以下金额仅作算例，不代表个人收益。假设订单基数：", exampleNetwork: "团队奖励算例", exampleCultivation: "好友升级奖励算例，不代表个人到账金额",
    noTotal: "非实际收益合计", pendingAmount: "待发放", unknownAmount: "—", base: "假设订单基数", configured: "奖励标准", notOpen: "未开放", notConfigured: "暂不可用",
    purchase: "好友购买", deviceEarning: "好友设备收益", totalRate: "总奖励比例", split: "奖励拆分", directOnly: "仅限你邀请的好友；由平台额外发放，不影响好友自己的收益", priceUnavailable: "UVT 价格暂时无法获取，稍后计入",
  },
  en: {
    purchaseBudget: "Friend purchase reward rate", purchaseReplacement: "The UVT share already includes this purchase's extra UVT reward; it isn't paid twice", purchaseOriginal: "Friend and team purchase rewards are paid under the current rules", networkPurchase: "Team purchase rewards include extra UVT and are subject to actual payout", deviceScope: "Friend device earnings rewards go only to the inviter, are paid extra by the platform, and don't reduce your friends' earnings",
    loading: "Loading…", unavailable: "This guide couldn't load. Please reload.", missing: "Rules couldn't load", none: "No rewards to display", retry: "Reload",
    days: "days", settlementPeriod: "Payout period", minRank: "entry rank",
    daily: "daily", weekly: "weekly", monthly: "monthly", paused: "paused", unpaused: "paying normally",
    hold: "Team incentive pool payouts aren't open yet", unsupported: "Not open yet", supported: "Subject to actual payout",
    network: "Team rewards are subject to actual payout.", records: "Rewards are subject to actual payout.", cultivation: "Friend rank-up rewards are subject to actual payout.",
    exampleScope: "These amounts are illustrations, not personal earnings. Hypothetical order base:", exampleNetwork: "Team reward illustration", exampleCultivation: "Friend rank-up reward illustration, not a personal payment",
    noTotal: "Not an earnings total", pendingAmount: "To be paid", unknownAmount: "—", base: "Hypothetical order base", configured: "Reward amount under the rules", notOpen: "Not available", notConfigured: "Temporarily unavailable",
    purchase: "Friend purchases", deviceEarning: "Friends' device earnings", totalRate: "Total reward", split: "Reward split", directOnly: "Friends you invited only; paid extra by the platform without reducing your friends' earnings", priceUnavailable: "UVT price unavailable; it will be added later",
  },
  vi: {
    purchaseBudget: "Tỷ lệ thưởng bạn bè mua hàng", purchaseReplacement: "Phần UVT đã bao gồm thưởng UVT bổ sung của giao dịch mua này và không được chi trả hai lần", purchaseOriginal: "Thưởng mua hàng của bạn bè và của nhóm được chi trả theo quy tắc hiện hành", networkPurchase: "Thưởng mua hàng của nhóm bao gồm UVT bổ sung, theo kết quả chi trả thực tế", deviceScope: "Thưởng thu nhập thiết bị của bạn bè chỉ dành cho người mời, do nền tảng chi trả thêm và không làm giảm thu nhập của bạn bè",
    loading: "Đang tải…", unavailable: "Chưa tải được hướng dẫn. Vui lòng tải lại.", missing: "Chưa tải được quy tắc", none: "Chưa có phần thưởng để hiển thị", retry: "Tải lại",
    days: "ngày", settlementPeriod: "Kỳ chi trả", minRank: "hạng tham gia",
    daily: "hằng ngày", weekly: "hằng tuần", monthly: "hằng tháng", paused: "đã tạm dừng", unpaused: "chi trả bình thường",
    hold: "Quỹ thưởng nhóm chưa mở chi trả", unsupported: "Chưa mở", supported: "Theo kết quả chi trả thực tế",
    network: "Thưởng nhóm theo kết quả chi trả thực tế.", records: "Thưởng theo kết quả chi trả thực tế.", cultivation: "Thưởng khi bạn bè lên hạng theo kết quả chi trả thực tế.",
    exampleScope: "Các số tiền chỉ để minh họa, không phải thu nhập cá nhân. Cơ sở đơn hàng giả định:", exampleNetwork: "Minh họa thưởng đội nhóm", exampleCultivation: "Minh họa thưởng khi bạn bè lên hạng, không phải khoản cá nhân đã nhận",
    noTotal: "Không phải tổng thu nhập", pendingAmount: "Chờ chi trả", unknownAmount: "—", base: "Cơ sở đơn hàng giả định", configured: "Mức thưởng theo quy tắc", notOpen: "Chưa mở", notConfigured: "Tạm thời chưa khả dụng",
    purchase: "Bạn bè mua hàng", deviceEarning: "Thu nhập thiết bị của bạn bè", totalRate: "Tổng thưởng", split: "Phân chia thưởng", directOnly: "Chỉ dành cho bạn bè bạn đã mời; nền tảng chi trả thêm và không làm giảm thu nhập của bạn bè", priceUnavailable: "Chưa lấy được giá UVT; sẽ được ghi nhận sau",
  },
  id: {
    purchaseBudget: "Persentase hadiah pembelian teman", purchaseReplacement: "Porsi UVT sudah termasuk hadiah UVT ekstra dari pembelian ini; tidak dibayarkan dua kali", purchaseOriginal: "Hadiah pembelian teman dan tim dibayarkan sesuai aturan saat ini", networkPurchase: "Hadiah pembelian tim termasuk UVT ekstra dan mengikuti pembayaran aktual", deviceScope: "Hadiah pendapatan perangkat teman hanya untuk pengundang, dibayarkan ekstra oleh platform, dan tidak mengurangi pendapatan teman Anda",
    loading: "Memuat…", unavailable: "Panduan ini gagal dimuat. Muat ulang.", missing: "Aturan gagal dimuat", none: "Belum ada hadiah untuk ditampilkan", retry: "Muat ulang",
    days: "hari", settlementPeriod: "Periode pembayaran", minRank: "peringkat awal",
    daily: "harian", weekly: "mingguan", monthly: "bulanan", paused: "dijeda", unpaused: "dibayarkan seperti biasa",
    hold: "Pembayaran pool insentif tim belum dibuka", unsupported: "Belum dibuka", supported: "Mengikuti pembayaran aktual",
    network: "Hadiah tim mengikuti pembayaran aktual.", records: "Hadiah mengikuti pembayaran aktual.", cultivation: "Hadiah naik peringkat teman mengikuti pembayaran aktual.",
    exampleScope: "Jumlah berikut hanya ilustrasi, bukan pendapatan pribadi. Asumsi nilai pesanan:", exampleNetwork: "Ilustrasi hadiah tim", exampleCultivation: "Ilustrasi hadiah naik peringkat teman, bukan pembayaran pribadi",
    noTotal: "Bukan total pendapatan", pendingAmount: "Akan dibayarkan", unknownAmount: "—", base: "Asumsi nilai pesanan", configured: "Jumlah hadiah sesuai aturan", notOpen: "Tidak tersedia", notConfigured: "Sementara tidak tersedia",
    purchase: "Pembelian teman", deviceEarning: "Pendapatan perangkat teman", totalRate: "Total persentase", split: "Pembagian hadiah", directOnly: "Hanya teman yang Anda undang; dibayarkan ekstra oleh platform tanpa mengurangi pendapatan teman Anda", priceUnavailable: "Harga UVT tidak tersedia; akan ditambahkan nanti",
  },
  ms: {
    purchaseBudget: "Kadar ganjaran pembelian rakan", purchaseReplacement: "Bahagian UVT sudah termasuk ganjaran UVT tambahan bagi pembelian ini; ia tidak dibayar dua kali", purchaseOriginal: "Ganjaran pembelian rakan dan pasukan dibayar mengikut peraturan semasa", networkPurchase: "Ganjaran pembelian pasukan termasuk UVT tambahan dan tertakluk kepada pembayaran sebenar", deviceScope: "Ganjaran pendapatan peranti rakan hanya untuk penjemput, dibayar tambahan oleh platform, dan tidak mengurangkan pendapatan rakan anda",
    loading: "Memuatkan…", unavailable: "Panduan ini gagal dimuatkan. Sila muat semula.", missing: "Peraturan gagal dimuatkan", none: "Tiada ganjaran untuk dipaparkan", retry: "Muat semula",
    days: "hari", settlementPeriod: "Tempoh bayaran", minRank: "pangkat permulaan",
    daily: "harian", weekly: "mingguan", monthly: "bulanan", paused: "dijeda", unpaused: "dibayar seperti biasa",
    hold: "Bayaran dana insentif pasukan belum dibuka", unsupported: "Belum dibuka", supported: "Tertakluk kepada bayaran sebenar",
    network: "Ganjaran pasukan tertakluk kepada pembayaran sebenar.", records: "Ganjaran tertakluk kepada pembayaran sebenar.", cultivation: "Ganjaran naik pangkat rakan tertakluk kepada pembayaran sebenar.",
    exampleScope: "Jumlah ini hanya contoh pengiraan, bukan pendapatan peribadi. Nilai pesanan contoh:", exampleNetwork: "Ilustrasi ganjaran pasukan", exampleCultivation: "Ilustrasi ganjaran naik pangkat rakan, bukan bayaran peribadi",
    noTotal: "Bukan jumlah pendapatan", pendingAmount: "Akan dibayar", unknownAmount: "—", base: "Nilai pesanan contoh", configured: "Jumlah ganjaran ikut peraturan", notOpen: "Tidak tersedia", notConfigured: "Tidak tersedia buat sementara",
    purchase: "Pembelian rakan", deviceEarning: "Pendapatan peranti rakan", totalRate: "Kadar keseluruhan", split: "Pecahan ganjaran", directOnly: "Hanya rakan yang anda jemput; dibayar tambahan oleh platform tanpa mengurangkan pendapatan rakan anda", priceUnavailable: "Harga UVT tidak tersedia; ia akan ditambah kemudian",
  },
  fil: {
    purchaseBudget: "Rate ng reward sa pagbili ng kaibigan", purchaseReplacement: "Kasama na sa UVT na bahagi ang dagdag na reward na UVT ng pagbiling ito; hindi ito ibibigay nang dalawang beses", purchaseOriginal: "Ibinibigay ang reward sa pagbili ng kaibigan at ng team ayon sa kasalukuyang patakaran", networkPurchase: "May dagdag na UVT ang reward sa pagbili ng team at batay sa aktuwal na payout", deviceScope: "Sa nag-imbita lang ibinibigay ang reward sa kita ng device ng kaibigan, dagdag ito mula sa platform, at hindi nito binabawasan ang kita ng mga kaibigan mo",
    loading: "Naglo-load…", unavailable: "Hindi ma-load ang gabay. I-reload.", missing: "Hindi ma-load ang patakaran", none: "Walang reward na maipapakita", retry: "I-reload",
    days: "araw", settlementPeriod: "Panahon ng payout", minRank: "simulang rank",
    daily: "araw-araw", weekly: "lingguhan", monthly: "buwanan", paused: "naka-pause", unpaused: "normal ang payout",
    hold: "Hindi pa bukas ang payout ng incentive pool ng team", unsupported: "Hindi pa bukas", supported: "Batay sa aktuwal na payout",
    network: "Ang reward ng team ay batay sa aktuwal na payout.", records: "Ang reward ay batay sa aktuwal na payout.", cultivation: "Ang reward sa rank-up ng kaibigan ay batay sa aktuwal na payout.",
    exampleScope: "Halimbawa lang ang mga halagang ito, hindi personal na kita. Halimbawang base ng order:", exampleNetwork: "Halimbawa ng reward ng team", exampleCultivation: "Halimbawa ng reward sa rank-up ng kaibigan, hindi aktuwal na payout",
    noTotal: "Hindi kabuuang kita", pendingAmount: "Ibibigay pa", unknownAmount: "—", base: "Halimbawang base ng order", configured: "Reward ayon sa patakaran", notOpen: "Hindi available", notConfigured: "Pansamantalang hindi available",
    purchase: "Pagbili ng kaibigan", deviceEarning: "Kita ng device ng kaibigan", totalRate: "Kabuuang rate", split: "Hati ng reward", directOnly: "Para lang sa mga kaibigang inimbitahan mo; dagdag mula sa platform nang hindi binabawasan ang kita nila", priceUnavailable: "Di makuha ang presyo ng UVT; idadagdag mamaya ang bagong reward",
  },
  ru: {
    purchaseBudget: "Ставка награды за покупки друзей", purchaseReplacement: "Доля UVT уже включает доп. награду UVT за эту покупку; дважды она не выплачивается", purchaseOriginal: "Награды за покупки друзей и команды выплачиваются по текущим правилам", networkPurchase: "Награды за покупки команды включают доп. UVT, по фактической выплате", deviceScope: "Награду за доход устройств друзей получает только пригласивший; её дополнительно выплачивает платформа, доход друзей не уменьшается",
    loading: "Загрузка…", unavailable: "Не удалось загрузить описание. Обновите страницу.", missing: "Правила не загрузились", none: "Наград для показа нет", retry: "Обновить",
    days: "дн.", settlementPeriod: "Период выплат", minRank: "Участие с",
    daily: "ежедневно", weekly: "еженедельно", monthly: "ежемесячно", paused: "на паузе", unpaused: "выплачивается",
    hold: "Выплаты из пула наград команды пока не открыты", unsupported: "Пока закрыто", supported: "По фактической выплате",
    network: "Награды команды — по фактической выплате.", records: "Награды — по фактической выплате.", cultivation: "Награды за повышение ранга друга — по фактической выплате.",
    exampleScope: "Суммы ниже — пример, а не ваш доход. Условная сумма заказов:", exampleNetwork: "Пример наград команды", exampleCultivation: "Пример награды за повышение ранга друга, а не ваша выплата",
    noTotal: "Не итог дохода", pendingAmount: "К выплате", unknownAmount: "—", base: "Условная сумма заказов", configured: "Награда по правилам", notOpen: "Недоступно", notConfigured: "Временно недоступно",
    purchase: "Покупки друзей", deviceEarning: "Доход устройств друзей", totalRate: "Ставка награды:", split: "Разделение", directOnly: "Только приглашённые вами друзья; выплачивается платформой дополнительно, доход друзей не уменьшается", priceUnavailable: "Цена UVT недоступна; сумма в UVT будет учтена позже",
  },
  kk: {
    purchaseBudget: "Дос сатып алғандағы сыйақы мөлшерлемесі", purchaseReplacement: "Сыйақының UVT бөлігіне осы сатып алудың қосымша UVT сыйақысы кірген; ол екі рет төленбейді", purchaseOriginal: "Достар мен команда мүшелерінің сатып алулары үшін сыйақылар ағымдағы ережелер бойынша төленеді", networkPurchase: "Команданың сатып алулары үшін сыйақыға қосымша UVT кіреді, нақты төленген сома негізге алынады", deviceScope: "Достың құрылғы табысына берілетін сыйақы тек шақырушыға төленеді, оны платформа қосымша төлейді және достарыңыздың табысы азаймайды",
    loading: "Жүктелуде…", unavailable: "Бұл нұсқаулық жүктелмеді. Қайта жүктеңіз.", missing: "Ережелер жүктелмеді", none: "Көрсететін сыйақы жоқ", retry: "Жаңарту",
    days: "күн", settlementPeriod: "Төлем кезеңі", minRank: "бастапқы дәреже",
    daily: "күн сайын", weekly: "апта сайын", monthly: "ай сайын", paused: "тоқтатылды", unpaused: "қалыпты төленуде",
    hold: "Ынталандыру қорынан төлем әлі ашылмаған", unsupported: "Әлі ашылмаған", supported: "Нақты төлем негізге алынады",
    network: "Команда сыйақылары: нақты төленген сома негізге алынады.", records: "Сыйақылар: нақты төленген сома негізге алынады.", cultivation: "Дос дәрежесі өскендегі сыйақы: нақты төленген сома негізге алынады.",
    exampleScope: "Бұл сомалар — мысал, жеке табыс емес. Шартты тапсырыс сомасы:", exampleNetwork: "Команда сыйақысының мысалы", exampleCultivation: "Дос дәрежесі өскендегі сыйақы мысалы, жеке төлем емес",
    noTotal: "Табыстың жалпы сомасы емес", pendingAmount: "Төленуін күтуде", unknownAmount: "—", base: "Шартты тапсырыс сомасы", configured: "Ережелер бойынша сыйақы мөлшері", notOpen: "Қолжетімсіз", notConfigured: "Уақытша қолжетімсіз",
    purchase: "Достардың сатып алуы", deviceEarning: "Достардың құрылғы табысы", totalRate: "Жалпы мөлшерлеме", split: "Сыйақы бөлінісі", directOnly: "Тек сіз шақырған достар; платформа достарыңыздың табысын азайтпай қосымша төлейді", priceUnavailable: "UVT бағасы қолжетімсіз; ол кейін қосылады",
  },
  uz: {
    purchaseBudget: "Doʻst xaridi mukofoti koʻrsatkichi", purchaseReplacement: "UVT ulushiga shu xarid uchun qoʻshimcha UVT mukofoti kiritilgan; u ikki marta toʻlanmaydi", purchaseOriginal: "Doʻst va jamoa xaridi mukofotlari amaldagi qoidalar boʻyicha toʻlanadi", networkPurchase: "Jamoa xaridi mukofotlariga qoʻshimcha UVT kiradi, yakuniy summa haqiqiy toʻlov boʻyicha", deviceScope: "Doʻstlar qurilmalari daromadi mukofoti faqat taklif qilgan foydalanuvchiga beriladi, platforma tomonidan qoʻshimcha toʻlanadi va doʻstlaringiz daromadini kamaytirmaydi",
    loading: "Yuklanmoqda…", unavailable: "Qoʻllanmani yuklab boʻlmadi. Qayta yuklang.", missing: "Qoidalar yuklanmadi", none: "Koʻrsatiladigan mukofot yoʻq", retry: "Yangilash",
    days: "kun", settlementPeriod: "Toʻlov davri", minRank: "boshlash darajasi",
    daily: "har kuni", weekly: "har hafta", monthly: "har oy", paused: "toʻxtatilgan", unpaused: "odatdagidek toʻlanmoqda",
    hold: "Jamoa ragʻbat fondi toʻlovlari hali ochilmagan", unsupported: "Hali ochilmagan", supported: "Haqiqiy toʻlov boʻyicha",
    network: "Jamoa mukofotlari haqiqiy toʻlov boʻyicha.", records: "Mukofotlar haqiqiy toʻlov boʻyicha.", cultivation: "Doʻst darajasi oshishi mukofotlari haqiqiy toʻlov boʻyicha.",
    exampleScope: "Bu summalar misol, shaxsiy daromad emas. Taxminiy buyurtma summasi:", exampleNetwork: "Jamoa mukofoti misoli", exampleCultivation: "Doʻst darajasi oshishi mukofoti misoli, shaxsiy toʻlov emas",
    noTotal: "Daromad jami emas", pendingAmount: "Toʻlanadi", unknownAmount: "—", base: "Taxminiy buyurtma summasi", configured: "Qoidalar boʻyicha mukofot", notOpen: "Mavjud emas", notConfigured: "Vaqtincha mavjud emas",
    purchase: "Doʻst xaridlari", deviceEarning: "Doʻstlar qurilmalari daromadi", totalRate: "Jami mukofot (%)", split: "Mukofot taqsimoti", directOnly: "Faqat siz taklif qilgan doʻstlar; platforma qoʻshimcha toʻlaydi, doʻstlaringiz daromadi kamaymaydi", priceUnavailable: "UVT narxini aniqlab boʻlmadi; keyinroq hisobga olinadi",
  },
};

export const COMMISSIONS_HOW_SLOTS = ["hero", "overview", "channels", "network", "binary", "peer", "cultivation", "leadership", "genesis", "lifecycle", "cooling", "unlocked", "withdrawn", "cooling-note", "example", "example-day", "example-network", "example-cultivation", "example-peer", "example-leadership", "example-total", "example-note", "faq", "faq-order", "faq-withdraw", "faq-reversal", "faq-cultivation", "footer"];


export function buildCommissionsHowContent(snapshot: CommissionsHowSnapshot | null, locale: string) {
  const copy = COPY[uiLocale(locale.split("-")[0])];
  const number = (value: number) => formatHowNumber(value, locale);
  const money = (value: number, currency = "USDT") => `${formatAmount(value)} ${currency}`;
  const tokens: Record<string, string> = {};
  const publicBodies: Record<string, string> = {};
  const amounts = { network: copy.unknownAmount, cultivation: copy.unknownAmount, peer: copy.unknownAmount, leadership: copy.unknownAmount };
  if (snapshot) {
    const { guide, directPolicy } = snapshot;
    const ranks = snapshot.ranks.filter(r => r.visible).sort((a, b) => a.v - b.v);
    const b = guide.binary, l = guide.leadership;
    const describe = (rule: DirectReferralRule) => !directPolicy.configured ? copy.notConfigured : !rule.enabled ? copy.paused
      : `${copy.totalRate} ${number(rule.totalRatePct)}% · ${copy.split}: USDT ${number(rule.usdtSharePct)}% / UVT ${number(100 - rule.usdtSharePct)}% · ${number(rule.coolingDays)} ${copy.days}`;
    tokens.directPurchaseRules = describe(directPolicy.purchase);
    if (directPolicy.settlementMode === "SEVEN_V2") {
      const split = directPolicy.purchaseSplit, reference = directPolicy.sevenLayerReference;
      tokens.directPurchaseRules = !directPolicy.configured || !split || !reference || directPolicy.purchaseSplitConfigured === false
        || reference.baseRatePct === null || reference.coolingDays === null ? copy.notConfigured
        : split.enabled ? `${copy.purchaseBudget} ${number(reference.baseRatePct)}% · ${copy.split}: USDT ${number(split.usdtSharePct)}% / UVT ${number(100 - split.usdtSharePct)}% · ${copy.purchaseReplacement}`
        : copy.purchaseOriginal;
    }
    tokens.networkPurchaseRules = copy.networkPurchase;
    tokens.directDeviceRules = describe(directPolicy.deviceEarning);
    tokens.directScope = directPolicy.settlementMode === "SEVEN_V2" ? copy.deviceScope : copy.directOnly;
    tokens.directPrice = directPolicy.nexUsdtPrice === null ? copy.priceUnavailable : `${number(directPolicy.nexUsdtPrice)} USDT / UVT`;
    tokens.coolingDays = guide.coolingDays === null ? copy.missing : `${number(guide.coolingDays)} ${copy.days}`;
    // Caps and unmatched-volume handling are payout mechanics, not user guidance (APP-COPY-AUDIT rule 6).
    tokens.binaryRules = b ? `${copy.settlementPeriod}: ${copy[b.settlePeriod]} · ${b.paused ? copy.paused : copy.unpaused}` : copy.missing;
    tokens.peerRules = copy.records;
    tokens.cultivationRules = copy.cultivation;
    tokens.leadershipRules = l ? `${copy.minRank} V${l.minRank}` : copy.hold;
    tokens.leadershipVotes = "";
    tokens.peerStatus = guide.capabilities.peer ? copy.supported : copy.unsupported;
    tokens.genesisStatus = guide.capabilities.genesis ? copy.supported : copy.unsupported;
    // A unit illustration, not a purchase, account estimate, or settlement: no fictional named orders.
    tokens.exampleBase = money(100);
    amounts.network = directPolicy.configured && directPolicy.purchase.enabled && directPolicy.nexUsdtPrice !== null ? copy.pendingAmount : copy.notConfigured;
    const cultivation = ranks.find(r => r.cultivationBonus > 0);
    tokens.exampleRank = cultivation ? `V${cultivation.v}` : copy.none;
    const qualified = (value: string, note: string) => locale.startsWith("zh") ? `${value}（${note}）` : `${value} (${note})`;
    amounts.cultivation = cultivation ? qualified(money(cultivation.cultivationBonus, "UVT"), copy.configured) : copy.none;
    amounts.peer = guide.capabilities.peer ? copy.pendingAmount : copy.notOpen;
    amounts.leadership = l ? copy.pendingAmount : copy.notConfigured;
    Object.assign(publicBodies, {
      binary: `${copy.records} ${tokens.binaryRules}`,
      peer: `${copy.records} ${tokens.peerStatus}`,
      cultivation: copy.cultivation,
      leadership: `${copy.records} ${tokens.leadershipRules}`,
      "example-day": `${copy.exampleScope} ${tokens.exampleBase}`,
      "example-network": copy.exampleNetwork,
      "example-cultivation": copy.exampleCultivation,
      "example-leadership": copy.pendingAmount,
    });
  }
  // The template must match the actual settlement generation, including both purchase groups.
  const directBody = snapshot?.document.blocks.find(block => block.id === "network")?.body ?? "";
  const currentPublication = directBody.includes("{directPurchaseRules}") && directBody.includes("{directDeviceRules}")
    && (snapshot?.directPolicy.settlementMode !== "SEVEN_V2" || (snapshot.document.schemaVersion === 2
      && snapshot.document.templateId === "commissions-v2" && directBody.includes("{networkPurchaseRules}")));
  const blocks = new Map(currentPublication ? snapshot?.document.blocks.map(block => [block.id, block]) : []);
  function section(id: string, fallbackTitle = copy.unavailable) {
    const block = blocks.get(id);
    let available = Boolean(block);
    const render = (raw: string) => {
      return raw.replace(/\{([^{}]+)\}/g, (_, key: string) => {
      if (!Object.prototype.hasOwnProperty.call(tokens, key)) { available = false; return ""; }
      return tokens[key];
      });
    };
    const title = block ? render(block.title) : fallbackTitle;
    const body = block ? render(block.body) : copy.unavailable;
    return { id, available, title: platformDisplayText(available ? title.trim() : fallbackTitle), body: platformDisplayText(available ? (publicBodies[id] ?? body).trim() : copy.unavailable) };
  }
  const incomplete = COMMISSIONS_HOW_SLOTS.some(id => !section(id).available);
  // Never show a numeric illustration without its published context and limitations.
  if (incomplete) for (const key of Object.keys(amounts) as (keyof typeof amounts)[]) amounts[key] = copy.unknownAmount;
  return { copy, section, amounts, exampleTotal: copy.noTotal, incomplete };
}

export interface CommissionsHowState { loading: boolean; error: boolean; snapshot: CommissionsHowSnapshot | null }
export function createCommissionsHowResource(deps: { read(locale: string): Promise<CommissionsHowSnapshot>; apply(state: CommissionsHowState): void }) {
  let epoch = 0, disposed = false;
  let pending: { locale: string; promise: Promise<void> } | undefined;
  function load(locale: string): Promise<void> {
    if (disposed) return Promise.resolve();
    if (pending?.locale === locale) return pending.promise;
    const request = ++epoch;
    deps.apply({ loading: true, error: false, snapshot: null });
    const promise = Promise.resolve().then(() => deps.read(locale))
      .then(snapshot => { if (!disposed && epoch === request) deps.apply({ loading: false, error: false, snapshot }); })
      .catch(() => { if (!disposed && epoch === request) deps.apply({ loading: false, error: true, snapshot: null }); })
      .finally(() => { if (epoch === request) pending = undefined; });
    pending = { locale, promise };
    return promise;
  }
  return { load, dispose() { disposed = true; epoch++; pending = undefined; } };
}
