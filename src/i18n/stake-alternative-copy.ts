import type { UiLocale } from "@/i18n";

interface StakeAlternativeCopy {
  label: string;
  basis: string;
  term: string;
  estimate: string;
  assumptions: string;
  lockup: string;
  rules: string;
}

export const stakeAlternativeCopy: Record<UiLocale, StakeAlternativeCopy> = {
  zh: {
    label: "暂时不用？可以先质押",
    basis: "按输入的 {amount} USDT 查看各期限的预计奖励。",
    term: "{days} 天 · 参考年奖励率 {rate}%",
    estimate: "预计奖励 {amount} USDT",
    assumptions: "按当前参考奖励率估算，以实际到账为准。",
    lockup: "质押期间资金锁定，提前解锁可能产生扣费，具体以质押页为准。",
    rules: "查看质押说明",
  },
  en: {
    label: "Not using it yet? Consider staking",
    basis: "Estimated rewards by term for the {amount} USDT you entered.",
    term: "{days} days · Est. annual reward rate {rate}%",
    estimate: "Est. reward {amount} USDT",
    assumptions: "Estimated at the current reference rate. Actual rewards may differ.",
    lockup: "Staked funds are locked for the term. Unlocking early may incur a charge. See the staking page for details.",
    rules: "View staking details",
  },
  vi: {
    label: "Chưa cần dùng? Bạn có thể staking",
    basis: "Phần thưởng dự kiến theo từng kỳ hạn cho {amount} USDT bạn đã nhập.",
    term: "{days} ngày · Tỷ lệ thưởng năm tham khảo {rate}%",
    estimate: "Thưởng dự kiến {amount} USDT",
    assumptions: "Ước tính theo tỷ lệ tham khảo hiện tại. Phần thưởng thực tế có thể khác.",
    lockup: "Tiền staking được khóa trong suốt kỳ hạn. Mở khóa sớm có thể phát sinh khoản khấu trừ. Xem chi tiết tại trang staking.",
    rules: "Xem chi tiết staking",
  },
  id: {
    label: "Belum dipakai? Pertimbangkan staking",
    basis: "Perkiraan hadiah per jangka waktu untuk {amount} USDT yang Anda masukkan.",
    term: "{days} hari · Est. hadiah tahunan {rate}%",
    estimate: "Est. hadiah {amount} USDT",
    assumptions: "Diperkirakan dengan persentase acuan saat ini. Hadiah aktual bisa berbeda.",
    lockup: "Dana staking terkunci selama jangka waktunya. Buka kunci lebih awal bisa dikenai biaya. Lihat halaman staking untuk detailnya.",
    rules: "Lihat detail staking",
  },
  ms: {
    label: "Belum menggunakannya? Pertimbangkan staking",
    basis: "Anggaran ganjaran ikut tempoh bagi {amount} USDT yang anda masukkan.",
    term: "{days} hari · Kadar ganjaran tahunan angg. {rate}%",
    estimate: "Angg. ganjaran {amount} USDT",
    assumptions: "Dianggarkan pada kadar rujukan semasa. Ganjaran sebenar mungkin berbeza.",
    lockup: "Dana staking dikunci sepanjang tempoh. Buka kunci awal mungkin dikenakan caj. Lihat halaman staking untuk butiran.",
    rules: "Lihat butiran staking",
  },
  fil: {
    label: "Hindi pa gagamitin? Subukan ang staking",
    basis: "Tinatayang reward bawat term para sa {amount} USDT na inilagay mo.",
    term: "{days} araw · Tinatayang taunang rate ng reward {rate}%",
    estimate: "Tantiyang reward {amount} USDT",
    assumptions: "Tinantiya sa kasalukuyang rate. Puwedeng mag-iba ang aktuwal na reward.",
    lockup: "Naka-lock ang pondong naka-stake sa buong term. Puwedeng may singil ang maagang pag-unlock. Tingnan ang page ng staking para sa detalye.",
    rules: "Detalye ng staking",
  },
  ru: {
    label: "Пока не нужны? Рассмотрите стейкинг",
    basis: "Ожидаемые награды по срокам для введённой суммы {amount} USDT.",
    term: "{days} дн. · ориентир. годовая ставка {rate}%",
    estimate: "≈ награда {amount} USDT",
    assumptions: "Оценка по текущей ориентировочной ставке. Фактические награды могут отличаться.",
    lockup: "Средства в стейкинге заблокированы на срок. Досрочная разблокировка может быть платной. Подробности — на странице стейкинга.",
    rules: "О стейкинге",
  },
  kk: {
    label: "Әзірге қолданбайсыз ба? Стейкингті қараңыз",
    basis: "Енгізген {amount} USDT бойынша мерзімдерге қарай болжамды сыйақы.",
    term: "{days} күн · Болжамды жылдық сыйақы мөлшерлемесі {rate}%",
    estimate: "Болж. сыйақы {amount} USDT",
    assumptions: "Ағымдағы болжамды мөлшерлеме бойынша есептелген. Нақты сыйақы өзгеше болуы мүмкін.",
    lockup: "Стейкингтегі қаражат мерзім бойы құлыпталады. Ерте ашу ақылы болуы мүмкін. Толығырақ стейкинг бетінде.",
    rules: "Стейкинг мәліметін қарау",
  },
  uz: {
    label: "Hozir kerak emasmi? Steykingni koʻrib chiqing",
    basis: "Siz kiritgan {amount} USDT uchun muddatlar boʻyicha taxminiy mukofot.",
    term: "{days} kun · Taxminiy yillik mukofot {rate}%",
    estimate: "Taxminiy mukofot {amount} USDT",
    assumptions: "Joriy taxminiy koʻrsatkich boʻyicha hisoblangan. Haqiqiy mukofot farq qilishi mumkin.",
    lockup: "Steykingdagi mablagʻ muddat davomida qulflanadi. Erta ochishda haq olinishi mumkin. Tafsilotlar steyking sahifasida.",
    rules: "Steyking haqida",
  },
};
