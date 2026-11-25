// Local prototype guide, mirroring the backend's shipped default (rank-how-policy-default-2026.10.29.json). This fixture is served only by the demo server, never bundled in the app.
const rows = [
  ["overview",["什么是等级", "What ranks are", "Hạng là gì"],["等级由你的自购算力点、达标好友和团队算力点共同决定，当前开放 {firstRank} 至 {lastRank}。", "Your rank depends on your own compute points, qualified friends and team compute points. Ranks {firstRank} to {lastRank} are open now.", "Hạng của bạn phụ thuộc vào điểm tính toán cá nhân, số bạn bè đạt chuẩn và điểm tính toán của nhóm. Hiện mở từ {firstRank} đến {lastRank}."]],
  ["overview-detail",["等级与奖励", "Ranks and rewards", "Hạng và phần thưởng"],["每升一级，可解锁更多奖励，具体以等级页显示为准。", "Each rank unlocks more rewards. See the rank page for details.", "Mỗi lần lên hạng, bạn mở khóa thêm phần thưởng. Xem chi tiết tại trang hạng."]],
  ["ladder",["{rankCount} 个等级", "{rankCount} ranks", "{rankCount} hạng"],["每个等级都有自己的条件和权益，点击页面底部按钮可查看你的等级进度。", "Each rank has its own requirements and benefits. Tap the button below to see your progress.", "Mỗi hạng có điều kiện và quyền lợi riêng. Nhấn nút bên dưới để xem tiến độ của bạn."]],
  ["promotion",["怎么升级", "How to move up", "Cách lên hạng"],["同时满足目标等级的各项条件后，即可升级。", "Meet all requirements of the next rank to move up.", "Đáp ứng đủ các điều kiện của hạng tiếp theo để lên hạng."]],
  ["requirement-self",["1. 自购算力点", "1. Own compute points", "1. Điểm tính toán cá nhân"],["购买设备后，设备的算力点计入你的自购算力点，以已确认的订单为准。", "Devices you buy add their compute points to your own total, based on confirmed orders.", "Thiết bị bạn mua sẽ cộng điểm tính toán vào tổng của bạn, theo đơn hàng đã xác nhận."]],
  ["requirement-direct",["2. 达标好友", "2. Qualified friends", "2. Bạn bè đạt chuẩn"],["你邀请的好友满足自购要求后，计为达标好友。当前要求：{referralThreshold}。", "A friend you invited counts as qualified once they meet the own-purchase requirement. Current requirement: {referralThreshold}.", "Bạn bè do bạn mời được tính là đạt chuẩn khi đáp ứng yêu cầu mua cá nhân. Yêu cầu hiện tại: {referralThreshold}."]],
  ["requirement-team",["3. 团队算力点", "3. Team compute points", "3. Điểm tính toán của nhóm"],["团队成员购买设备的算力点计入团队算力点，以已确认的订单为准。", "Devices bought by your team add to your team compute points, based on confirmed orders.", "Thiết bị do thành viên nhóm mua được cộng vào điểm của nhóm, theo đơn hàng đã xác nhận."]],
  ["requirement-legs",["4. 好友等级", "4. Friends' ranks", "4. Hạng của bạn bè"],["部分等级还要求若干位好友达到指定等级。", "Some ranks also require a number of friends to reach a given rank.", "Một số hạng còn yêu cầu một số bạn bè đạt hạng nhất định."]],
  ["stepwise",["逐级晋升", "One rank at a time", "Lên từng hạng"],["满足条件后自动晋升，每次升一级。", "You move up automatically, one rank at a time.", "Bạn được lên hạng tự động, mỗi lần một hạng."]],
  ["protection",["等级保护", "Rank protection", "Bảo vệ hạng"],["{protection}", "{protection}", "{protection}"]],
  ["rewards",["每级解锁什么", "What each rank unlocks", "Mỗi hạng mở khóa gì"],["团队奖励范围、团队激励池票数和好友升级奖励，具体以等级页为准。", "Wider team rewards, more team incentive pool votes and friend rank-up rewards. See the rank page for details.", "Phạm vi thưởng nhóm rộng hơn, nhiều phiếu hơn trong quỹ thưởng nhóm và thưởng khi bạn bè lên hạng. Xem chi tiết tại trang hạng."]],
  ["unlock-network",["团队奖励", "Team rewards", "Thưởng nhóm"],["团队成员购买设备时，你可获得团队购买奖励，范围随等级提升而扩大。", "Earn team purchase rewards when team members buy devices; your reach grows as you rank up.", "Nhận thưởng nhóm mua hàng khi thành viên nhóm mua thiết bị; phạm vi mở rộng khi bạn lên hạng."]],
  ["unlock-peer",["同级奖励", "Same-rank reward", "Thưởng đồng cấp"],["以实际发放为准。", "Subject to actual payout.", "Theo kết quả chi trả thực tế."]],
  ["unlock-leadership",["团队激励池", "Team incentive pool", "Quỹ thưởng nhóm"],["达到参与等级后，按票数每周发放。{leadershipStatus}", "Once you reach the eligible rank, payouts are made weekly by votes. {leadershipStatus}", "Khi đạt hạng tham gia, thưởng được chi trả hằng tuần theo số phiếu. {leadershipStatus}"]],
  ["unlock-cultivation",["好友升级奖励", "Friend rank-up reward", "Thưởng khi bạn bè lên hạng"],["你邀请的好友升级时，你可获得奖励。", "Earn a reward when a friend you invited ranks up.", "Nhận thưởng khi bạn bè do bạn mời lên hạng."]],
  ["example",["示例：{fromRank} 升 {toRank}", "Example: {fromRank} to {toRank}", "Ví dụ: {fromRank} lên {toRank}"],["以下仅作说明，数值以当前规则为准。", "For illustration only; figures follow the current rules.", "Chỉ để minh họa; số liệu theo quy tắc hiện hành."]],
  ["example-start",["起点", "Starting point", "Điểm bắt đầu"],["假设你当前是 {fromRank}，目标是 {toRank}。", "Say you're {fromRank} and aiming for {toRank}.", "Giả sử bạn đang ở {fromRank} và muốn lên {toRank}."]],
  ["example-self",["自购", "Own purchases", "Mua cá nhân"],["{toRank} 需要自购算力点达到 {selfComputePoints}。", "{toRank} needs {selfComputePoints} in own compute points.", "{toRank} cần {selfComputePoints} điểm cá nhân."]],
  ["example-team",["团队", "Team", "Nhóm"],["{toRank} 需要团队算力点达到 {teamComputePoints}；达标好友要求：{directRefs}（好友自购要求：{referralThreshold}）。", "{toRank} needs {teamComputePoints} in team compute points. Qualified friends required: {directRefs} (friend own-purchase requirement: {referralThreshold}).", "{toRank} cần {teamComputePoints} điểm của nhóm. Số bạn bè đạt chuẩn cần có: {directRefs} (yêu cầu mua cá nhân của bạn bè: {referralThreshold})."]],
  ["example-legs",["好友等级", "Friends' ranks", "Hạng của bạn bè"],["{toRank} 的好友等级要求：{rankLegs}。", "{toRank} friend-rank requirement: {rankLegs}.", "Yêu cầu về hạng bạn bè của {toRank}: {rankLegs}."]],
  ["example-trigger",["完成升级", "Moving up", "Lên hạng"],["以上条件都满足后，你会自动从 {fromRank} 升到 {toRank}。", "Once all of the above are met, you move from {fromRank} to {toRank} automatically.", "Khi đáp ứng đủ các điều kiện trên, bạn sẽ tự động được nâng từ {fromRank} lên {toRank}."]],
  ["example-results",["{toRank} 解锁的权益", "What {toRank} unlocks", "Quyền lợi của {toRank}"],["以下为当前规则下的权益，不代表已发放。", "Benefits under the current rules; not a payout.", "Quyền lợi theo quy tắc hiện hành, không phải khoản đã chi trả."]],
  ["result-network",["好友购买奖励", "Friend purchase reward", "Thưởng bạn bè mua hàng"],["好友购买奖励比例 {directRate}，以实际发放为准。", "Friend purchase reward rate: {directRate}, subject to actual payout.", "Tỷ lệ thưởng bạn bè mua hàng: {directRate}, theo kết quả chi trả thực tế."]],
  ["result-peer",["同级奖励", "Same-rank reward", "Thưởng đồng cấp"],["{toRank} 同级奖励比例 {peerRate}，以实际发放为准。", "{toRank} same-rank reward rate: {peerRate}, subject to actual payout.", "Tỷ lệ thưởng đồng cấp của {toRank}: {peerRate}, theo kết quả chi trả thực tế."]],
  ["result-leadership",["团队激励池", "Team incentive pool", "Quỹ thưởng nhóm"],["{toRank} 有 {votes} 票。{leadershipStatus}", "{toRank} has {votes} votes. {leadershipStatus}", "{toRank} có {votes} phiếu. {leadershipStatus}"]],
  ["result-cultivation",["好友升级奖励", "Friend rank-up reward", "Thưởng khi bạn bè lên hạng"],["该等级的好友升级奖励合计 {cultivation}，以实际发放为准。", "Friend rank-up rewards for this rank total {cultivation}, subject to actual payout.", "Tổng thưởng khi bạn bè lên hạng ở hạng này là {cultivation}, theo kết quả chi trả thực tế."]],
  ["faq-members",["为什么团队有人，我还没升级？", "Why haven't I ranked up when my team has members?", "Vì sao nhóm đã có thành viên mà tôi chưa lên hạng?"],["团队人数不等于达标好友数。好友满足自购要求（{referralThreshold}）才计入，你也要同时满足自购和团队算力点要求。", "Team size isn't the same as qualified friends. A friend counts once they meet the own-purchase requirement ({referralThreshold}), and you also need to meet the own and team compute point requirements.", "Số thành viên nhóm khác với số bạn bè đạt chuẩn. Bạn bè chỉ được tính khi đáp ứng yêu cầu mua cá nhân ({referralThreshold}), và bạn cũng cần đáp ứng yêu cầu về điểm cá nhân và điểm của nhóm."]],
  ["faq-rank",["团队算力点减少后会怎样？", "What if my team compute points go down?", "Nếu điểm của nhóm giảm thì sao?"],["{protection}", "{protection}", "{protection}"]],
  ["faq-rewards",["在哪里看进度和奖励？", "Where can I see progress and rewards?", "Xem tiến độ và phần thưởng ở đâu?"],["等级页可查看当前进度和差距，奖励到账情况见奖励明细。", "The rank page shows your progress and gaps; see your reward history for payouts.", "Trang hạng hiển thị tiến độ và phần còn thiếu; xem khoản thưởng đã nhận trong lịch sử thưởng."]],
];
export const demoV1SelfComputePoints=320;
// Three-language preview of the approved F1 publication (team-rank/how-texts.md).
const revisedRows = [
  ["overview", ["什么是等级", "What ranks are", "Hạng là gì"], [
    "等级由自购算力点、团队算力点、已购人数和 V 等级人数共同决定，当前开放 {firstRank} 至 {lastRank}。",
    "Your rank depends on your own compute points, team compute points, buyers and people at a required rank. Ranks {firstRank} to {lastRank} are open.",
    "Hạng phụ thuộc vào điểm tính toán cá nhân, điểm tính toán nhóm, số người đã mua và số người đạt hạng yêu cầu. Hiện mở từ {firstRank} đến {lastRank}.",
  ]],
  ["overview-detail", ["等级与奖励", "Ranks and rewards", "Hạng và phần thưởng"], [
    "每升一级，好友购买奖励比例、晋级奖励和月薪可能更高，具体以等级页为准。",
    "Each rank can bring a higher purchase rate, rank-up reward and monthly reward. See the rank page.",
    "Mỗi hạng có thể có tỷ lệ thưởng mua hàng, thưởng thăng hạng và thưởng tháng cao hơn. Xem trang hạng.",
  ]],
  ["ladder", ["{rankCount} 个等级", "{rankCount} ranks", "{rankCount} hạng"], [
    "每个等级都有自己的条件和奖励，点页面底部按钮查看你的进度。",
    "Each rank has its own requirements and rewards. Tap the button below to see your progress.",
    "Mỗi hạng có điều kiện và phần thưởng riêng. Nhấn nút bên dưới để xem tiến độ.",
  ]],
  ["promotion", ["怎么升级", "How to move up", "Cách lên hạng"], [
    "同时满足目标等级和之前各级的条件后升级，每次一级。",
    "Meet the requirements of the next rank and every rank before it to move up one rank at a time.",
    "Đáp ứng điều kiện của hạng tiếp theo và các hạng trước đó để lên từng hạng.",
  ]],
  ["requirement-self", ["1. 自购算力点", "1. Own compute points", "1. Điểm tính toán cá nhân"], [
    "你购买设备后，设备的算力点计入自购算力点，以已确认的订单为准。",
    "Devices you buy add to your own compute points, based on confirmed orders.",
    "Thiết bị bạn mua được cộng vào điểm của bạn, theo đơn hàng đã xác nhận.",
  ]],
  ["requirement-direct", ["2. 已购人数", "2. Buyers", "2. Số người đã mua"], [
    "好友和好友的好友里，至少有一笔有效已付款订单的人数。任何商品都算，不看金额。",
    "People among your friends and their friends with at least one valid paid order. Any product counts, whatever the amount.",
    "Số bạn bè và bạn của bạn bè có ít nhất một đơn đã thanh toán hợp lệ. Mọi sản phẩm đều tính, không xét giá trị.",
  ]],
  ["requirement-team", ["3. 团队算力点", "3. Team compute points", "3. Điểm tính toán nhóm"], [
    "一至七级团队成员（不含你自己）购买设备的算力点计入团队算力点，以已确认的订单为准。",
    "Devices bought by team members in levels 1–7 (not counting you) add to your team compute points, based on confirmed orders.",
    "Thiết bị do thành viên nhóm từ cấp 1 đến cấp 7 (không tính bạn) mua được cộng vào điểm nhóm, theo đơn hàng đã xác nhận.",
  ]],
  ["requirement-legs", ["4. V 等级人数", "4. People at a rank", "4. Số người đạt hạng"], [
    "部分等级还要求好友和好友的好友里达到指定等级的人数，等级更高的也算。",
    "Some ranks also need a number of friends and their friends at a given rank; higher ranks count too.",
    "Một số hạng còn yêu cầu số bạn bè và bạn của bạn bè đạt hạng nhất định; hạng cao hơn cũng tính.",
  ]],
  ["stepwise", ["逐级晋升", "One rank at a time", "Lên từng hạng"], [
    "条件满足后自动晋升，每次一级，最高自动升到 V7；V8 由官方审核后升级。",
    "You move up automatically, one rank at a time, up to V7. V8 is granted after an official review.",
    "Bạn được tự động lên hạng, mỗi lần một hạng, tối đa V7. V8 được xét duyệt chính thức.",
  ]],
  ["protection", ["等级保护", "Rank protection", "Bảo vệ hạng"], [
    "{protection}",
    "{protection}",
    "{protection}",
  ]],
  ["rewards", ["每级解锁什么", "What each rank unlocks", "Mỗi hạng mở khóa gì"], [
    "各级不同，可能有更高的好友购买奖励比例、晋级奖励和月薪，具体以等级页为准。",
    "It differs by rank: a higher friend purchase rate, a rank-up reward or a monthly reward. See the rank page.",
    "Mỗi hạng khác nhau: có thể có tỷ lệ thưởng bạn bè mua hàng cao hơn, thưởng thăng hạng hoặc thưởng tháng. Xem trang hạng.",
  ]],
  ["unlock-network", ["好友购买奖励", "Friend purchase reward", "Thưởng bạn bè mua hàng"], [
    "好友和好友的好友付款买设备时，按算奖励时你的等级从订单金额中给你奖励，比例见等级页。",
    "When your friends or their friends pay for a device, you get a share of the order at the rate for your rank when the reward is calculated. See the rank page.",
    "Khi bạn bè hoặc bạn của bạn bè thanh toán mua thiết bị, bạn nhận thưởng theo tỷ lệ của hạng bạn khi tính thưởng. Xem trang hạng.",
  ]],
  ["unlock-cultivation", ["晋级奖励", "Rank-up reward", "Thưởng thăng hạng"], [
    "升到新等级时一次性发放 UVT，发给你本人，冷却后可用。",
    "A one-time UVT reward when you reach a new rank, paid to you and usable after the cooling period.",
    "Thưởng UVT một lần khi bạn lên hạng mới, trả cho chính bạn, dùng được sau thời gian chờ.",
  ]],
  ["salary", ["每月月薪", "Monthly reward", "Thưởng hằng tháng"], [
    "设有月薪的等级，每个自然月可手动领取一次 USDT 月薪，月末截止，次月 1 日起作废。金额按当月到达过的最高等级，按到达时的设置锁定，之后的调整只影响以后的月份。新到达的等级从次日起可领；月末最后一天才到达的，只限下月 1 日当天可领上个月的。平台暂时不能发放时可能领不到，过了截止日仍作废。领取后本月再升级不补差，领取后进入可用余额。以实际发放为准。",
    "Ranks with a monthly reward can claim it in USDT once each calendar month. It must be claimed by the end of the month and expires from the 1st of the next month. The amount follows the highest rank reached that month and is fixed by the settings when you reached it; later changes only affect later months. A newly reached rank is claimable from the next day. If you reach it on the last day of the month, you can claim the previous month on the 1st of the next month only. If payouts are temporarily unavailable, you may not be able to claim, and the reward still expires after the deadline. Ranking up after you claim that month isn't topped up. Claimed rewards go to your available balance. Subject to actual payout.",
    "Các hạng có thưởng tháng được nhận thưởng USDT một lần mỗi tháng dương lịch. Hạn nhận là cuối tháng và hết hiệu lực từ ngày 1 tháng sau. Số tiền theo hạng cao nhất đạt được trong tháng và cố định theo thiết lập khi bạn đạt hạng; thay đổi sau đó chỉ áp dụng cho các tháng sau. Hạng mới đạt được nhận từ ngày hôm sau. Nếu đạt vào ngày cuối tháng, bạn chỉ có thể nhận của tháng trước vào ngày 1 tháng sau. Nếu tạm thời chưa thể chi trả, bạn có thể không nhận được và thưởng vẫn hết hiệu lực sau hạn. Lên hạng sau khi nhận trong tháng không được bù chênh lệch. Thưởng đã nhận vào số dư khả dụng. Theo chi trả thực tế.",
  ]],
  ["v8-perks", ["V8 会员权益", "V8 benefits", "Quyền lợi V8"], [
    "渠道宣传、年度旅游、VIP 专属客服、资金转移、新市场优先权，具体以官方通知为准。",
    "Official promotion, annual trip, VIP support, fund transfer and new-market priority. Details are announced officially.",
    "Quảng bá chính thức, du lịch hằng năm, hỗ trợ VIP, chuyển tiền và ưu tiên thị trường mới. Chi tiết theo thông báo chính thức.",
  ]],
  ["example", ["示例：{fromRank} 升 {toRank}", "Example: {fromRank} to {toRank}", "Ví dụ: {fromRank} lên {toRank}"], [
    "以下仅作说明，数值以当前规则为准。",
    "For illustration only; figures follow the current rules.",
    "Chỉ để minh họa; số liệu theo quy tắc hiện hành.",
  ]],
  ["example-start", ["起点", "Starting point", "Điểm bắt đầu"], [
    "假设你当前是 {fromRank}，目标是 {toRank}。",
    "Say you're {fromRank} and aiming for {toRank}.",
    "Giả sử bạn đang ở {fromRank} và muốn lên {toRank}.",
  ]],
  ["example-self", ["自购", "Own purchases", "Mua cá nhân"], [
    "{toRank} 需要自购算力点达到 {selfComputePoints}。",
    "{toRank} needs {selfComputePoints} in own compute points.",
    "{toRank} cần {selfComputePoints} điểm cá nhân.",
  ]],
  ["example-team", ["团队", "Team", "Nhóm"], [
    "{toRank} 需要团队算力点达到 {teamComputePoints}，已购人数 {directRefs}。",
    "{toRank} needs {teamComputePoints} in team compute points and {directRefs} buyers.",
    "{toRank} cần {teamComputePoints} điểm nhóm và {directRefs} người đã mua.",
  ]],
  ["example-legs", ["V 等级人数", "People at a rank", "Số người đạt hạng"], [
    "{toRank} 的人数要求：{rankLegs}。",
    "{toRank} requirement: {rankLegs}.",
    "Yêu cầu của {toRank}: {rankLegs}.",
  ]],
  ["example-trigger", ["完成升级", "Moving up", "Lên hạng"], [
    "以上条件都满足后，你会从 {fromRank} 升到 {toRank}。",
    "Once all of the above are met, you move from {fromRank} to {toRank}.",
    "Khi đáp ứng đủ các điều kiện trên, bạn sẽ lên từ {fromRank} lên {toRank}.",
  ]],
  ["example-results", ["{toRank} 的权益", "What {toRank} unlocks", "Quyền lợi của {toRank}"], [
    "以下为当前规则下的权益，不代表已发放。",
    "Benefits under the current rules; not a payout.",
    "Quyền lợi theo quy tắc hiện hành, không phải khoản đã chi trả.",
  ]],
  ["result-network", ["好友购买奖励", "Friend purchase reward", "Thưởng bạn bè mua hàng"], [
    "一级比例 {directRate}，以实际发放为准。",
    "First-level rate {directRate}, subject to actual payout.",
    "Tỷ lệ cấp một {directRate}, theo kết quả chi trả thực tế.",
  ]],
  ["result-cultivation", ["晋级奖励", "Rank-up reward", "Thưởng thăng hạng"], [
    "升到 {toRank} 可得晋级奖励，金额见等级页。",
    "You get a rank-up reward at {toRank}; see the rank page for the amount.",
    "Bạn nhận thưởng thăng hạng khi lên {toRank}; số tiền xem trang hạng.",
  ]],
  ["faq-members", ["团队有人，为什么还没升级？", "My team has people. Why haven't I ranked up?", "Vì sao nhóm có người mà tôi chưa lên hạng?"], [
    "团队人数不等于已购人数。好友和好友的好友里有有效付款订单才算已购；你还要同时满足目标等级和之前各级的自购算力点、团队算力点和人数要求。",
    "Team size isn't the same as buyers. Friends and their friends count as buyers once they have a valid paid order, and you also need to meet the own, team and people requirements of the target rank and every rank before it.",
    "Số thành viên khác số người đã mua. Bạn bè và bạn của bạn bè có đơn đã thanh toán hợp lệ mới tính là đã mua; bạn cũng cần đạt điều kiện điểm cá nhân, điểm nhóm và số người của hạng mục tiêu và các hạng trước đó.",
  ]],
  ["faq-rank", ["团队算力点减少后会怎样？", "What if my team compute points go down?", "Nếu điểm của nhóm giảm thì sao?"], [
    "{protection}",
    "{protection}",
    "{protection}",
  ]],
  ["faq-rewards", ["在哪里看进度、奖励和月薪？", "Where can I see progress, rewards and monthly rewards?", "Xem tiến độ, thưởng và thưởng tháng ở đâu?"], [
    "等级页看进度、领取月薪；奖励到账情况见奖励明细。",
    "The rank page shows your progress and lets you claim monthly rewards; see your reward history for payouts.",
    "Trang hạng hiển thị tiến độ và cho nhận thưởng tháng; xem lịch sử thưởng để biết khoản đã nhận.",
  ]],
];

