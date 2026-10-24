import {Suspense,useLayoutEffect,useMemo,useRef,useState,type ComponentType} from 'react';
import {Routes,Route,useLocation,useNavigationType} from 'react-router-dom';
import {AppRoutes} from '@/AppRoutes';
import {AppLayout} from '@/components/layout/AppLayout';
import {PageAccessBoundary} from '@/components/auth/PageAccessBoundary';
import {PageLoader} from '@/components/PageLoader';
import {useHomeMode} from '@/hooks/useHomeMode';
import {CastleWindowContext} from '@/contexts/CastleWindowContext';
import {castleOrigin,CastleWindowRegistry,resolveCastleWindow,type CastleOrigin} from '@/lib/castleWindows';
import {CastleWindow} from './CastleWindow';
export function CastleRouteSurface({Content=AppRoutes}:{Content?:ComponentType}){
 const location=useLocation(),action=useNavigationType(),{mode}=useHomeMode();
 const [registry]=useState(()=>{try{return new CastleWindowRegistry(window.sessionStorage);}catch{return new CastleWindowRegistry();}});
 const previous=useRef<CastleOrigin|null>(null),backgroundNode=useRef<HTMLDivElement>(null);
 const origin=useMemo(()=>resolveCastleWindow(location,action,registry,previous.current),[location,action,registry]);
 const home=useMemo(()=>location.pathname==='/'&&mode==='castle'?castleOrigin(location):null,[location,mode]);
 const windowActive=!!origin;
 useLayoutEffect(()=>{if(origin)registry.commit(location.key,origin);else if((location.state as {castleWindowExit?:boolean}|null)?.castleWindowExit)registry.commit(location.key,null);previous.current=origin||home;},[location,registry,origin,home]);
 useLayoutEffect(()=>{const node=backgroundNode.current;if(node){node.inert=windowActive;node.toggleAttribute('inert',windowActive);}return()=>{if(node){node.inert=false;node.removeAttribute('inert');}};},[windowActive]);
 const background=origin||location;
 return <CastleWindowContext.Provider value={!!origin}>
   <div className="castle-background-route" ref={backgroundNode} aria-hidden={origin?true:undefined}>
    <Routes location={background}><Route path="*" element={<PageAccessBoundary><AppLayout><Suspense fallback={<PageLoader/>}><Content/></Suspense></AppLayout></PageAccessBoundary>}/></Routes>
   </div>
   {origin&&<CastleWindow origin={origin}><PageAccessBoundary><AppLayout surface="castle-window"><Suspense fallback={<PageLoader/>}><Content/></Suspense></AppLayout></PageAccessBoundary></CastleWindow>}
 </CastleWindowContext.Provider>;
}
