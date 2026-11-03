import { uiLocale } from "@/i18n";
const copy = {
  zh: {
    learn: "了解创世节点",
    empty: "可先查看创世节点介绍、交易规则与风险说明。",
    holderIntro: "了解节点权益与风险；如已购买，可在此查看持有记录。",
    trust: "信任与披露",
  },
  en: {
    learn: "About Genesis nodes",
    empty: "Explore Genesis nodes, trading rules and risk disclosures.",
    holderIntro: "Explore node benefits and risks. If you have purchased nodes, view your holdings here.",
    trust: "Trust and disclosures",
  },
  vi: {
    learn: "Tìm hiểu nút Genesis",
    empty: "Xem giới thiệu nút Genesis, quy tắc giao dịch và thông tin rủi ro.",
    holderIntro: "Tìm hiểu quyền lợi và rủi ro. Nếu đã mua nút, bạn có thể xem thông tin sở hữu tại đây.",
    trust: "Tin cậy và công bố",
  },
  id: {
    learn: "Tentang Node Genesis",
    empty: "Lihat penjelasan Node Genesis, aturan perdagangan, dan pengungkapan risiko.",
    holderIntro: "Pelajari manfaat dan risiko node. Jika sudah membeli, lihat kepemilikan Anda di sini.",
    trust: "Kepercayaan dan pengungkapan",
  },
  ms: {
    learn: "Tentang nod Genesis",
    empty: "Terokai nod Genesis, peraturan dagangan dan pendedahan risiko.",
    holderIntro: "Terokai manfaat dan risiko nod. Jika anda telah membeli nod, lihat pegangan anda di sini.",
    trust: "Kepercayaan dan pendedahan",
  },
  fil: {
    learn: "Tungkol sa Genesis node",
    empty: "Alamin ang Genesis node, patakaran sa trading at paalala sa panganib.",
    holderIntro: "Alamin ang benepisyo at panganib ng node. Kung nakabili ka na, makikita rito ang hawak mo.",
    trust: "Trust at disclosure",
  },
  ru: {
    learn: "Об узлах Genesis",
    empty: "Узнайте об узлах Genesis, правилах торговли и рисках.",
    holderIntro: "Узнайте о привилегиях и рисках узлов. Если вы уже купили узлы, ваши записи — здесь.",
    trust: "Доверие и сведения",
  },
  kk: {
    learn: "Genesis түйіндері туралы",
    empty: "Genesis түйіндерімен, сауда ережелерімен және тәуекелдер туралы ақпаратпен танысыңыз.",
    holderIntro: "Түйін артықшылықтары мен тәуекелдерімен танысыңыз. Түйін сатып алған болсаңыз, иелігіңізді осында көріңіз.",
    trust: "Сенім және ашық ақпарат",
  },
  uz: {
    learn: "Genesis tugunlari haqida",
    empty: "Genesis tugunlari, savdo qoidalari va xatarlar bilan tanishing.",
    holderIntro: "Tugun imtiyozlari va xatarlar bilan tanishing. Agar tugun sotib olgan boʻlsangiz, egaligingizni shu yerda koʻring.",
    trust: "Ishonch va maʼlumotlar",
  },
};

export function genesisConsumerCopyFor(locale: string) {
  return copy[uiLocale(locale)];
}
