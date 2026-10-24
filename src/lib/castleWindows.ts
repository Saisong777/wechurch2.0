import type {Location} from 'react-router-dom';
export type CastleOrigin={pathname:'/';search:string;hash:'';key:string;state:null};
export const CASTLE_WINDOWS_STORAGE='wechurch_castle_windows_v1';
const validKey=(key:unknown):key is string=>typeof key==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(key);
const contentPaths=new Set(['/learn','/learn/church-reading','/learn/bible','/bible','/learn/my-notes','/learn/reading-plans','/learn/jesus-timeline','/jesus-timeline','/share','/grace-record','/groups','/walls','/devotion-wall','/prayer-wall','/play','/icebreaker','/grouper','/play/bible-quiz','/play/disciple-quiz','/card','/cards','/prayer-meeting','/care','/me','/me/activity','/me/sharing','/me/love-journey','/me/mentoring','/notifications','/sitemap','/help','/feedback','/login','/notebook','/user/notebook']);
export function castleContentPath(path:string){return contentPaths.has(path)||/^\/groups\/[a-zA-Z0-9_-]{1,128}$/.test(path)||/^\/learn\/reading-plans\/[a-zA-Z0-9_-]{1,128}\/read$/.test(path);}
export function castleOrigin(location:Pick<Location,'key'|'pathname'|'search'>):CastleOrigin|null {
 if(location.pathname!=='/'||!validKey(location.key))return null;
 const current=new URLSearchParams(location.search),safe=new URLSearchParams({mode:'castle'});
 if(current.get('styleLab')==='1')safe.set('styleLab','1');const variant=current.get('dashboardVariant');if(variant&&['a','b','c','d'].includes(variant))safe.set('dashboardVariant',variant);
 return {pathname:'/',search:`?${safe}`,hash:'',key:location.key,state:null};
}
function readOrigin(value:unknown):CastleOrigin|null {if(!value||typeof value!=='object')return null;const origin=value as CastleOrigin;if(origin.pathname!=='/'||origin.hash!==''||origin.state!==null||typeof origin.search!=='string'||origin.search.length>128||new URLSearchParams(origin.search).get('mode')!=='castle')return null;const safe=castleOrigin(origin);return safe&&safe.search===origin.search?safe:null;}
type Store=Pick<Storage,'getItem'|'setItem'>;
export class CastleWindowRegistry {
 private entries=new Map<string,CastleOrigin>();
 constructor(private storage?:Store){try{const raw=storage?.getItem(CASTLE_WINDOWS_STORAGE);if(!raw||raw.length>32000)return;const parsed=JSON.parse(raw);if(parsed.v!==1||!Array.isArray(parsed.entries)||parsed.entries.length>50)return;for(const item of parsed.entries){const origin=readOrigin(item?.origin);if(validKey(item?.key)&&origin)this.entries.set(item.key,origin);}}catch{/* UI storage is optional. */}}
 get(key:string){return this.entries.get(key)||null;}
 commit(key:string,origin:CastleOrigin|null){if(!validKey(key))return;if(origin){this.entries.delete(key);this.entries.set(key,origin);while(this.entries.size>50)this.entries.delete(this.entries.keys().next().value!);}else this.entries.delete(key);try{this.storage?.setItem(CASTLE_WINDOWS_STORAGE,JSON.stringify({v:1,entries:[...this.entries].map(([key,origin])=>({key,origin}))}));}catch{/* Keep this tab's in-memory UI history. */}}
}
export function resolveCastleWindow(location:Location,action:string,registry:CastleWindowRegistry,previous:CastleOrigin|null){
 if((location.state as {castleWindowExit?:unknown}|null)?.castleWindowExit===true||!castleContentPath(location.pathname))return null;
 return registry.get(location.key)||(action!=='POP'?previous:null);
}
export const castleOriginHref=(origin:CastleOrigin)=>origin.pathname+origin.search;
