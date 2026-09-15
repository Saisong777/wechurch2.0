import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

async function verify(page,runId) {
  const origin='https://wechurch-staging-staging.up.railway.app';
  if(!page.url().startsWith(origin+'/'))throw new Error('B browser session required');
  const deployment=await page.request.get(origin+'/api/deployment');
  if(!(await deployment.json()).staging)throw new Error('B only');
  const mutationId=await page.evaluate(()=>crypto.randomUUID());
  const created=await page.request.post(origin+'/api/devotional-notes',{data:{verseReference:`B 草稿驗收 ${Date.now()}`,verseText:'合成測試內容',observation:'Original',clientMutationId:mutationId}});
  if(created.status()!==201)throw new Error('Synthetic note creation failed');
  const note=await created.json();
  const accept=dialog=>dialog.accept();
  page.on('dialog',accept);
  const slow=async route=>{if(route.request().method()==='GET')await page.waitForTimeout(800);await route.continue();};
  await page.route('**/api/devotional-notes/**',slow);
  let evidence;
  try {
    await page.setViewportSize({width:390,height:844});
    await page.goto(origin+'/learn/my-notes');
    async function edit() {
      await page.getByTestId('tab-devotional').click();
      await page.getByTestId(`card-devotional-note-${note.id}`).click();
      await page.getByTestId(`button-edit-note-${note.id}`).click();
      await page.getByRole('textbox',{name:'看見',exact:true}).waitFor();
    }
    await edit();
    await page.getByRole('textbox',{name:'看見',exact:true}).fill('Device draft');
    await page.getByText('草稿已保留在此裝置，尚未同步',{exact:true}).waitFor();
    await page.reload();
    await edit();
    await page.locator('summary').filter({hasText:'前次草稿'}).click();
    await page.getByRole('button',{name:'恢復草稿',exact:true}).click();
    if(await page.getByRole('textbox',{name:'看見',exact:true}).inputValue()!=='Device draft')throw new Error('Reload lost draft');
    const changed=await page.request.patch(origin+`/api/devotional-notes/${note.id}`,{data:{version:note.version,observation:'Other device'}});
    if(changed.status()!==200)throw new Error('Concurrent fixture update failed');
    await page.getByTestId('button-save-devotional-note').click();
    await page.getByRole('button',{name:'查看雲端版本',exact:true}).waitFor();
    if((await (await page.request.get(origin+`/api/devotional-notes/${note.id}`)).json()).observation!=='Other device')throw new Error('Conflict overwrote cloud');
    await page.getByRole('button',{name:'查看雲端版本',exact:true}).click();
    await page.getByText('Other device',{exact:true}).waitFor();
    await page.getByRole('textbox',{name:'看見',exact:true}).fill('Other device + Device draft');
    await page.getByRole('button',{name:'已合併，保留目前輸入',exact:true}).click();
    await page.getByTestId('button-save-devotional-note').click();
    await page.getByTestId('devotional-note-sheet').waitFor({state:'hidden'});
    const final=await (await page.request.get(origin+`/api/devotional-notes/${note.id}`)).json();
    if(final.version!==3 || final.observation!=='Other device + Device draft')throw new Error('Manual merge did not persist');
    if((await page.getByTestId(`text-filled-count-${note.id}`).textContent()).trim()!=='1/3')throw new Error('Empty insight counted as completed');
    evidence={runId,at:new Date().toISOString(),origin,mobileWidth:390,syntheticNote:true,slowReadMs:800,reloadRecovery:true,conflictProtected:true,manualMergeSaved:true,emptyInsightExcluded:true};
  } finally {
    await page.unroute('**/api/devotional-notes/**',slow);
    page.off('dialog',accept);
    // Hide only the fixture created above; never remove existing user notes.
    const cleanup=await page.request.patch(origin+`/api/devotional-notes/${note.id}/hidden`,{data:{hidden:true}});
    if(cleanup.status()!==200)throw new Error('Fixture cleanup failed');
  }
  await page.evaluate(value=>{window.__wechurchDraftEvidence=value;},evidence);
  return evidence;
}
const cli=`${process.env.HOME}/.codex/skills/playwright/scripts/playwright_cli.sh`;
const session=`-s=${process.env.PLAYWRIGHT_SESSION||'church-review'}`,runId=String(Date.now());
let output=execFileSync(cli,[session,'run-code',`async page => (${verify.toString()})(page,${JSON.stringify(runId)})`],{encoding:'utf8',timeout:180000,maxBuffer:2*1024*1024});
let result=output.split('### Result\n')[1]?.split('\n###')[0];
// The CLI yields on native dialogs even when our handler accepts them. Read the
// completed run's evidence rather than mistaking that early yield for success.
for(let attempt=0;!result && attempt<30;attempt++){
  await new Promise(resolve=>setTimeout(resolve,1500));
  output=execFileSync(cli,[session,'run-code',`async page => page.evaluate(id=>window.__wechurchDraftEvidence?.runId===id ? window.__wechurchDraftEvidence : null,${JSON.stringify(runId)})`],{encoding:'utf8',timeout:30000,maxBuffer:2*1024*1024});
  const candidate=output.split('### Result\n')[1]?.split('\n###')[0];
  if(candidate && JSON.parse(candidate)?.runId===runId)result=candidate;
}
if(!result)throw new Error(output.slice(-2000));
fs.mkdirSync('output/playwright',{recursive:true});
fs.writeFileSync('output/playwright/draft-results.json',result+'\n');
console.log(result);
