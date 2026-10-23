// 규칙은 공식 원문 재확인 대기. UI에는 학습용 모의 구성을 적용한다.
export const SUBJECTS = ["부동산학개론", "민법 및 민사특별법", "중개사법령 및 중개실무", "부동산공법", "부동산공시법", "부동산세법"] as const;
export type PaperId = "first" | "second-a" | "second-b";
export const PROFILE = {
  name: "공인중개사", bankId: "main", choiceCount: 5, questionsPerSubject: 40,
  passAverage: 60, subjectCutoff: 40, targetReviewedCount: 1000,
  rulesVerificationStatus: "pending", storageKey: "real-estate-agent-cbt:v1",
  officialSources: ["https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=9630"],
} as const;
// 공시법(24)+세법(16)은 별도 과락 과목이 아니라 하나의 40문항 채점 과목이다.
export const PAPERS = {
  first: { label: "1차 시험", minutes: 100, count: 80, subjects: [SUBJECTS[0], SUBJECTS[1]], quotas: [40,40], stage: 1 },
  "second-a": { label: "2차 1교시", minutes: 100, count: 80, subjects: [SUBJECTS[2], SUBJECTS[3]], quotas: [40,40], stage: 2 },
  "second-b": { label: "2차 2교시", minutes: 50, count: 40, subjects: [SUBJECTS[4], SUBJECTS[5]], quotas: [24,16], stage: 2 },
} as const;
