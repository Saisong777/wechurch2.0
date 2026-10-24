import {useCallback,useLayoutEffect,useMemo,useRef,type ReactNode} from 'react';
import {useLocation,useNavigate,useNavigationType} from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import {X,Castle,BookOpen,Heart,Users,BookHeart,MessageCircle,Compass,Leaf} from 'lucide-react';
import {castleContentMetadata} from '@/lib/castleContent';
import {CastleContentPresentationContext} from '@/contexts/CastleContentPresentationContext';
import {castleOriginHref,type CastleOrigin} from '@/lib/castleWindows';
import {PageScrollContext} from '@/contexts/PageScrollContext';
import './castle-windows.css';
export function CastleWindow({origin,children}:{origin:CastleOrigin;children:ReactNode}){
 const navigate=useNavigate(),location=useLocation(),action=useNavigationType();
 const title=useRef<HTMLHeadingElement>(null),viewport=useRef<HTMLDivElement|null>(null),trigger=useRef<HTMLElement|null>(document.activeElement instanceof HTMLElement?document.activeElement:null);
 const positions=useRef(new Map<string,number>());
 const listeners=useRef(new Set<()=>void>());
 // Children may subscribe in layout effects before this ancestor host ref attaches.
 const bindViewport=useCallback((node:HTMLDivElement|null)=>{
   if(viewport.current===node)return;
   for(const listener of listeners.current)viewport.current?.removeEventListener('scroll',listener);
   viewport.current=node;
   for(const listener of listeners.current)node?.addEventListener('scroll',listener,{passive:true});
 },[]);
 const scroll=useMemo(()=>({to:(top:number)=>{const node=viewport.current;if(node){if(node.scrollTo)node.scrollTo({top,behavior:'instant'});else node.scrollTop=top;}},y:()=>viewport.current?.scrollTop||0,listen:(listener:()=>void)=>{const subscription=()=>listener();listeners.current.add(subscription);viewport.current?.addEventListener('scroll',subscription,{passive:true});return()=>{listeners.current.delete(subscription);viewport.current?.removeEventListener('scroll',subscription);};}}),[]);
 useLayoutEffect(()=>{const node=viewport.current,savedPositions=positions.current;if(!node)return;node.scrollTop=action==='POP'?savedPositions.get(location.key)||0:0;return()=>{savedPositions.set(location.key,node.scrollTop);if(savedPositions.size>50)savedPositions.delete(savedPositions.keys().next().value!);};},[location.key,action]);
 const close=()=>void navigate(castleOriginHref(origin));
 const metadata=castleContentMetadata(location.pathname,location.search);
 const Emblem={castle:Castle,book:BookOpen,heart:Heart,users:Users,journal:BookHeart,messages:MessageCircle,tools:Compass,leaf:Leaf}[metadata.emblem];
 return <CastleContentPresentationContext.Provider value><Dialog.Root open modal onOpenChange={open=>{if(!open)close();}}><Dialog.Portal>
  <Dialog.Overlay className="castle-window-backdrop"/>
  <Dialog.Content className="castle-feature-window" aria-describedby={undefined} onOpenAutoFocus={event=>{event.preventDefault();title.current?.focus();}} onCloseAutoFocus={event=>{event.preventDefault();const previous=trigger.current;requestAnimationFrame(()=>{if(previous?.isConnected&&previous!==document.body&&previous!==document.documentElement&&!previous.closest('[hidden],[inert]'))previous.focus({preventScroll:true});else document.querySelector<HTMLButtonElement>('[data-castle-explore]')?.focus({preventScroll:true});});}} onPointerDownOutside={event=>event.preventDefault()}>
   <header className="castle-window-header"><span className="castle-window-emblem"><Emblem size={23} aria-hidden="true"/></span><div className="castle-window-heading"><p>{metadata.place}</p><Dialog.Title ref={title} tabIndex={-1}>{metadata.activity}</Dialog.Title></div><button type="button" aria-label="關閉內容，返回城堡" onClick={close}><X size={21} aria-hidden="true"/><span className="sr-only">收起</span></button></header>
   <div ref={bindViewport} className="castle-window-scroll" data-testid="castle-window-scroll"><PageScrollContext.Provider value={scroll}>{children}</PageScrollContext.Provider></div>
  </Dialog.Content>
 </Dialog.Portal></Dialog.Root></CastleContentPresentationContext.Provider>;
}
