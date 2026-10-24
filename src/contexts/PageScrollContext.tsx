import {createContext,useContext} from 'react';
export type PageScroll={to:(top:number)=>void;y:()=>number;listen:(listener:()=>void)=>()=>void};
const browserScroll:PageScroll={to:top=>window.scrollTo({top,behavior:'instant'}),y:()=>window.scrollY,listen:listener=>{window.addEventListener('scroll',listener,{passive:true});return()=>window.removeEventListener('scroll',listener);}};
export const PageScrollContext=createContext<PageScroll>(browserScroll);
export const usePageScroll=()=>useContext(PageScrollContext);
