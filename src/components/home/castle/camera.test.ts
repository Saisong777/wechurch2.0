import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {castleProjection,isPortraitCastle} from './camera';
import {buildCastleWorld} from './world';
describe('portrait castle composition',()=>{
  it.each([[390,844],[320,568]])('uses vertical space at %d×%d, rather than fitting island width', (width,height)=>{
    const world=buildCastleWorld(),projection=castleProjection(width,height,{top:100,right:64,bottom:76});
    const camera=new THREE.PerspectiveCamera(projection.fov,width/height,.2,250);camera.position.set(35,32,43);camera.lookAt(0,.7,2);camera.setViewOffset(width,height,projection.offsetX,projection.offsetY,width,height);camera.updateMatrixWorld();world.group.updateMatrixWorld(true);
    let top=1,bottom=-1;world.group.traverse(object=>{if(!(object instanceof THREE.Mesh))return;const vertices=object.geometry.attributes.position;for(let i=0;i<vertices.count;i++){const point=new THREE.Vector3().fromBufferAttribute(vertices,i).applyMatrix4(object.matrixWorld);if(point.y < -3.4||Math.abs(point.x)>25||point.z < -20||point.z>23)continue;point.project(camera);top=Math.min(top,point.y);bottom=Math.max(bottom,point.y);}});
    const fraction=(bottom-top)/2;expect(fraction).toBeGreaterThanOrEqual(.55);expect(fraction).toBeLessThanOrEqual(.75);world.dispose();
  });
  it('does not pull back when the bottom sheet opens, while landscape and desktop keep their existing framing',()=>{
    const closed=castleProjection(390,844,{top:100,right:64,bottom:76}),open=castleProjection(390,844,{top:100,right:64,bottom:490});expect(open).toEqual(closed);
    expect(isPortraitCastle(640,640)).toBe(true);expect(isPortraitCastle(844,390)).toBe(false);expect(isPortraitCastle(1280,720)).toBe(false);
    const desktop=castleProjection(1280,720,{top:100,right:330,bottom:0});expect(desktop.offsetX).toBe(165);expect(desktop.offsetY).toBe(-50);expect(desktop.fov).toBeCloseTo(44.708,2);
  });
});
