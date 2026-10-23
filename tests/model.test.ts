import { describe, expect, it } from 'vitest';
import { BASE_BANK, SUBJECTS, STORAGE_KEY, answerExam, checkPractice, createExam, emptyStore, fingerprint, grade, gradeSecondStage, importQuestions, nextPractice, parseCsv, remainingSeconds, restoreStore, startPractice, submitExam, validateQuestion, type Question } from '../src/model';
import { PAPERS } from '../src/qualification';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const bank=BASE_BANK;
function fixtureBank(): Question[] {
 return SUBJECTS.flatMap((subject, s) => Array.from({length:40}, (_,i) => ({...bank[0],id:`FIX-${s}-${i}`,subject,question:`テスト ${s}-${i}`,family:undefined})));
}
describe('기본 문제은행 감사',()=>{
 it('고정 원고 재생성은 동일 JSON',()=>{const before=readFileSync('src/data/questions-main.json','utf8');execFileSync('python3',['scripts/generate-bank.py']);expect(readFileSync('src/data/questions-main.json','utf8')).toBe(before)});
 it('실제 내부 검수 1000개; 960 계산 변형/40family + 40 개념',()=>{
  expect(bank).toHaveLength(1000); expect(new Set(bank.map(q=>q.id)).size).toBe(1000); expect(new Set(bank.map(fingerprint)).size).toBe(1000);
  expect(bank.filter(q=>q.calculation)).toHaveLength(960);expect(new Set(bank.filter(q=>q.family).map(q=>q.family)).size).toBe(40);
  expect(bank.filter(q=>q.subject===SUBJECTS[1])).toHaveLength(200);
  for(const q of bank){expect(()=>validateQuestion(q)).not.toThrow();expect(q.type).toBe('original');expect(q.year).toBeNull();expect(q.session).toBeNull();expect(q.verificationStatus).toBe('reviewed');}
 });
 for(const q of bank.filter(q=>q.calculation)) it(`${q.id} 독립 재계산/단위/보기 검증`,()=>{
  const {kind,values:v,result,unit}=q.calculation!;let expected:number;
  switch(kind){
   case 'capitalization': expected=v[0]*100/v[1];break;
   case 'ltv':expected=v[0]/100*v[1];break;
   case 'unit-price':case 'gross-rent':expected=v.reduce((a,b)=>a*b,1);break;
   case 'depreciation':expected=v[0]/v[2]-v[1]/v[2];break;
   case 'effective-income':expected=v[0]-(v[0]*v[1]/100);break;
   case 'noi':expected=v[0]-v[1];break;
   case 'equilibrium':expected=(v[0]-v[1])/4;expect(v[0]-2*expected).toBe(v[1]+2*expected);break;
   case 'civil-share': expected=v[0]/4;break;
   case 'civil-expense': case 'broker-split': expected=v[0]*v[1]/100;break;
   case 'civil-arrears': case 'broker-quarter-rent': case 'registry-rectangle': expected=v[0]*v[1];break;
   case 'civil-deposit':expected=v[0]-v[1]-v[2];break;
   case 'civil-damages':case 'broker-fee':case 'tax-proportional':expected=v[0]/100*v[1];break;
   case 'civil-balance':case 'civil-offset':case 'broker-net':case 'broker-balance':case 'public-remaining':case 'registry-division':case 'tax-credit':expected=v[0]-v[1];break;
   case 'civil-interest':expected=v[0]*v[1]*v[2]/1200;break;
   case 'broker-negotiation':case 'public-land-deduction':case 'tax-installment':expected=v[0]-(v[0]/100*v[1]);break;
   case 'public-coverage':case 'public-far':expected=v[1]*100/v[0];break;
   case 'public-footprint':case 'public-floor':case 'registry-share-area':expected=v[0]*v[1]/100;break;
   case 'registry-distance':expected=v[0]/100*v[1];break;
   case 'registry-map-area':expected=v[0]/10000*v[1]**2;break;
   case 'registry-merger':expected=v[0]+v[1];break;
   case 'tax-deduction':expected=(v[0]-v[1])*v[2]/100;break;
   case 'tax-gain':expected=v[0]-v[1]-v[2];break;
   case 'tax-progressive':expected=(Math.min(v[0],v[1])*v[2]+Math.max(v[0]-v[1],0)*v[3])/100;break;
   default:throw Error('검증식 없는 유형');
  }
  expect(expected).toBe(result);
  const answers=q.choices.map(c=>Number(c.replaceAll(',','').replace(unit,'')));
  expect(answers[q.answer-1]).toBe(expected);expect(new Set(answers).size).toBe(5);
  expect(q.choices.every(c=>c.endsWith(unit))).toBe(true);expect(q.explanation.replaceAll(',','')).toContain(String(result));
 });
 it('JSON·CSV 양식 모두 유효하고 가져오면 검증 대기',()=>{
  for(const data of [JSON.parse(readFileSync('public/templates/questions.json','utf8')),parseCsv(readFileSync('public/templates/questions.csv','utf8'))]){
   const imported=importQuestions(data,[]);expect(imported.added).toHaveLength(1);expect(imported.added[0].verificationStatus).toBe('pending');
  }
 });
 it('본문과 보기 순서 변경 중복 제거 및 원자적 오류',()=>{
  const q={...bank[0],id:'NEW',choices:[...bank[0].choices].reverse()};
  expect(importQuestions([q],bank).duplicates).toBe(1);
  expect(()=>importQuestions([{...q,choices:['one']}],bank)).toThrow();
 });
});
describe('시험 구성·과락·시간·복원',()=>{
 it('1차 80 고유 ID, 과목별40, 100분, family는 먼저 분산하고 부족분 보충',()=>{
  const e=createExam(bank,'main',1000);expect(e.questions).toHaveLength(80);expect(new Set(e.questions.map(q=>q.id)).size).toBe(80);
  expect(e.questions.filter(q=>q.subject===SUBJECTS[0])).toHaveLength(40);expect(e.deadline).toBe(6001000);
  expect(new Set(e.questions.filter(q=>q.family && q.subject===SUBJECTS[0]).map(q=>q.family)).size).toBe(8);
  expect(createExam(bank,'main',1000,'second-a').questions).toHaveLength(80);
 });
 it('2차 교시별 배분 40/40, 24/16; 각각 100/50분',()=>{
  const fixture=fixtureBank();for(const paper of ['second-a','second-b'] as const){
   const e=createExam(fixture,'main',0,paper);expect(e.deadline).toBe(PAPERS[paper].minutes*60000);expect(e.questions).toHaveLength(PAPERS[paper].count);
   PAPERS[paper].subjects.forEach((s,i)=>expect(e.questions.filter(q=>q.subject===s)).toHaveLength(PAPERS[paper].quotas[i]));
  }
 });
 it('평균60 경계·과락40 경계와 원값 판정',()=>{
  const e=createExam(bank,'main');const bySubject=SUBJECTS.slice(0,2).map(s=>e.questions.filter(q=>q.subject===s));
  const answer=(a:number,b:number)=>{e.answers={};[a,b].forEach((n,i)=>bySubject[i].slice(0,n).forEach(q=>e.answers[q.id]=q.answer));return grade(e)};
  expect(answer(24,24)).toMatchObject({score:60,passed:true});expect(answer(24,23).passed).toBe(false);
  expect(answer(15,40)).toMatchObject({passed:false});expect(answer(16,32)).toMatchObject({score:60,passed:true});
 });
 it('공시법·세법은 합산 한 과목, 2차 종합만 합격 판정',()=>{
  const fixture=fixtureBank(),a=createExam(fixture,'main',0,'second-a'),b=createExam(fixture,'main',0,'second-b');
  for(const e of [a,b])for(const q of e.questions)e.answers[q.id]=q.answer;
  expect(grade(b).subjects).toHaveLength(1);expect(grade(b).passed).toBe(false);expect(gradeSecondStage(a,b)).toMatchObject({passed:true,score:100});
  b.answers={};b.questions.slice(0,15).forEach(q=>b.answers[q.id]=q.answer);expect(gradeSecondStage(a,b).passed).toBe(false);
  b.questions.slice(0,16).forEach(q=>b.answers[q.id]=q.answer);expect(gradeSecondStage(a,b).passed).toBe(true);
 });
 it('절대시각 저장·5번 선택·만료 답안 변경 차단·중복 제출 방지',()=>{
  let s={...emptyStore(),exam:createExam(bank,'main',1000)};s=answerExam(s,s.exam.questions[0].id,5,2000) as typeof s;
  const restored=restoreStore(JSON.stringify(s));expect(restored.exam?.answers).toEqual(s.exam.answers);expect(remainingSeconds(s.exam.deadline,1000)).toBe(6000);
  const ended=answerExam(s,s.exam.questions[1].id,1,s.exam.deadline);expect(ended.exam).toBeNull();expect(ended.results[0].reason).toBe('timeout');expect(ended.results[0].answers[s.exam.questions[1].id]).toBeUndefined();
  expect(submitExam(ended)).toBe(ended);expect(ended.attempts).toHaveLength(80);
 });
 it('손상 복원 거부와 교시별 구성 검증',()=>{
  expect(()=>restoreStore('{')).toThrow();const s={...emptyStore(),exam:structuredClone(createExam(bank,'main'))};s.exam.questions[0].subject=SUBJECTS[4];expect(()=>restoreStore(JSON.stringify(s))).toThrow();
  expect(STORAGE_KEY).toBe('real-estate-agent-cbt:v1');
 });
});
describe('랜덤·기록',()=>{
 it('한 순회 중복 금지, 즉시채점 한 번, 정답 복습 시 오답 해제',()=>{
  let p=startPractice(bank,'main',SUBJECTS[1]);const seen=new Set<string>();
  for(let i=0;i<200;i++){expect(seen.has(p.currentId)).toBe(false);seen.add(p.currentId);p=nextPractice(p,bank)}
  let state=emptyStore();state.practice=startPractice(bank,'main');const q=bank.find(q=>q.id===state.practice!.currentId)!;
  state.wrongIds=[q.id];state.practice.selected=q.answer;state=checkPractice(state,bank);expect(state.wrongIds).not.toContain(q.id);expect(state.attempts).toHaveLength(1);expect(checkPractice(state,bank)).toBe(state);
 });
 it('가져온 검증 대기 제외, 학습 풀 부족이면 오류',()=>{
  expect(()=>startPractice(bank.filter(q=>q.subject!==SUBJECTS[4]),'main',SUBJECTS[4])).toThrow();expect(()=>createExam(bank.map(q=>({...q,verificationStatus:'pending'})),'main')).toThrow();
 });
});
