import { expect, test, type Page, type CDPSession } from '@playwright/test';
import bank from '../../src/data/questions-main.json' with { type: 'json' };
const key='real-estate-agent-cbt:v1';
async function read(page:Page){return page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),key)}
async function nav(page:Page,label:string){
 const menu=page.getByRole('button',{name:'메뉴 열기'});if(await menu.isVisible())await menu.click();
 await page.getByRole('navigation').getByRole('button',{name:label,exact:true}).click();
}
async function submit(page:Page){await page.getByRole('button',{name:'시험 종료 및 제출'}).click();await page.getByRole('button',{name:'제출하고 결과 보기'}).click()}
test('대시보드·1000개·과목별 준비·학습 기준/상시 배너 없음·반응형',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('');
 await expect(page.getByRole('heading',{name:'공인중개사 필기 CBT',exact:true})).toBeVisible();
 await expect(page.locator('.bank-summary')).toContainText('등록 1000문항');
 await expect(page.locator('.bank-summary')).toContainText('960 / 40 family');
 await expect(page.getByLabel('학습 기준')).toHaveCount(0);await expect(page.locator('.criteria-note')).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 for(const paper of ['first','second-a','second-b']){await page.getByLabel('시험 교시').selectOption(paper);await expect(page.getByRole('button',{name:'모의시험 시작하기',exact:true})).toBeEnabled()}
 await page.screenshot({path:info.outputPath('dashboard.png'),fullPage:true});expect(errors).toEqual([]);
});
test('실전 답변·5지선다·변경·Space·마지막 보호·새로고침·결과',async({page})=>{
 await page.goto('');await page.getByRole('button',{name:'모의시험 시작하기',exact:true}).click();
 await expect(page.locator('.number-grid button')).toHaveCount(80);await expect(page.getByLabel('남은 시간')).toContainText(/100:00|99:5\d/);
 await expect(page.locator('.choices button')).toHaveCount(5);await expect(page.locator('.explanation')).toHaveCount(0);
 // 미응답 Space 보호, 실제 keydown/keyup
 await page.keyboard.press('Space');await expect(page.locator('.question-counter')).toContainText('1');
 await page.getByRole('button',{name:'북마크 추가'}).click();
 const e=(await read(page)).exam;
 await page.locator('.choices button').nth(4).click();await page.keyboard.press('Space');
 expect((await read(page)).exam.answers[e.questions[0].id]).toBe(5);
 await expect(page.locator('.number-grid button').nth(1)).toHaveClass(/current/);
 await page.keyboard.down('Space');await page.keyboard.up('Space');
 await expect(page.locator('.number-grid button').nth(1)).toHaveClass(/current/);
 await page.locator('.choices button').nth(0).click();await page.locator('.choices button').nth(1).click();
 expect((await read(page)).exam.answers[e.questions[1].id]).toBe(2);
 const before=await read(page);await page.reload();expect((await read(page)).exam.deadline).toBe(before.exam.deadline);expect((await read(page)).exam.answers).toEqual(before.exam.answers);
 await page.locator('.number-grid button').last().click();await page.locator('.choices button').nth(0).click();await page.keyboard.press('Space');
 await expect(page.locator('.number-grid button').last()).toHaveClass(/current/);await expect(page.getByRole('dialog')).toHaveCount(0);
 await page.getByRole('button',{name:'시험 종료 및 제출'}).click();await page.getByRole('button',{name:'돌아가기',exact:true}).click();
 await submit(page);await expect(page.getByRole('heading',{name:'모의시험 결과',exact:true})).toBeVisible();await expect(page.locator('.review-card')).toHaveCount(80);
 await page.getByLabel('오답만 보기').check();expect(await page.locator('.review-card').count()).toBeGreaterThan(0);
 const saved=await read(page);expect(saved.results).toHaveLength(1);expect(saved.attempts).toHaveLength(80);
 await page.getByRole('button',{name:'이 시험 오답만 다시 풀기'}).click();await expect(page.locator('.choices button')).toHaveCount(5);
});
test('랜덤 즉시채점·본문 포커스·Space·길게 누르기·북마크·오답노트·통계',async({page})=>{
 await page.goto('');await page.getByRole('button',{name:'문제풀이 시작하기',exact:true}).click();
 const before=await read(page);await page.keyboard.press('Space');expect((await read(page)).practice.currentId).toBe(before.practice.currentId);
 const q=bank.find(q=>q.id===before.practice.currentId)!;const wrong=q.answer%5;
 await page.locator('.choices button').nth(wrong).click();await expect(page.locator('.explanation')).toBeVisible();
 expect((await read(page)).attempts).toHaveLength(1);await page.keyboard.down('Space');await page.keyboard.down('Space');await page.keyboard.up('Space');
 expect((await read(page)).practice.currentId).not.toBe(q.id);expect((await read(page)).practice.revealed).toBe(false);
 await page.getByRole('button',{name:'북마크 추가'}).click();await nav(page,'북마크');await expect(page.locator('.review-card')).toBeVisible();
 await nav(page,'오답노트');await expect(page.locator('main')).toContainText(q.question);await page.getByRole('button',{name:'1문제 다시 풀기',exact:true}).click();await page.locator('.choices button').nth(q.answer-1).click();expect((await read(page)).wrongIds).not.toContain(q.id);
 await nav(page,'학습 통계');await expect(page.locator('.subject-stat')).toHaveCount(6);await expect(page.locator('main')).toContainText('2차 종합 결과');
});
test('만료 후 재접속 자동제출·중복 없음',async({page})=>{
 await page.goto('');await page.getByRole('button',{name:'모의시험 시작하기',exact:true}).click();
 await page.evaluate(k=>{const s=JSON.parse(localStorage.getItem(k)!);s.exam.startedAt=Date.now()-6001000;s.exam.deadline=s.exam.startedAt+6000000;localStorage.setItem(k,JSON.stringify(s))},key);
 await page.reload();await expect(page.getByRole('heading',{name:'모의시험 결과',exact:true})).toBeVisible();
 const s=await read(page);expect(s.exam).toBeNull();expect(s.results).toHaveLength(1);expect(s.results[0].reason).toBe('timeout');await page.reload();expect((await read(page)).results).toHaveLength(1);
});
test('2차 두 교시 시험·배분·50분·통합 과락 결과',async({page})=>{
 await page.goto('');await page.getByLabel('시험 교시').selectOption('second-a');await page.getByRole('button',{name:'모의시험 시작하기',exact:true}).click();
 expect((await read(page)).exam.paper).toBe('second-a');await expect(page.locator('.number-grid button')).toHaveCount(80);await submit(page);
 await expect(page.locator('.result-hero>.tag')).toHaveText('교시 결과 · 2차 종합 판정 필요');
 await nav(page,'학습 대시보드');await page.getByLabel('시험 교시').selectOption('second-b');await page.getByRole('button',{name:'모의시험 시작하기',exact:true}).click();
 await expect(page.locator('.number-grid button')).toHaveCount(40);await expect(page.getByLabel('남은 시간')).toContainText(/50:00|49:5\d/);
 const questions=(await read(page)).exam.questions;expect(questions.filter((q:any)=>q.subject==='부동산공시법')).toHaveLength(24);expect(questions.filter((q:any)=>q.subject==='부동산세법')).toHaveLength(16);
 await submit(page);await expect(page.locator('.result-subjects>div')).toHaveCount(1);await nav(page,'학습 통계');
 await expect(page.getByLabel('2차 종합 판정')).toContainText('불합격');
});
test('문제은행 출처 상세·검색·JSON/CSV·검증 대기·원본 보호·초기화',async({page})=>{
 await page.goto('');await nav(page,'문제은행 관리');await page.getByText('시험 규칙·문제 출처·검수 범위',{exact:true}).click();
 await expect(page.locator('.source-details')).toContainText('실제 등록·내부 검수 1,000개');await expect(page.locator('.source-details')).toContainText('최신성');
 await page.getByLabel('문항 검색').fill('REA-C-001');await expect(page.locator('main')).toContainText('권리·의무의 주체');
 const q={...bank[0],id:'LOCAL-TEST',question:'로컬 가져오기 예시 — 단위 테스트용',verificationStatus:'reviewed'};
 await page.locator('input[type=file]').setInputFiles({name:'bank.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([q]))});
 await expect.poll(async()=>(await read(page)).imported.length).toBe(1);expect((await read(page)).imported[0].verificationStatus).toBe('pending');
 // JSON 가져오기의 public 양식 경로 및 CSV 파일은 단위 테스트와 HTTP 응답 양쪽 확인
 for(const path of ['templates/questions.json','templates/questions.csv'])expect((await page.request.get(path)).ok()).toBe(true);
 await nav(page,'학습 대시보드');
 // 하단 도구는 locator click의 실제 자동 스크롤로 접근. 메뉴 스와이프는 아래 별도 검사.
 const open=page.getByRole('button',{name:'메뉴 열기'});if(await open.isVisible())await open.click();
 await page.getByRole('button',{name:'데이터 초기화',exact:true}).click();await page.getByRole('button',{name:'돌아가기',exact:true}).click();
 expect((await read(page)).imported).toHaveLength(1);
});
test('손상 기록·저장 실패 경고와 원본 보존',async({page})=>{
 await page.goto('');await page.evaluate(k=>localStorage.setItem(k,'broken-original'),key);await page.reload();
 await expect(page.getByRole('alert')).toContainText('기록을 읽지 못했습니다');expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('broken-original');
 await page.getByRole('button',{name:'문제풀이 시작하기',exact:true}).click();expect(await page.evaluate(k=>localStorage.getItem(k),key)).toBe('broken-original');
});
async function swipe(cdp:CDPSession,x:number,from:number,to:number){
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:from}]});
 for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:from+(to-from)*i/12}]});await new Promise(r=>setTimeout(r,20))}
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
}
for(const [width,height] of [[390,480],[740,360]])test(`메뉴 ${width}×${height} 실제 휠·터치 아래/위·하단도구·대시보드`,async({page,context},info)=>{
 await page.setViewportSize({width,height});await page.goto('');await page.getByRole('button',{name:'메뉴 열기'}).click();await expect(page.locator('.sidebar')).toHaveClass(/open/);await page.waitForTimeout(450);
 const sidebar=page.locator('.sidebar');expect(await sidebar.evaluate(e=>e.scrollHeight>e.clientHeight)).toBe(true);
 await page.mouse.move(120,height/2);await page.mouse.wheel(0,1800);
 await expect.poll(()=>sidebar.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);await page.waitForTimeout(250);
 const backup=page.getByRole('button',{name:'학습 기록 백업',exact:true});await expect(backup).toBeInViewport();
 const download=page.waitForEvent('download');await backup.click();expect((await download).suggestedFilename()).toBe('real-estate-study-backup.json');
 await page.mouse.move(120,height/2);await page.mouse.wheel(0,-1800);await expect.poll(()=>sidebar.evaluate(e=>e.scrollTop)).toBe(0);
 await expect(page.getByRole('navigation').getByRole('button',{name:'학습 대시보드',exact:true})).toBeInViewport();
 const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 for(let i=0;i<4;i++)await swipe(cdp,120,height-65,90);
 await expect.poll(()=>sidebar.evaluate(e=>e.scrollTop)).toBeGreaterThan(0);await expect(backup).toBeInViewport();
 await page.getByRole('button',{name:'데이터 초기화',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'돌아가기',exact:true}).click();
 for(let i=0;i<5;i++)await swipe(cdp,120,90,height-65);
 await expect.poll(()=>sidebar.evaluate(e=>e.scrollTop)).toBe(0);
 const home=page.getByRole('navigation').getByRole('button',{name:'학습 대시보드',exact:true});await expect(home).toBeInViewport();await home.click();
 await expect(sidebar).not.toHaveClass(/open/);await expect(page.getByRole('heading',{name:'공인중개사 필기 CBT',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath(`menu-${width}-${height}.png`)});
});
test('메뉴·입력·수정키·IME에서 Space 보호와 네이티브 답안 키보드',async({page})=>{
 await page.goto('');await page.getByRole('button',{name:'모의시험 시작하기',exact:true}).click();
 const choices=page.locator('.choices button');await choices.nth(2).focus();await page.keyboard.press('Space');
 expect(Object.values((await read(page)).exam.answers)).toEqual([3]);await expect(page.locator('.question-stem')).toBeFocused();
 await page.keyboard.press('Shift+Space');await expect(page.locator('.number-grid button').first()).toHaveClass(/current/);
 await page.locator('.question-stem').dispatchEvent('keydown',{key:' ',code:'Space',isComposing:true});await expect(page.locator('.number-grid button').first()).toHaveClass(/current/);
 await page.getByRole('button',{name:'시험 종료 및 제출'}).click();await page.getByRole('dialog').evaluate(d=>{const h=d.querySelector('h2')!;h.tabIndex=-1;h.focus()});await page.keyboard.press('Space');await expect(page.getByRole('dialog')).toBeVisible();await expect(page.locator('.number-grid button').first()).toHaveClass(/current/);await page.getByRole('button',{name:'돌아가기',exact:true}).click();
 await nav(page,'문제은행 관리');const input=page.getByLabel('문항 검색');await input.fill('test');await input.press('Space');await expect(input).toHaveValue('test ');
});
test('등록·근거 승인·확인 후 초기화',async({page})=>{
 await page.goto('');await nav(page,'문제은행 관리');
 const q={...bank[0],id:'LOCAL-APPROVE',question:'승인 흐름 검증용 연습문항',verificationStatus:'reviewed'};
 await page.locator('input[type=file]').setInputFiles({name:'approve.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify([q]))});
 await expect.poll(async()=>(await read(page)).imported.length).toBe(1);
 await page.getByLabel('문항 검색').fill('LOCAL-APPROVE');await page.locator('.bank-list summary').click();await page.getByRole('button',{name:'검수 내용 확인 및 승인',exact:true}).click();
 await expect(page.getByRole('button',{name:'검수 완료로 처리'})).toBeDisabled();
 await page.locator('.review-form input[type=checkbox]').check();await page.locator('.review-form textarea').fill('테스트용 자체 작성 문항: 원고 및 정답·선택지·권리 확인. 공용 은행 게시 아님.');
 await page.getByRole('button',{name:'검수 완료로 처리'}).click();await expect.poll(async()=>(await read(page)).imported[0].verificationStatus).toBe('reviewed');
 await nav(page,'학습 대시보드');const open=page.getByRole('button',{name:'메뉴 열기'});if(await open.isVisible())await open.click();await page.getByRole('button',{name:'데이터 초기화',exact:true}).click();await page.getByRole('button',{name:'모든 데이터 초기화',exact:true}).click();
 await expect(page.locator('.bank-summary')).toContainText('등록 1000문항');expect((await read(page)).imported).toHaveLength(0);
});
test('저장 제한 경고·확대 글자 메뉴 상하 접근',async({page})=>{
 await page.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException('테스트 저장 차단','QuotaExceededError')}});
 await page.goto('');await expect(page.getByRole('alert')).toContainText('기록을 저장하지 못했습니다');
 await page.setViewportSize({width:390,height:480});await page.addStyleTag({content:'.sidebar {font-size:24px} .sidebar nav button {font-size:24px;line-height:1.6}'});
 await page.getByRole('button',{name:'메뉴 열기'}).click();await page.waitForTimeout(450);await page.mouse.move(120,240);await page.mouse.wheel(0,2400);await page.waitForTimeout(250);
 await expect(page.getByRole('button',{name:'데이터 초기화',exact:true})).toBeInViewport();await page.mouse.wheel(0,-2400);await expect.poll(()=>page.locator('.sidebar').evaluate(e=>e.scrollTop)).toBe(0);
 await page.getByRole('navigation').getByRole('button',{name:'학습 대시보드',exact:true}).click();
});
