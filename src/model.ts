import bank from "./data/questions-main.json";
import { PROFILE, PAPERS, SUBJECTS, type PaperId } from "./qualification";
export { SUBJECTS } from "./qualification";
export type Subject = (typeof SUBJECTS)[number];
export type Version = "main";
export interface Question {
  id: string;
  subject: Subject;
  topic: string;
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
  difficulty: "하" | "중" | "상";
  year: number | null;
  session: string | null;
  type: "original" | "past" | "reconstructed";
  sourceUrl: string;
  verificationStatus: "reviewed" | "pending";
  reviewNote: string;
  version: Version;
  rights: string;
  family?: string;
  calculation?: {
    kind: string;
    values: number[];
    result: number;
    unit: string;
    precision?: number;
  };
}
export const BASE_BANK = bank as Question[];
export const TYPE_LABEL = {
  original: "자체 제작",
  past: "원문 기출",
  reconstructed: "복원문제",
};
export const VERSION_LABEL = { main: "기본 문제은행" };
export interface Exam {
  paper: PaperId;
  id: string;
  version: Version;
  questions: Question[];
  answers: Record<string, number>;
  startedAt: number;
  deadline: number;
}
export interface Result extends Exam {
  submittedAt: number;
  reason: "manual" | "timeout";
}
export interface Attempt {
  questionId: string;
  subject: Subject;
  correct: boolean;
  at: number;
  mode: "exam" | "practice";
}
export interface Practice {
  version: Version;
  subject: Subject | "전체";
  poolIds: string[] | null;
  currentId: string;
  selected: number | null;
  revealed: boolean;
  seen: string[];
  streak: number;
  answered: number;
  correct: number;
}
export interface Store {
  schema: 1;
  version: Version;
  exam: Exam | null;
  results: Result[];
  practice: Practice | null;
  attempts: Attempt[];
  wrongIds: string[];
  bookmarks: string[];
  imported: Question[];
}
export const STORAGE_KEY = PROFILE.storageKey;
export function emptyStore(): Store {
  return {
    schema: 1,
    version: "main",
    exam: null,
    results: [],
    practice: null,
    attempts: [],
    wrongIds: [],
    bookmarks: [],
    imported: [],
  };
}
export function shuffled<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function createExam(
  bank: Question[],
  version: Version,
  now = Date.now(),
  paper: PaperId = "first",
): Exam {
  const config = PAPERS[paper];
  const pools = config.subjects.map((s) =>
    bank.filter(
      (q) =>
        q.version === version &&
        q.subject === s &&
        q.verificationStatus === "reviewed",
    ),
  );
  if (pools.some((p, i) => p.length < config.quotas[i]))
    throw new Error("선택한 교시의 과목별 검수 문항 수가 부족합니다.");
  return {
    id: crypto.randomUUID(),
    paper,
    version,
    questions: shuffled(
      pools.flatMap((pool, poolIndex) => {
        const quota = config.quotas[poolIndex];
        // Give each authored question / calculated family one initial slot.
        // This avoids treating 30 number variants as 30 independent exam topics.
        const groups = new Map<string, Question[]>();
        for (const question of pool) {
          const key = question.family
            ? `family:${question.family}`
            : `question:${question.id}`;
          groups.set(key, [...(groups.get(key) || []), question]);
        }
        const selected = shuffled([...groups.values()])
          .slice(0, quota)
          .map((group) => shuffled(group)[0]);
        const selectedIds = new Set(selected.map((q) => q.id));
        // Imported banks may have fewer than 20 families but enough unique IDs.
        return [
          ...selected,
          ...shuffled(pool.filter((q) => !selectedIds.has(q.id))).slice(
            0,
            quota - selected.length,
          ),
        ];
      }),
    ),
    answers: {},
    startedAt: now,
    deadline: now + config.minutes * 60 * 1000,
  };
}
export function remainingSeconds(deadline: number, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
export function grade(exam: Exam) {
  const correct = exam.questions.filter(
    (q) => exam.answers[q.id] === q.answer,
  ).length;
  const unanswered = exam.questions.filter((q) => !exam.answers[q.id]).length;
  const subjectNames = exam.paper === "second-b" ? ["부동산공시법·부동산세법"] : [...PAPERS[exam.paper].subjects];
  const subjects = subjectNames.map((subject) => {
    const questions = exam.questions.filter((q) => exam.paper === "second-b" || q.subject === subject);
    const count = questions.filter(
      (q) => exam.answers[q.id] === q.answer,
    ).length;
    return {
      subject,
      correct: count,
      total: questions.length,
      rate: questions.length ? Math.round((count / questions.length) * 100) : 0,
    };
  });
  return {
    correct,
    wrong: exam.questions.length - correct,
    unanswered,
    score: Math.round((correct / exam.questions.length) * 1000) / 10,
    passed: exam.paper === "first" && correct / exam.questions.length >= PROFILE.passAverage / 100 && subjects.every(s => s.correct / s.total >= PROFILE.subjectCutoff / 100),
    verdict: exam.paper === "first" ? (correct / exam.questions.length >= PROFILE.passAverage / 100 && subjects.every(s => s.correct / s.total >= PROFILE.subjectCutoff / 100) ? "합격" : "불합격") : "교시 결과 · 2차 종합 판정 필요",
    subjects,
  };
}
function addAttempts(state: Store, attempts: Attempt[]) {
  const wrong = new Set(state.wrongIds);
  attempts.forEach((a) =>
    a.correct ? wrong.delete(a.questionId) : wrong.add(a.questionId),
  );
  return {
    attempts: [...state.attempts, ...attempts].slice(-5000),
    wrongIds: [...wrong],
  };
}
export function submitExam(
  state: Store,
  now = Date.now(),
  reason: "manual" | "timeout" = "manual",
): Store {
  if (!state.exam) return state;
  const exam = state.exam;
  const expired = now >= exam.deadline;
  const result: Result = {
    ...exam,
    submittedAt: expired ? exam.deadline : now,
    reason: expired ? "timeout" : reason,
  };
  const attempts = exam.questions.map((q) => ({
    questionId: q.id,
    subject: q.subject,
    correct: exam.answers[q.id] === q.answer,
    at: result.submittedAt,
    mode: "exam" as const,
  }));
  return {
    ...state,
    ...addAttempts(state, attempts),
    exam: null,
    results: [result, ...state.results].slice(0, 30),
  };
}
export function answerExam(
  state: Store,
  id: string,
  answer: number,
  now = Date.now(),
): Store {
  if (!state.exam) return state;
  if (now >= state.exam.deadline) return submitExam(state, now, "timeout");
  if (
    !state.exam.questions.some((q) => q.id === id) ||
    answer < 1 ||
    answer > PROFILE.choiceCount
  )
    return state;
  return {
    ...state,
    exam: { ...state.exam, answers: { ...state.exam.answers, [id]: answer } },
  };
}
export function practicePool(
  bank: Question[],
  p: Pick<Practice, "version" | "subject" | "poolIds">,
) {
  return bank.filter(
    (q) =>
      q.verificationStatus === "reviewed" &&
      q.version === p.version &&
      (p.subject === "전체" || p.subject === q.subject) &&
      (!p.poolIds || p.poolIds.includes(q.id)),
  );
}
export function startPractice(
  bank: Question[],
  version: Version,
  subject: Subject | "전체" = "전체",
  poolIds: string[] | null = null,
): Practice {
  const pool = practicePool(bank, { version, subject, poolIds });
  if (!pool.length)
    throw new Error("이 조건에 맞는 검수 완료 문제가 없습니다.");
  return {
    version,
    subject,
    poolIds,
    currentId: shuffled(pool)[0].id,
    selected: null,
    revealed: false,
    seen: [],
    streak: 0,
    answered: 0,
    correct: 0,
  };
}
export function checkPractice(
  state: Store,
  bank: Question[],
  now = Date.now(),
): Store {
  const p = state.practice,
    q = bank.find((q) => q.id === p?.currentId);
  if (!p || !q || p.revealed || p.selected === null) return state;
  const correct = p.selected === q.answer;
  return {
    ...state,
    ...addAttempts(state, [
      {
        questionId: q.id,
        subject: q.subject,
        correct,
        at: now,
        mode: "practice",
      },
    ]),
    practice: {
      ...p,
      revealed: true,
      streak: correct ? p.streak + 1 : 0,
      answered: p.answered + 1,
      correct: p.correct + (correct ? 1 : 0),
    },
  };
}
export function nextPractice(p: Practice, bank: Question[]): Practice {
  const pool = practicePool(bank, p);
  const seen = [...p.seen, p.currentId];
  let available = pool.filter((q) => !seen.includes(q.id));
  const reset = !available.length;
  if (reset)
    available = pool.filter((q) => pool.length === 1 || q.id !== p.currentId);
  if (!available.length) return p;
  return {
    ...p,
    currentId: shuffled(available)[0].id,
    selected: null,
    revealed: false,
    seen: reset ? [] : seen,
  };
}
export function validateQuestion(value: unknown): Question {
  if (!value || typeof value !== "object")
    throw new Error("문항은 객체여야 합니다.");
  const q = value as Record<string, unknown>;
  for (const key of [
    "id",
    "topic",
    "question",
    "explanation",
    "sourceUrl",
    "reviewNote",
    "rights",
  ])
    if (
      typeof q[key] !== "string" ||
      !(q[key] as string).trim() ||
      (q[key] as string).length > 12000
    )
      throw new Error(`${key}: 비어 있거나 너무 긴 문자열입니다.`);
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(q.id as string))
    throw new Error("ID는 영문·숫자·하이픈·밑줄 100자 이내입니다.");
  if (
    q.family !== undefined &&
    (typeof q.family !== "string" || !q.family.trim() || q.family.length > 100)
  )
    throw new Error(
      "계산 유형 family는 비어 있지 않은 100자 이내 문자열이어야 합니다.",
    );
  if (!SUBJECTS.includes(q.subject as Subject))
    throw new Error("과목이 올바르지 않습니다.");
  if (
    !Array.isArray(q.choices) ||
    q.choices.length !== PROFILE.choiceCount ||
    q.choices.some(
      (c) => typeof c !== "string" || !c.trim() || c.length > 2000,
    ) ||
    new Set(q.choices.map((c) => String(c).trim())).size !== PROFILE.choiceCount
  )
    throw new Error("서로 다른 보기 5개가 필요합니다.");
  if (
    !Number.isInteger(q.answer) ||
    Number(q.answer) < 1 ||
    Number(q.answer) > PROFILE.choiceCount
  )
    throw new Error("정답 번호는 1~5입니다.");
  if (
    !["하", "중", "상"].includes(q.difficulty as string) ||
    !["original", "past", "reconstructed"].includes(q.type as string) ||
    !["reviewed", "pending"].includes(q.verificationStatus as string) ||
    !["main"].includes(q.version as string)
  )
    throw new Error("난이도·유형·검증 상태·버전을 확인하세요.");
  if (
    q.year !== null &&
    (!Number.isInteger(q.year) ||
      Number(q.year) < 1900 ||
      Number(q.year) > 2100)
  )
    throw new Error("출제 연도는 확인된 연도 또는 null이어야 합니다.");
  if (
    q.session !== null &&
    (typeof q.session !== "string" ||
      !q.session.trim() ||
      q.session.length > 100 ||
      q.year === null)
  )
    throw new Error("회차는 연도가 확인된 경우에만 기록하세요.");
  if (q.type === "original" && (q.year !== null || q.session !== null))
    throw new Error("자체 제작 문항에는 출제 연도·회차를 부여하지 않습니다.");
  if (
    q.type === "past" &&
    q.year === null &&
    q.verificationStatus === "reviewed"
  )
    throw new Error("원문 기출 검수에는 확인된 출제 연도가 필요합니다.");
  try {
    const url = new URL(q.sourceUrl as string);
    if (url.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("출처 URL은 https 주소여야 합니다.");
  }
  return { ...q, choices: [...q.choices] } as unknown as Question;
}
export function fingerprint(q: Question) {
  return [q.question, ...[...q.choices].sort()]
    .join("|")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLowerCase();
}
export function importQuestions(values: unknown, existing: Question[]) {
  if (!Array.isArray(values) || !values.length || values.length > 10000)
    throw new Error("1~10,000개의 문항 배열이 필요합니다.");
  const ids = new Set(existing.map((q) => q.id)),
    hashes = new Set(existing.map(fingerprint));
  const added: Question[] = [];
  let duplicates = 0;
  values.forEach((value, i) => {
    let q: Question;
    try {
      q = validateQuestion(value);
    } catch (e) {
      throw new Error(`${i + 1}번 문항: ${(e as Error).message}`);
    }
    const hash = fingerprint(q);
    if (ids.has(q.id) || hashes.has(hash)) {
      duplicates++;
      return;
    }
    ids.add(q.id);
    hashes.add(hash);
    added.push({
      ...q,
      verificationStatus: "pending",
      reviewNote: `가져온 문항 · 출처·이용 권한·정답 검수 대기. ${q.reviewNote}`,
    });
  });
  return { added, duplicates };
}
export function parseCsv(text: string): unknown[] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell.length)
        throw new Error("CSV 따옴표 위치를 확인하세요.");
      else quoted = !quoted;
    } else if (!quoted && (ch === "," || ch === "\n")) {
      row.push(cell);
      cell = "";
      if (ch === "\n") {
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
      }
    } else cell += ch;
  }
  if (quoted) throw new Error("CSV의 닫는 따옴표가 없습니다.");
  row.push(cell);
  if (row.some((v) => v.trim())) rows.push(row);
  const headers = rows.shift();
  if (!headers) throw new Error("빈 CSV 파일입니다.");
  if (new Set(headers).size !== headers.length)
    throw new Error("CSV 열 이름이 중복되었습니다.");
  return rows.map((r, index) => {
    if (r.length !== headers.length)
      throw new Error(`CSV ${index + 2}행의 열 수를 확인하세요.`);
    const q: Record<string, unknown> = Object.fromEntries(
      headers.map((h, i) => [h, r[i]]),
    );
    q.choices = [q.choice1, q.choice2, q.choice3, q.choice4, q.choice5];
    for (const key of ["choice1", "choice2", "choice3", "choice4", "choice5"])
      delete q[key];
    q.answer = Number(q.answer);
    q.year = q.year ? Number(q.year) : null;
    q.session = q.session || null;
    return q;
  });
}
export function restoreStore(raw: string | null): Store {
  if (!raw) return emptyStore();
  const s = JSON.parse(raw) as Store;
  if (
    s.schema !== 1 ||
    !["main"].includes(s.version) ||
    !Array.isArray(s.imported) ||
    !Array.isArray(s.results) ||
    !Array.isArray(s.attempts) ||
    !Array.isArray(s.wrongIds) ||
    !Array.isArray(s.bookmarks)
  )
    throw new Error("저장 형식이 올바르지 않습니다.");
  s.imported.forEach(validateQuestion);
  const checkExam = (e: Exam) => {
    if (
      !e ||
      !Number.isFinite(e.deadline) ||
      !Number.isFinite(e.startedAt) ||
      !(e.paper in PAPERS) ||
      e.deadline - e.startedAt !== PAPERS[e.paper].minutes * 60000 ||
      !Array.isArray(e.questions) ||
      e.questions.length !== PAPERS[e.paper].count ||
      new Set(e.questions.map((q) => q.id)).size !== PAPERS[e.paper].count ||
      !e.answers ||
      typeof e.answers !== "object"
    )
      throw new Error("시험 데이터가 올바르지 않습니다.");
    e.questions.forEach(validateQuestion);
    const config = PAPERS[e.paper];
    if (e.questions.some(q => q.version !== e.version || q.verificationStatus !== "reviewed") || config.subjects.some((subject, i) => e.questions.filter(q => q.subject === subject).length !== config.quotas[i])) throw new Error("시험 과목 구성이 올바르지 않습니다.");
    if (
      Object.entries(e.answers).some(
        ([id, a]) =>
          !e.questions.some((q) => q.id === id) ||
          !Number.isInteger(a) ||
          a < 1 ||
          a > PROFILE.choiceCount,
      )
    )
      throw new Error("답안 데이터가 올바르지 않습니다.");
  };
  if (s.exam) checkExam(s.exam);
  s.results.forEach(checkExam);
  if (
    s.attempts.some(
      (a) =>
        !a ||
        !SUBJECTS.includes(a.subject) ||
        typeof a.correct !== "boolean" ||
        typeof a.questionId !== "string" ||
        !Number.isFinite(a.at),
    )
  )
    throw new Error("학습 기록이 올바르지 않습니다.");
  if ([...s.wrongIds, ...s.bookmarks].some((id) => typeof id !== "string"))
    throw new Error("문항 참조가 올바르지 않습니다.");
  if (s.practice) {
    const p = s.practice;
    if (
      !["main"].includes(p.version) ||
      !["전체", ...SUBJECTS].includes(p.subject) ||
      !Array.isArray(p.seen) ||
      typeof p.currentId !== "string" ||
      (p.selected !== null &&
        (!Number.isInteger(p.selected) || p.selected < 1 || p.selected > PROFILE.choiceCount)) ||
      typeof p.revealed !== "boolean" ||
      ![p.streak, p.answered, p.correct].every(
        (n) => Number.isInteger(n) && n >= 0,
      ) ||
      p.correct > p.answered ||
      (p.poolIds !== null && !Array.isArray(p.poolIds))
    )
      throw new Error("연습 기록이 올바르지 않습니다.");
  }
  return s;
}

// 2차는 1교시 두 과목 + 2교시 공시·세법 한 과목의 3과목으로 판정한다.
export function gradeSecondStage(first: Exam, second: Exam) {
  if (first.paper !== "second-a" || second.paper !== "second-b") throw new Error("2차 교시 조합을 확인하세요.");
  const subjects = [...grade(first).subjects, ...grade(second).subjects];
  const correct = subjects.reduce((n,s) => n+s.correct,0);
  return { subjects, score: Math.round(correct / 120 * 1000) / 10,
    passed: correct / 120 >= 0.6 && subjects.every(s => s.correct / s.total >= 0.4) };
}
