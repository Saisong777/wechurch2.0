import {useLayoutEffect,useState} from 'react';
import {createMemoryRouter,RouterProvider} from 'react-router-dom';
import {CastleWindow} from '@/components/home/CastleWindow';
// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {PageScrollContext,usePageScroll} from './PageScrollContext';
function Reader(){const scroll=usePageScroll();return <button onClick={()=>scroll.to(0)}>回章節頂端</button>;}
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('keeps normal page scrolling and routes window scrolling only to the provided viewport',()=>{const native=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});const view=render(<Reader/>);fireEvent.click(screen.getByRole('button'));expect(native).toHaveBeenCalledWith({top:0,behavior:'instant'});native.mockClear();const own=vi.fn();view.rerender(<PageScrollContext.Provider value={{to:own,y:()=>12,listen:()=>()=>{}}}><Reader/></PageScrollContext.Provider>);fireEvent.click(screen.getByRole('button'));expect(own).toHaveBeenCalledWith(0);expect(native).not.toHaveBeenCalled();});

it('attaches a child layout subscription on first window mount, unsubscribes, and remounts without stale listeners',()=>{
 const samples:number[]=[],adapters=new Set<unknown>();
 function Child({enabled}:{enabled:boolean}){const scroll=usePageScroll();adapters.add(scroll);useLayoutEffect(()=>{if(enabled)return scroll.listen(()=>samples.push(scroll.y()));},[scroll,enabled]);return null;}
 function Window(){const[enabled,setEnabled]=useState(true);return <CastleWindow origin={{pathname:'/',search:'?mode=castle',hash:'',key:'home',state:null}}><button onClick={()=>setEnabled(value=>!value)}>切換訂閱</button><Child enabled={enabled}/></CastleWindow>;}
 const mount=()=>render(<RouterProvider router={createMemoryRouter([{path:'*',element:<Window/>}],{initialEntries:['/learn/bible']})}/>);
 const first=mount(),viewport=screen.getByTestId('castle-window-scroll');viewport.scrollTop=123;fireEvent.scroll(viewport);expect(samples).toEqual([123]);
 fireEvent.click(screen.getByRole('button',{name:'切換訂閱'}));viewport.scrollTop=222;fireEvent.scroll(viewport);expect(samples).toEqual([123]);
 fireEvent.click(screen.getByRole('button',{name:'切換訂閱'}));viewport.scrollTop=333;fireEvent.scroll(viewport);expect(samples).toEqual([123,333]);expect(adapters.size).toBe(1);
 first.unmount();viewport.scrollTop=444;fireEvent.scroll(viewport);expect(samples).toEqual([123,333]);
 const second=mount(),replacement=screen.getByTestId('castle-window-scroll');replacement.scrollTop=555;fireEvent.scroll(replacement);expect(samples).toEqual([123,333,555]);second.unmount();replacement.scrollTop=666;fireEvent.scroll(replacement);expect(samples).toEqual([123,333,555]);
});
