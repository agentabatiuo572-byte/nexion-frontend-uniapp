<!--
  ReceiptModal — ported from
  Nexion-prototype/app/components/receipt/receipt-modal.tsx.
  Bottom-anchored detail sheet for a Proof-of-Compute (or legacy wallet-verification) receipt. Scrim +
  slide-up card (nx-step-in, tokens.css). Sections rendered generically from a
  computed `sections` descriptor (the source's Row/RowCopy/Section/DetailsRows
  components collapse into {k, v, accent, muted, strong, copyValue, hint} rows).
  framer AnimatePresence → v-if + CSS. ESC handler dropped (mobile).
  Tap-to-copy on hash/signature/wallet rows (uni.setClipboardData + toast +
  transient ✓ icon, mirrors prototype RowCopy). Driven by
  :receipt prop (null = hidden) + @close emit (P-032: page-mounted sheet,
  prop/emit — no chassis-level overlay host).
-->
<template>
  <view v-if="receipt" class="nx-receipt-modal-root" role="dialog" aria-modal="true" :aria-label="receiptTitle">
    <view class="nx-receipt-scrim" :style="scrimStyle" @click="emit('close')">
    <view class="nx-step-in" :style="sheetStyle" @click.stop>
      <!-- Close -->
      <view class="grid place-items-center active:opacity-60" :style="closeBtnStyle" role="button" tabindex="0" :aria-label="t.ui.close" @click="emit('close')" @keydown.enter.prevent="emit('close')" @keydown.space.prevent="emit('close')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
      </view>

      <!-- Header -->
      <view :style="headerStyle">
        <text class="block" :style="headerKickerStyle">{{ receiptTitle }}</text>
        <view class="flex items-center" style="margin-top: 8px; gap: 8px">
          <text v-if="isReceiptSettled" class="inline-flex items-center" :style="stampStyle">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" :stroke="stampColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            <text style="margin-left: 4px">{{ isSimulatedReceipt ? copy.posted : t.receipt.stampVerified }}</text>
          </text>
          <text class="nx-receipt-line" style="font-size: var(--ui-type-list-subtitle); color: var(--v5-ink-2)">{{ receiptStatus }} · {{ receiptTime }}</text>
        </view>
      </view>

      <view class="nx-receipt-body" :style="bodyStyle">
      <view :style="summaryStyle">
        <text class="block" style="font-size:var(--ui-type-list-subtitle);color:var(--v5-ink-2)">{{ copy.result }}</text>
        <text class="nx-receipt-line tabular-nums" :title="summaryAmount" style="font-family: var(--font-amount); margin-top:6px;font-size:26px;line-height:1.3;font-weight:600">{{ summaryAmount }}</text>
      </view>
      <!-- Only identifiers and hashes use monospace; raw values remain unchanged. -->
      <view v-for="(sec, si) in visibleSections" :key="si" :style="sectionStyle(si)">
        <text class="block" :style="sectionHeadStyle">{{ sec.heading || sectionHeading(sec) }}</text>
        <view
          v-for="(row, ri) in sec.rows"
          :key="ri"
          class="nx-receipt-row"
          :style="rowStyle"
        >
          <text class="nx-receipt-line" :title="fieldLabel(row.k)" style="color:var(--v5-ink-2)">{{ fieldLabel(row.k) }}</text>
          <view v-if="row.divider" :style="dividerStyle" />
          <view
            v-else-if="row.copyValue"
            class="flex items-center active:opacity-60"
            :style="copyRowStyle"
            role="button"
            tabindex="0"
            :aria-label="copy.copy + ' ' + fieldLabel(row.k)"
            @click="copyRow(row.copyKey ?? row.k, row.copyValue ?? '')"
            @keydown.enter.prevent="copyRow(row.copyKey ?? row.k, row.copyValue ?? '')"
            @keydown.space.prevent="copyRow(row.copyKey ?? row.k, row.copyValue ?? '')"
          >
            <text class="nx-receipt-line" style="font-family:var(--font-jet-mono),ui-monospace,monospace;color:var(--v5-ink)">{{ receiptLine(row.v) }}</text>
            <text v-if="row.hint" class="nx-receipt-line" style="color:var(--v5-ink-2);font-size:12px">({{ row.hint }})</text>
            <!-- Check when just-copied, else Copy affordance (mirrors prototype RowCopy) -->
            <svg v-if="copiedField === (row.copyKey ?? row.k)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-brand)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><path d="M20 6 9 17l-5-5" /></svg>
            <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-ink-4)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
          </view>
          <text v-else class="nx-receipt-line text-right" :style="valueStyle(row)" :title="row.v" @longpress="row.v && copyRow(row.k, row.v)">{{ receiptLine(row.v) }}</text>
        </view>
        <!-- 历史验证回执的核验清单(渲染兜底,仅存量数据) -->
        <view v-if="sec.checks" style="margin-top: 4px">
          <view v-for="chk in sec.checks" :key="chk" class="flex items-center" style="gap: 8px; padding: 2px 0">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--v5-tech-cyan-ink)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0"><path d="M20 6 9 17l-5-5" /></svg>
            <text class="nx-receipt-line" :title="chk" style="font-size:var(--ui-type-list-subtitle);color:var(--v5-ink-2)">{{ receiptLine(chk) }}</text>
            <text class="nx-receipt-line" style="flex-shrink:0;margin-left:auto;font-size:var(--ui-type-list-subtitle);color:var(--v5-ink-2)">{{ t.uiChrome.passed }}</text>
          </view>
        </view>
      </view>
      </view>
    </view>
  </view>
  </view>
</template>