const reviewRequirement = ["V8 另需另一位 V8 的推荐信和官方审核。", " V8 also needs a recommendation from another V8 and an official review.", " V8 cần thêm thư giới thiệu từ một V8 khác và xét duyệt chính thức."];

const revisedHero = [
  "等级越高，好友购买奖励比例、晋级奖励和月薪可能更高，具体以等级页为准。",
  "Higher ranks can bring higher friend purchase rates, larger rank-up rewards and larger monthly rewards. See the rank page for details.",
  "Hạng càng cao, tỷ lệ thưởng bạn bè mua hàng, thưởng thăng hạng và thưởng tháng có thể càng cao. Xem chi tiết tại trang hạng.",
];

export function rankPolicyDemo(url, locale, edition, reviewRequired) {
  if (url.pathname !== '/api/config/v-rank-policy') return undefined;
  const lang = url.searchParams.get('locale') || locale;
  const index = lang === 'zh' ? 0 : lang === 'vi' ? 2 : 1;
  const revised = edition === 'revised';
  const sections = (revised ? revisedRows : rows).map(([id, titles, bodies], order) => {
    let body = bodies[index];
    if (revised && id === 'promotion' && reviewRequired) body += reviewRequirement[index];
    if (revised && id === 'stepwise' && !reviewRequired) body = rows.find(([key]) => key === id)[2][index];
    return { id, title: titles[index], body, order };
  });
  const legacyHero = ["等级越高，可获得的奖励越多。", "The higher your rank, the more rewards you can earn.", "Hạng càng cao, phần thưởng bạn có thể nhận càng nhiều."];
  return {
    status: 'PUBLISHED', version: revised ? 'demo-rank-rules-2026.11.25' : 'default-2026.10.29', locale: lang,
    hero: (revised ? revisedHero : legacyHero)[index], source: 'server', sourceEnvironment: 'PRODUCTION', runId: '',
    rules: { permanentProtection: true, qualifiedReferralSelfComputePoints: revised ? null : demoV1SelfComputePoints, leadershipConfigured: !revised },
    sections,
  };
}
