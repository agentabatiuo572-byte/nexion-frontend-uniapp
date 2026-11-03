import { uiLocale } from "@/i18n";
const COPY = {
  zh: {
    title: '邀请榜', points: '算力点', gap: '距上一名还差 {points}',
    unavailable: '算力排行暂不可用',
    note: '按所选周期的算力点排名。榜单奖励在周期结束后发放，以实际到账为准。',
    noteAll: '按累计算力点排名。',
  },
  en: {
    title: 'Invite leaderboard', points: 'Compute points', gap: '{points} behind the next rank',
    unavailable: 'Compute ranking is currently unavailable',
    note: 'Ranked by compute points for the selected period. Leaderboard rewards are paid after the period ends, subject to actual payout.',
    noteAll: 'Ranked by all-time compute points.',
  },
  vi: {
    title: 'Bảng xếp hạng mời', points: 'Điểm tính toán', gap: 'Còn {points} để đạt hạng kế tiếp',
    unavailable: 'Bảng xếp hạng điểm tính toán hiện chưa khả dụng',
    note: 'Xếp hạng theo điểm tính toán trong kỳ đã chọn. Thưởng bảng xếp hạng được chi trả sau khi kỳ kết thúc, theo số tiền thực nhận.',
    noteAll: 'Xếp hạng theo tổng điểm tính toán tích lũy.',
  },
  id: {
    title: 'Peringkat pengundang', points: 'Poin komputasi', gap: 'Kurang {points} dari peringkat berikutnya',
    unavailable: 'Peringkat komputasi sedang tidak tersedia',
    note: 'Diurutkan berdasarkan poin komputasi pada periode yang dipilih. Hadiah papan peringkat dibayarkan setelah periode berakhir, sesuai pembayaran aktual.',
    noteAll: 'Diurutkan berdasarkan total poin komputasi.',
  },
  ms: {
    title: 'Carta jemputan', points: 'Mata pengkomputeran', gap: 'Jurang ke kedudukan di atas: {points}',
    unavailable: 'Kedudukan pengkomputeran tidak tersedia buat masa ini',
    note: 'Kedudukan mengikut mata pengkomputeran bagi tempoh yang dipilih. Ganjaran papan pendahulu dibayar selepas tempoh tamat, tertakluk kepada pembayaran sebenar.',
    noteAll: 'Kedudukan mengikut mata pengkomputeran terkumpul.',
  },
  fil: {
    title: 'Leaderboard ng imbita', points: 'Puntos ng compute', gap: '{points} ang layo sa susunod na rank',
    unavailable: 'Kasalukuyang hindi available ang compute ranking',
    note: 'Niraranggo ayon sa puntos ng compute sa napiling period. Ibinibigay ang reward pagkatapos ng period, batay sa aktuwal na payout.',
    noteAll: 'Niraranggo ayon sa kabuuang puntos ng compute.',
  },
  ru: {
    title: 'Рейтинг приглашений', points: 'Очки мощности', gap: 'До следующего места: {points}',
    unavailable: 'Рейтинг по мощности сейчас недоступен',
    note: 'Рейтинг по очкам мощности за выбранный период. Награды начисляются после его окончания; итоговая сумма — по фактическому зачислению.',
    noteAll: 'Рейтинг по очкам мощности за всё время.',
  },
  kk: {
    title: 'Шақыру рейтингі', points: 'Есептеу ұпайлары', gap: 'Келесі орынға дейін {points}',
    unavailable: 'Есептеу рейтингі қазір қолжетімсіз',
    note: 'Таңдалған кезеңдегі есептеу ұпайлары бойынша. Рейтинг сыйақылары кезең аяқталғаннан кейін төленеді, нақты төлем негізге алынады.',
    noteAll: 'Барлық уақыттағы есептеу ұпайлары бойынша.',
  },
  uz: {
    title: 'Takliflar reytingi', points: 'Quvvat ballari', gap: 'Keyingi oʻringacha {points}',
    unavailable: 'Quvvat reytingi hozircha mavjud emas',
    note: 'Tanlangan davrdagi quvvat ballari boʻyicha. Reyting mukofotlari davr tugagach toʻlanadi, yakuniy summa haqiqiy toʻlov boʻyicha.',
    noteAll: 'Jami quvvat ballari boʻyicha.',
  },
};

export function leaderboardPointsCopy(locale: string) {
  return COPY[uiLocale(locale.split('-')[0])];
}