<script setup lang="ts">
import { formatDisplayDateTime } from "@/lib/display-date";
import { formatAmount, formatGroupedAmount } from "@/lib/amount-display";
import { receiptLine } from "@/lib/receipt-line";
import { computed, ref, onUnmounted, type CSSProperties } from "vue";
import { useDialogA11y } from "@/composables/use-dialog-a11y";
import type { Receipt, ReceiptDetails } from "@/mock/receipt";
import { shortenHex } from "@/mock/receipt";
import type { CanonicalComputeReceipt } from "@/api/task-assignment-api";
import { useT } from "@/i18n/use-t";
import { useLocaleStore } from "@/store/locale";
import { workloadLabel } from "@/lib/workload-label";
import { toast } from "@/store/ui";
import { uiLocale, type UiLocale } from "@/i18n";

const props = defineProps<{ receipt: Receipt | CanonicalComputeReceipt | null }>();
const emit = defineEmits<{ (e: "close"): void }>();

const t = useT();
const locale = useLocaleStore();
// 2026-10 review: user-facing labels are localized; identifiers and proof values stay exact.
const copyByLocale = {
  zh: { taskReceipt:"任务凭证", posted:"已入账", taskRuntime:"任务时间", taskDevice:"设备信息", result:"收益金额", copy:"复制", job:"作业与凭证", client:"委托方", device:"执行设备", runtime:"执行时间与用量", rewards:"收益明细", proof:"核验信息", checks:"历史核验记录", pending:"待结算", failed:"结算失败", unknown:"状态待确认", purpose:"钱包归属证明", images:"张图像" },
  en: { taskReceipt:"Task receipt", posted:"Posted", taskRuntime:"Task times", taskDevice:"Device information", result:"Reward amount", copy:"Copy", job:"Job and receipt", client:"Client", device:"Execution device", runtime:"Runtime and usage", rewards:"Reward breakdown", proof:"Verification details", checks:"Historical verification", pending:"Pending settlement", failed:"Settlement failed", unknown:"Status unconfirmed", purpose:"Wallet ownership proof", images:"images" },
  vi: { taskReceipt:"Biên nhận tác vụ", posted:"Đã ghi có", taskRuntime:"Thời gian tác vụ", taskDevice:"Thông tin thiết bị", result:"Số tiền thu nhập", copy:"Sao chép", job:"Tác vụ và biên nhận", client:"Khách hàng", device:"Thiết bị thực hiện", runtime:"Thời gian và mức sử dụng", rewards:"Chi tiết thu nhập", proof:"Thông tin xác minh", checks:"Xác minh trước đây", pending:"Chờ quyết toán", failed:"Quyết toán thất bại", unknown:"Chưa xác nhận trạng thái", purpose:"Bằng chứng sở hữu ví", images:"hình ảnh" },
  id: { taskReceipt:"Kuitansi tugas", posted:"Masuk", taskRuntime:"Waktu tugas", taskDevice:"Informasi perangkat", result:"Jumlah hadiah", copy:"Salin", job:"Tugas dan kuitansi", client:"Klien", device:"Perangkat pelaksana", runtime:"Durasi dan pemakaian", rewards:"Rincian hadiah", proof:"Detail verifikasi", checks:"Riwayat verifikasi", pending:"Menunggu pembayaran", failed:"Pembayaran gagal", unknown:"Status belum terkonfirmasi", purpose:"Bukti kepemilikan dompet", images:"gambar" },
  ms: { taskReceipt:"Resit tugasan", posted:"Dikreditkan", taskRuntime:"Masa tugasan", taskDevice:"Maklumat peranti", result:"Jumlah ganjaran", copy:"Salin", job:"Kerja dan resit", client:"Pelanggan", device:"Peranti pelaksana", runtime:"Tempoh pelaksanaan & penggunaan", rewards:"Pecahan ganjaran", proof:"Butiran pengesahan", checks:"Sejarah pengesahan", pending:"Menunggu pembayaran", failed:"Pembayaran gagal", unknown:"Status belum disahkan", purpose:"Bukti pemilikan dompet", images:"imej" },
  fil: { taskReceipt:"Resibo ng task", posted:"Naitala", taskRuntime:"Oras ng task", taskDevice:"Impormasyon ng device", result:"Halaga ng reward", copy:"Kopyahin", job:"Job at resibo", client:"Client", device:"Device na gumawa", runtime:"Runtime at paggamit", rewards:"Breakdown ng reward", proof:"Detalye ng beripikasyon", checks:"Mga tala ng beripikasyon", pending:"Hinihintay ang payout", failed:"Nabigo ang payout", unknown:"Hindi kumpirmado ang status", purpose:"Patunay ng pag-aari ng wallet", images:"larawan" },
  ru: { taskReceipt:"Квитанция о задаче", posted:"Зачислено", taskRuntime:"Время задачи", taskDevice:"Об устройстве", result:"Сумма награды", copy:"Копировать", job:"Задача и квитанция", client:"Заказчик", device:"Устройство", runtime:"Время и ресурсы", rewards:"Состав награды", proof:"Данные проверки", checks:"История проверок", pending:"Ждёт выплаты", failed:"Выплата не прошла", unknown:"Статус не подтверждён", purpose:"Владение кошельком", images:"изобр." },
  kk: { taskReceipt:"Тапсырма түбіртегі", posted:"Түсті", taskRuntime:"Тапсырма уақыты", taskDevice:"Құрылғы ақпараты", result:"Сыйақы сомасы", copy:"Көшіру", job:"Жұмыс және түбіртек", client:"Клиент", device:"Орындаған құрылғы", runtime:"Орындалу уақыты мен көлемі", rewards:"Сыйақы мәліметі", proof:"Тексеру мәліметі", checks:"Бұрынғы тексерулер", pending:"Төлем күтілуде", failed:"Төлем сәтсіз", unknown:"Күйі расталмады", purpose:"Әмиян иелігінің растамасы", images:"сурет" },
  uz: { taskReceipt:"Vazifa cheki", posted:"Hisobga tushdi", taskRuntime:"Vazifa vaqti", taskDevice:"Qurilma maʼlumotlari", result:"Mukofot summasi", copy:"Nusxalash", job:"Ish va chek", client:"Buyurtmachi", device:"Bajargan qurilma", runtime:"Bajarilish vaqti va sarf", rewards:"Mukofot tafsiloti", proof:"Tekshiruv maʼlumotlari", checks:"Tekshiruvlar tarixi", pending:"Toʻlov kutilmoqda", failed:"Toʻlov amalga oshmadi", unknown:"Holat tasdiqlanmagan", purpose:"Hamyon egaligi isboti", images:"ta rasm" },
};
const receiptLocale = computed(() => uiLocale(locale.code));
const copy = computed(() => copyByLocale[receiptLocale.value]);
const fieldLabels: Record<UiLocale, Record<string, string>> = {
  zh: { receipt_no:"凭证编号", task_no:"作业编号", task_type:"作业类型", task_name:"作业名称", model:"模型", client:"委托方", status:"结算状态", device:"设备", device_instance:"设备编号", device_type:"设备型号", gpu:"显卡", vram:"显存", started_at:"开始时间", duration:"执行时长", completed_at:"完成时间", reward_usdt:"USDT 收益", reward_nex:"UVT 奖励", proof_hash:"证明哈希", receipt_hash:"证明哈希", compliance_id:"核验编号", type:"类型", program:"核验程序", authority:"核验方", paired_wallet:"关联钱包", network:"网络", signature:"签名", deposit:"存入金额", purpose:"用途", credited:"到账金额", tx_hash:"交易哈希", block:"区块编号", verified_at:"核验时间", job_id:"作业编号", client_addr:"委托方地址", gpu_fingerprint:"显卡标识", vram_peak:"峰值显存 / 总显存", energy:"耗电量", unit_price:"单价", units:"计费数量", gross:"总收益", network_fee:"网络费用", net_paid:"到账金额", resolution:"分辨率", batch_size:"批次大小", output:"产出", clip_duration:"视频时长", fps:"帧率", frames:"帧数", model_size:"模型规模", input_tokens:"输入词元", output_tokens:"输出词元", latency:"响应延迟", training_steps:"训练步数", final_loss:"最终损失值", chunks:"文本分块", total_tokens:"总词元数", embedding_dim:"向量维度", audio_duration:"音频时长", wer:"词错误率", language:"识别语言" },
  en: { receipt_no:"Receipt number", task_no:"Job number", task_type:"Job type", task_name:"Job name", model:"Model", client:"Client", status:"Settlement status", device:"Device", device_instance:"Device number", device_type:"Device model", gpu:"GPU", vram:"Video memory", started_at:"Started", duration:"Duration", completed_at:"Completed", reward_usdt:"USDT reward", reward_nex:"UVT reward", proof_hash:"Proof hash", receipt_hash:"Receipt hash", compliance_id:"Verification number", type:"Type", program:"Verification program", authority:"Verifier", paired_wallet:"Linked wallet", network:"Network", signature:"Signature", deposit:"Deposited amount", purpose:"Purpose", credited:"Credited amount", tx_hash:"Transaction hash", block:"Block number", verified_at:"Verified", job_id:"Job number", client_addr:"Client address", gpu_fingerprint:"GPU identifier", vram_peak:"Peak / total memory", energy:"Energy used", unit_price:"Unit price", units:"Billed units", gross:"Gross reward", network_fee:"Network fee", net_paid:"Credited amount", resolution:"Resolution", batch_size:"Batch size", output:"Output", clip_duration:"Clip duration", fps:"Frame rate", frames:"Frame count", model_size:"Model size", input_tokens:"Input tokens", output_tokens:"Output tokens", latency:"Response latency", training_steps:"Training steps", final_loss:"Final loss", chunks:"Text chunks", total_tokens:"Total tokens", embedding_dim:"Embedding dimensions", audio_duration:"Audio duration", wer:"Word error rate", language:"Detected language" },
  vi: { receipt_no:"Mã biên nhận", task_no:"Mã tác vụ", task_type:"Loại tác vụ", task_name:"Tên tác vụ", model:"Mô hình", client:"Khách hàng", status:"Trạng thái ghi nhận", device:"Thiết bị", device_instance:"Mã thiết bị", device_type:"Mẫu thiết bị", gpu:"GPU", vram:"Bộ nhớ GPU", started_at:"Bắt đầu", duration:"Thời lượng", completed_at:"Hoàn thành", reward_usdt:"Thu nhập USDT", reward_nex:"Phần thưởng UVT", proof_hash:"Mã băm bằng chứng", receipt_hash:"Mã băm biên nhận", compliance_id:"Mã xác minh", type:"Loại", program:"Chương trình xác minh", authority:"Bên xác minh", paired_wallet:"Ví liên kết", network:"Mạng", signature:"Chữ ký", deposit:"Số tiền nạp", purpose:"Mục đích", credited:"Số tiền đã nhận", tx_hash:"Mã băm giao dịch", block:"Số khối", verified_at:"Thời gian xác minh", job_id:"Mã tác vụ", client_addr:"Địa chỉ khách hàng", gpu_fingerprint:"Mã nhận dạng GPU", vram_peak:"Bộ nhớ đỉnh / tổng", energy:"Điện năng tiêu thụ", unit_price:"Đơn giá", units:"Số lượng tính phí", gross:"Tổng thu nhập", network_fee:"Phí mạng", net_paid:"Số tiền đã nhận", resolution:"Độ phân giải", batch_size:"Kích thước lô", output:"Kết quả", clip_duration:"Thời lượng video", fps:"Tốc độ khung hình", frames:"Số khung hình", model_size:"Quy mô mô hình", input_tokens:"Token đầu vào", output_tokens:"Token đầu ra", latency:"Độ trễ phản hồi", training_steps:"Số bước huấn luyện", final_loss:"Giá trị mất mát cuối", chunks:"Khối văn bản", total_tokens:"Tổng số token", embedding_dim:"Số chiều vector", audio_duration:"Thời lượng âm thanh", wer:"Tỷ lệ lỗi từ", language:"Ngôn ngữ nhận diện" },
  id: { receipt_no:"Nomor kuitansi", task_no:"Nomor tugas", task_type:"Jenis tugas", task_name:"Nama tugas", model:"Model", client:"Klien", status:"Status pembayaran", device:"Perangkat", device_instance:"Nomor perangkat", device_type:"Model perangkat", gpu:"GPU", vram:"Memori video", started_at:"Mulai", duration:"Durasi", completed_at:"Selesai", reward_usdt:"Hadiah USDT", reward_nex:"Hadiah UVT", proof_hash:"Hash bukti", receipt_hash:"Hash kuitansi", compliance_id:"Nomor verifikasi", type:"Jenis", program:"Program verifikasi", authority:"Pemverifikasi", paired_wallet:"Dompet tertaut", network:"Jaringan", signature:"Tanda tangan", deposit:"Jumlah disetor", purpose:"Tujuan", credited:"Jumlah masuk", tx_hash:"Hash transaksi", block:"Nomor blok", verified_at:"Diverifikasi", job_id:"Nomor tugas", client_addr:"Alamat klien", gpu_fingerprint:"ID GPU", vram_peak:"Memori puncak / total", energy:"Energi terpakai", unit_price:"Harga satuan", units:"Jumlah unit tagihan", gross:"Total hadiah", network_fee:"Biaya jaringan", net_paid:"Jumlah masuk", resolution:"Resolusi", batch_size:"Ukuran batch", output:"Output", clip_duration:"Durasi klip", fps:"Frame rate", frames:"Jumlah frame", model_size:"Ukuran model", input_tokens:"Token input", output_tokens:"Token output", latency:"Latensi respons", training_steps:"Langkah training", final_loss:"Loss akhir", chunks:"Potongan teks", total_tokens:"Total token", embedding_dim:"Dimensi embedding", audio_duration:"Durasi audio", wer:"Tingkat kesalahan kata", language:"Bahasa terdeteksi" },
  ms: { receipt_no:"Nombor resit", task_no:"Nombor kerja", task_type:"Jenis kerja", task_name:"Nama kerja", model:"Model", client:"Pelanggan", status:"Status pembayaran", device:"Peranti", device_instance:"Nombor peranti", device_type:"Model peranti", gpu:"GPU", vram:"Memori video", started_at:"Mula", duration:"Tempoh", completed_at:"Selesai", reward_usdt:"Ganjaran USDT", reward_nex:"Ganjaran UVT", proof_hash:"Hash bukti", receipt_hash:"Hash resit", compliance_id:"Nombor pengesahan", type:"Jenis", program:"Program pengesahan", authority:"Pengesah", paired_wallet:"Dompet terpaut", network:"Rangkaian", signature:"Tandatangan", deposit:"Jumlah deposit", purpose:"Tujuan", credited:"Jumlah dikreditkan", tx_hash:"Hash transaksi", block:"Nombor blok", verified_at:"Disahkan", job_id:"Nombor kerja", client_addr:"Alamat pelanggan", gpu_fingerprint:"Pengecam GPU", vram_peak:"Puncak / jumlah memori", energy:"Tenaga digunakan", unit_price:"Harga seunit", units:"Unit dibilkan", gross:"Ganjaran kasar", network_fee:"Caj rangkaian", net_paid:"Jumlah dikreditkan", resolution:"Resolusi", batch_size:"Saiz kelompok", output:"Output", clip_duration:"Tempoh klip", fps:"Kadar bingkai", frames:"Bilangan bingkai", model_size:"Saiz model", input_tokens:"Token input", output_tokens:"Token output", latency:"Kependaman respons", training_steps:"Langkah latihan", final_loss:"Nilai loss akhir", chunks:"Cebisan teks", total_tokens:"Jumlah token", embedding_dim:"Dimensi embedding", audio_duration:"Tempoh audio", wer:"Kadar ralat kata", language:"Bahasa dikesan" },
  fil: { receipt_no:"Receipt no.", task_no:"Job no.", task_type:"Uri ng job", task_name:"Pangalan ng job", model:"Model", client:"Client", status:"Status ng payout", device:"Device", device_instance:"Device no.", device_type:"Model ng device", gpu:"GPU", vram:"Memory ng GPU", started_at:"Nagsimula", duration:"Tagal", completed_at:"Natapos", reward_usdt:"Reward na USDT", reward_nex:"Reward na UVT", proof_hash:"Hash ng patunay", receipt_hash:"Hash ng resibo", compliance_id:"Verification no.", type:"Uri", program:"Programa ng beripikasyon", authority:"Nag-verify", paired_wallet:"Naka-link na wallet", network:"Network", signature:"Signature", deposit:"Halagang idineposito", purpose:"Layunin", credited:"Halagang pumasok", tx_hash:"Hash ng transaksyon", block:"Block no.", verified_at:"Na-verify", job_id:"Job no.", client_addr:"Address ng client", gpu_fingerprint:"ID ng GPU", vram_peak:"Peak / kabuuang memory", energy:"Nagamit na kuryente", unit_price:"Presyo bawat isa", units:"Siningil na unit", gross:"Gross na reward", network_fee:"Fee sa network", net_paid:"Halagang pumasok", resolution:"Resolution", batch_size:"Laki ng batch", output:"Output", clip_duration:"Haba ng clip", fps:"Bilis ng frame", frames:"Bilang ng frame", model_size:"Laki ng model", input_tokens:"Input token", output_tokens:"Output token", latency:"Latency ng sagot", training_steps:"Training step", final_loss:"Huling loss", chunks:"Text chunk", total_tokens:"Kabuuang token", embedding_dim:"Embedding dimension", audio_duration:"Haba ng audio", wer:"Rate ng maling salita", language:"Natukoy na wika" },
  ru: { receipt_no:"Номер квитанции", task_no:"Номер задачи", task_type:"Тип задачи", task_name:"Задача", model:"Модель", client:"Заказчик", status:"Статус выплаты", device:"Устройство", device_instance:"Номер устройства", device_type:"Модель устройства", gpu:"GPU", vram:"Видеопамять", started_at:"Начало", duration:"Длительность", completed_at:"Завершено", reward_usdt:"Награда USDT", reward_nex:"Награда UVT", proof_hash:"Хеш доказательства", receipt_hash:"Хеш квитанции", compliance_id:"Номер проверки", type:"Тип", program:"Программа проверки", authority:"Проверяющий", paired_wallet:"Связанный кошелёк", network:"Сеть", signature:"Подпись", deposit:"Внесено", purpose:"Назначение", credited:"Зачислено", tx_hash:"Хеш транзакции", block:"Номер блока", verified_at:"Проверено", job_id:"Номер задачи", client_addr:"Адрес заказчика", gpu_fingerprint:"ID GPU", vram_peak:"Видеопамять: пик / всего", energy:"Расход энергии", unit_price:"Цена за ед.", units:"Учтённые единицы", gross:"Награда всего", network_fee:"Комиссия сети", net_paid:"Зачислено", resolution:"Разрешение", batch_size:"Размер пакета", output:"Результат", clip_duration:"Длина видео", fps:"Частота кадров", frames:"Кадров", model_size:"Размер модели", input_tokens:"Входные токены", output_tokens:"Выходные токены", latency:"Задержка ответа", training_steps:"Шагов обучения", final_loss:"Итоговые потери", chunks:"Фрагменты текста", total_tokens:"Всего токенов", embedding_dim:"Размерность эмбеддинга", audio_duration:"Длина аудио", wer:"Доля ошибок (WER)", language:"Язык распознавания" },
  kk: { receipt_no:"Түбіртек нөмірі", task_no:"Жұмыс нөмірі", task_type:"Жұмыс түрі", task_name:"Жұмыс атауы", model:"Модель", client:"Клиент", status:"Төлем күйі", device:"Құрылғы", device_instance:"Құрылғы нөмірі", device_type:"Құрылғы моделі", gpu:"GPU", vram:"Бейне жады", started_at:"Басталды", duration:"Ұзақтығы", completed_at:"Аяқталды", reward_usdt:"USDT сыйақысы", reward_nex:"UVT сыйақысы", proof_hash:"Растама хэші", receipt_hash:"Түбіртек хэші", compliance_id:"Тексеру нөмірі", type:"Түрі", program:"Тексеру бағдарламасы", authority:"Тексеруші", paired_wallet:"Байланысты әмиян", network:"Желі", signature:"Қолтаңба", deposit:"Толтырылған сома", purpose:"Мақсаты", credited:"Түскен сома", tx_hash:"Транзакция хэші", block:"Блок нөмірі", verified_at:"Тексерілді", job_id:"Жұмыс нөмірі", client_addr:"Клиент мекенжайы", gpu_fingerprint:"GPU идентификаторы", vram_peak:"Ең жоғары / жалпы жады", energy:"Жұмсалған энергия", unit_price:"Бірлік бағасы", units:"Есептелген бірлік саны", gross:"Жалпы сыйақы", network_fee:"Желі ақысы", net_paid:"Түскен сома", resolution:"Ажыратымдылық", batch_size:"Топтама өлшемі", output:"Нәтиже", clip_duration:"Клип ұзақтығы", fps:"Кадр жиілігі", frames:"Кадр саны", model_size:"Модель өлшемі", input_tokens:"Кіріс токендер", output_tokens:"Шығыс токендер", latency:"Жауап кідірісі", training_steps:"Оқыту қадамдары", final_loss:"Соңғы loss", chunks:"Мәтін бөліктері", total_tokens:"Жалпы токендер", embedding_dim:"Embedding өлшемдері", audio_duration:"Аудио ұзақтығы", wer:"Сөз қатесі үлесі (WER)", language:"Анықталған тіл" },
  uz: { receipt_no:"Chek raqami", task_no:"Ish raqami", task_type:"Ish turi", task_name:"Ish nomi", model:"Model", client:"Buyurtmachi", status:"Toʻlov holati", device:"Qurilma", device_instance:"Qurilma raqami", device_type:"Qurilma modeli", gpu:"GPU", vram:"Video xotira", started_at:"Boshlandi", duration:"Davomiyligi", completed_at:"Tugadi", reward_usdt:"USDT mukofoti", reward_nex:"UVT mukofoti", proof_hash:"Isbot xeshi", receipt_hash:"Chek xeshi", compliance_id:"Tekshiruv raqami", type:"Turi", program:"Tekshiruv dasturi", authority:"Tekshiruvchi", paired_wallet:"Ulangan hamyon", network:"Tarmoq", signature:"Imzo", deposit:"Kiritilgan summa", purpose:"Maqsad", credited:"Tushgan summa", tx_hash:"Tranzaksiya xeshi", block:"Blok raqami", verified_at:"Tekshirilgan", job_id:"Ish raqami", client_addr:"Buyurtmachi manzili", gpu_fingerprint:"GPU ID", vram_peak:"Eng yuqori / jami xotira", energy:"Sarflangan energiya", unit_price:"Birlik narxi", units:"Toʻlovli birliklar", gross:"Umumiy mukofot", network_fee:"Tarmoq haqi", net_paid:"Tushgan summa", resolution:"Oʻlcham", batch_size:"Partiya hajmi", output:"Natija", clip_duration:"Video davomiyligi", fps:"Kadr chastotasi", frames:"Kadrlar soni", model_size:"Model hajmi", input_tokens:"Kirish tokenlari", output_tokens:"Chiqish tokenlari", latency:"Javob kechikishi", training_steps:"Oʻqitish qadamlari", final_loss:"Yakuniy xatolik", chunks:"Matn boʻlaklari", total_tokens:"Jami tokenlar", embedding_dim:"Embedding oʻlchami", audio_duration:"Audio davomiyligi", wer:"Soʻz xatolari ulushi", language:"Aniqlangan til" },
};
function fieldLabel(key: string): string {
  return fieldLabels[receiptLocale.value][key] ?? key;
}
const identifierFields = new Set(["receipt_no","task_no","compliance_id","job_id","device_instance","gpu_fingerprint","block"]);
useDialogA11y(computed(() => props.receipt !== null), ".nx-receipt-modal-root", () => emit("close"), true);
// "KY" = 存量验证类回执(机制已删,历史数据保留可查 —— 白名单字段)。
function isCanonicalComputeReceipt(
  receipt: Receipt | CanonicalComputeReceipt,
): receipt is CanonicalComputeReceipt {
  return "receiptNo" in receipt && "proofHash" in receipt;
}

