import { computed } from "vue";
import { useLocaleStore } from "@/store/locale";
import { uiLocale } from "@/i18n";

export type EntrySurfaceKey = "signed" | "h5" | "white";

const copy = {
  zh: {
    navTitle: "使用指南", eyebrow: "开始使用", title: "选择使用方式",
    body: "在手机 App 中管理手机算力，或通过网页查看收益、设备与账户。",
    otherWays: "其他使用方式",
    surfaces: {
      signed: {
        linkLabel: "手机 App", summary: "校准、绑定并启用手机算力",
        kicker: "手机算力", title: "从手机 App 开始",
        body: "在手机 App 中完成校准与激活，之后可在设备页查看状态。",
        primaryLabel: "打开首页", secondaryLabel: "管理设备",
        steps: [
          { title: "登录手机 App", body: "使用你的账户登录，并按提示完成手机校准。" },
          { title: "绑定并激活", body: "前往设备页完成绑定，再按页面提示激活。" },
          { title: "查看记录", body: "设备激活后，可在收益页查看已完成作业与收益记录。" },
        ],
      },
      h5: {
        linkLabel: "网页查看", summary: "查看收益记录与设备状态",
        kicker: "随时查看", title: "用网页查看账户",
        body: "在浏览器中查看收益和设备。手机校准与激活需在手机 App 中完成。",
        primaryLabel: "查看收益", secondaryLabel: "管理设备",
        steps: [
          { title: "查看收益", body: "打开收益页，查看已完成作业和收益记录。" },
          { title: "查看设备", body: "在设备页查看已绑定设备及其最新状态。" },
          { title: "启用手机算力", body: "如需校准或激活手机，请前往手机 App。" },
        ],
      },
      white: {
        linkLabel: "账户管理", summary: "查看账户概览与登录安全",
        kicker: "账户与安全", title: "管理你的账户",
        body: "从首页查看账户概览，或前往安全设置管理登录方式与登录设备。",
        primaryLabel: "打开首页", secondaryLabel: "登录与安全",
        steps: [
          { title: "查看账户概览", body: "在首页查看收益、设备和待办事项。" },
          { title: "检查登录安全", body: "查看登录设备，管理账户的安全设置。" },
          { title: "查找帮助", body: "遇到问题时，可从首页帮助入口获取支持。" },
        ],
      },
    },
  },
  en: {
    navTitle: "Getting started", eyebrow: "Get started", title: "Choose how to use UVEL",
    body: "Manage phone computing in the phone app, or view earnings, devices and your account on the web.",
    otherWays: "Other ways to use UVEL",
    surfaces: {
      signed: {
        linkLabel: "Phone app", summary: "Calibrate, link and activate phone computing",
        kicker: "Phone computing", title: "Start with the phone app",
        body: "Calibrate and activate in the phone app, then check its status on the devices page.",
        primaryLabel: "Open home", secondaryLabel: "Manage devices",
        steps: [
          { title: "Sign in on your phone", body: "Sign in to your account and follow the phone calibration steps." },
          { title: "Link and activate", body: "Open the devices page to link your phone, then follow the activation steps." },
          { title: "View records", body: "After activation, check completed jobs and earnings on the earnings page." },
        ],
      },
      h5: {
        linkLabel: "Web access", summary: "View earnings records and device status",
        kicker: "Check anytime", title: "View your account on the web",
        body: "Check earnings and devices in your browser. Phone calibration and activation require the phone app.",
        primaryLabel: "View earnings", secondaryLabel: "Manage devices",
        steps: [
          { title: "View earnings", body: "Open the earnings page to check completed jobs and earnings records." },
          { title: "View devices", body: "Check your linked devices and their latest status on the devices page." },
          { title: "Activate phone computing", body: "Use the phone app to calibrate or activate your phone." },
        ],
      },
      white: {
        linkLabel: "Account management", summary: "Check your account overview and sign-in security",
        kicker: "Account and security", title: "Manage your account",
        body: "View your account overview from home, or manage sign-in methods and devices in security settings.",
        primaryLabel: "Open home", secondaryLabel: "Sign-in and security",
        steps: [
          { title: "View your overview", body: "Check earnings, devices and tasks on the home page." },
          { title: "Review sign-in security", body: "Review signed-in devices and manage your security settings." },
          { title: "Find help", body: "Use the help entry on the home page when you need support." },
        ],
      },
    },
  },
  vi: {
    navTitle: "Hướng dẫn sử dụng", eyebrow: "Bắt đầu", title: "Chọn cách sử dụng UVEL",
    body: "Quản lý năng lực tính toán của điện thoại trong ứng dụng điện thoại, hoặc xem thu nhập, thiết bị và tài khoản trên web.",
    otherWays: "Cách sử dụng khác",
    surfaces: {
      signed: {
        linkLabel: "Ứng dụng điện thoại", summary: "Hiệu chuẩn, liên kết và kích hoạt điện thoại",
        kicker: "Tính toán trên điện thoại", title: "Bắt đầu với ứng dụng điện thoại",
        body: "Hiệu chuẩn và kích hoạt trong ứng dụng điện thoại, sau đó xem trạng thái tại trang thiết bị.",
        primaryLabel: "Mở trang chủ", secondaryLabel: "Quản lý thiết bị",
        steps: [
          { title: "Đăng nhập trên điện thoại", body: "Đăng nhập tài khoản và làm theo hướng dẫn hiệu chuẩn điện thoại." },
          { title: "Liên kết và kích hoạt", body: "Mở trang thiết bị để liên kết điện thoại, rồi làm theo hướng dẫn kích hoạt." },
          { title: "Xem lịch sử", body: "Sau khi kích hoạt, xem tác vụ đã hoàn thành và thu nhập tại trang thu nhập." },
        ],
      },
      h5: {
        linkLabel: "Truy cập web", summary: "Xem lịch sử thu nhập và trạng thái thiết bị",
        kicker: "Xem bất cứ lúc nào", title: "Xem tài khoản trên web",
        body: "Xem thu nhập và thiết bị trong trình duyệt. Cần ứng dụng điện thoại để hiệu chuẩn và kích hoạt điện thoại.",
        primaryLabel: "Xem thu nhập", secondaryLabel: "Quản lý thiết bị",
        steps: [
          { title: "Xem thu nhập", body: "Mở trang thu nhập để xem tác vụ đã hoàn thành và lịch sử thu nhập." },
          { title: "Xem thiết bị", body: "Xem thiết bị đã liên kết và trạng thái mới nhất tại trang thiết bị." },
          { title: "Kích hoạt điện thoại", body: "Dùng ứng dụng điện thoại để hiệu chuẩn hoặc kích hoạt." },
        ],
      },
      white: {
        linkLabel: "Quản lý tài khoản", summary: "Xem tổng quan tài khoản và bảo mật đăng nhập",
        kicker: "Tài khoản và bảo mật", title: "Quản lý tài khoản của bạn",
        body: "Xem tổng quan tại trang chủ, hoặc quản lý phương thức đăng nhập và thiết bị trong cài đặt bảo mật.",
        primaryLabel: "Mở trang chủ", secondaryLabel: "Đăng nhập và bảo mật",
        steps: [
          { title: "Xem tổng quan", body: "Xem thu nhập, thiết bị và việc cần làm tại trang chủ." },
          { title: "Kiểm tra bảo mật", body: "Xem thiết bị đăng nhập và quản lý cài đặt bảo mật." },
          { title: "Tìm trợ giúp", body: "Mở mục trợ giúp trên trang chủ khi cần hỗ trợ." },
        ],
      },
    },
  },
  id: {
    navTitle: "Panduan memulai", eyebrow: "Mulai", title: "Pilih cara memakai UVEL",
    body: "Kelola komputasi ponsel di aplikasi ponsel, atau lihat pendapatan, perangkat, dan akun Anda di web.",
    otherWays: "Cara lain memakai UVEL",
    surfaces: {
      signed: {
        linkLabel: "Aplikasi ponsel", summary: "Kalibrasi, tautkan, dan aktifkan komputasi ponsel",
        kicker: "Komputasi ponsel", title: "Mulai dari aplikasi ponsel",
        body: "Kalibrasi dan aktifkan di aplikasi ponsel, lalu cek statusnya di halaman perangkat.",
        primaryLabel: "Buka Beranda", secondaryLabel: "Kelola perangkat",
        steps: [
          { title: "Masuk di aplikasi ponsel", body: "Masuk ke akun Anda dan ikuti langkah kalibrasi ponsel." },
          { title: "Tautkan dan aktifkan", body: "Buka halaman perangkat untuk menautkan ponsel, lalu ikuti langkah aktivasi." },
          { title: "Lihat catatan", body: "Setelah aktif, cek tugas yang selesai dan pendapatan di halaman Pendapatan." },
        ],
      },
      h5: {
        linkLabel: "Akses web", summary: "Lihat catatan pendapatan dan status perangkat",
        kicker: "Cek kapan saja", title: "Lihat akun Anda di web",
        body: "Cek pendapatan dan perangkat di browser. Kalibrasi dan aktivasi ponsel memerlukan aplikasi ponsel.",
        primaryLabel: "Lihat pendapatan", secondaryLabel: "Kelola perangkat",
        steps: [
          { title: "Lihat pendapatan", body: "Buka halaman Pendapatan untuk mengecek tugas yang selesai dan catatan pendapatan." },
          { title: "Lihat perangkat", body: "Cek perangkat tertaut dan status terbarunya di halaman perangkat." },
          { title: "Aktifkan komputasi ponsel", body: "Gunakan aplikasi ponsel untuk kalibrasi atau aktivasi ponsel Anda." },
        ],
      },
      white: {
        linkLabel: "Kelola akun", summary: "Cek ringkasan akun dan keamanan masuk",
        kicker: "Akun dan keamanan", title: "Kelola akun Anda",
        body: "Lihat ringkasan akun dari Beranda, atau kelola cara masuk dan perangkat di pengaturan keamanan.",
        primaryLabel: "Buka Beranda", secondaryLabel: "Masuk & keamanan",
        steps: [
          { title: "Lihat ringkasan", body: "Cek pendapatan, perangkat, dan hal yang perlu dilakukan di Beranda." },
          { title: "Tinjau keamanan masuk", body: "Periksa perangkat yang digunakan untuk masuk dan kelola pengaturan keamanan Anda." },
          { title: "Cari bantuan", body: "Gunakan menu bantuan di Beranda saat butuh bantuan." },
        ],
      },
    },
  },
  ms: {
    navTitle: "Panduan bermula", eyebrow: "Mula", title: "Pilih cara menggunakan UVEL",
    body: "Urus pengkomputeran telefon dalam app telefon, atau lihat pendapatan, peranti dan akaun anda di web.",
    otherWays: "Cara lain menggunakan UVEL",
    surfaces: {
      signed: {
        linkLabel: "App telefon", summary: "Tentukur, pautkan dan aktifkan pengkomputeran telefon",
        kicker: "Pengkomputeran telefon", title: "Mula dengan app telefon",
        body: "Tentukur dan aktifkan dalam app telefon, kemudian semak statusnya di halaman peranti.",
        primaryLabel: "Buka Utama", secondaryLabel: "Urus peranti",
        steps: [
          { title: "Log masuk di telefon", body: "Log masuk ke akaun anda dan ikuti langkah penentukuran telefon." },
          { title: "Pautkan dan aktifkan", body: "Buka halaman peranti untuk memautkan telefon anda, kemudian ikuti langkah pengaktifan." },
          { title: "Lihat rekod", body: "Selepas pengaktifan, semak kerja selesai dan pendapatan di halaman pendapatan." },
        ],
      },
      h5: {
        linkLabel: "Akses web", summary: "Lihat rekod pendapatan dan status peranti",
        kicker: "Semak bila-bila masa", title: "Lihat akaun anda di web",
        body: "Semak pendapatan dan peranti dalam pelayar anda. Penentukuran dan pengaktifan telefon memerlukan app telefon.",
        primaryLabel: "Lihat pendapatan", secondaryLabel: "Urus peranti",
        steps: [
          { title: "Lihat pendapatan", body: "Buka halaman pendapatan untuk menyemak kerja selesai dan rekod pendapatan." },
          { title: "Lihat peranti", body: "Semak peranti terpaut anda dan status terkininya di halaman peranti." },
          { title: "Aktifkan pengkomputeran", body: "Gunakan app telefon untuk menentukur atau mengaktifkan telefon anda." },
        ],
      },
      white: {
        linkLabel: "Pengurusan akaun", summary: "Semak ringkasan akaun dan keselamatan log masuk",
        kicker: "Akaun dan keselamatan", title: "Urus akaun anda",
        body: "Lihat ringkasan akaun anda dari Utama, atau urus cara log masuk dan peranti dalam tetapan keselamatan.",
        primaryLabel: "Buka Utama", secondaryLabel: "Log masuk & keselamatan",
        steps: [
          { title: "Lihat ringkasan akaun", body: "Semak pendapatan, peranti dan tugasan di halaman Utama." },
          { title: "Semak keselamatan log masuk", body: "Semak peranti yang log masuk dan urus tetapan keselamatan anda." },
          { title: "Dapatkan bantuan", body: "Buka bahagian Bantuan di halaman Utama apabila anda memerlukan bantuan." },
        ],
      },
    },
  },
  fil: {
    navTitle: "Pagsisimula", eyebrow: "Magsimula", title: "Paano gagamitin ang UVEL",
    body: "Pamahalaan ang compute ng phone sa app sa phone, o tingnan ang kita, device at account mo sa web.",
    otherWays: "Iba pang paraan ng paggamit",
    surfaces: {
      signed: {
        linkLabel: "App sa phone", summary: "I-calibrate, i-link at i-activate ang compute ng phone",
        kicker: "Compute ng phone", title: "Magsimula sa app sa phone",
        body: "Mag-calibrate at mag-activate sa app sa phone, saka tingnan ang status nito sa page ng device.",
        primaryLabel: "Buksan ang Home", secondaryLabel: "Pamahalaan ang device",
        steps: [
          { title: "Mag-log in sa phone mo", body: "Mag-log in sa account mo at sundin ang mga hakbang sa calibration ng phone." },
          { title: "I-link at i-activate", body: "Buksan ang page ng device para i-link ang phone mo, saka sundin ang mga hakbang sa activation." },
          { title: "Tingnan ang record", body: "Pagka-activate, tingnan ang natapos na job at record ng kita sa tab na Kumita." },
        ],
      },
      h5: {
        linkLabel: "Access sa web", summary: "Tingnan ang record ng kita at status ng device",
        kicker: "Tingnan anumang oras", title: "Tingnan ang account mo sa web",
        body: "Tingnan ang kita at device sa browser mo. Kailangan ang app sa phone para sa calibration at activation ng phone.",
        primaryLabel: "Tingnan ang kita", secondaryLabel: "Pamahalaan ang device",
        steps: [
          { title: "Tingnan ang kita", body: "Buksan ang tab na Kumita para makita ang natapos na job at record ng kita." },
          { title: "Tingnan ang device", body: "Tingnan sa page ng device ang mga naka-link mong device at ang pinakabagong status nila." },
          { title: "I-activate ang compute ng phone", body: "Gamitin ang app sa phone para i-calibrate o i-activate ang phone mo." },
        ],
      },
      white: {
        linkLabel: "Pamamahala ng account", summary: "Tingnan ang buod ng account at seguridad ng pag-log in",
        kicker: "Account at seguridad", title: "Ang account mo",
        body: "Tingnan ang buod ng account mo sa Home, o pamahalaan ang paraan ng pag-log in at mga device sa setting ng seguridad.",
        primaryLabel: "Buksan ang Home", secondaryLabel: "Pag-log in at seguridad",
        steps: [
          { title: "Tingnan ang buod mo", body: "Tingnan ang kita, device at mga task sa Home." },
          { title: "Suriin ang seguridad", body: "Suriin ang mga naka-log in na device at pamahalaan ang setting ng seguridad mo." },
          { title: "Humanap ng tulong", body: "Buksan ang tulong sa Home kapag kailangan mo ng support." },
        ],
      },
    },
  },
  ru: {
    navTitle: "С чего начать", eyebrow: "Начало", title: "Как пользоваться UVEL",
    body: "Управляйте вычислениями на телефоне в приложении или смотрите доход, устройства и аккаунт в браузере.",
    otherWays: "Другие способы",
    surfaces: {
      signed: {
        linkLabel: "Приложение", summary: "Калибровка, привязка и запуск вычислений на телефоне",
        kicker: "Вычисления на телефоне", title: "Начните с приложения",
        body: "Откалибруйте и активируйте телефон в приложении, затем следите за статусом на странице устройств.",
        primaryLabel: "На главную", secondaryLabel: "Устройства",
        steps: [
          { title: "Войдите на телефоне", body: "Войдите в аккаунт и следуйте инструкциям по калибровке телефона." },
          { title: "Привяжите и активируйте", body: "Откройте страницу устройств, привяжите телефон и следуйте инструкциям по активации." },
          { title: "Смотрите записи", body: "После активации выполненные задачи и доход видны в разделе «Заработок»." },
        ],
      },
      h5: {
        linkLabel: "В браузере", summary: "История дохода и статус устройств",
        kicker: "В любое время", title: "Аккаунт в браузере",
        body: "Смотрите доход и устройства в браузере. Калибровка и активация телефона — только в приложении.",
        primaryLabel: "Доход", secondaryLabel: "Устройства",
        steps: [
          { title: "Доход", body: "Откройте «Заработок», чтобы увидеть выполненные задачи и историю дохода." },
          { title: "Устройства", body: "Привязанные устройства и их статус — на странице устройств." },
          { title: "Запуск вычислений на телефоне", body: "Калибровка и активация телефона — в приложении." },
        ],
      },
      white: {
        linkLabel: "Аккаунт", summary: "Обзор аккаунта и безопасность входа",
        kicker: "Аккаунт и безопасность", title: "Ваш аккаунт",
        body: "Смотрите обзор аккаунта на главной или управляйте способами входа и устройствами в настройках безопасности.",
        primaryLabel: "На главную", secondaryLabel: "Вход и безопасность",
        steps: [
          { title: "Обзор аккаунта", body: "Доход, устройства и задачи — на главной." },
          { title: "Безопасность входа", body: "Проверьте устройства, где выполнен вход, и настройки безопасности." },
          { title: "Помощь", body: "Если нужна помощь, откройте справку на главной." },
        ],
      },
    },
  },
  kk: {
    navTitle: "Бастау", eyebrow: "Бастау", title: "UVEL-ді қолдану тәсілі",
    body: "Телефон есептеу қуатын телефон қолданбасында басқарыңыз немесе табысты, құрылғыларды және аккаунтты вебте қараңыз.",
    otherWays: "Қолданудың басқа жолдары",
    surfaces: {
      signed: {
        linkLabel: "Телефон қолданбасы", summary: "Телефон есептеу қуатын калибрлеу, байланыстыру, белсендіру",
        kicker: "Телефон есептеу қуаты", title: "Телефон қолданбасынан бастаңыз",
        body: "Телефон қолданбасында калибрлеп, белсендіріңіз, сосын күйін құрылғылар бетінен қараңыз.",
        primaryLabel: "Басты бетті ашу", secondaryLabel: "Құрылғыларды басқару",
        steps: [
          { title: "Телефон қолданбасына кіріңіз", body: "Аккаунтыңызға кіріп, телефонды калибрлеу қадамдарын орындаңыз." },
          { title: "Байланыстыру, белсендіру", body: "Телефонды байланыстыру үшін құрылғылар бетін ашып, белсендіру қадамдарын орындаңыз." },
          { title: "Жазбаларды қарау", body: "Белсендірілгеннен кейін аяқталған жұмыстар мен табысты «Табыс» бетінен қараңыз." },
        ],
      },
      h5: {
        linkLabel: "Веб арқылы кіру", summary: "Табыс жазбалары мен құрылғы күйін қарау",
        kicker: "Кез келген уақытта", title: "Аккаунтыңызды вебте қараңыз",
        body: "Табыс пен құрылғыларды браузерде қараңыз. Телефонды калибрлеу және белсендіру үшін телефон қолданбасы қажет.",
        primaryLabel: "Табысты қарау", secondaryLabel: "Құрылғыларды басқару",
        steps: [
          { title: "Табысты қарау", body: "Аяқталған жұмыстар мен табыс жазбаларын көру үшін «Табыс» бетін ашыңыз." },
          { title: "Құрылғыны қарау", body: "Байланыстырылған құрылғылар мен олардың соңғы күйін құрылғылар бетінен қараңыз." },
          { title: "Есептеу қуатын белсендіру", body: "Телефонды калибрлеу не белсендіру үшін телефон қолданбасын пайдаланыңыз." },
        ],
      },
      white: {
        linkLabel: "Аккаунтты басқару", summary: "Аккаунтқа шолу және кіру қауіпсіздігін тексеру",
        kicker: "Аккаунт және қауіпсіздік", title: "Аккаунтты басқару",
        body: "Аккаунтқа шолуды басты беттен қараңыз немесе кіру әдістері мен құрылғыларды қауіпсіздік баптауларында басқарыңыз.",
        primaryLabel: "Басты бетті ашу", secondaryLabel: "Кіру және қауіпсіздік",
        steps: [
          { title: "Шолуды қарау", body: "Табысты, құрылғыларды және тапсырмаларды басты беттен қараңыз." },
          { title: "Кіру қауіпсіздігін тексеру", body: "Кірген құрылғыларды қарап, қауіпсіздік баптауларын басқарыңыз." },
          { title: "Көмек табу", body: "Қолдау керек болса, басты беттегі анықтама бөлімін пайдаланыңыз." },
        ],
      },
    },
  },
  uz: {
    navTitle: "Boshlash", eyebrow: "Boshlash", title: "Foydalanish usulini tanlang",
    body: "Telefon quvvatini telefon ilovasida boshqaring yoki daromad, qurilmalar va akkauntni vebda koʻring.",
    otherWays: "Boshqa foydalanish usullari",
    surfaces: {
      signed: {
        linkLabel: "Telefon ilovasi", summary: "Telefonni kalibrlab, bogʻlang va hisoblash quvvatini yoqing",
        kicker: "Telefon quvvati", title: "Telefon ilovasidan boshlang",
        body: "Telefon ilovasida kalibrlang va faollashtiring, soʻng holatini qurilmalar sahifasida tekshiring.",
        primaryLabel: "Bosh sahifa", secondaryLabel: "Qurilmalar",
        steps: [
          { title: "Telefonda kiring", body: "Akkauntingizga kiring va telefonni kalibrlash qadamlarini bajaring." },
          { title: "Bogʻlang va yoqing", body: "Telefonni bogʻlash uchun qurilmalar sahifasini oching, soʻng faollashtirish qadamlarini bajaring." },
          { title: "Tarixni koʻring", body: "Faollashtirilgach, bajarilgan ishlar va daromadni daromad sahifasida koʻring." },
        ],
      },
      h5: {
        linkLabel: "Veb orqali", summary: "Daromad tarixi va qurilma holatini koʻring",
        kicker: "Istalgan vaqtda", title: "Akkauntni vebda koʻring",
        body: "Daromad va qurilmalarni brauzerda koʻring. Telefonni kalibrlash va faollashtirish uchun telefon ilovasi kerak.",
        primaryLabel: "Daromadni koʻrish", secondaryLabel: "Qurilmalar",
        steps: [
          { title: "Daromadni koʻring", body: "Bajarilgan ishlar va daromad tarixini koʻrish uchun daromad sahifasini oching." },
          { title: "Qurilmalar", body: "Bogʻlangan qurilmalaringiz va ularning soʻnggi holatini qurilmalar sahifasida koʻring." },
          { title: "Telefon quvvatini yoqing", body: "Telefonni kalibrlash yoki faollashtirish telefon ilovasida." },
        ],
      },
      white: {
        linkLabel: "Akkauntni boshqarish", summary: "Akkauntning umumiy holati va kirish xavfsizligini koʻring",
        kicker: "Akkaunt va xavfsizlik", title: "Akkaunt boshqaruvi",
        body: "Bosh sahifada akkauntning umumiy holatini koʻring yoki kirish usullari va qurilmalarni xavfsizlik sozlamalarida boshqaring.",
        primaryLabel: "Bosh sahifa", secondaryLabel: "Kirish va xavfsizlik",
        steps: [
          { title: "Umumiy holatni koʻring", body: "Daromad, qurilmalar va vazifalarni bosh sahifada koʻring." },
          { title: "Kirish xavfsizligi", body: "Kirgan qurilmalarni koʻrib chiqing va xavfsizlik sozlamalarini boshqaring." },
          { title: "Yordam topish", body: "Yordam kerak boʻlsa, bosh sahifadagi yordam boʻlimidan foydalaning." },
        ],
      },
    },
  },
};

export function entrySurfaceCopyFor(locale: string) {
  return copy[uiLocale(locale)];
}

export function useEntrySurfaceCopy() {
  const locale = useLocaleStore();
  return computed(() => entrySurfaceCopyFor(locale.code));
}
