import { computed } from "vue";
import { useLocaleStore } from "@/store/locale";
import { uiLocale } from "@/i18n";

const copy = {
  zh: {
    bankFooter: "请使用本人账户；有提现处理中时不可更换。未保存内容离页即清除。",
    bankRules: "绑定及换卡规则",
    addressLoading: "正在读取地址与保护期…",
    addressUnavailable: "地址信息暂不可用，当前地址及保护期尚无法确认。请重试。",
    retry: "重试",
  },
  en: {
    bankFooter: "Use your own account. Changes are blocked during a withdrawal. Unsaved details are cleared when you leave.",
    bankRules: "Linking and account change rules",
    addressLoading: "Loading address and protection period…",
    addressUnavailable: "Address details are unavailable. The current address and protection period cannot be confirmed. Please retry.",
    retry: "Retry",
  },
  vi: {
    bankFooter: "Dùng tài khoản của chính bạn. Không thể đổi khi đang xử lý lệnh rút. Nội dung chưa lưu sẽ bị xóa khi rời trang.",
    bankRules: "Quy tắc liên kết và đổi tài khoản",
    addressLoading: "Đang tải địa chỉ và thời gian bảo vệ…",
    addressUnavailable: "Chưa thể tải thông tin địa chỉ. Không thể xác nhận địa chỉ hiện tại và thời gian bảo vệ. Vui lòng thử lại.",
    retry: "Thử lại",
  },
  id: {
    bankFooter: "Gunakan rekening atas nama Anda sendiri. Rekening tidak bisa diganti saat penarikan diproses. Data yang belum disimpan hilang saat Anda meninggalkan halaman.",
    bankRules: "Aturan penautan & ganti rekening",
    addressLoading: "Memuat alamat dan masa perlindungan…",
    addressUnavailable: "Detail alamat tidak tersedia. Alamat saat ini dan masa perlindungannya belum dapat dikonfirmasi. Coba lagi.",
    retry: "Coba lagi",
  },
  ms: {
    bankFooter: "Gunakan akaun anda sendiri. Penukaran akaun disekat semasa pengeluaran diproses. Butiran yang belum disimpan akan dipadam apabila anda meninggalkan halaman ini.",
    bankRules: "Peraturan pemautan & penukaran",
    addressLoading: "Memuatkan alamat dan tempoh perlindungan…",
    addressUnavailable: "Butiran alamat tidak tersedia. Alamat semasa dan tempoh perlindungan tidak dapat disahkan. Sila cuba lagi.",
    retry: "Cuba lagi",
  },
  fil: {
    bankFooter: "Gamitin ang sarili mong account. Hindi ito mapapalitan habang may pinoprosesong withdrawal. Mabubura ang hindi na-save na detalye pag-alis mo.",
    bankRules: "Patakaran sa pag-link/pagpalit",
    addressLoading: "Nilo-load ang address at panahon ng proteksyon…",
    addressUnavailable: "Hindi available ang detalye ng address. Hindi pa makumpirma ang kasalukuyang address at panahon ng proteksyon. Subukan ulit.",
    retry: "Subukan ulit",
  },
  ru: {
    bankFooter: "Используйте свой счёт. Во время вывода сменить его нельзя. Несохранённые данные стираются при выходе.",
    bankRules: "Правила привязки и смены счёта",
    addressLoading: "Загружаем адрес и защитный период…",
    addressUnavailable: "Данные адреса недоступны. Текущий адрес и защитный период подтвердить нельзя. Повторите попытку.",
    retry: "Повторить",
  },
  kk: {
    bankFooter: "Өз шотыңызды қолданыңыз. Ақша шығару сұрауы өңделіп жатқанда шотты өзгерту мүмкін емес. Сақталмаған мәлімет беттен шыққанда өшіріледі.",
    bankRules: "Байланыстыру, өзгерту ережелері",
    addressLoading: "Мекенжай мен қауіпсіздік үшін күту кезеңі жүктелуде…",
    addressUnavailable: "Мекенжай мәліметі қолжетімсіз. Қазіргі мекенжай мен қауіпсіздік үшін күту кезеңін растау мүмкін болмады. Қайталап көріңіз.",
    retry: "Қайталау",
  },
  uz: {
    bankFooter: "Oʻz hisobingizdan foydalaning. Pul yechish jarayonida oʻzgartirib boʻlmaydi. Saqlanmagan maʼlumotlar chiqib ketganda oʻchadi.",
    bankRules: "Ulash va almashtirish qoidalari",
    addressLoading: "Manzil va himoya davri yuklanmoqda…",
    addressUnavailable: "Manzil maʼlumotlarini hozircha yuklab boʻlmaydi. Joriy manzil va himoya davrini tasdiqlab boʻlmaydi. Qayta urining.",
    retry: "Takrorlash",
  },
};
export function financeReviewCopy(locale: string) { return copy[uiLocale(locale)]; }
export function useFinanceReviewCopy() {
  const locale = useLocaleStore();
  return computed(() => financeReviewCopy(locale.code));
}
