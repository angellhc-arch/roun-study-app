// NODE_PATH=<Playwright install>/node_modules PLAYWRIGHT_BROWSERS_PATH=<browser cache>
// node tests/reading-flow-webkit.cjs (local app server on port 8765)
const {webkit}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await webkit.launch();
 try {
 for (const width of [390,768]) {
 const context=await browser.newContext({viewport:{width,height:1024},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>new URL(r.request().url()).hostname==='127.0.0.1'?r.continue():r.abort());
 await page.goto(new URL('/roun_study_app.html', process.env.TEST_BASE_URL || 'http://127.0.0.1:8765').href);
 await page.evaluate(()=>{
  queueV2Sync=()=>{};
  localStorage.setItem(PLAN_V2_STORE_KEY,JSON.stringify({
   '2026-09-10':{items:[{id:'read-a',title:'과학 독서',categoryKey:'study',plannedCount:1,completedCount:0,unitMinutes:30},{id:'read-b',title:'동화책',categoryKey:'reading',plannedCount:1,completedCount:0,unitMinutes:30}],updatedAt:'2026-09-09T00:00:00Z',planUpdatedAt:'2026-09-09T00:00:00Z'},
   '2026-09-11':{items:[],readingRecords:{old:{title:'이전 독서',text:'기존 기록은 보존돼요.',createdAt:'2026-09-11T00:00:00Z',updatedAt:'2026-09-11T00:00:00Z'}},updatedAt:'2026-09-11T00:00:00Z'}
  }));
  document.getElementById('v2-view-date').value='2026-09-10';
  showScreen('home');
 });
 const readingItem=()=>page.locator('.v2-item').filter({hasText:'과학 독서'});
 await readingItem().locator('.v2-check-label').tap();
 assert(await page.locator('#reading-dialog').isVisible());
 assert.equal(await readingItem().locator('input[type=checkbox]').isChecked(),false);
 assert.match(await page.locator('#reading-dialog').innerText(),/처음 27분/);
 assert.match(await page.locator('#reading-dialog').innerText(),/② 오늘은 주인공/);
 if(width===768) await page.screenshot({path:'/private/tmp/reading-ipad.png'});
 await page.locator('#reading-save').tap();
 assert.equal(await page.locator('#reading-error').innerText(),'로운이의 생각을 짧게 적어줘 😊');
 await page.getByRole('button',{name:'취소',exact:true}).tap();
 assert.equal(await page.evaluate(()=>loadV2PlanState()['2026-09-10'].items[0].completedCount),0);
 await readingItem().locator('.v2-check-label').tap();
 await page.getByRole('button',{name:'독서록 닫기'}).tap();
 assert.equal(await readingItem().locator('input[type=checkbox]').isChecked(),false);
 await readingItem().locator('.v2-check-label').tap();
 await page.locator('#reading-text').fill('오늘은 별이 기억에 남았다.\n왜냐하면 반짝여서 신기했기 때문이다.');
 await page.evaluate(()=>{
  window.originalStorageSet=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(key===PLAN_V2_STORE_KEY)throw new DOMException('Full','QuotaExceededError');return window.originalStorageSet.call(this,key,value);};
 });
 await page.locator('#reading-save').tap();
 assert.match(await page.locator('#reading-error').innerText(),/저장하지 못했어요/);
 assert.match(await page.locator('#reading-text').inputValue(),/별이 기억/);
 assert.equal(await page.evaluate(()=>loadV2PlanState()['2026-09-10'].items[0].completedCount),0);
 await page.evaluate(()=>Storage.prototype.setItem=window.originalStorageSet);
 await page.locator('#reading-save').tap();
 assert.equal(await page.locator('#reading-dialog').isVisible(),false);
 assert.equal(await readingItem().locator('input[type=checkbox]').isChecked(),true);
 await page.evaluate(()=>showScreen('history'));
 await page.locator('#hf-reading').tap();
 assert.equal(await page.locator('.reading-day').count(),2);
 assert.equal(await page.locator('.reading-day h3').first().innerText(),'2026-09-11');
 await page.locator('#reading-history-date').fill('2026-09-10');
 assert.equal(await page.locator('.reading-record').count(),1);
 assert.match(await page.locator('.reading-record').innerText(),/반짝여서 신기/);
 await page.locator('.reading-record').tap();
 assert.match(await page.locator('#reading-text').inputValue(),/별이 기억/);
 await page.locator('#reading-text').fill('수정한 생각 <책>\n책을 또 읽고 싶다.');
 await page.locator('#reading-save').tap();
 assert.match(await page.locator('.reading-record').innerText(),/<책>/);
 assert.equal(await page.locator('.reading-record').count(),1);
 await page.evaluate(()=>{showScreen('home');document.getElementById('v2-view-date').value='2026-09-10';renderV2Home();});
 await readingItem().getByRole('button',{name:'📖 독서록 보기 · 수정'}).tap();
 assert.equal(await page.locator('#reading-text').inputValue(),'수정한 생각 <책>\n책을 또 읽고 싶다.');
 await page.locator('#reading-text').fill('학습목록에서 다시 수정한 생각');
 await page.locator('#reading-save').tap();
 await page.reload();
 await page.evaluate(()=>{queueV2Sync=()=>{};showScreen('history');setHistFilter('reading');});
 assert.match(await page.locator('#hist-list').innerText(),/학습목록에서 다시 수정한 생각/);
 assert.match(await page.locator('#hist-list').innerText(),/기존 기록은 보존/);
 await page.locator('#reading-history-date').fill('2026-09-09');
 assert.equal(await page.locator('.reading-empty').innerText(),'아직 독서록이 없어요. 책을 읽고 첫 생각을 남겨보자! 📚');
 await page.evaluate(()=>{showScreen('home');document.getElementById('v2-view-date').value='2026-09-10';openV2PlanDialog();});
 await page.locator('#v2-category').selectOption('nap');
 assert.equal(await page.locator('#v2-minutes').inputValue(),'30');
 await page.locator('#v2-title').fill('');
 await page.getByRole('button',{name:'+ 계획 추가하기',exact:true}).tap();
 let nap=()=>page.locator('.v2-item').filter({hasText:'낮잠'});
 assert.match(await nap().innerText(),/30분/);
 const responses=['낮잠 휴식','2','35'];
 const promptHandler=dialog=>dialog.accept(responses.shift());
 page.on('dialog',promptHandler);
 await nap().getByRole('button',{name:'이름/횟수/시간 수정'}).tap();
 page.off('dialog',promptHandler);
 assert.match(await nap().innerText(),/35분 · 계획 2회/);
 await nap().locator('input[type=checkbox]').first().check();
 assert.equal(await page.locator('#reading-dialog').isVisible(),false);
 assert.equal(await nap().locator('input[type=checkbox]').first().isChecked(),true);
 await nap().locator('input[type=checkbox]').first().uncheck();
 assert.equal(await nap().locator('input[type=checkbox]').first().isChecked(),false);
 await nap().getByRole('button',{name:'항목 삭제',exact:true}).tap();
 assert.equal(await nap().count(),0);
 // Deleting a reading plan preserves its note in history.
 await readingItem().getByRole('button',{name:'항목 삭제',exact:true}).tap();
 await page.getByRole('button',{name:'완료 · 홈으로',exact:true}).tap();
 await page.evaluate(()=>{document.getElementById('reading-history-date').value='';showScreen('history');setHistFilter('reading');});
 assert.match(await page.locator('#hist-list').innerText(),/학습목록에서 다시 수정한 생각/);
 assert.deepEqual(errors,[]);
 console.log(`PASS WebKit ${width}: reading cancel/empty/failure/retry/complete/edit/history/date/reload/archive; nap add/edit/complete/undo/delete`);
 await context.close();
 }
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
