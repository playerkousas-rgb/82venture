/* ============================================================
   store.js — localStorage 資料層 + 示範種子資料
   （之後接真後端時，只需替換本檔的讀寫實作）
   ============================================================ */

const KEY = 'venture82.db.v1';
const SESSION_KEY = 'venture82.session.v1';

/* ---------------- seed ---------------- */
function seed() {
  return {
    version: 1,
    settings: {
      groupName: '82venture 深資童軍團',
      groupShort: '82venture',
      unitNo: '第 82 旅',
      progressUrl: '',                 // ← 之後填你現有的進度紀錄系統網址
      progressName: '團員進度紀錄系統',
      feePeriodLabel: '2025–26 年度團費',
      feeAmount: 200,
      updatedAt: ''
    },

    /* 三個帳戶 */
    accounts: [
      { id: 'super',  role: 'super',  username: 'sheep',  password: '0728', name: 'Sheep',   title: '超級管理員' },
      { id: 'leader', role: 'leader', username: 'leader', password: '8202', name: '團領袖',   title: '領袖' },
      { id: 'exco',   role: 'exco',   username: 'exco',   password: '8203', name: '執行委員會', title: '執委會' }
    ],

    /* 團章 */
    constitution: {
      version: '2.1',
      updatedAt: '2026-08-15',
      updatedBy: 'sheep',
      published: true,
      preamble:
        '本章程依據香港童軍總會《政策、組織及規條》及深資童軍團自務自治之精神訂立，' +
        '旨在確立本團之宗旨、組織、職權、會議及財務制度，使全體團員得以共同參與、共同決策、共同承擔。',
      chapters: [
        { id: 'c1', no: '第一章', title: '總則', articles: [
          { id: 'a101', no: '1.1', text: '本團定名為「82venture 深資童軍團」（下稱「本團」），隸屬香港童軍總會。' },
          { id: 'a102', no: '1.2', text: '本團以童軍誓詞及規律為根本，培養團員之領導才能、公民責任及服務精神。' },
          { id: 'a103', no: '1.3', text: '本團實行自務自治，團務由全體團員透過執行委員會（下稱「執委會」）共同管理。' },
          { id: 'a104', no: '1.4', text: '本章程為本團之最高內部規範，任何團內規章不得與之抵觸。' }
        ]},
        { id: 'c2', no: '第二章', title: '團員', articles: [
          { id: 'a201', no: '2.1', text: '凡年滿十五歲至二十歲、認同童軍誓詞及規律者，均得申請加入本團為團員。' },
          { id: 'a202', no: '2.2', text: '團員享有選舉權、被選舉權、提案權、表決權，以及參與本團一切活動之權利。' },
          { id: 'a203', no: '2.3', text: '團員須遵守童軍規律及本章程、出席會議及活動、並依期繳交團費。' },
          { id: 'a204', no: '2.4', text: '團員連續三次無故缺席常會，或逾期三個月未繳團費者，執委會得向其作出提醒並記錄在案。' }
        ]},
        { id: 'c3', no: '第三章', title: '執行委員會', articles: [
          { id: 'a301', no: '3.1', text: '執委會為本團之最高執行機關，對全體團員負責。' },
          { id: 'a302', no: '3.2', text: '執委會由主席、秘書、司庫及不少於兩名委員組成，全部由團員大會以不記名投票選出，任期一年。' },
          { id: 'a303', no: '3.3', text: '執委會職權包括：執行團員大會決議、籌辦活動、管理團務及財務、擬定年度計劃及財政預算。' },
          { id: 'a304', no: '3.4', text: '執委會會議須有過半數委員出席方為有效；決議以出席者過半數贊成通過，票數相同時由主席投決定票。' }
        ]},
        { id: 'c4', no: '第四章', title: '會議', articles: [
          { id: 'a401', no: '4.1', text: '團員大會每年至少舉行兩次，須於十四日前通知全體團員。' },
          { id: 'a402', no: '4.2', text: '執委會會議每月至少舉行一次；主席得應三名或以上委員要求召開臨時會議。' },
          { id: 'a403', no: '4.3', text: '秘書須於會議後十四日內完成會議記錄，並向全體團員公布。' }
        ]},
        { id: 'c5', no: '第五章', title: '財務', articles: [
          { id: 'a501', no: '5.1', text: '本團財務由司庫負責，須設立完整收支記錄，所有支出須有單據。' },
          { id: 'a502', no: '5.2', text: '每筆超過港幣五百元之支出，須經執委會事先核准。' },
          { id: 'a503', no: '5.3', text: '司庫須於每季及每年終結後一個月內，向執委會提交財務報表。' },
          { id: 'a504', no: '5.4', text: '團費金額由團員大會議決；如有特殊困難，團員得向執委會申請減免。' }
        ]},
        { id: 'c6', no: '第六章', title: '紀律', articles: [
          { id: 'a601', no: '6.1', text: '團員如有違反童軍規律或損害本團聲譽之行為，執委會得予以勸誡、暫停會籍或開除會籍。' },
          { id: 'a602', no: '6.2', text: '開除會籍之處分須經團員大會三分之二出席者贊成，並報總會備案。' }
        ]},
        { id: 'c7', no: '第七章', title: '章程修訂', articles: [
          { id: 'a701', no: '7.1', text: '本章程之修訂，須由三名或以上團員聯署提出，並於團員大會經三分之二出席者贊成通過。' },
          { id: 'a702', no: '7.2', text: '修訂後之章程須於通過後十四日內向全體團員公布，並報總會備案。' }
        ]}
      ],
      history: [
        { version: '2.1', date: '2026-08-15', by: 'sheep', note: '修訂第五章財務條文，增訂季度報表要求' },
        { version: '2.0', date: '2025-09-01', by: 'leader', note: '全面檢討，改為自務自治架構' },
        { version: '1.0', date: '2023-09-01', by: 'sheep', note: '首版訂立' }
      ]
    },

    /* 團員 */
    members: [
      { id: 'm1',  name: '陳彥廷', eng: 'Chan Yin Ting', role: '執委會主席', phone: '9123 4567', email: 'yinting@example.org', join: '2023-09-01', status: 'active', tags: ['執委會', '領袖級'], note: '統籌全年團務，主持執委會會議。' },
      { id: 'm2',  name: '林思穎', eng: 'Lam Sze Wing',  role: '秘書',       phone: '9234 5678', email: 'szewing@example.org', join: '2023-09-01', status: 'active', tags: ['執委會'],          note: '負責會議通知、議程及會議記錄。' },
      { id: 'm3',  name: '黃子謙', eng: 'Wong Tsz Him',  role: '司庫',       phone: '9345 6789', email: 'tszhim@example.org',  join: '2023-09-01', status: 'active', tags: ['執委會'],          note: '管理團費收支及季度報表。' },
      { id: 'm4',  name: '張樂瑤', eng: 'Cheung Lok Yiu',role: '活動統籌',   phone: '9456 7890', email: 'lokyiu@example.org',   join: '2024-03-16', status: 'active', tags: ['執委會'],          note: '策劃遠足、露營及服務活動。' },
      { id: 'm5',  name: '李俊賢', eng: 'Lee Chun Yin',  role: '文書',       phone: '9567 8901', email: 'chunyin@example.org',  join: '2024-03-16', status: 'active', tags: ['執委會'],          note: '負責文件存檔及團章版本管理。' },
      { id: 'm6',  name: '吳曉彤', eng: 'Ng Hiu Tung',   role: '隊長',       phone: '9678 9012', email: 'hiutung@example.org',  join: '2024-09-07', status: 'active', tags: ['小隊'],            note: '帶領小隊訓練及新團員適應。' },
      { id: 'm7',  name: '何柏軒', eng: 'Ho Pak Hin',    role: '隊員',       phone: '9789 0123', email: 'pakhin@example.org',   join: '2025-03-15', status: 'active', tags: ['小隊'],            note: '' },
      { id: 'm8',  name: '梁芷晴', eng: 'Leung Tsz Ching',role: '隊員',      phone: '9890 1234', email: 'tszching@example.org', join: '2025-03-15', status: 'active', tags: ['小隊'],            note: '對急救及野外技能特別有興趣。' },
      { id: 'm9',  name: '周凱文', eng: 'Chow Hoi Man',  role: '隊員',       phone: '9901 2345', email: 'hoiman@example.org',   join: '2025-09-06', status: 'active', tags: ['新團員'],          note: '' },
      { id: 'm10', name: '鄧雅琳', eng: 'Tang Nga Lam',  role: '隊員',       phone: '9012 3456', email: 'ngalam@example.org',   join: '2025-09-06', status: 'leave',  tags: ['新團員'],          note: '2026 上半年學業繁忙，暫請事假。' }
    ],

    /* 會議 —— 狀態：draft 草稿 / pending 待處理 / confirmed 已確定 / done 已完成 */
    meetings: [
      {
        id: 'mt1', title: '九月執委會常會', type: 'exco', date: '2026-09-20', time: '15:00', venue: '旅部活動室',
        chair: 'm1', secretary: 'm2', status: 'pending',
        agenda: [
          { id: 'ag1', text: '通過上次會議記錄', minutes: 3 },
          { id: 'ag2', text: '司庫報告（八月收支及團費進度）', minutes: 10 },
          { id: 'ag3', text: '秋季遠足籌備進度', minutes: 15 },
          { id: 'ag4', text: '新團員招募計劃', minutes: 10 },
          { id: 'ag5', text: '團章修訂討論（第五章財務）', minutes: 15 },
          { id: 'ag6', text: '其他事項', minutes: 5 }
        ],
        attendance: {}, minutes: '',
        decisions: [
          { id: 'd1', text: '秋季遠足定於 10 月 25–26 日，由張樂瑤統籌', owner: 'm4', due: '2026-10-10', done: false }
        ],
        attachments: [], createdBy: 'sheep', updatedAt: '2026-09-12 21:10'
      },
      {
        id: 'mt2', title: '八月執委會常會', type: 'exco', date: '2026-08-16', time: '15:00', venue: '旅部活動室',
        chair: 'm1', secretary: 'm2', status: 'done',
        agenda: [
          { id: 'ag7', text: '通過上次會議記錄', minutes: 3 },
          { id: 'ag8', text: '暑期露營檢討', minutes: 20 },
          { id: 'ag9', text: '團章修訂（第五章）', minutes: 20 },
          { id: 'ag10', text: '其他事項', minutes: 5 }
        ],
        attendance: { m1: 'present', m2: 'present', m3: 'present', m4: 'present', m5: 'apology', m6: 'present' },
        minutes: '主席於下午三時正宣布會議開始。\n\n1. 通過上次會議記錄：由李俊賢動議、林思穎和議，一致通過。\n\n2. 暑期露營檢討：全體同意露營整體順利，惟物資清點需提前三日完成，明年由文書負責製作物資清單。\n\n3. 團章修訂：經詳細討論後，接納第五章 5.3 之修訂，增訂季度財務報表要求。\n\n4. 其他事項：無。\n\n會議於下午四時十分結束。',
        decisions: [
          { id: 'd2', text: '製作露營物資標準清單，明年活動前三日完成清點', owner: 'm5', due: '2027-06-30', done: false },
          { id: 'd3', text: '團章第五章 5.3 修訂案提交團員大會追認', owner: 'm2', due: '2026-09-20', done: true }
        ],
        attachments: [{ name: '2026暑期露營檢討.pdf', size: '412 KB' }],
        createdBy: 'sheep', updatedAt: '2026-08-16 16:15'
      },
      {
        id: 'mt3', title: '秋季遠足籌備會議', type: 'activity', date: '2026-09-27', time: '14:00', venue: '線上（Zoom）',
        chair: 'm4', secretary: 'm5', status: 'confirmed',
        agenda: [
          { id: 'ag11', text: '路線及安全風險評估', minutes: 20 },
          { id: 'ag12', text: '分工及物資', minutes: 15 },
          { id: 'ag13', text: '預算及收費', minutes: 10 }
        ],
        attendance: {}, minutes: '', decisions: [], attachments: [],
        createdBy: 'sheep', updatedAt: '2026-09-10 12:00'
      },
      {
        id: 'mt4', title: '2026 年度第二次團員大會', type: 'agm', date: '2026-10-04', time: '15:00', venue: '旅部禮堂',
        chair: 'm1', secretary: 'm2', status: 'draft',
        agenda: [
          { id: 'ag14', text: '通過上次會議記錄', minutes: 5 },
          { id: 'ag15', text: '主席年度報告', minutes: 15 },
          { id: 'ag16', text: '司庫年度財務報告', minutes: 15 },
          { id: 'ag17', text: '團章修訂追認', minutes: 20 },
          { id: 'ag18', text: '執委會補選（如有）', minutes: 15 }
        ],
        attendance: {}, minutes: '', decisions: [], attachments: [],
        createdBy: 'sheep', updatedAt: '2026-09-08 09:30'
      }
    ],

    /* 收支紀錄 */
    transactions: [
      { id: 't1',  date: '2026-09-01', type: 'income',  category: '團費',     item: '陳彥廷 2025–26 團費',   amount: 200,   method: '轉數快', by: 'm1',  ref: 'FPS-001', note: '', receipt: true },
      { id: 't2',  date: '2026-09-01', type: 'income',  category: '團費',     item: '林思穎 2025–26 團費',   amount: 200,   method: '轉數快', by: 'm2',  ref: 'FPS-002', note: '', receipt: true },
      { id: 't3',  date: '2026-09-03', type: 'income',  category: '團費',     item: '黃子謙 2025–26 團費',   amount: 200,   method: '現金',   by: 'm3',  ref: '', note: '', receipt: true },
      { id: 't4',  date: '2026-09-05', type: 'expense', category: '場地',     item: '九月份場地租金',         amount: 600,   method: '轉賬',   by: '',    ref: '', note: '旅部活動室', receipt: true },
      { id: 't5',  date: '2026-09-06', type: 'expense', category: '活動',     item: '遠足路線勘察交通費',     amount: 184,   method: '現金',   by: 'm4',  ref: '', note: '巴士及小巴', receipt: true },
      { id: 't6',  date: '2026-09-08', type: 'income',  category: '資助',     item: '總會活動資助（第一期）', amount: 3000,  method: '轉賬',   by: '',    ref: 'GR-26-011', note: '', receipt: true },
      { id: 't7',  date: '2026-09-10', type: 'expense', category: '物資',     item: '急救包補給',             amount: 320,   method: '現金',   by: 'm8',  ref: '', note: '紗布、繃帶、消毒用品', receipt: true },
      { id: 't8',  date: '2026-09-11', type: 'expense', category: '文書',     item: '影印團章及會議文件',     amount: 96,    method: '現金',   by: 'm5',  ref: '', note: '', receipt: false },
      { id: 't9',  date: '2026-09-12', type: 'income',  category: '活動費',   item: '秋季遠足報名費（6 人）', amount: 900,   method: '轉數快', by: '',    ref: 'FPS-0912', note: '每人 HK$150', receipt: true },
      { id: 't10', date: '2026-08-05', type: 'income',  category: '團費',     item: '張樂瑤 2025–26 團費',   amount: 200,   method: '轉數快', by: 'm4',  ref: 'FPS-0805', note: '', receipt: true },
      { id: 't11', date: '2026-08-05', type: 'income',  category: '團費',     item: '李俊賢 2025–26 團費',   amount: 200,   method: '轉數快', by: 'm5',  ref: 'FPS-0806', note: '', receipt: true },
      { id: 't12', date: '2026-08-10', type: 'expense', category: '活動',     item: '暑期露營營地費用',       amount: 2400,  method: '轉賬',   by: '',    ref: '', note: '兩晚，共 14 人', receipt: true },
      { id: 't13', date: '2026-08-10', type: 'expense', category: '活動',     item: '暑期露營伙食',           amount: 1860,  method: '現金',   by: 'm6',  ref: '', note: '', receipt: true },
      { id: 't14', date: '2026-08-18', type: 'income',  category: '活動費',   item: '暑期露營收費（14 人）',  amount: 4200,  method: '轉數快', by: '',    ref: '', note: '每人 HK$300', receipt: true },
      { id: 't15', date: '2026-08-20', type: 'expense', category: '場地',     item: '八月份場地租金',         amount: 600,   method: '轉賬',   by: '',    ref: '', note: '', receipt: true },
      { id: 't16', date: '2026-08-22', type: 'expense', category: '雜項',     item: '團部電話費',             amount: 128,   method: '自動扣賬', by: '',   ref: '', note: '', receipt: false }
    ],

    /* 團費 / 活動費收繳 */
    fees: [
      { id: 'f1',  memberId: 'm1',  kind: '團費',  label: '2025–26 年度團費', amount: 200, due: '2026-09-30', paid: true,  paidDate: '2026-09-01', method: '轉數快' },
      { id: 'f2',  memberId: 'm2',  kind: '團費',  label: '2025–26 年度團費', amount: 200, due: '2026-09-30', paid: true,  paidDate: '2026-09-01', method: '轉數快' },
      { id: 'f3',  memberId: 'm3',  kind: '團費',  label: '2025–26 年度團費', amount: 200, due: '2026-09-30', paid: true,  paidDate: '2026-09-03', method: '現金' },
      { id: 'f4',  memberId: 'm4',  kind: '團費',  label: '2025–26 年度團費', amount: 200, due: '2026-09-30', paid: true,  paidDate: '2026-08-05', method: '轉數快' },
      { id: 'f5',  memberId: 'm5',  kind: '團費',  label: '2025–26 年度團費', amount: 200, due: '2026-09-30', paid: true,  paidDate: '2026-08-05', method: '轉數快' },
      { id: 'f6',  memberId: 'm6',  kind: '團費',  label: '2025–26 年度團費', amount: 200, due: '2026-09-30', paid: false, paidDate: '', method: '' },
      { id: 'f7',  memberId: 'm7',  kind: '團費',  label: '2025–26 年度團費', amount: 200, due: '2026-09-30', paid: false, paidDate: '', method: '' },
      { id: 'f8',  memberId: 'm8',  kind: '團費',  label: '2025–26 年度團費', amount: 200, due: '2026-09-30', paid: false, paidDate: '', method: '' },
      { id: 'f9',  memberId: 'm9',  kind: '團費',  label: '2025–26 年度團費', amount: 200, due: '2026-09-30', paid: false, paidDate: '', method: '' },
      { id: 'f10', memberId: 'm10', kind: '團費',  label: '2025–26 年度團費', amount: 200, due: '2026-09-30', paid: false, paidDate: '', method: '' },
      { id: 'f11', memberId: 'm1',  kind: '活動費', label: '秋季遠足（10月25–26日）', amount: 150, due: '2026-10-11', paid: true,  paidDate: '2026-09-12', method: '轉數快' },
      { id: 'f12', memberId: 'm2',  kind: '活動費', label: '秋季遠足（10月25–26日）', amount: 150, due: '2026-10-11', paid: true,  paidDate: '2026-09-12', method: '轉數快' },
      { id: 'f13', memberId: 'm4',  kind: '活動費', label: '秋季遠足（10月25–26日）', amount: 150, due: '2026-10-11', paid: true,  paidDate: '2026-09-12', method: '轉數快' },
      { id: 'f14', memberId: 'm6',  kind: '活動費', label: '秋季遠足（10月25–26日）', amount: 150, due: '2026-10-11', paid: true,  paidDate: '2026-09-12', method: '轉數快' },
      { id: 'f15', memberId: 'm7',  kind: '活動費', label: '秋季遠足（10月25–26日）', amount: 150, due: '2026-10-11', paid: true,  paidDate: '2026-09-12', method: '現金' },
      { id: 'f16', memberId: 'm8',  kind: '活動費', label: '秋季遠足（10月25–26日）', amount: 150, due: '2026-10-11', paid: true,  paidDate: '2026-09-12', method: '現金' },
      { id: 'f17', memberId: 'm3',  kind: '活動費', label: '秋季遠足（10月25–26日）', amount: 150, due: '2026-10-11', paid: false, paidDate: '', method: '' },
      { id: 'f18', memberId: 'm5',  kind: '活動費', label: '秋季遠足（10月25–26日）', amount: 150, due: '2026-10-11', paid: false, paidDate: '', method: '' },
      { id: 'f19', memberId: 'm9',  kind: '活動費', label: '秋季遠足（10月25–26日）', amount: 150, due: '2026-10-11', paid: false, paidDate: '', method: '' }
    ],

    /* 活動預算結算（次要功能） */
    budgets: [
      {
        id: 'b1', event: '秋季遠足（10 月 25–26 日）', date: '2026-10-25', status: 'open',
        items: [
          { id: 'bi1', name: '交通（包車）',   budget: 2200, actual: 0 },
          { id: 'bi2', name: '營地費用',       budget: 1400, actual: 0 },
          { id: 'bi3', name: '伙食',           budget: 1200, actual: 0 },
          { id: 'bi4', name: '急救及雜項',     budget: 300,  actual: 0 }
        ],
        incomeItems: [
          { id: 'bii1', name: '團員收費（HK$150 × 12 人）', budget: 1800, actual: 900 },
          { id: 'bii2', name: '總會資助',                    budget: 1500, actual: 0 }
        ]
      }
    ]
  };
}

