export const TRAINING_STEPS = [
  { id: "words", label: "1. 学（词语）", short: "学" },
  { id: "sentences", label: "2. 读（句子）", short: "读" },
  { id: "simulation", label: "3. 说（模拟）", short: "说" },
];

export const REVIEWABLE_KINDS = ["word", "phrase", "sentence"];
export const isReviewable = (kind) => REVIEWABLE_KINDS.includes(kind);

export const WPM_VALUES = Array.from({ length: 13 }, (_, index) => 80 + index * 10);
export const SPEED_META = {
  80:["入门","逐词辨听与首次跟读"],90:["慢速","为短语留出充分反应时间"],100:["慢速","适合初级日常表达"],
  110:["舒缓","清晰完整，便于模仿语调"],120:["清晰","兼顾理解与自然连读"],130:["自然偏慢","进入真实交流节奏"],
  140:["自然","日常交流的自然节奏"],150:["自然偏快","训练快速组织与回应"],160:["流畅","接近工作与旅行交流"],
  170:["快速","强化连读和即时理解"],180:["快速","适合高阶听说挑战"],190:["挑战","应对高信息密度表达"],
  200:["高强度","模拟快速母语交流片段"],
};

export const CEFR_LEVELS = [
  { code:"A1", label:"入门表达", detail:"使用高频词与简单固定句型" },
  { code:"A2", label:"基础交流", detail:"处理熟悉场景中的直接沟通" },
  { code:"B1", label:"独立表达", detail:"熟悉话题中持续交流并说明理由" },
  { code:"B2", label:"流利互动", detail:"自然讨论抽象话题与不同观点" },
  { code:"C1", label:"熟练运用", detail:"灵活使用复杂句式与隐含表达" },
  { code:"C2", label:"精准掌控", detail:"处理高密度语义与细微语气差异" },
];

export const conversations = [
  { id:"lunch", title:"午餐与同学", time:"今天 12:40", turns:[
    ["AI","How was lunch with your classmates today?"],
    ["You","It was relaxing. We talked about our group project and the food near campus."],
    ["AI","That sounds nice. Which part of the project are you taking care of?"],
  ]},
  { id:"movie", title:"最近看的电影", time:"昨天", turns:[
    ["You","I watched a documentary about ocean exploration."],
    ["AI","What surprised you most about it?"],
  ]},
  { id:"weekend", title:"周末计划", time:"周一", turns:[
    ["AI","Do you have anything planned for this weekend?"],
    ["You","I might visit a small exhibition downtown."],
  ]},
];

export const sceneCategories = [
  { id:"daily", label:"生活日常", scenes:[
    { id:"cafe", title:"咖啡店点单", desc:"说明饮品、杯型与奶类偏好，并听懂确认问题。", meta:"约 6 分钟 · 基础", art:"cafe" },
    { id:"restaurant", title:"餐厅特殊需求", desc:"礼貌说明忌口、过敏或座位需求。", meta:"约 7 分钟 · 基础", art:"table" },
  ]},
  { id:"campus", label:"校园学习", scenes:[
    { id:"seminar", title:"课堂讨论", desc:"提出观点、回应同学并补充理由。", meta:"约 8 分钟 · 进阶", art:"book" },
  ]},
  { id:"travel", label:"旅行出行", scenes:[
    { id:"airport", title:"机场突发求助", desc:"说明问题、询问改签和下一步安排。", meta:"约 8 分钟 · 进阶", art:"plane" },
  ]},
  { id:"work", label:"工作沟通", scenes:[
    { id:"meeting", title:"会议沟通", desc:"表达不同意见并提出替代方案。", meta:"约 9 分钟 · 进阶", art:"work" },
  ]},
];

export const learningAssets = [
  { id:"recommend", kind:"word", type:"单词", text:"recommend", phonetic:"/ˌrekəˈmend/", translation:"推荐；建议", note:"重音落在最后一个音节" },
  { id:"different", kind:"phrase", type:"短语", text:"feel like trying something different", phonetic:"/fiːl laɪk ˈtraɪɪŋ/", translation:"想尝试一些不一样的选择", note:"feel like 后接动名词" },
  { id:"milk", kind:"phrase", type:"短语", text:"with oat milk", phonetic:"/wɪð əʊt mɪlk/", translation:"换成燕麦奶", note:"with 与 oat 自然连接" },
];

export const sentences = [
  { text:"Could you recommend something less sweet?", translation:"你能推荐一些不太甜的吗？", focus:"Could you · recommend · less sweet" },
  { text:"I feel like trying something different today.", translation:"我今天想尝试一些不一样的东西。", focus:"feel like trying · different" },
  { text:"I’ll have a medium latte with oat milk.", translation:"我要一杯中杯燕麦奶拿铁。", focus:"medium latte · with oat milk" },
  { text:"That’s all, thank you.", translation:"就这些，谢谢。", focus:"That’s all · thank you" },
];