const isLegacyVerification = computed(() => {
  const receipt = props.receipt;
  return receipt ? !isCanonicalComputeReceipt(receipt) && receipt.category === "KY" : false;
});
const isSimulatedReceipt = computed(() => props.receipt != null && isCanonicalComputeReceipt(props.receipt)
  && props.receipt.executionMode === "SIMULATED");
const isSimulatedNexReceipt = computed(() => props.receipt != null && isCanonicalComputeReceipt(props.receipt)
  && isSimulatedReceipt.value && props.receipt.rewardUsdt === 0 && props.receipt.rewardNex > 0);
const receiptTitle = computed(() => isLegacyVerification.value ? t.value.receipt.typeWalletPairing
  : isSimulatedReceipt.value ? copy.value.taskReceipt : t.value.receipt.proofOfCompute);
const stampColor = computed(() => (isLegacyVerification.value ? "var(--v5-tech-cyan)" : "var(--v5-brand)"));
const isReceiptSettled = computed(() => {
  const r = props.receipt;
  return !!r && (!isCanonicalComputeReceipt(r) || /^(POSTED|SUCCESS|SETTLED|CREDITED|PAID)$/.test(r.earningStatus.toUpperCase()));
});
const receiptStatus = computed(() => {
  const r = props.receipt;
  if (!r || isLegacyVerification.value) return t.value.receipt.statusRecorded;
  if (!isCanonicalComputeReceipt(r)) return t.value.receipt.statusSettled;
  const status = r.earningStatus.toUpperCase();
  if (/^(POSTED|SUCCESS|SETTLED|CREDITED|PAID)$/.test(status)) return t.value.receipt.statusSettled;
  if (/^(PENDING|PROCESSING)$/.test(status)) return copy.value.pending;
  if (/^(FAILED|REJECTED)$/.test(status)) return copy.value.failed;
  return copy.value.unknown;
});
// A detail whose settledAt only copied completedAt has no posting time; show the completion time instead.
const receiptTime = computed(() => {
  const r = props.receipt;
  if (!r) return "";
  if (!isCanonicalComputeReceipt(r)) return fmtDate(r.settledAt);
  return r.settledAt === null ? `${fieldLabel("completed_at")} ${fmtDate(r.completedAt)}` : fmtDate(r.settledAt);
});
const summaryAmount = computed(() => {
  const r = props.receipt;
  if (!r) return "";
  const amount = isCanonicalComputeReceipt(r) ? formatGroupedAmount(isSimulatedNexReceipt.value ? r.rewardNex : r.rewardUsdt, "full") : formatGroupedAmount(r.netPaid);
  return (amount.startsWith("-") || amount === "0" || amount === "0.00" ? "" : "+") + amount + (isSimulatedNexReceipt.value ? " UVT" : " USDT");
});

