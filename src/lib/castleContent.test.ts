import {expect,it} from 'vitest';
import {castleContentMetadata} from './castleContent';
import {castleContentPath} from './castleWindows';
it.each([
 ['/learn/church-reading','','同行主堡','每日靈修'],['/learn/bible','','話語之塔','聖經'],['/share','','禱告花園','禱告'],['/groups','','小家聚落','我的小家'],['/grace-record','?view=grace','恩典書庫','恩典記錄簿'],['/walls','','同行廣場','分享牆'],['/play','','相聚小亭','小遊戲與互動'],
 ['/grace-record','?view=prayer','禱告花園','個人禱告'],['/groups/team','?view=reading','小家聚落','小家同行'],['/learn/reading-plans/plan/read','','話語之塔','每日讀經'],['/login','?returnTo=%2Fgroups','歡迎回來','登入城堡'],['/learn/my-notes','','話語之塔','我的筆記'],
])('names real destination %s without exposing route/query data',(path,search,place,activity)=>{expect(castleContentPath(path)).toBe(true);expect(castleContentMetadata(path,search)).toMatchObject({place,activity});});
it('names every current finite supported content route and never grants route access',()=>{
 const paths=['/learn','/bible','/learn/reading-plans','/learn/jesus-timeline','/jesus-timeline','/devotion-wall','/prayer-wall','/icebreaker','/grouper','/play/bible-quiz','/play/disciple-quiz','/card','/cards','/prayer-meeting','/care','/me','/me/activity','/me/sharing','/me/love-journey','/me/mentoring','/notifications','/sitemap','/help','/feedback','/notebook','/user/notebook'];
 for(const path of paths){expect(castleContentPath(path)).toBe(true);expect(castleContentMetadata(path).activity).not.toBe('教會日常');}
 expect(castleContentPath('/admin')).toBe(false);expect(castleContentPath('/reset-password')).toBe(false);expect(castleContentMetadata('/unknown','?token=private').activity).toBe('教會日常');
});

it('uses the castle mailbox title and envelope without changing route admission',()=>{expect(castleContentPath('/feedback')).toBe(true);expect(castleContentMetadata('/feedback')).toEqual({place:'城堡信箱',activity:'意見與建議',emblem:'mail'});});
