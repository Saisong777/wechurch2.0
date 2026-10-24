export type CastleContentEmblem='castle'|'book'|'heart'|'users'|'journal'|'messages'|'tools'|'leaf';
export interface CastleContentMetadata { place:string; activity:string; emblem:CastleContentEmblem }
const entry=(place:string,activity:string,emblem:CastleContentEmblem):CastleContentMetadata=>({place,activity,emblem});
const metadata:Record<string,CastleContentMetadata>={
 '/learn':entry('話語之塔','讀經','book'),
 '/learn/church-reading':entry('同行主堡','每日靈修','castle'),
 '/learn/bible':entry('話語之塔','聖經','book'),'/bible':entry('話語之塔','聖經','book'),
 '/learn/my-notes':entry('話語之塔','我的筆記','journal'),
 '/learn/reading-plans':entry('話語之塔','讀經計畫','book'),
 '/learn/jesus-timeline':entry('話語之塔','耶穌四季','book'),'/jesus-timeline':entry('話語之塔','耶穌四季','book'),
 '/share':entry('禱告花園','禱告','heart'),
 '/groups':entry('小家聚落','我的小家','users'),
 '/walls':entry('同行廣場','分享牆','messages'),'/devotion-wall':entry('同行廣場','靈修分享','messages'),'/prayer-wall':entry('禱告花園','禱告分享','heart'),
 '/play':entry('相聚小亭','小遊戲與互動','tools'),'/icebreaker':entry('相聚小亭','破冰','tools'),'/grouper':entry('相聚小亭','分組','users'),
 '/play/bible-quiz':entry('相聚小亭','聖經問答','book'),'/play/disciple-quiz':entry('相聚小亭','十二門徒人格','book'),
 '/card':entry('相聚小亭','信息圖卡','journal'),'/cards':entry('相聚小亭','信息圖卡','journal'),
 '/prayer-meeting':entry('禱告花園','禱告會','heart'),'/care':entry('同行廣場','關懷清單','heart'),
 '/me':entry('我的日常','個人設定','leaf'),'/me/activity':entry('我的日常','待回應','leaf'),'/me/sharing':entry('我的日常','我的分享','journal'),
 '/me/love-journey':entry('我的日常','愛的旅程','heart'),'/me/mentoring':entry('我的日常','門訓陪伴','users'),
 '/notifications':entry('城堡信箱','通知','messages'),'/sitemap':entry('城堡指引','網站導覽','leaf'),
 '/help':entry('城堡指引','使用說明','book'),'/feedback':entry('城堡信箱','意見反饋','messages'),
 '/login':entry('歡迎回來','登入城堡','castle'),'/notebook':entry('話語之塔','筆記本','journal'),'/user/notebook':entry('話語之塔','筆記本','journal'),
};
// UI naming only: route admission, feature flags and authorization stay in their existing guards.
export function castleContentMetadata(pathname:string,search=''):CastleContentMetadata {
 if(pathname==='/grace-record')return new URLSearchParams(search).get('view')==='grace'?entry('恩典書庫','恩典記錄簿','journal'):entry('禱告花園','個人禱告','heart');
 if(/^\/groups\/[^/]+$/.test(pathname))return entry('小家聚落','小家同行','users');
 if(/^\/learn\/reading-plans\/[^/]+\/read$/.test(pathname))return entry('話語之塔','每日讀經','book');
 return metadata[pathname]||entry('城堡指引','教會日常','leaf');
}
