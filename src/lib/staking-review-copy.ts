import { computed } from "vue";
import { useLocaleStore } from "@/store/locale";
import { uiLocale } from "@/i18n";

// Kept local to staking so concurrent dictionary changes remain independent.
const copy = {
  en: {
    days: "{n} days",
    loading: "Loading…",
    unavailable: "Staking info could not load. Please try again later.",
    stale: "Refresh failed. Showing the last data; refresh before making changes.",
    retry: "Retry", empty: "No stakes yet", emptyDetail: "Choose a plan above to start staking.",
    rateNotice: "Rates for new plans may change. Existing stakes keep their recorded rate.",
    rules: {
      r3Label: "Rates for new plans may change",
      r3Body: "New stakes use the plan available at the time. Existing stakes keep the rate, term and early unlock charge they started with.",
      s3Step3Title: "Claim at maturity", faqQ3: "What if I do not claim at maturity?",
    },
  },
  zh: {
    days: "{n} 天",
    loading: "正在加载…",
    unavailable: "质押信息加载失败，请稍后重试。",
    stale: "刷新失败，以下是上次的数据，操作前请先刷新。",
    retry: "重试", empty: "还没有质押", emptyDetail: "选择上方方案开始质押。",
    rateNotice: "新方案的奖励率可能调整，已开始的质押按原奖励率计算。",
    rules: {
      r3Label: "新方案奖励率可能调整",
      r3Body: "新质押按当时的方案计算；已开始的质押按开始时的奖励率、期限和扣费比例计算。",
      s3Step3Title: "到期领取", faqQ3: "到期没领取会怎样？",
    },
  },
  vi: {
    days: "{n} ngày",
    loading: "Đang tải…",
    unavailable: "Không tải được thông tin staking. Vui lòng thử lại sau.",
    stale: "Làm mới thất bại. Đang hiển thị dữ liệu lần trước; vui lòng làm mới trước khi thao tác.",
    retry: "Thử lại", empty: "Chưa có khoản staking nào", emptyDetail: "Chọn một gói ở trên để bắt đầu staking.",
    rateNotice: "Tỷ lệ thưởng của gói mới có thể thay đổi. Các khoản đang staking giữ nguyên tỷ lệ đã ghi nhận.",
    rules: {
      r3Label: "Tỷ lệ thưởng của gói mới có thể thay đổi",
      r3Body: "Khoản staking mới áp dụng gói tại thời điểm tham gia. Các khoản đang staking giữ nguyên tỷ lệ thưởng, kỳ hạn và phí mở khóa sớm như lúc bắt đầu.",
      s3Step3Title: "Nhận khi đáo hạn", faqQ3: "Nếu chưa nhận khi đáo hạn thì sao?",
    },
  },
  id: {
    days: "{n} hari",
    loading: "Memuat…",
    unavailable: "Info staking gagal dimuat. Coba lagi nanti.",
    stale: "Gagal memuat ulang. Menampilkan data terakhir; muat ulang sebelum mengubah apa pun.",
    retry: "Coba lagi", empty: "Belum ada stake", emptyDetail: "Pilih paket di atas untuk mulai staking.",
    rateNotice: "Persentase hadiah untuk paket baru bisa berubah. Stake yang sudah berjalan tetap memakai persentase hadiah yang tercatat.",
    rules: {
      r3Label: "Persentase hadiah paket baru bisa berubah",
      r3Body: "Stake baru memakai paket yang tersedia saat itu. Stake yang sudah berjalan tetap dihitung dengan persentase hadiah, jangka waktu, dan persentase biaya buka kunci lebih awal yang berlaku saat dimulai.",
      s3Step3Title: "Klaim saat jatuh tempo", faqQ3: "Bagaimana jika belum diklaim saat jatuh tempo?",
    },
  },
  ms: {
    days: "{n} hari",
    loading: "Memuatkan…",
    unavailable: "Maklumat staking gagal dimuatkan. Sila cuba lagi nanti.",
    stale: "Muat semula gagal. Memaparkan data terakhir; muat semula sebelum membuat perubahan.",
    retry: "Cuba lagi", empty: "Belum ada stake", emptyDetail: "Pilih pelan di atas untuk mula staking.",
    rateNotice: "Kadar untuk pelan baharu mungkin berubah. Stake sedia ada mengekalkan kadar yang direkodkan.",
    rules: {
      r3Label: "Kadar untuk pelan baharu mungkin berubah",
      r3Body: "Stake baharu menggunakan pelan yang tersedia pada masa itu. Stake sedia ada mengekalkan kadar, tempoh dan caj buka kunci awal semasa ia bermula.",
      s3Step3Title: "Tuntut selepas tamat", faqQ3: "Apa jadi jika saya tidak menuntut selepas tamat?",
    },
  },
  fil: {
    days: "{n} araw",
    loading: "Naglo-load…",
    unavailable: "Hindi ma-load ang impormasyon ng staking. Subukan ulit mamaya.",
    stale: "Nabigo ang refresh. Ipinapakita ang huling data; mag-refresh bago gumawa ng pagbabago.",
    retry: "Subukan ulit", empty: "Wala pang stake", emptyDetail: "Pumili ng plan sa itaas para magsimulang mag-stake.",
    rateNotice: "Puwedeng magbago ang rate ng mga bagong plan. Sa kasalukuyang stake, ang naitalang rate pa rin ang gagamitin.",
    rules: {
      r3Label: "Puwedeng magbago ang rate ng bagong plan",
      r3Body: "Sa bagong stake, ang plan na available sa panahong iyon ang gagamitin. Sa kasalukuyang stake, ang rate, term at singil sa maagang pag-unlock noong nagsimula ito ang patuloy na gagamitin.",
      s3Step3Title: "I-claim sa maturity", faqQ3: "Paano kung hindi ako mag-claim sa maturity?",
    },
  },
  ru: {
    days: "{n} дн.",
    loading: "Загрузка…",
    unavailable: "Не удалось загрузить данные стейкинга. Повторите попытку позже.",
    stale: "Не удалось обновить. Показаны прошлые данные; обновите, прежде чем что-то менять.",
    retry: "Повторить", empty: "Стейкинга пока нет", emptyDetail: "Выберите план выше, чтобы начать.",
    rateNotice: "Ставки новых планов могут меняться. Текущий стейкинг сохраняет свою ставку.",
    rules: {
      r3Label: "Ставки новых планов могут меняться",
      r3Body: "Для нового стейкинга действует план на момент его начала. Для уже начатого сохраняются исходные ставка награды, срок и доля суммы, удерживаемая при досрочной разблокировке.",
      s3Step3Title: "Заберите в конце срока", faqQ3: "Что, если не забрать средства в конце срока?",
    },
  },
  kk: {
    days: "{n} күн",
    loading: "Жүктелуде…",
    unavailable: "Стейкинг ақпараты жүктелмеді. Кейінірек қайталап көріңіз.",
    stale: "Жаңарту сәтсіз. Бұрын жүктелген деректер көрсетілуде; әрекет жасамас бұрын жаңартыңыз.",
    retry: "Қайталау", empty: "Әзірге стейкинг жоқ", emptyDetail: "Стейкинг бастау үшін жоғарыдан жоспар таңдаңыз.",
    rateNotice: "Жаңа жоспарлардың мөлшерлемесі өзгеруі мүмкін. Басталған стейкинг өз мөлшерлемесін сақтайды.",
    rules: {
      r3Label: "Жаңа жоспарлардың мөлшерлемесі өзгеруі мүмкін",
      r3Body: "Жаңа стейкинг сол кездегі жоспар бойынша есептеледі. Басталған стейкинг өзінің бастапқы мөлшерлемесін, мерзімін және ерте ашу ақысын сақтайды.",
      s3Step3Title: "Мерзім соңында алу", faqQ3: "Мерзім соңында алмасам не болады?",
    },
  },
  uz: {
    days: "{n} kun",
    loading: "Yuklanmoqda…",
    unavailable: "Steyking maʼlumotlari yuklanmadi. Keyinroq qayta urinib koʻring.",
    stale: "Yangilab boʻlmadi. Oxirgi maʼlumotlar koʻrsatilmoqda; oʻzgartirishdan oldin yangilang.",
    retry: "Takrorlash", empty: "Hali steyking yoʻq", emptyDetail: "Steykingni boshlash uchun yuqoridagi rejani tanlang.",
    rateNotice: "Yangi rejalarda mukofot koʻrsatkichi oʻzgarishi mumkin. Boshlangan steykinglarda avvalgi koʻrsatkich saqlanadi.",
    rules: {
      r3Label: "Yangi rejada mukofot koʻrsatkichi oʻzgarishi mumkin",
      r3Body: "Yangi steykinglar oʻsha paytdagi reja boʻyicha hisoblanadi. Boshlangan steykinglarda dastlabki mukofot koʻrsatkichi, muddat va erta ochish haqi nisbati amal qiladi.",
      s3Step3Title: "Muddat oxirida oling", faqQ3: "Muddat oxirida olmasam nima boʻladi?",
    },
  },
};

export function stakingReviewCopy(locale: string) {
  const selected = copy[uiLocale(locale)];
  return { ...selected, days: (n: number) => selected.days.replace("{n}", String(n)) };
}

export function useStakingReviewCopy() {
  const locale = useLocaleStore();
  return computed(() => stakingReviewCopy(locale.code));
}
