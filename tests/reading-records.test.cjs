const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname,'../roun_study_app.html'),'utf8');
let stored = {'2026-09-10':{items:[{id:'read',title:'과학 독서',plannedCount:2,completedCount:0}],planUpdatedAt:'2026-09-09T00:00:00Z'},'2026-09-11':{items:[],readingRecords:{old:{text:'옛 기록',title:'옛 책'}}}};
let shouldFail = false;
let refreshes = 0;
const c = vm.createContext({
 loadV2PlanState:()=>JSON.parse(JSON.stringify(stored)),
 saveV2PlanState:state=>{if(shouldFail) throw new Error('QuotaExceededError'); stored=JSON.parse(JSON.stringify(state));},
 refreshV2RewardSnapshot:()=>refreshes++,
});
for(const name of ['sanitizeV2PlanState','touchV2Record','isV2ReadingItem','mergeV2ReadingRecords','getV2ReadingRecords','commitV2ReadingRecord']) {
 const start=html.indexOf('function '+name+'(');
 vm.runInContext(html.slice(start,html.indexOf('\n}',start)+2),c);
}
assert(c.isV2ReadingItem({title:'매일 독서하기'}));
assert(c.isV2ReadingItem({title:'과학책',categoryKey:'reading'}));
assert(!c.isV2ReadingItem({title:'낮잠',categoryKey:'nap'}));
assert(!c.isV2ReadingItem({title:'낮잠 = 독서 1회 인정',categoryKey:'reading'}));
const context={dateKey:'2026-09-10',itemId:'read',completeTo:1};
assert.throws(()=>c.commitV2ReadingRecord(context,' \n '),/생각을 짧게/);
assert.equal(stored['2026-09-10'].items[0].completedCount,0);
shouldFail=true;
assert.throws(()=>c.commitV2ReadingRecord(context,'저장 실패 시 유지'),/Quota/);
assert.equal(stored['2026-09-10'].items[0].completedCount,0);
assert.equal(stored['2026-09-10'].readingRecords,undefined);
shouldFail=false;
c.commitV2ReadingRecord(context,' 오늘은 우주가 신기했다.\n더 알고 싶다. ');
assert.equal(stored['2026-09-10'].items[0].completedCount,1);
assert.equal(stored['2026-09-10'].readingRecords.read.text,'오늘은 우주가 신기했다.\n더 알고 싶다.');
const created=stored['2026-09-10'].readingRecords.read.createdAt;
const before=refreshes;
c.commitV2ReadingRecord({...context,completeTo:null},'수정한 생각');
assert.equal(refreshes,before,'editing a note does not recalculate rewards');
assert.equal(stored['2026-09-10'].items[0].completedCount,1);
assert.equal(stored['2026-09-10'].readingRecords.read.createdAt,created);
assert.equal(Object.keys(stored['2026-09-10'].readingRecords).length,1);
assert.equal(stored['2026-09-10'].planUpdatedAt,'2026-09-09T00:00:00Z');
c.commitV2ReadingRecord({...context,completeTo:2},'두 번째 독서 생각');
assert.equal(stored['2026-09-10'].items[0].completedCount,2);
assert.equal(Object.keys(stored['2026-09-10'].readingRecords).length,1);
stored['2026-09-10'].items=[];
c.commitV2ReadingRecord({...context,completeTo:null},'삭제된 항목 기록도 보존');
assert.equal(c.getV2ReadingRecords()[1].dateKey,'2026-09-10');
assert.equal(c.getV2ReadingRecords()[1].text,'삭제된 항목 기록도 보존');
assert.throws(()=>c.commitV2ReadingRecord(context,'삭제된 학습 완료 불가'),/찾을 수/);
const local={read:{text:'최신',updatedAt:'2026-09-15T00:00:00Z'}};
assert.equal(c.mergeV2ReadingRecords(local,{}).read.text,'최신');
assert.equal(c.mergeV2ReadingRecords(local,{read:{text:'옛날',updatedAt:'2026-09-10T00:00:00Z'}}).read.text,'최신');
assert.equal(c.mergeV2ReadingRecords(local,{read:{text:'서버 최신',updatedAt:'2026-09-16T00:00:00Z'}}).read.text,'서버 최신');
console.log('PASS: reading detection, atomic failure, completion, single-record edits, study date, repeat counts, archived notes, cloud merge');

assert(c.sanitizeV2PlanState({'2026-09-10':{items:[],readingRecords:{a:{text:'보존할 독서록'}}}})['2026-09-10']);