// ── tap-to-copy (matches prototype RowCopy: copy on tap, transient ✓ icon) ──
// Backend-replaceable: copies the full underlying value; no real backend call.
const copiedField = ref<string | null>(null);
let copyResetTimer: ReturnType<typeof setTimeout> | null = null;

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the uni clipboard API below.
  }
  return new Promise((resolve) => {
    try {
      uni.setClipboardData({
        data: text,
        showToast: false,
        success: () => resolve(true),
        fail: () => resolve(false),
      });
    } catch {
      resolve(false);
    }
  });
}

async function copyRow(field: string, value: string): Promise<void> {
  const ok = await writeClipboard(value);
  if (!ok) return;
  copiedField.value = field;
  toast.success(t.value.receipt.copied);
  if (copyResetTimer) clearTimeout(copyResetTimer);
  copyResetTimer = setTimeout(() => {
    copiedField.value = null;
    copyResetTimer = null;
  }, 1400);
}

onUnmounted(() => {
  if (copyResetTimer) clearTimeout(copyResetTimer);
});

interface DescRow {
  k: string;
  v?: string;
  accent?: boolean;
  muted?: boolean;
  strong?: boolean;
  copyValue?: string;
  copyKey?: string;
  hint?: string;
  divider?: boolean;
}
interface DescSection {
  heading?: string;
  rows: DescRow[];
  checks?: string[];
}

