// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {PageScrollContext,usePageScroll} from './PageScrollContext';
function Reader(){const scroll=usePageScroll();return <button onClick={()=>scroll.to(0)}>回章節頂端</button>;}
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('keeps normal page scrolling and routes window scrolling only to the provided viewport',()=>{const native=vi.spyOn(window,'scrollTo').mockImplementation(()=>{});const view=render(<Reader/>);fireEvent.click(screen.getByRole('button'));expect(native).toHaveBeenCalledWith({top:0,behavior:'instant'});native.mockClear();const own=vi.fn();view.rerender(<PageScrollContext.Provider value={{to:own,y:()=>12,listen:()=>()=>{}}}><Reader/></PageScrollContext.Provider>);fireEvent.click(screen.getByRole('button'));expect(own).toHaveBeenCalledWith(0);expect(native).not.toHaveBeenCalled();});
