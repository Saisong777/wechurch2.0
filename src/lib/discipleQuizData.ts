// Original reflection game content. Scripture summaries and creative archetypes are distinct.
export const DISCIPLE_IDS = ["peter", "andrew", "james", "john", "philip", "nathanael", "matthew", "thomas", "jamesA", "thaddaeus", "simonZ", "matthias"] as const;
export type DiscipleId = typeof DISCIPLE_IDS[number];
export interface DiscipleProfile { id: DiscipleId; name: string; icon: string; title: string; traits: string[]; reflection: string; strength: string; growth: string; action: string; prompt: string; reference: string; scripture: string; sourceNote: string }
export interface QuizQuestion { id: string; chapter: string; text: string; options: Array<{text: string; role: DiscipleId}> }
export const DISCIPLES: readonly DiscipleProfile[] = [
  {
    "id": "peter",
    "name": "彼得",
    "icon": "🪨",
    "title": "勇敢開路者",
    "traits": [
      "主動",
      "嘗試",
      "承擔"
    ],
    "reflection": "你常願意踏出第一步，讓停在原地的事情開始流動。",
    "strength": "在不確定中開始行動，也願意承擔眼前需要。",
    "growth": "行動之前多聽一個不同的意見，讓勇氣有方向。",
    "action": "邀一位夥伴，今天一起試一個小而可逆的行動。",
    "prompt": "我帶頭的時候，你有足夠空間說出自己的想法嗎？",
    "reference": "馬太福音14:28–31",
    "scripture": "彼得曾請求走在水面上到耶穌那裡，害怕下沉時向祂求救。",
    "sourceNote": "這段記載呈現一次回應與求助，不能據此斷定終身人格。"
  },
  {
    "id": "andrew",
    "name": "安得烈",
    "icon": "🤝",
    "title": "連結同行者",
    "traits": [
      "連結",
      "邀請",
      "成全"
    ],
    "reflection": "你容易看見誰能彼此幫助，也願意讓新的人進入關係。",
    "strength": "把人帶到合適的關係裡，讓別人的長處有機會被看見。",
    "growth": "牽線之前先問雙方意願，也留意自己的界線與需要。",
    "action": "經過雙方同意，介紹兩位可能彼此支持的朋友認識。",
    "prompt": "我替你安排幫助時，有先聽你的意願嗎？",
    "reference": "約翰福音1:40–42",
    "scripture": "安得烈找到兄弟西門，把他帶到耶穌面前。",
    "sourceNote": "「連結同行者」是依這段故事延伸的遊戲角色，不是人格定論。"
  },
  {
    "id": "james",
    "name": "西庇太的兒子雅各",
    "icon": "⚡",
    "title": "全力投入者",
    "traits": [
      "投入",
      "毅力",
      "目標"
    ],
    "reflection": "你重視值得努力的目標，遇到困難也常願意繼續投入。",
    "strength": "為重要的事付出力氣，把想做的事持續推進。",
    "growth": "留意目標之外的人與代價，容許休息、調整或求助。",
    "action": "選一項重要工作，同時排進一段休息與一次夥伴確認。",
    "prompt": "我全力往前時，有沒有忽略你或自己的負荷？",
    "reference": "馬可福音3:17；10:35–45",
    "scripture": "雅各與約翰被稱為雷子，也曾一起向耶穌要求榮耀中的座位。",
    "sourceNote": "經文也記下耶穌對服事的教導；此處的角色特質屬遊戲創作。"
  },
  {
    "id": "john",
    "name": "約翰",
    "icon": "❤️",
    "title": "深度陪伴者",
    "traits": [
      "傾聽",
      "內省",
      "理解"
    ],
    "reflection": "你傾向先理解人的內心與關係，再回應眼前發生的事。",
    "strength": "細聽感受，讓不容易說出口的經驗有被理解的空間。",
    "growth": "別只靠揣測理解對方，可以直接詢問，也練習清楚說出需要。",
    "action": "留十分鐘聽一位朋友說近況，先問、先聽，不急著給建議。",
    "prompt": "你說話時，我是真的理解，還是太快替你解釋？",
    "reference": "馬可福音3:17",
    "scripture": "約翰是西庇太的兒子、雅各的兄弟，與他一同被稱為雷子。",
    "sourceNote": "深度陪伴是本測驗的創作角色；「耶穌所愛的門徒」對應約翰採常見教會傳統，相關經文未直接署名。"
  },
  {
    "id": "philip",
    "name": "腓力",
    "icon": "🔍",
    "title": "務實探索者",
    "traits": [
      "務實",
      "提問",
      "方法"
    ],
    "reflection": "你常把抽象想法帶回現實，想弄懂資源、限制和下一步。",
    "strength": "看見現實條件，把大想法拆成眼前做得到的步驟。",
    "growth": "計算限制時也保留嘗試的空間，避免太早判定沒有可能。",
    "action": "把一個看似太大的想法，拆成今天能試的一小步。",
    "prompt": "我提出限制時，有幫你找路，還是讓你覺得只能放棄？",
    "reference": "約翰福音6:5–7",
    "scripture": "面對群眾吃飯的問題，腓力計算所需費用，指出供應的不足。",
    "sourceNote": "這是一次事件的記載，角色特質是本測驗的延伸設計。"
  },
  {
    "id": "nathanael",
    "name": "拿但業",
    "icon": "💎",
    "title": "真誠對話者",
    "traits": [
      "真誠",
      "坦率",
      "一致"
    ],
    "reflection": "你重視表裡一致，希望人與人之間可以真實地說話。",
    "strength": "願意承認不知道、不認同或做不到，讓關係有真話的空間。",
    "growth": "說真話也可以選擇合宜的時機與方式，並留意自己的預設。",
    "action": "練習用「我的觀察是……我想了解……」開啟一次真誠對話。",
    "prompt": "我說得坦白的時候，有沒有也讓你感受到尊重？",
    "reference": "約翰福音1:45–49",
    "scripture": "耶穌稱拿但業為心裡沒有詭詐的以色列人。",
    "sourceNote": "拿但業與巴多羅買採常見教會傳統對應，經文沒有直接說兩名是同一人。"
  },
  {
    "id": "matthew",
    "name": "馬太",
    "icon": "📊",
    "title": "有序整理者",
    "traits": [
      "條理",
      "細節",
      "清楚"
    ],
    "reflection": "你喜歡把散落的事情整理清楚，讓人容易理解、接手和合作。",
    "strength": "讓資訊、流程與責任有脈絡，減少大家重複摸索的負擔。",
    "growth": "容許計畫因人而調整，別讓追求完整成為開始的門檻。",
    "action": "把一份容易讓人困惑的資訊，整理成三個清楚的下一步。",
    "prompt": "我整理的方式，對你有幫助，還是增加了負擔？",
    "reference": "馬太福音9:9",
    "scripture": "馬太在稅關上聽見耶穌的呼召，就起來跟從祂。",
    "sourceNote": "有序整理是本測驗創作，並非經文對馬太的性格測量，也不以福音書作者傳統作證明。"
  },
  {
    "id": "thomas",
    "name": "多馬",
    "icon": "🧪",
    "title": "審慎求證者",
    "traits": [
      "求證",
      "思辨",
      "誠實"
    ],
    "reflection": "你傾向把疑問說清楚，核對自己真正知道和不知道的事。",
    "strength": "願意檢查重要資訊，讓團隊有機會修正錯誤的假設。",
    "growth": "核對之後也練習決定下一步，避免等到完全確定才開始。",
    "action": "選一個目前的疑問，找原始資料核對，再決定一個小行動。",
    "prompt": "我的追問有幫你釐清，還是讓你感到不被信任？",
    "reference": "約翰福音20:24–29",
    "scripture": "多馬曾表示要看見才相信，後來向耶穌宣認祂是自己的主與神。",
    "sourceNote": "經文沒有說多馬的信仰「比誰都堅定」；此處不作門徒間的高低比較。"
  },
  {
    "id": "jamesA",
    "name": "亞勒腓的兒子雅各",
    "icon": "🌿",
    "title": "穩定守望者",
    "traits": [
      "穩定",
      "持續",
      "可靠"
    ],
    "reflection": "你看重持續出現、完成承諾，讓日常有可以依靠的節奏。",
    "strength": "在不起眼的日常中維持照應，讓事情能長久運作。",
    "growth": "忠於承諾也可以表達限制，別把所有責任都默默留給自己。",
    "action": "完成一件已答應的小事，也向夥伴清楚說出一項需要。",
    "prompt": "我說「沒問題」的時候，你知道我真正的負荷嗎？",
    "reference": "馬太福音10:3；使徒行傳1:13–14",
    "scripture": "亞勒腓的兒子雅各列在使徒名單與同心禱告的群體中。",
    "sourceNote": "聖經留下的個人資料很少，不能據此推定他安靜、可靠；穩定守望者是遊戲創作。"
  },
  {
    "id": "thaddaeus",
    "name": "達太",
    "icon": "🔥",
    "title": "用心關懷者",
    "traits": [
      "關懷",
      "敏銳",
      "支持"
    ],
    "reflection": "你容易注意到人的需要，願意停下來問：現在能怎麼陪你？",
    "strength": "讓容易被忽略的人被看見，帶來有溫度的支持。",
    "growth": "先聽對方需要，也留意自己的能力，不必承接每個人的困難。",
    "action": "先徵詢意願，為一位有需要的人做一件具體而不勉強的小事。",
    "prompt": "我提供的照顧，是你想要的，還是我以為你需要的？",
    "reference": "約翰福音14:22",
    "scripture": "猶大（非加略人）問耶穌為何向門徒顯現，而不向世人顯現。",
    "sourceNote": "達太與這位猶大採教會傳統對應；熱心、公義或內在性格不是這節經文明說。"
  },
  {
    "id": "simonZ",
    "name": "奮銳黨的西門",
    "icon": "⚔️",
    "title": "改善行動者",
    "traits": [
      "改善",
      "公義",
      "行動"
    ],
    "reflection": "你常看見既有安排中不合適的地方，希望事情能變得更好。",
    "strength": "願意指出問題，也嘗試讓參與、資源與責任更公平。",
    "growth": "推動改變之前聽聽受影響的人，確認行動真正服務他們。",
    "action": "問一位受影響的人：哪個小改變對你最有幫助？再一起試做。",
    "prompt": "我推動的改變，有讓真正受影響的人一起決定嗎？",
    "reference": "路加福音6:15",
    "scripture": "路加稱他為奮銳黨的西門，並把他列在耶穌所選的十二使徒中。",
    "sourceNote": "稱號的歷史背景有討論，不能直接斷言他屬於特定政治組織或有已知改革事蹟。"
  },
  {
    "id": "matthias",
    "name": "馬提亞",
    "icon": "🌟",
    "title": "預備補位者",
    "traits": [
      "預備",
      "學習",
      "接棒"
    ],
    "reflection": "你看重在需要出現之前做好準備，盼望到時能接上、幫上忙。",
    "strength": "願意累積能力、理解需要，讓團隊遇到缺口時多一份選擇。",
    "growth": "預備也需要適時實作；不必等到完全準備好，才容許自己加入。",
    "action": "挑一項想學的能力，今天練習十五分鐘，並找一次實際運用機會。",
    "prompt": "我一直在準備的事，現在有哪些已經可以開始試？",
    "reference": "使徒行傳1:21–26",
    "scripture": "馬提亞符合一同作伴、見證復活的候選資格，後被選入使徒行列補上猶大的缺。",
    "sourceNote": "馬提亞不是耶穌最初揀選的十二名單成員；預備、等候的內在性格是本測驗創作。"
  }
];
export const QUESTIONS: readonly QuizQuestion[] = [
  {
    "id": "q01",
    "chapter": "初次相遇",
    "text": "第一次參加一場陌生人的聚會，你比較自然的做法是？",
    "options": [
      {
        "text": "把落單的人介紹給聊得來的朋友",
        "role": "andrew"
      },
      {
        "text": "先招呼大家，提議一起做點什麼",
        "role": "peter"
      },
      {
        "text": "留意誰不自在，主動關心他的需要",
        "role": "thaddaeus"
      },
      {
        "text": "真實介紹自己，也直接問對方在意的事",
        "role": "nathanael"
      }
    ]
  },
  {
    "id": "q02",
    "chapter": "初次相遇",
    "text": "臨時要安排一場小聚會，你最想先處理哪件事？",
    "options": [
      {
        "text": "算清楚時間、人數和實際可用的資源",
        "role": "philip"
      },
      {
        "text": "確認大家真正想要什麼，不勉強假裝喜歡",
        "role": "nathanael"
      },
      {
        "text": "找到可以一起幫忙的人，把彼此連起來",
        "role": "andrew"
      },
      {
        "text": "先把例行工作穩穩做好，讓現場有人照應",
        "role": "jamesA"
      }
    ]
  },
  {
    "id": "q03",
    "chapter": "初次相遇",
    "text": "團隊多了一位新朋友，你會先怎麼幫他進入狀況？",
    "options": [
      {
        "text": "主動帶他試做一次，讓他快點上手",
        "role": "peter"
      },
      {
        "text": "邀他一起完成一個有挑戰的小任務",
        "role": "james"
      },
      {
        "text": "整理一份清楚的資訊，讓他隨時可以查看",
        "role": "matthew"
      },
      {
        "text": "介紹他認識不同夥伴，找到可以求助的人",
        "role": "andrew"
      }
    ]
  },
  {
    "id": "q04",
    "chapter": "初次相遇",
    "text": "你接下一個從沒做過的任務，會如何開始？",
    "options": [
      {
        "text": "問清楚要做到什麼、有哪些限制",
        "role": "philip"
      },
      {
        "text": "先準備可能用到的技能與備案",
        "role": "matthias"
      },
      {
        "text": "找曾經做過的人交流，邀請他指點",
        "role": "andrew"
      },
      {
        "text": "核對關鍵資訊，先釐清自己還不確定的地方",
        "role": "thomas"
      }
    ]
  },
  {
    "id": "q05",
    "chapter": "一起商量",
    "text": "一個新想法聽起來很吸引人，你會怎麼回應？",
    "options": [
      {
        "text": "先問有什麼證據，可以怎麼驗證",
        "role": "thomas"
      },
      {
        "text": "想知道這個想法與大家真正重視的事有何關聯",
        "role": "john"
      },
      {
        "text": "留意這件事能照顧到誰、又可能忽略誰",
        "role": "thaddaeus"
      },
      {
        "text": "把步驟和需要的資訊記下來，再檢查可行性",
        "role": "matthew"
      }
    ]
  },
  {
    "id": "q06",
    "chapter": "一起商量",
    "text": "大家意見不合，討論有點卡住了。你通常會？",
    "options": [
      {
        "text": "把爭議拆成可核對的問題，逐一求證",
        "role": "thomas"
      },
      {
        "text": "提醒大家共同目標，鼓勵繼續往前",
        "role": "james"
      },
      {
        "text": "坦白說出自己的想法，也請大家說真話",
        "role": "nathanael"
      },
      {
        "text": "先聽聽每個人話裡的感受，幫彼此理解",
        "role": "john"
      }
    ]
  },
  {
    "id": "q07",
    "chapter": "一起商量",
    "text": "活動開始前，發現原本的安排可能行不通，你會？",
    "options": [
      {
        "text": "拿出預先準備的備案，等需要時接上",
        "role": "matthias"
      },
      {
        "text": "先確認哪個環節真的有問題，避免誤判",
        "role": "thomas"
      },
      {
        "text": "守住仍能運作的部分，讓現場不至於亂掉",
        "role": "jamesA"
      },
      {
        "text": "重新調整不合適的做法，推動必要的改變",
        "role": "simonZ"
      }
    ]
  },
  {
    "id": "q08",
    "chapter": "一起商量",
    "text": "朋友問你一個困難的問題，你比較傾向？",
    "options": [
      {
        "text": "把問題分清楚，整理相關資訊給他",
        "role": "matthew"
      },
      {
        "text": "先問他現在最需要哪一種支持",
        "role": "thaddaeus"
      },
      {
        "text": "誠實說出知道和不知道的部分，不裝懂",
        "role": "nathanael"
      },
      {
        "text": "釐清限制，提供他現在做得到的幾個方法",
        "role": "philip"
      }
    ]
  },
  {
    "id": "q09",
    "chapter": "共同完成",
    "text": "準備大型活動時，哪個角色最讓你有投入感？",
    "options": [
      {
        "text": "把流程、名單和細節整理得清清楚楚",
        "role": "matthew"
      },
      {
        "text": "檢查舊安排哪裡不公平或不方便，試著改進",
        "role": "simonZ"
      },
      {
        "text": "確認重要資訊無誤，幫大家找出盲點",
        "role": "thomas"
      },
      {
        "text": "連結合適的人，讓各自的專長派上用場",
        "role": "andrew"
      }
    ]
  },
  {
    "id": "q10",
    "chapter": "共同完成",
    "text": "夥伴邀你一起做一件有意義的事，你最想先知道？",
    "options": [
      {
        "text": "這件事對我們和參與的人，有什麼深層意義",
        "role": "john"
      },
      {
        "text": "大家能否誠實相待，有不同意見也能說",
        "role": "nathanael"
      },
      {
        "text": "我需要預備什麼，才能在需要時幫得上忙",
        "role": "matthias"
      },
      {
        "text": "第一步可以怎麼開始，先一起試試看",
        "role": "peter"
      }
    ]
  },
  {
    "id": "q11",
    "chapter": "共同完成",
    "text": "團隊中有位夥伴似乎跟不上，你會先？",
    "options": [
      {
        "text": "幫他找到能一起合作、互相支持的人",
        "role": "andrew"
      },
      {
        "text": "留一點時間聽他說，了解他真正卡住的地方",
        "role": "john"
      },
      {
        "text": "把眼前任務拆小，找一個他做得到的起點",
        "role": "philip"
      },
      {
        "text": "陪他訂一個具體目標，鼓勵他一起完成",
        "role": "james"
      }
    ]
  },
  {
    "id": "q12",
    "chapter": "共同完成",
    "text": "你最希望夥伴如何形容你在團隊中的貢獻？",
    "options": [
      {
        "text": "願意理解人，也能說出大家忽略的感受",
        "role": "john"
      },
      {
        "text": "讓資訊與事情變得有條理、容易接手",
        "role": "matthew"
      },
      {
        "text": "需要開始或做決定時，願意站出來承擔",
        "role": "peter"
      },
      {
        "text": "答應的事會持續做完，讓人可以放心",
        "role": "jamesA"
      }
    ]
  },
  {
    "id": "q13",
    "chapter": "遇上風雨",
    "text": "一個重要任務受挫，你下一步比較可能是？",
    "options": [
      {
        "text": "重新振作，持續向原本的目標努力",
        "role": "james"
      },
      {
        "text": "先照常完成手上的責任，維持穩定節奏",
        "role": "jamesA"
      },
      {
        "text": "試另一個小做法，邊行動邊修正",
        "role": "peter"
      },
      {
        "text": "查清楚失敗的原因，看看哪個假設不成立",
        "role": "thomas"
      }
    ]
  },
  {
    "id": "q14",
    "chapter": "遇上風雨",
    "text": "工作突然變多，你會怎麼安排自己？",
    "options": [
      {
        "text": "抓住最重要的目標，集中力氣完成",
        "role": "james"
      },
      {
        "text": "維持可持續的步調，一件一件做好",
        "role": "jamesA"
      },
      {
        "text": "列出清單，排出先後順序和時間",
        "role": "matthew"
      },
      {
        "text": "提前備妥材料與替補方案，預防臨時缺口",
        "role": "matthias"
      }
    ]
  },
  {
    "id": "q15",
    "chapter": "遇上風雨",
    "text": "活動中有人臨時無法出席，你會先注意？",
    "options": [
      {
        "text": "把原本必須有人做的事接起來，維持運作",
        "role": "jamesA"
      },
      {
        "text": "看看誰因此更辛苦，先照顧他的需要",
        "role": "thaddaeus"
      },
      {
        "text": "算一算現有資源，調整成做得到的規模",
        "role": "philip"
      },
      {
        "text": "重新整理分工和流程，讓大家知道如何配合",
        "role": "matthew"
      }
    ]
  },
  {
    "id": "q16",
    "chapter": "遇上風雨",
    "text": "有人正在經歷一段低潮，你比較自然的陪伴是？",
    "options": [
      {
        "text": "定期出現，做一些穩定的小事陪他度過",
        "role": "jamesA"
      },
      {
        "text": "幫他連結可以支持他的朋友或資源",
        "role": "andrew"
      },
      {
        "text": "留意造成困難的環境，陪他推動可行的改變",
        "role": "simonZ"
      },
      {
        "text": "聽他慢慢說，陪他整理內心複雜的感受",
        "role": "john"
      }
    ]
  },
  {
    "id": "q17",
    "chapter": "在意的事",
    "text": "看到一個長期存在的問題，你通常最想？",
    "options": [
      {
        "text": "找出需要改變的規則，開始推動改善",
        "role": "simonZ"
      },
      {
        "text": "弄清楚成本與限制，先試一個可行的方法",
        "role": "philip"
      },
      {
        "text": "持續投入，不因遇到阻力就輕易放棄",
        "role": "james"
      },
      {
        "text": "誠實指出問題，不用漂亮話把它蓋過去",
        "role": "nathanael"
      }
    ]
  },
  {
    "id": "q18",
    "chapter": "在意的事",
    "text": "你看見有人被排除在活動之外，會怎麼做？",
    "options": [
      {
        "text": "想辦法調整安排，讓參與方式更公平",
        "role": "simonZ"
      },
      {
        "text": "先走過去邀請他加入，打破眼前的僵局",
        "role": "peter"
      },
      {
        "text": "承擔一項有難度的工作，把改善真正做完",
        "role": "james"
      },
      {
        "text": "先詢問他的感受和需要，陪他找到支持",
        "role": "thaddaeus"
      }
    ]
  },
  {
    "id": "q19",
    "chapter": "在意的事",
    "text": "下個月可能有新的服務機會，你會如何預備？",
    "options": [
      {
        "text": "先練習需要的能力，等機會出現就能補位",
        "role": "matthias"
      },
      {
        "text": "研究可能的需求，安排好資源和實際步驟",
        "role": "philip"
      },
      {
        "text": "查清楚事情的來龍去脈，確認值得投入",
        "role": "thomas"
      },
      {
        "text": "先找一個小行動開始，從實作中學習",
        "role": "peter"
      }
    ]
  },
  {
    "id": "q20",
    "chapter": "在意的事",
    "text": "完成一次合作後，你最想保留下來的是？",
    "options": [
      {
        "text": "彼此能坦誠說話，也容得下不同聲音",
        "role": "nathanael"
      },
      {
        "text": "清楚的紀錄和方法，讓下次做得更順",
        "role": "matthew"
      },
      {
        "text": "這次累積的準備，未來需要時能派上用場",
        "role": "matthias"
      },
      {
        "text": "真正改善了什麼，讓後來的人更容易參與",
        "role": "simonZ"
      }
    ]
  },
  {
    "id": "q21",
    "chapter": "走向日常",
    "text": "你發現自己犯了錯，最想先做哪一步？",
    "options": [
      {
        "text": "真實承認自己的部分，不急著找藉口",
        "role": "nathanael"
      },
      {
        "text": "把事實釐清，弄懂自己是哪裡判斷錯了",
        "role": "thomas"
      },
      {
        "text": "把已承諾的責任做好，逐步重建信任",
        "role": "jamesA"
      },
      {
        "text": "關心受到影響的人，聽他現在需要什麼",
        "role": "thaddaeus"
      }
    ]
  },
  {
    "id": "q22",
    "chapter": "走向日常",
    "text": "如果一週只能多留一段時間幫忙，你比較想？",
    "options": [
      {
        "text": "陪一位有需要的人，好好關心他的近況",
        "role": "thaddaeus"
      },
      {
        "text": "準備教材或練習技能，讓下次可以幫上忙",
        "role": "matthias"
      },
      {
        "text": "改善一個大家反覆遇到的不方便",
        "role": "simonZ"
      },
      {
        "text": "把一件有挑戰的任務往前推進一大步",
        "role": "james"
      }
    ]
  },
  {
    "id": "q23",
    "chapter": "走向日常",
    "text": "朋友問你：「最近想練習什麼？」你比較認同？",
    "options": [
      {
        "text": "更敏銳地看見別人的需要，適時伸手",
        "role": "thaddaeus"
      },
      {
        "text": "多認識不同的人，讓彼此有機會連結",
        "role": "andrew"
      },
      {
        "text": "更耐心地理解自己和別人的內心",
        "role": "john"
      },
      {
        "text": "培養需要的能力，準備好接受新的託付",
        "role": "matthias"
      }
    ]
  },
  {
    "id": "q24",
    "chapter": "走向日常",
    "text": "想像下一次一起出發，你最想帶給同行的人什麼？",
    "options": [
      {
        "text": "願意先踏出一步的勇氣，讓大家有個開始",
        "role": "peter"
      },
      {
        "text": "發現不合適的地方就一起改變的行動力",
        "role": "simonZ"
      },
      {
        "text": "能安心分享心裡話、被理解的關係",
        "role": "john"
      },
      {
        "text": "把想法變成可行步驟、照顧現實需要的方法",
        "role": "philip"
      }
    ]
  }
];