function detailRows(d: ReceiptDetails): DescRow[] {
  switch (d.kind) {
    case "IG":
      return [
        { k: "resolution", v: d.resolution },
        { k: "batch_size", v: String(d.batchSize) },
        { k: "output", v: `${d.outputCount} ${copy.value.images}` },
      ];
    case "VG":
      return [
        { k: "resolution", v: d.resolution },
        { k: "clip_duration", v: `${d.durationSec}s` },
        { k: "fps", v: String(d.fps) },
        { k: "frames", v: String(d.frames) },
      ];
    case "LL":
      return [
        { k: "model_size", v: d.modelSize },
        { k: "input_tokens", v: d.inputTokens.toLocaleString() },
        { k: "output_tokens", v: d.outputTokens.toLocaleString() },
        { k: "latency", v: `p50 ${d.latencyP50ms}ms · p95 ${d.latencyP95ms}ms` },
      ];
    case "FT":
      return [
        { k: "training_steps", v: String(d.trainingSteps) },
        { k: "final_loss", v: d.finalLoss.toFixed(3) },
      ];
    case "EM":
      return [
        { k: "chunks", v: d.chunksCount.toLocaleString() },
        { k: "total_tokens", v: d.totalTokens.toLocaleString() },
        { k: "embedding_dim", v: String(d.embeddingDim) },
      ];
    case "SP":
      return [
        { k: "audio_duration", v: `${(d.audioDurationSec / 60).toFixed(1)} min` },
        { k: "wer", v: d.wer.toFixed(3) },
        { k: "language", v: d.languageDetected },
      ];
  }
}

