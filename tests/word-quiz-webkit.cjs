// Run with PLAYWRIGHT_BROWSERS_PATH and NODE_PATH pointing to Playwright's install.
// WebKit mobile emulation + synthetic visualViewport keyboard geometry, not real iOS.
const { webkit } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await webkit.launch();
  try {
    for (const [width, height] of [[320,568],[390,844],[430,932],[844,390]]) {
      const context = await browser.newContext({ viewport:{width,height}, isMobile:true, hasTouch:true, deviceScaleFactor:2, serviceWorkers:'block' });
      const page = await context.newPage();
      await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(new URL('/roun_study_app.html', process.env.TEST_BASE_URL || 'http://127.0.0.1:8765').href);
      for (const mode of ['preview','review','DAILY','WEEKLY']) {
        await page.evaluate(mode => {
          showScreen('word2');
          wordV2Session = {mode,practice:true,index:0,questions:[
            {questionType:'MEANING_TO_WORD',word:'favorite',meaningKo:'가장 좋아하는',correctAnswer:'favorite'},
            {questionType:'WORD_TO_MEANING',word:'favorite',meaningKo:'가장 좋아하는',correctAnswer:'가장 좋아하는',choices:['가장 좋아하는','작은','큰']},
            {questionType:'EXAMPLE',word:'favorite',example:'This is my ___ book.',meaningKo:'가장 좋아하는',correctAnswer:'favorite',choices:['favorite','small','large']}
          ]};
          showWordV2Quiz();
          window.quizScrollCalls = 0;
          Element.prototype.scrollIntoView = () => window.quizScrollCalls++;
        }, mode);
        await page.locator('#wv2-answer').fill('favorite');
        for (const offset of [0,48,0]) {
          await page.evaluate(({height,offset}) => {
            const vv = window.visualViewport;
            Object.defineProperty(vv,'height',{configurable:true,value:Math.max(230,height-340)});
            Object.defineProperty(vv,'offsetTop',{configurable:true,value:offset});
            vv.dispatchEvent(new Event('resize'));
            vv.dispatchEvent(new Event('scroll'));
          }, {height,offset});
          await page.waitForTimeout(160);
          const geometry = await page.evaluate(() => {
            const input = document.getElementById('wv2-answer').getBoundingClientRect();
            const submit = document.getElementById('wv2-submit-btn').getBoundingClientRect();
            const vv = window.visualViewport;
            return {inputTop:input.top,inputBottom:input.bottom,submitTop:submit.top,submitBottom:submit.bottom,top:vv.offsetTop,bottom:vv.offsetTop+vv.height,calls:quizScrollCalls,parent:document.getElementById('wv2-quiz').parentElement.className};
          });
          assert.equal(geometry.parent,'phone-shell');
          assert.equal(geometry.calls,0);
          assert(geometry.inputTop >= geometry.top, JSON.stringify(geometry));
          assert(geometry.inputBottom <= geometry.submitTop, JSON.stringify(geometry));
          assert(geometry.submitBottom <= geometry.bottom+1, JSON.stringify(geometry));
        }
        if (width===390 && mode==='DAILY') await page.screenshot({path:'/private/tmp/roun-webkit-keyboard.png'});
        await page.locator('#wv2-submit-btn').tap();
        assert.match(await page.locator('#wv2-feedback').innerText(), /정답!/);
        await page.evaluate(() => {
          delete visualViewport.height; delete visualViewport.offsetTop;
          visualViewport.dispatchEvent(new Event('resize'));
        });
        for (const answer of ['가장 좋아하는','favorite']) {
          await page.locator('#wv2-next-btn').tap();
          await page.locator('#wv2-choice-area button').filter({hasText:answer}).tap();
          await page.locator('#wv2-submit-btn').tap();
          assert.match(await page.locator('#wv2-feedback').innerText(), /정답!/);
        }
        await page.locator('#wv2-next-btn').tap();
        assert.match(await page.locator('#wv2-feedback').innerText(), /100점/);
        await page.locator('#wv2-next-btn').tap();
        assert.equal(await page.locator('#wv2-quiz').isVisible(),false);
      }
      assert.deepEqual(errors,[]);
      console.log(`PASS WebKit ${width}x${height}: 4 modes, typing, keyboard resize/pan, choices, completion/exit`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode=1; });
