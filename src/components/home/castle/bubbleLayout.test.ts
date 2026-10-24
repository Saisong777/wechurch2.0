import {describe,expect,it} from 'vitest';
import {placeHeadBubble} from './bubbleLayout';
describe('head bubble placement against actual HUD rectangles',()=>{
 it.each([[320,568],[390,844],[640,360],[641,360],[844,390],[1280,720]])('keeps a visible actor bubble inside %sx%s while preserving a pointer to the real head',(width,height)=>{
  const head={x:width*.53,y:height*.61},bounds={left:12,top:40,width:width-24,height:height-60};
  const obstacles=[{left:10,top:40,width:width<500?220:width-20,height:75},{left:width-60,top:140,width:50,height:200}];
  const p=placeHeadBubble(head,{width:width<500?232:260,height:154},bounds,obstacles);
  expect(p.left).toBeGreaterThanOrEqual(bounds.left);expect(p.top).toBeGreaterThanOrEqual(bounds.top);expect(p.left+p.width).toBeLessThanOrEqual(bounds.left+bounds.width);expect(p.top+p.height).toBeLessThanOrEqual(bounds.top+bounds.height);expect(p.tail[1]).toBe(head);expect(p.overlap).toBe(0);
 });
 it('uses a side/below slot when a real notice occupies the usual above-head location',()=>{
  const p=placeHeadBubble({x:350,y:210},{width:240,height:140},{left:12,top:40,width:616,height:300},[{left:10,top:40,width:310,height:170}]);expect(p.overlap).toBe(0);expect(p.left).toBeGreaterThanOrEqual(326);
 });
 it('does not cover a head near the top edge when the above candidate has to clamp',()=>{
  const head={x:350,y:60},p=placeHeadBubble(head,{width:240,height:140},{left:12,top:40,width:616,height:300},[]);expect(head.y<p.top||head.y>p.top+p.height||head.x<p.left||head.x>p.left+p.width).toBe(true);expect(p.tail[1]).toBe(head);
 });
 it('returns a clamped honest pointer rather than hiding a visible actor in a crowded short viewport',()=>{
  const head={x:155,y:160},p=placeHeadBubble(head,{width:232,height:150},{left:12,top:40,width:296,height:170},[{left:0,top:0,width:320,height:200}]);expect(p.top).toBeGreaterThanOrEqual(40);expect(p.top+p.height).toBeLessThanOrEqual(210);expect(p.tail[1]).toBe(head);expect(p.overlap).toBeGreaterThan(0);
 });
});