// Stable internal keys also identify copied fields. The current review explicitly
// replaces the former raw-key presentation with localized, grouped labels.
const sections = computed<DescSection[]>(() => {
  const r = props.receipt;
  if (!r) return [];
  if (isCanonicalComputeReceipt(r)) {
    return [
      {
        rows: [
          { k: "receipt_no", v: r.displayReceiptNo || shortenHex(r.receiptNo, 7, 5), copyValue: r.receiptNo },
          { k: "task_no", v: shortenHex(r.taskNo, 7, 5), copyValue: r.taskNo },
          { k: "task_type", v: workloadLabel(t.value, r.taskClass) },
          { k: "task_name", v: r.taskName },
          ...(!isSimulatedReceipt.value ? [{ k: "model", v: r.model || "—" }] : []),
        ],
      },
      {
        rows: [
          ...(r.client ? [{ k: "client", v: r.client }] : []),
          { k: "status", v: receiptStatus.value },
        ],
      },
      {
        rows: [
          { k: "device", v: r.deviceName },
          { k: "device_instance", v: shortenHex(r.deviceInstanceNo, 8, 6), copyValue: r.deviceInstanceNo },
          { k: "device_type", v: r.deviceType },
          ...(r.deviceGpu ? [{ k: "gpu", v: r.deviceGpu }] : []),
          ...(r.vramTotalGb !== null ? [{ k: "vram", v: `${r.vramTotalGb} GB` }] : []),
        ],
      },
      {
        rows: [
          { k: "started_at", v: fmtDate(r.startedAt) },
          { k: "duration", v: fmtDuration(r.durationSec) },
          { k: "completed_at", v: fmtDate(r.completedAt) },
        ],
      },
      {
        rows: [
          ...(!isSimulatedNexReceipt.value ? [{ k: "reward_usdt", v: `+${formatAmount(r.rewardUsdt, "full")} USDT`, accent: true, strong: true }] : []),
          ...(r.rewardNex > 0 ? [{ k: "reward_nex", v: `+${formatAmount(r.rewardNex, "full")} UVT`, accent: true, strong: isSimulatedNexReceipt.value }] : []),
        ],
      },
      {
        rows: [
          ...(r.receiptHash ? [{ k: "receipt_hash", copyValue: r.receiptHash, v: shortenHex(r.receiptHash, 8, 6) }] : []),
          ...(r.proofHash ? [{ k: "proof_hash", copyKey: "proof_hash", copyValue: r.proofHash, v: shortenHex(r.proofHash, 8, 6) }] : []),
        ],
      },
    ];
  }
  if (r.category === "KY") {
    return [
      {
        rows: [
          { k: "compliance_id", v: r.id, accent: true },
          { k: "type", v: workloadLabel(t.value, r.category) },
          { k: "program", v: r.model },
          { k: "authority", v: r.client },
        ],
      },
      {
        rows: [
          { k: "paired_wallet", copyKey: "paired_wallet", copyValue: r.verificationWalletAddress ?? "0x", v: shortenHex(r.verificationWalletAddress ?? "0x", 6, 4) },
          { k: "network", v: r.verificationNetwork ?? "—" },
          { k: "signature", copyKey: "verification_signature", copyValue: r.signature, v: shortenHex(r.signature, 8, 6), hint: "rsa-sha256" },
        ],
      },
      {
        heading: copy.value.checks,
        rows: [],
        checks: r.verificationChecks ?? [],
      },
      {
        rows: [
          { k: "deposit", v: `${formatAmount(r.gross)} USDT` },
          { k: "purpose", v: copy.value.purpose, muted: true },
          { k: "credited", v: `+$${formatAmount(r.netPaid)}`, accent: true, strong: true },
        ],
      },
      {
        rows: [
          { k: "tx_hash", copyKey: "tx_hash", copyValue: r.txHash, v: shortenHex(r.txHash, 8, 6) },
          { k: "block", v: `#${r.blockNumber.toLocaleString()}` },
          { k: "verified_at", v: fmtDate(r.settledAt) },
        ],
      },
    ];
  }
  // Task receipt
  return [
    {
      rows: [
        { k: "job_id", v: r.id, accent: true },
        { k: "type", v: workloadLabel(t.value, r.category) },
        { k: "model", v: r.model },
        ...(r.details ? detailRows(r.details) : []),
      ],
    },
    {
      rows: [
        { k: "client", v: r.client },
        { k: "client_addr", copyKey: "client_addr", copyValue: r.clientAddress, v: shortenHex(r.clientAddress, 6, 4) },
        { k: "signature", copyKey: "signature", copyValue: r.signature, v: shortenHex(r.signature, 8, 6), hint: "rsa-sha256" },
      ],
    },
    {
      rows: [
        { k: "device", v: r.deviceName },
        { k: "gpu", v: r.deviceGpu },
        { k: "gpu_fingerprint", v: r.deviceFingerprint },
      ],
    },
    {
      rows: [
        { k: "duration", v: fmtDuration(r.durationSec) },
        ...(r.vramTotalGb > 0 ? [{ k: "vram_peak", v: `${r.vramPeakGb.toFixed(1)} / ${r.vramTotalGb} GB` }] : []),
        { k: "energy", v: `${r.energyKwh.toFixed(3)} kWh` },
      ],
    },
    {
      rows: [
        { k: "unit_price", v: r.unitPriceLabel.replace(/^\$([0-9]+(?:\.[0-9]+)?)/, (_match, amount: string) => `$${formatAmount(amount)}`) },
        { k: "units", v: r.unitsLabel },
        { k: "gross", v: `$${formatAmount(r.gross)}` },
        { k: "network_fee", v: `-$${formatAmount(r.fee)}`, muted: true },
        { k: "net_paid", v: `+${formatAmount(r.netPaid)} USDT`, accent: true, strong: true },
      ],
    },
    {
      rows: [
        { k: "tx_hash", copyKey: "tx_hash", copyValue: r.txHash, v: shortenHex(r.txHash, 8, 6) },
        { k: "block", v: `#${r.blockNumber.toLocaleString()}` },
      ],
    },
  ];
});