/* ---------------- persistence ---------------- */
let cache = null;

export function load() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { cache = JSON.parse(raw); }
  } catch (e) { console.warn('讀取資料失敗，改用種子資料', e); }
  if (!cache || cache.version !== 1) { cache = seed(); save(); }
  return cache;
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(cache)); }
  catch (e) { console.error('儲存失敗', e); }
}
export function commit() { save(); }
export function reset() {
  cache = seed(); save();
  localStorage.removeItem(SESSION_KEY);
}
export function importJSON(text) {
  const obj = JSON.parse(text);
  if (!obj || typeof obj !== 'object') throw new Error('格式不正確');
  cache = Object.assign(seed(), obj);
  cache.version = 1; save();
}

/* ---------------- session ---------------- */
export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
  catch { return null; }
}
export function setSession(s) {
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
}

/* ---------------- generic CRUD helpers ---------------- */
export function collection(name) {
  const db = load();
  if (!db[name]) db[name] = [];
  return db[name];
}
export function find(name, id) { return collection(name).find(x => x.id === id) || null; }
export function add(name, obj) { const c = collection(name); c.unshift(obj); commit(); return obj; }
export function update(name, id, patch) {
  const item = find(name, id);
  if (item) { Object.assign(item, patch); commit(); }
  return item;
}
export function remove(name, id) {
  const db = load();
  db[name] = (db[name] || []).filter(x => x.id !== id);
  commit();
}
