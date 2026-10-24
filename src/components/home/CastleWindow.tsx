import {useLayoutEffect,useMemo,useRef,type ReactNode} from 'react';
import {useLocation,useNavigate,useNavigationType} from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import {X,ArrowUpRight} from 'lucide-react';
import {castleOriginHref,type CastleOrigin} from '@/lib/castleWindows';
import {PageScrollContext} from '@/contexts/PageScrollContext';
import './castle-windows.css';
export function CastleWindow({origin,children}:{origin:CastleOrigin;children:ReactNode}){
 const navigate=useNavigate(),location=useLocation(),action=useNavigationType();
 const title=useRef<HTMLHeadingElement>(null),viewport=useRef<HTMLDivElement>(null),trigger=useRef<HTMLElement|null>(document.activeElement instanceof HTMLElement?document.activeElement:null);
 const positions=useRef(new Map<string,number>());
 const scroll=useMemo(()=>({to:(top:number)=>{const node=viewport.current;if(node){if(node.scrollTo)node.scrollTo({top,behavior:'instant'});else node.scrollTop=top;}},y:()=>viewport.current?.scrollTop||0,listen:(listener:()=>void)=>{const node=viewport.current;node?.addEventListener('scroll',listener,{passive:true});return()=>node?.removeEventListener('scroll',listener);}}),[]);
 useLayoutEffect(()=>{const node=viewport.current,savedPositions=positions.current;if(!node)return;node.scrollTop=action==='POP'?savedPositions.get(location.key)||0:0;return()=>{savedPositions.set(location.key,node.scrollTop);if(savedPositions.size>50)savedPositions.delete(savedPositions.keys().next().value!);};},[location.key,action]);
 const close=()=>void navigate(castleOriginHref(origin));
 return <Dialog.Root open modal onOpenChange={open=>{if(!open)close();}}><Dialog.Portal>
  <Dialog.Overlay className="castle-window-backdrop"/>
  <Dialog.Content className="castle-feature-window" aria-describedby={undefined} onOpenAutoFocus={event=>{event.preventDefault();title.current?.focus();}} onCloseAutoFocus={event=>{event.preventDefault();const previous=trigger.current;requestAnimationFrame(()=>{if(previous?.isConnected&&previous!==document.body&&previous!==document.documentElement&&!previous.closest('[hidden],[inert]'))previous.focus({preventScroll:true});else document.querySelector<HTMLButtonElement>('[data-castle-explore]')?.focus({preventScroll:true});});}} onPointerDownOutside={event=>event.preventDefault()}>
   <header className="castle-window-header"><Dialog.Title ref={title} tabIndex={-1}>城堡內容</Dialog.Title><div><button type="button" onClick={()=>void navigate(location.pathname+location.search+location.hash,{state:{castleWindowExit:true}})}><ArrowUpRight size={16} aria-hidden="true"/><span>完整頁面</span></button><button type="button" aria-label="關閉內容，返回城堡" onClick={close}><X size={20} aria-hidden="true"/><span>返回城堡</span></button></div></header>
   <div ref={viewport} className="castle-window-scroll" data-testid="castle-window-scroll"><PageScrollContext.Provider value={scroll}>{children}</PageScrollContext.Provider></div>
  </Dialog.Content>
 </Dialog.Portal></Dialog.Root>;
}