// The main amount is already presented above the sections.
const visibleSections = computed(() => sections.value
  .map(section => ({ ...section, rows: section.rows.filter(row => !row.strong) }))
  .filter(section => section.rows.length > 0 || section.checks?.length));
function sectionHeading(section: DescSection): string {
  const first = section.rows[0]?.k ?? "";
  if (["receipt_no","job_id","compliance_id"].includes(first)) return copy.value.job;
  if (["client","client_addr"].includes(first)) return copy.value.client;
  if (first === "device") return isSimulatedReceipt.value ? copy.value.taskDevice : copy.value.device;
  if (["started_at","duration"].includes(first)) return isSimulatedReceipt.value ? copy.value.taskRuntime : copy.value.runtime;
  if (["status","reward_nex","deposit","unit_price"].includes(first)) return copy.value.rewards;
  return copy.value.proof;
}

function fmtDuration(sec: number): string {
  const units = ({ zh: ['分', '秒'], en: ['min', 'sec'], vi: ['phút', 'giây'], id: ['mnt', 'dtk'], ms: ['min', 's'], fil: ['min', 'seg'], ru: ['мин', 'с'], kk: ['мин', 'сек'], uz: ['daq.', 'son.'] })[receiptLocale.value];
  if (sec < 60) return `${sec} ${units[1]}`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m} ${units[0]} ${s.toString().padStart(2, "0")} ${units[1]} (${sec} ${units[1]})`;
}
function fmtDate(ts: number | null): string {
  return formatDisplayDateTime(ts, receiptLocale.value);
}

// ── styles ──
const scrimStyle: CSSProperties = {
  position: "fixed",
  left: "0",
  right: "0",
  top: "0",
  bottom: "0",
  zIndex: 1000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box",
  padding: "var(--nx-overlay-top) 16px var(--nx-overlay-bottom)",
  background: "rgba(0,0,0,0.7)",
};
const sheetStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  maxWidth: "480px",
  boxSizing: "border-box",
  maxHeight: "min(85vh, calc(100vh - var(--nx-overlay-top) - var(--nx-overlay-bottom)))",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "var(--v5-surface)",
  border: "1px solid var(--v5-surface-2)",
  borderRadius: "16px",
  fontFamily: "var(--font-v5)",
  color: "var(--v5-ink)",
};
const closeBtnStyle: CSSProperties = {
  position: "absolute",
  top: "8px",
  right: "8px",
  width: "44px",
  height: "44px",
  borderRadius: "999px",
  zIndex: 10,
};
const headerStyle: CSSProperties = {
  padding: "20px 60px 16px 20px",
  flexShrink: 0,
  borderBottom: "1px solid color-mix(in srgb, var(--v5-surface-2) 70%, transparent)",
};
const headerKickerStyle: CSSProperties = {
  fontSize: "19px",
  fontWeight: 600,
  lineHeight: 1.4,
  color: "var(--v5-ink)",
};
const bodyStyle: CSSProperties = { minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", paddingBottom: "16px" };
const summaryStyle: CSSProperties = { padding: "20px", borderBottom: "1px solid var(--v5-border)" };
const stampStyle = computed<CSSProperties>(() => ({
  alignItems: "center",
  flexShrink: 0,
  whiteSpace: "nowrap",
  // Prototype: px-1.5 py-0.5 = 2px 6px, rounded-md = 6px, rotate(-4deg).
  padding: "2px 6px",
  borderRadius: "6px",
  fontSize: "12px",
  fontWeight: 600,
  letterSpacing: "0.08em",
  color: stampColor.value,
  background: `color-mix(in srgb, ${stampColor.value} 8%, transparent)`,
  transform: "rotate(-4deg)",
}));
function sectionStyle(si: number): CSSProperties {
  return {
    padding: "16px 20px",
    borderTop: si === 0 ? "none" : "1px solid color-mix(in srgb, var(--v5-surface-2) 70%, transparent)",
  };
}
const sectionHeadStyle: CSSProperties = {
  marginBottom: "10px",
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--v5-ink)",
};
// Prototype Section uses `space-y-1` = 4px gap between rows. `padding: 2px 0`
// on every row yields the same 4px inter-row spacing.
const rowStyle: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(0, .8fr) minmax(0, 1.4fr)", alignItems: "center", gap: "12px", fontSize: "var(--ui-type-list-subtitle)", lineHeight: 1.5, padding: "6px 0" };
const dividerStyle: CSSProperties = {
  flex: "1",
  height: "1px",
  margin: "6px 0",
  background: "color-mix(in srgb, var(--v5-surface-2) 70%, transparent)",
};
function valueStyle(row: DescRow): CSSProperties {
  return {
    fontFamily: identifierFields.has(row.k) ? "var(--font-jet-mono), ui-monospace, monospace" : "var(--font-v5)",
    color: row.muted ? "var(--v5-ink-2)" : "var(--v5-ink)",
    fontWeight: row.strong ? 600 : 400,
  };
}
// Prototype RowCopy: `flex items-center gap-1` (4px) — value + hint + copy icon.
const copyRowStyle: CSSProperties = { gap: "6px", minHeight: "44px", minWidth: 0, justifyContent: "flex-end", flexWrap: "nowrap" };
</script>

<style scoped>
.nx-receipt-line {
  display: block;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