export const diagnosticDimensions = [
  { name:"发音清晰度", value:84, note:"重点词清晰，th 音仍可更稳定" },
  { name:"流利度", value:78, note:"整体顺畅，个别停顿稍长" },
  { name:"表达完整度", value:91, note:"需求、偏好与确认信息完整" },
  { name:"互动回应", value:86, note:"能接住追问并主动确认" },
  { name:"自然度", value:80, note:"语序自然，可增加轻读与连读" },
];

export const pronunciationHistory = [
  { id:"h1", date:"7 月 10 日 · 14:32", item:"Could you recommend…", duration:"00:08", result:"重音准确，尾音可更轻" },
  { id:"h2", date:"7 月 9 日 · 20:16", item:"feel like trying…", duration:"00:06", result:"节奏稳定，trying 连读更自然" },
  { id:"h3", date:"7 月 8 日 · 11:05", item:"recommend", duration:"00:04", result:"末音节重音已改善" },
];

export const durationByDay = [18, 26, 34, 12, 40, 31, 22];

export const mockSessions = [
  {
    id: "cafe",
    title: "咖啡店点单",
    meta: "4 个词句 · 刚刚",
    stats: { word: 1, phrase: 2, sentence: 1 },
    assets: [
      { id: "recommend", kind: "word", type: "单词", text: "recommend", phonetic: "/ˌrekəˈmend/", translation: "推荐；建议", note: "💡 搭配纠错 · recommend 是及物动词" },
      { id: "different", kind: "phrase", type: "短语", text: "feel like trying something different", phonetic: "/fiːl laɪk ˈtraɪɪŋ/", translation: "想尝试一些不一样的选择", note: "💡 搭配纠错 · feel like 后接动名词" },
      { id: "milk", kind: "phrase", type: "短语", text: "with oat milk", phonetic: "/wɪð əʊt mɪlk/", translation: "换成燕麦奶", note: "💡 冠词纠错 · 不加定冠词 the，直接用 with oat milk" },
      { id: "order", kind: "sentence", type: "句子", text: "Could you recommend something less sweet?", phonetic: "/kʊdʒu ˌrekəˈmend/", translation: "你能推荐一些不太甜的吗？", note: "🗣️ 连读提示 · Could you 发生同化连读为 /kʊdʒu/" }
    ]
  },
  {
    id: "hotel",
    title: "酒店入住办理",
    meta: "5 个词句 · 2天前",
    stats: { word: 2, phrase: 2, sentence: 1 },
    assets: [
      { id: "reservation", kind: "word", type: "单词", text: "reservation", phonetic: "/ˌrezəˈveɪʃn/", translation: "预订，预约", note: "💡 重音提示 · 重音在第三音节" },
      { id: "check_in", kind: "phrase", type: "短语", text: "check in", phonetic: "/tʃek ɪn/", translation: "办理入住", note: "🗣️ 连读提示 · check 与 in 发生辅元连读" },
      { id: "deposit", kind: "word", type: "单词", text: "deposit", phonetic: "/dɪˈpɒzɪt/", translation: "押金", note: "💡 词汇释义 · 表示入住时交的保证金" },
      { id: "credit_card", kind: "phrase", type: "短语", text: "credit card", phonetic: "/ˈkredɪt kɑːd/", translation: "信用卡", note: "🗣️ 爆破提示 · credit 结尾的 t 发生失去爆破" },
      { id: "room_key", kind: "sentence", type: "句子", text: "Here is your room key.", phonetic: "/hɪər ɪz jɔː ruːm kiː/", translation: "这是您的房间钥匙。", note: "🗣️ 连读提示 · Here 与 is 发生连读" }
    ]
  },
  {
    id: "airport",
    title: "机场登机登记",
    meta: "4 个词句 · 1周前",
    stats: { word: 1, phrase: 2, sentence: 1 },
    assets: [
      { id: "boarding", kind: "word", type: "单词", text: "boarding pass", phonetic: "/ˈbɔːdɪŋ pɑːs/", translation: "登机牌", note: "💡 词汇释义 · 表示乘机证明" },
      { id: "carry_on", kind: "phrase", type: "短语", text: "carry-on luggage", phonetic: "/ˈkæri ɒn ˈlʌɡɪdʒ/", translation: "随身行李", note: "🗣️ 连读提示 · carry 与 on 发生元元连读 /ri-j-ɒn/" },
      { id: "luggage", kind: "phrase", type: "短语", text: "checked luggage", phonetic: "/tʃekt ˈlʌɡɪdʒ/", translation: "托运行李", note: "💡 词意区别 · checked baggage 与 carry-on 的区别" },
      { id: "gate", kind: "sentence", type: "句子", text: "Which gate does the flight leave from?", phonetic: "/wɪtʃ ɡeɪt dʌz ðə flaɪt liːv frɒm/", translation: "这趟航班在哪个登机口登机？", note: "🗣️ 节奏提示 · 强调 Which gate 和 flight" }
    ]
  }
];
