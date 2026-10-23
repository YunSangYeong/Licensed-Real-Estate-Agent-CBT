import { PAPERS, type PaperId } from "./qualification";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookCheck,
  BookMarked,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Database,
  FileCheck2,
  Flag,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Play,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Trophy,
  Upload,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import {
  answerExam,
  BASE_BANK,
  checkPractice,
  createExam,
  emptyStore,
  grade,
  gradeSecondStage,
  importQuestions,
  nextPractice,
  parseCsv,
  remainingSeconds,
  restoreStore,
  startPractice,
  STORAGE_KEY,
  SUBJECTS,
  submitExam,
  TYPE_LABEL,
  validateQuestion,
  VERSION_LABEL,
  type Question,
  type Result,
  type Store,
  type Subject,
  type Version,
} from "./model";
type View =
  | "home"
  | "exam"
  | "practice"
  | "result"
  | "wrong"
  | "bookmarks"
  | "stats"
  | "bank";
const navigation: { id: View; label: string; icon: typeof Zap }[] = [
  { id: "home", label: "학습 대시보드", icon: LayoutDashboard },
  { id: "exam", label: "실전 모의시험", icon: ClipboardList },
  { id: "practice", label: "랜덤 문제풀이", icon: Zap },
  { id: "wrong", label: "오답노트", icon: BookMarked },
  { id: "bookmarks", label: "북마크", icon: Bookmark },
  { id: "stats", label: "학습 통계", icon: BarChart3 },
  { id: "bank", label: "문제은행 관리", icon: Database },
];
function load() {
  try {
    const restored = restoreStore(localStorage.getItem(STORAGE_KEY));
    return {
      // The picker is removed. Reset only the old preference, retaining all records.
      state: { ...restored, version: "main" as const },
      error: "",
      safe: true,
    };
  } catch {
    return {
      state: emptyStore(),
      error:
        "학습 기록을 읽지 못했습니다. 기존 데이터를 덮어쓰지 않고 임시로 학습합니다. 기록 백업 후 초기화할 수 있습니다.",
      safe: false,
    };
  }
}
function download(filename: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  className = "",
  shortcut,
}: {
  children: ReactNode;
  onClick: () => void;
  secondary?: boolean;
  disabled?: boolean;
  className?: string;
  shortcut?: string;
}) {
  return (
    <button
      className={`${secondary ? "btn secondary" : "btn"} ${className}`}
      onClick={onClick}
      disabled={disabled}
      aria-keyshortcuts={shortcut}
    >
      {children}
    </button>
  );
}
function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <BookCheck size={38} />
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
function Source({ q }: { q: Question }) {
  return (
    <div className="source">
      <span className="tag">{TYPE_LABEL[q.type]}</span>
      <span>
        {q.year
          ? `${q.year}년 ${q.session ? `${q.session}회차` : ""}`
          : "확인된 출제 연도·회차 없음"}
      </span>
      <a href={q.sourceUrl} target="_blank" rel="noreferrer">
        출처 확인 ↗
      </a>
      <span>{q.rights}</span>
      <span>
        {q.verificationStatus === "reviewed" ? "내부 검수 완료" : "검증 대기"}
      </span>
    </div>
  );
}
function Explanation({ q, selected }: { q: Question; selected?: number }) {
  return (
    <div className={`explanation ${selected === q.answer ? "is-correct" : ""}`}>
      <h4>
        {selected === q.answer ? (
          <CheckCircle2 size={20} />
        ) : (
          <CircleHelp size={20} />
        )}{" "}
        정답 {q.answer}번 · {q.choices[q.answer - 1]}
      </h4>
      <p>{q.explanation}</p>
      <Source q={q} />
      <small>{q.reviewNote}</small>
    </div>
  );
}
function Choices({
  q,
  selected,
  revealed = false,
  onChoose,
}: {
  q: Question;
  selected?: number | null;
  revealed?: boolean;
  onChoose: (answer: number) => void;
}) {
  return (
    <div className="choices" role="group" aria-label="답안 선택">
      {q.choices.map((choice, i) => (
        <button
          key={i}
          aria-pressed={selected === i + 1}
          disabled={revealed}
          className={`choice ${selected === i + 1 ? "selected" : ""} ${revealed && q.answer === i + 1 ? "correct" : ""} ${revealed && selected === i + 1 && q.answer !== i + 1 ? "incorrect" : ""}`}
          onClick={() => onChoose(i + 1)}
        >
          <span className="choice-no">{i + 1}</span>
          <span>{choice}</span>
          {revealed && q.answer === i + 1 && <Check size={20} />}
        </button>
      ))}
    </div>
  );
}
function App() {
  const [initial] = useState(load);
  const [state, setState] = useState<Store>(initial.state);
  const [canPersist, setCanPersist] = useState(initial.safe);
  const [storageError, setStorageError] = useState(initial.error);
  const [view, setView] = useState<View>(initial.state.exam ? "exam" : "home");
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [examIndex, setExamIndex] = useState(0);
  const [resultId, setResultId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<"submit" | "reset" | null>(null);
  const [practiceSubject, setPracticeSubject] = useState<Subject | "전체">(
    "전체",
  );
  const bank = [...BASE_BANK, ...state.imported];
  const available = bank.filter(
    (q) => q.version === state.version && q.verificationStatus === "reviewed",
  );
  const [paper, setPaper] = useState<PaperId>("first");
  const config = PAPERS[paper];
  const poolAvailable = config.subjects.every((s, i) => available.filter(q => q.subject === s).length >= config.quotas[i]);
  const examCount = state.exam?.questions.length ?? config.count;
  const paperPicker = <label className="paper-picker">시험 교시 <select aria-label="시험 교시" value={paper} onChange={e => setPaper(e.target.value as PaperId)}>{Object.entries(PAPERS).map(([id, item]) => <option key={id} value={id}>{item.label} · {item.count}문항 · {item.minutes}분</option>)}</select></label>;
  const activeQuestion = state.exam?.questions[examIndex];
  const p = state.practice;
  const practiceQuestion = bank.find((q) => q.id === p?.currentId);
  const result =
    state.results.find((r) => r.id === resultId) || state.results[0];
  const correctCount = state.attempts.filter((a) => a.correct).length;
  const accuracy = state.attempts.length
    ? Math.round((correctCount / state.attempts.length) * 100)
    : 0;
  const weak = SUBJECTS.map((subject) => {
    const a = state.attempts.filter((a) => a.subject === subject);
    return {
      subject,
      total: a.length,
      rate: a.length
        ? Math.round((a.filter((a) => a.correct).length / a.length) * 100)
        : 0,
    };
  })
    .filter((s) => s.total)
    .sort((a, b) => a.rate - b.rate)[0];
  const sectionRef = useRef<HTMLDivElement>(null);
  const questionRef = useRef<HTMLHeadingElement>(null);
  const examAnswer = activeQuestion && state.exam?.answers[activeQuestion.id];
  const notify = (message: string) => setToast(message);
  const advancePractice = useCallback((requireGraded = false) => {
    setState((current) => {
      if (!current.practice || (requireGraded && !current.practice.revealed))
        return current;
      return {
        ...current,
        practice: nextPractice(current.practice, [
          ...BASE_BANK,
          ...current.imported,
        ]),
      };
    });
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        (event.code !== "Space" && event.key !== " ") ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        (view !== "practice" && view !== "exam") ||
        modal ||
        menuOpen
      )
        return;
      // Preserve typing and native keyboard activation of enabled controls.
      // A graded choice is disabled, so focus left there may use the shortcut.
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], button:not(:disabled), a, summary, [role="button"]',
        )
      )
        return;
      if (
        view === "practice" &&
        p?.revealed &&
        p.version === state.version &&
        practiceQuestion
      ) {
        event.preventDefault();
        advancePractice(true);
      } else if (
        view === "exam" &&
        state.exam &&
        examAnswer &&
        examIndex < examCount - 1 &&
        Date.now() < state.exam.deadline
      ) {
        event.preventDefault();
        setExamIndex((index) =>
          index === examIndex ? Math.min(index + 1, examCount - 1) : index,
        );
        window.scrollTo({ top: 0 });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    view,
    modal,
    menuOpen,
    p,
    state.version,
    practiceQuestion,
    advancePractice,
    state.exam,
    examAnswer,
    examIndex,
  ]);
  useEffect(() => {
    // Put focus on the question after grading / selecting and after navigation.
    // Disabled choices and native button Space handling must not swallow the shortcut.
    if (view === "practice" || view === "exam")
      questionRef.current?.focus({ preventScroll: true });
  }, [view, p?.currentId, p?.revealed, examIndex, examAnswer]);

  useEffect(() => {
    if (!canPersist) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      setStorageError("");
    } catch {
      setStorageError(
        "이 브라우저에 기록을 저장하지 못했습니다. 저장 공간과 개인정보 보호 설정을 확인하고, 기록을 백업하세요. 현재 변경은 새로고침 시 사라질 수 있습니다.",
      );
    }
  }, [state, canPersist]);
  useEffect(() => {
    if (!state.exam) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    const sync = () => setNow(Date.now());
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [state.exam?.id]);
  useEffect(() => {
    if (state.exam && now >= state.exam.deadline) {
      setResultId(state.exam.id);
      setState((s) => submitExam(s, Date.now(), "timeout"));
      setView("result");
      setModal(null);
      notify("시험 시간이 종료되어 자동 제출되었습니다.");
    }
  }, [now, state.exam]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    sectionRef.current?.focus();
  }, [view]);
  const navigate = (next: View) => {
    setView(next);
    setMenuOpen(false);
    window.scrollTo({ top: 0 });
  };
  const beginExam = () => {
    try {
      if (state.exam) {
        navigate("exam");
        return;
      }
      const exam = createExam(bank, state.version, Date.now(), paper);
      setState((s) => ({ ...s, exam }));
      setNow(exam.startedAt);
      setExamIndex(0);
      navigate("exam");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const beginPractice = (
    subject: Subject | "전체" = practiceSubject,
    ids: string[] | null = null,
    version: Version = state.version,
  ) => {
    try {
      const practice = startPractice(bank, version, subject, ids);
      setState((s) => ({ ...s, version, practice }));
      navigate("practice");
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const bookmark = (id: string) =>
    setState((s) => ({
      ...s,
      bookmarks: s.bookmarks.includes(id)
        ? s.bookmarks.filter((x) => x !== id)
        : [...s.bookmarks, id],
    }));
  const selectPractice = (answer: number) =>
    setState((s) =>
      !s.practice || s.practice.revealed
        ? s
        : checkPractice(
            { ...s, practice: { ...s.practice, selected: answer } },
            bank,
          ),
    );
  const finish = () => {
    if (!state.exam) return;
    setResultId(state.exam.id);
    setState((s) => submitExam(s));
    setModal(null);
    navigate("result");
  };
  const selectExam = (id: string, answer: number) => {
    const time = Date.now();
    if (state.exam && time >= state.exam.deadline) {
      setResultId(state.exam.id);
      setState((s) => submitExam(s, time, "timeout"));
      setModal(null);
      navigate("result");
      notify("시험 시간이 종료되어 자동 제출되었습니다.");
      return;
    }
    setState((s) => answerExam(s, id, answer, time));
  };
  const bookmarkButton = (q: Question) => (
    <button
      className={`icon-btn ${state.bookmarks.includes(q.id) ? "bookmarked" : ""}`}
      aria-label={
        state.bookmarks.includes(q.id) ? "북마크 해제" : "북마크 추가"
      }
      aria-pressed={state.bookmarks.includes(q.id)}
      onClick={() => bookmark(q.id)}
    >
      <Bookmark size={21} />
    </button>
  );
  const questionTop = (q: Question, index?: number) => (
    <div className="question-top">
      <div>
        <span className={`tag subject-${SUBJECTS.indexOf(q.subject)}`}>
          {q.subject}
        </span>
        <span className="topic">
          {q.topic} · 난이도 {q.difficulty}
        </span>
      </div>
      {bookmarkButton(q)}
      {index !== undefined && <span className="sr-only">문제 {index + 1}</span>}
    </div>
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("home");
          }}
        >
          <span className="brand-symbol">
            <Zap fill="currentColor" size={23} />
          </span>
          <span>
            부동산<span className="brand-light">CBT</span>
            <small>공인중개사 학습 공간</small>
          </span>
        </a>
        <div className="nav-caption">나의 학습 메뉴</div>
        <nav aria-label="주 메뉴">
          {navigation.map(({ id, label, icon: Icon }, i) => (
            <button
              key={id}
              aria-label={label}
              onClick={() => navigate(id)}
              className={`${view === id ? "active" : ""} ${i === 3 ? "nav-divider" : ""}`}
            >
              <Icon size={19} />
              <span>{label}</span>
              {id === "wrong" && state.wrongIds.length > 0 && (
                <b>{state.wrongIds.length}</b>
              )}
              {view === id && <span className="active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={19} />
            <div>
              <strong>나만의 학습 기록</strong>
              <p>로그인 없이, 이 브라우저에 저장</p>
            </div>
          </div>
          <button
            className="text-button"
            onClick={() =>
              download(
                "real-estate-study-backup.json",
                JSON.stringify(state, null, 2),
              )
            }
          >
            <ArrowDownToLine size={15} /> 학습 기록 백업
          </button>
          <button className="text-button" onClick={() => setModal("reset")}>
            <RotateCcw size={14} /> 데이터 초기화
          </button>
          <p className="sidebar-disclaimer">
            비공식 학습용 서비스
            <br />
            Q-Net 및 한국산업인력공단과 무관합니다.
          </p>
        </div>
      </aside>
      {menuOpen && (
        <button
          aria-label="메뉴 닫기"
          className="scrim"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-menu"
              aria-label="메뉴 열기"
              onClick={() => setMenuOpen(true)}
            >
              <Menu />
            </button>
            <span>나의 학습실</span>
            <ChevronRight size={14} />
            <strong>
              {view === "result"
                ? "시험 결과"
                : navigation.find((n) => n.id === view)?.label}
            </strong>
          </div>
          <div className="topbar-right">
            <span className="save-status">
              <span />{" "}
              {storageError ? "임시 저장 모드" : "브라우저에 자동 저장"}
            </span>
            <span className="avatar">나</span>
          </div>
        </header>
        <main ref={sectionRef} tabIndex={-1}>
          {storageError && (
            <div className="notice warning" role="alert">
              {storageError}
              <button
                className="text-button"
                onClick={() => {
                  try {
                    download(
                      "real-estate-raw-backup.txt",
                      localStorage.getItem(STORAGE_KEY) || "",
                      "text/plain",
                    );
                  } catch {
                    notify("브라우저 저장소에 접근할 수 없습니다.");
                  }
                }}
              >
                기존 기록 원본 백업
              </button>
            </div>
          )}
          {state.exam && view !== "exam" && (
            <button className="resume-strip" onClick={() => navigate("exam")}>
              <Clock3 size={18} /> 진행 중인 모의시험이 있습니다. 남은 시간{" "}
              {Math.floor(remainingSeconds(state.exam.deadline, now) / 60)}분 ·
              시험 이어하기 <ArrowRight size={17} />
            </button>
          )}
          {view === "home" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">
                    <span /> 합격을 향한 오늘의 한 걸음
                  </div>
                  <h1>공인중개사 필기 CBT</h1>
                  <p>오늘의 한 문제, 합격에 한 걸음 더 가까이.</p>
                </div>
              </div>

              <section className="mode-grid" aria-label="시험 모드">
                <article className="mode-card exam-mode">
                  <div className="mode-top">
                    <span className="mode-icon">
                      <ClipboardList size={25} />
                    </span>
                    <span className="pill">실전처럼, 집중해서</span>
                  </div>
                  <h2>실전 모의시험</h2>
                  {paperPicker}
                  <p>
                    {config.minutes}분의 집중, {config.count}문제의 도전.
                    <br />
                    실제 시험 흐름으로 준비 상태를 확인하세요.
                  </p>
                  <div className="mode-facts">
                    <span>
                      <FileCheck2 size={15} />
                      {config.count}문항
                    </span>
                    <span>
                      <Clock3 size={15} />
                      {config.minutes}분
                    </span>
                    <span>
                      <Target size={15} />
                      평균 60점 · 과목 40점
                    </span>
                  </div>
                  <button
                    className="mode-action"
                    onClick={beginExam}
                    disabled={!poolAvailable && !state.exam}
                  >
                    {state.exam
                      ? "진행 중인 시험 이어하기"
                      : "모의시험 시작하기"}
                    <ArrowRight size={19} />
                  </button>
                  <span className="card-watermark">
                    <ClipboardList />
                  </span>
                </article>
                <article className="mode-card practice-mode">
                  <div className="mode-top">
                    <span className="mode-icon">
                      <Zap size={25} />
                    </span>
                    <span className="pill">한 문제씩, 확실하게</span>
                  </div>
                  <h2>랜덤 문제풀이</h2>
                  <p>
                    부담 없이 한 문제부터 시작하세요.
                    <br />
                    정답과 상세 해설을 바로 확인할 수 있어요.
                  </p>
                  <div className="subject-picker">
                    {(["전체", ...SUBJECTS] as const).map((s) => (
                      <button
                        key={s}
                        className={practiceSubject === s ? "picked" : ""}
                        aria-pressed={practiceSubject === s}
                        onClick={() => setPracticeSubject(s)}
                      >
                        {s === "전체" ? "전체 과목" : s}
                      </button>
                    ))}
                  </div>
                  <button
                    className="mode-action"
                    onClick={() => beginPractice()}
                    disabled={!available.length}
                  >
                    문제풀이 시작하기
                    <ArrowRight size={19} />
                  </button>
                  {p && p.version === state.version && (
                    <button
                      className="continue-link"
                      onClick={() => navigate("practice")}
                    >
                      이전 학습 이어하기 <ChevronRight size={14} />
                    </button>
                  )}
                </article>
              </section>
              <section className="stats-grid" aria-label="학습 요약">
                <div className="stat-card">
                  <span className="stat-icon teal">
                    <BookCheck />
                  </span>
                  <div>
                    <p>최근 풀이</p>
                    <strong>
                      {state.attempts.length}
                      <small>문제</small>
                    </strong>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-icon blue">
                    <Target />
                  </span>
                  <div>
                    <p>전체 정답률</p>
                    <strong>
                      {state.attempts.length ? accuracy : "—"}
                      <small>%</small>
                    </strong>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-icon amber">
                    <Trophy />
                  </span>
                  <div>
                    <p>최근 모의시험</p>
                    <strong>
                      {state.results[0] ? grade(state.results[0]).score : "—"}
                      <small>점</small>
                    </strong>
                  </div>
                </div>
                <div className="stat-card">
                  <span className="stat-icon violet">
                    <BookMarked />
                  </span>
                  <div>
                    <p>다시 볼 오답</p>
                    <strong>
                      {state.wrongIds.length}
                      <small>문제</small>
                    </strong>
                  </div>
                </div>
              </section>
              <div className="dashboard-lower">
                <section className="panel recent-panel">
                  <div className="panel-heading">
                    <h2>최근 모의시험</h2>
                    <button
                      className="text-button"
                      onClick={() => navigate("stats")}
                    >
                      전체 기록 <ChevronRight size={14} />
                    </button>
                  </div>
                  {state.results.length ? (
                    <div className="history-list">
                      {state.results.slice(0, 3).map((r) => (
                        <button
                          key={r.id}
                          onClick={() => {
                            setResultId(r.id);
                            navigate("result");
                          }}
                        >
                          <span className="history-icon">
                            <ClipboardList size={19} />
                          </span>
                          <span>
                            <strong>
                              {new Date(r.submittedAt).toLocaleDateString(
                                "ko-KR",
                              )}{" "}
                              모의시험
                            </strong>
                            <small>
                              {VERSION_LABEL[r.version]} · {grade(r).correct}/{r.questions.length}
                              정답
                            </small>
                          </span>
                          <b>
                            {grade(r).score}
                            <small>점</small>
                          </b>
                          <span
                            className={`tag ${grade(r).passed ? "pass-tag" : ""}`}
                          >
                            {grade(r).verdict}
                          </span>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <Empty title="첫 번째 합격 기록을 만들어 보세요">
                      모의시험을 마치면 점수와 과목별 결과가 여기에 쌓여요.
                      <button
                        className="text-button"
                        onClick={beginExam}
                        disabled={!poolAvailable}
                      >
                        첫 모의시험 시작 <ArrowRight size={14} />
                      </button>
                    </Empty>
                  )}
                </section>
                <section className="panel study-guide">
                  <div className="panel-heading">
                    <h2>
                      <Sparkles size={18} /> 오늘의 학습 가이드
                    </h2>
                  </div>
                  <p className="guide-kicker">꾸준함이 실력이 되는 시간</p>
                  <h3>
                    {weak
                      ? `${weak.subject}, 한 번 더 다져볼까요?`
                      : "작게 시작하고, 확실하게 쌓아요."}
                  </h3>
                  <p>
                    {weak
                      ? `현재 정답률 ${weak.rate}%. 해설을 확인하고 오답을 다시 풀어보세요.`
                      : "랜덤 문제로 개념을 익히고, 모의시험으로 시간 감각을 키워보세요."}
                  </p>
                  <div className="guide-steps">
                    <span>
                      01 <b>개념 익히기</b>
                    </span>
                    <ChevronRight size={13} />
                    <span>
                      02 <b>실전 연습</b>
                    </span>
                    <ChevronRight size={13} />
                    <span>
                      03 <b>오답 복습</b>
                    </span>
                  </div>
                  <button
                    className="text-button"
                    onClick={() =>
                      weak ? beginPractice(weak.subject) : beginPractice()
                    }
                  >
                    추천 학습 시작 <ArrowRight size={15} />
                  </button>
                </section>
              </div>
              <section className="bank-summary">
                <div className="bank-summary-icon">
                  <Database size={23} />
                </div>
                <div>
                  <h3>출처를 구분하는, 투명한 문제은행</h3>
                  <p>
                    등록 {bank.length}문항 · 원문 기출{" "}
                    {bank.filter((q) => q.type === "past").length} · 복원{" "}
                    {bank.filter((q) => q.type === "reconstructed").length} ·
                    자체 제작 {bank.filter((q) => q.type === "original").length}{" "}
                    · 계산 조건 변형 {BASE_BANK.filter(q => q.calculation).length} / {new Set(BASE_BANK.filter(q => q.family).map(q => q.family)).size} family · 개념형 {BASE_BANK.filter(q => !q.calculation).length}
                    · 내부 검수{" "}
                    {
                      bank.filter((q) => q.verificationStatus === "reviewed")
                        .length
                    }
                  </p>
                </div>
                <button
                  className="text-button"
                  onClick={() => navigate("bank")}
                >
                  문제은행 보기 <ArrowRight size={16} />
                </button>
              </section>
            </>
          )}
          {view === "exam" &&
            (state.exam && activeQuestion ? (
              <>
                <div className="exam-bar">
                  <div>
                    <span className="eyebrow">교시별 실전 연습</span>
                    <h1>실전 모의시험</h1>
                    <p>
                      {PAPERS[state.exam.paper].label} · 총 {examCount}문항
                    </p>
                  </div>
                  <div
                    className={`timer ${remainingSeconds(state.exam.deadline, now) <= 300 ? "urgent" : ""}`}
                    aria-label="남은 시간"
                  >
                    <Clock3 size={21} />
                    <span>
                      {String(
                        Math.floor(
                          remainingSeconds(state.exam.deadline, now) / 60,
                        ),
                      ).padStart(2, "0")}
                      :
                      {String(
                        remainingSeconds(state.exam.deadline, now) % 60,
                      ).padStart(2, "0")}
                    </span>
                    <small>남은 시간</small>
                  </div>
                </div>
                <div className="exam-layout">
                  <section className="panel question-panel">
                    {questionTop(activeQuestion, examIndex)}
                    <div className="question-counter">
                      문제{" "}
                      <strong>{String(examIndex + 1).padStart(2, "0")}</strong>
                      <span>/ {examCount}</span>
                    </div>
                    <h2
                      className="question-stem"
                      ref={questionRef}
                      tabIndex={-1}
                    >
                      {activeQuestion.question}
                    </h2>
                    <Choices
                      q={activeQuestion}
                      selected={state.exam.answers[activeQuestion.id]}
                      onChoose={(a) => selectExam(activeQuestion.id, a)}
                    />
                    <div className="question-controls">
                      <Button
                        secondary
                        onClick={() => {
                          setExamIndex((i) => i - 1);
                          window.scrollTo(0, 0);
                        }}
                        disabled={examIndex === 0}
                      >
                        <ArrowLeft size={16} /> 이전 문제
                      </Button>
                      <span>답안을 자유롭게 변경할 수 있어요</span>
                      <Button
                        secondary
                        onClick={() => {
                          setExamIndex((i) => i + 1);
                          window.scrollTo(0, 0);
                        }}
                        disabled={examIndex === examCount - 1}
                        shortcut="Space"
                      >
                        다음 문제 <ArrowRight size={16} />
                      </Button>
                    </div>
                    <p className="muted small">
                      답안 선택 후 <kbd>Space</kbd> 키로 다음 문제로 이동합니다.
                      마지막 문제에서는 시험을 자동 제출하지 않습니다.
                    </p>
                  </section>
                  <aside className="panel answer-panel">
                    <div className="panel-heading">
                      <h2>답안 현황</h2>
                      <strong>
                        {Object.keys(state.exam.answers).length}
                        <small> / {examCount}</small>
                      </strong>
                    </div>
                    <div className="mini-progress">
                      <span
                        style={{
                          width: `${(Object.keys(state.exam.answers).length / examCount) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="answer-legend">
                      <span>
                        <i className="answered" />
                        응답
                      </span>
                      <span>
                        <i />
                        미응답
                      </span>
                      <span>
                        <i className="current" />
                        현재
                      </span>
                    </div>
                    <div className="number-grid">
                      {state.exam.questions.map((q, i) => (
                        <button
                          key={q.id}
                          className={`${state.exam!.answers[q.id] ? "answered" : ""} ${examIndex === i ? "current" : ""}`}
                          aria-label={`${i + 1}번 ${state.exam!.answers[q.id] ? "응답" : "미응답"}`}
                          aria-current={i === examIndex ? "step" : undefined}
                          onClick={() => {
                            setExamIndex(i);
                            window.scrollTo(0, 0);
                          }}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                    <p className="unanswered-note">
                      미응답{" "}
                      <b>{examCount - Object.keys(state.exam.answers).length}</b>문항
                    </p>
                    <Button onClick={() => setModal("submit")}>
                      <Flag size={17} /> 시험 종료 및 제출
                    </Button>
                    <p className="muted small">
                      시간이 끝나면 자동 제출됩니다.
                      <br />
                      새로고침해도 답안과 종료 시각이 유지됩니다.
                    </p>
                  </aside>
                </div>
              </>
            ) : (
              <>
                <PageTitle
                  eyebrow="교시별 실전 연습"
                  title="실전 모의시험"
                  description="선택한 교시의 문항 수·시간·과목 구성으로 연습하세요."
                />
                <section className="panel intro-panel">
                  <span className="big-icon">
                    <ClipboardList size={38} />
                  </span>
                  <h2>{config.label} · {config.minutes}분 집중 연습</h2>{paperPicker}
                  <div className="intro-facts">
                    <div>
                      <strong>
                        {config.count}<small>문항</small>
                      </strong>
                      <span>객관식 5지선다</span>
                    </div>
                    <div>
                      <strong>
                        {config.minutes}<small>분</small>
                      </strong>
                      <span>종료 시 자동 제출</span>
                    </div>
                    <div>
                      <strong>
                        60<small>점</small>
                      </strong>
                      <span>평균 60점 · 과목 40점 이상</span>
                    </div>
                  </div>
                  <p>
                    {config.subjects.map((subject,i) => `${subject} ${config.quotas[i]}문항`).join(" · ")}을 무작위로 출제합니다.
                    <br />
                    시험 중에는 정답과 해설을 공개하지 않습니다.
                  </p>

                  <Button onClick={beginExam} disabled={!poolAvailable}>
                    <Play size={18} /> 모의시험 시작하기
                  </Button>
                  {!poolAvailable && (
                    <p className="error-text">
                      선택한 교시의 과목별 검수 문항이 부족합니다.
                    </p>
                  )}
                </section>
              </>
            ))}
          {view === "practice" && (
            <>
              <PageTitle
                eyebrow="한 문제씩, 확실하게"
                title="랜덤 문제풀이"
                description="한 문제씩 이해하고, 해설로 확실하게 내 것으로 만드세요."
              />
              {p && practiceQuestion && p.version === state.version ? (
                <>
                  <div className="practice-toolbar">
                    <span className="tag">
                      {p.poolIds ? "선택 문항 복습" : `${p.subject} 과목`}
                    </span>
                    <span>
                      연속 정답 <b>{p.streak}</b>
                    </span>
                    <span>
                      이번 학습 정답률{" "}
                      <b>
                        {p.answered
                          ? Math.round((p.correct / p.answered) * 100)
                          : 0}
                        %
                      </b>{" "}
                      <small>
                        ({p.correct}/{p.answered})
                      </small>
                    </span>
                    <label className="sr-only" htmlFor="practice-filter">
                      연습 과목 변경
                    </label>
                    <select
                      id="practice-filter"
                      value={p.subject}
                      onChange={(e) =>
                        beginPractice(e.target.value as Subject | "전체")
                      }
                    >
                      {["전체", ...SUBJECTS].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <section className="panel question-panel practice-question">
                    {questionTop(practiceQuestion)}
                    <Source q={practiceQuestion} />
                    <h2
                      className="question-stem"
                      ref={questionRef}
                      tabIndex={-1}
                    >
                      {practiceQuestion.question}
                    </h2>
                    <Choices
                      q={practiceQuestion}
                      selected={p.selected}
                      revealed={p.revealed}
                      onChoose={selectPractice}
                    />
                    {p.revealed && (
                      <>
                        <div
                          role="status"
                          className={`answer-feedback ${p.selected === practiceQuestion.answer ? "good" : "bad"}`}
                        >
                          {p.selected === practiceQuestion.answer ? (
                            <CheckCircle2 size={20} />
                          ) : (
                            <XCircle size={20} />
                          )}{" "}
                          {p.selected === practiceQuestion.answer
                            ? "정답입니다! 잘하고 있어요."
                            : `아쉬워요. 정답은 ${practiceQuestion.answer}번입니다.`}
                        </div>
                        <Explanation
                          q={practiceQuestion}
                          selected={p.selected ?? undefined}
                        />
                      </>
                    )}
                    <div className="question-controls">
                      <span className="muted small">
                        답안을 선택하면 즉시 채점됩니다.
                      </span>
                      <Button
                        onClick={() => advancePractice()}
                        shortcut="Space"
                      >
                        다음 문제 <ArrowRight size={17} />
                      </Button>
                    </div>
                    <p className="muted small">
                      채점 후 <kbd>Space</kbd> 키로도 다음 문제로 이동할 수
                      있습니다.
                    </p>
                  </section>
                </>
              ) : (
                <section className="panel intro-panel">
                  <span className="big-icon">
                    <Zap size={38} />
                  </span>
                  <h2>어떤 과목을 공부할까요?</h2>
                  <div className="subject-picker large">
                    {(["전체", ...SUBJECTS] as const).map((s) => (
                      <button
                        key={s}
                        className={practiceSubject === s ? "picked" : ""}
                        onClick={() => setPracticeSubject(s)}
                      >
                        {s === "전체" ? "전체 과목" : s}
                      </button>
                    ))}
                  </div>
                  <p>
                    문제를 풀면 즉시 정답과 해설을 확인할 수 있습니다.
                    <br />한 바퀴를 모두 풀기 전에는 같은 문항을 다시 출제하지
                    않습니다.
                  </p>
                  <Button
                    onClick={() => beginPractice()}
                    disabled={!available.length}
                  >
                    문제풀이 시작 <ArrowRight size={17} />
                  </Button>
                </section>
              )}
            </>
          )}
          {view === "result" &&
            (result ? (
              <ResultView
                result={result}
                bookmarkButton={bookmarkButton}
                retry={() =>
                  beginPractice(
                    "전체",
                    result.questions
                      .filter((q) => result.answers[q.id] !== q.answer)
                      .map((q) => q.id),
                    result.version,
                  )
                }
              />
            ) : (
              <Empty title="아직 시험 결과가 없어요">
                모의시험을 완료하면 결과를 확인할 수 있습니다.
              </Empty>
            ))}
          {(view === "wrong" || view === "bookmarks") && (
            <>
              <PageTitle
                eyebrow={
                  view === "wrong"
                    ? "틀린 문제에서 배우는 시간"
                    : "다시 보고 싶은 문제"
                }
                title={view === "wrong" ? "오답노트" : "북마크"}
                description={
                  view === "wrong"
                    ? "다시 풀어 맞히면 오답노트에서 자동으로 빠집니다. 미응답 문제도 포함합니다."
                    : "중요한 개념을 모아두고 필요할 때 다시 살펴보세요."
                }
              />
              <QuestionCollection
                questions={bank.filter(
                  (q) =>
                    (view === "wrong"
                      ? state.wrongIds
                      : state.bookmarks
                    ).includes(q.id) && q.version === state.version,
                )}
                bookmarkButton={bookmarkButton}
                retry={(ids) => beginPractice("전체", ids)}
              />
            </>
          )}
          {view === "stats" && (
            <>
              <PageTitle
                eyebrow="기록으로 보는 나의 성장"
                title="학습 통계"
                description="모의시험과 랜덤 문제풀이 기록으로 학습의 방향을 찾아보세요."
              />
              <div className="notice">
                현재 브라우저 기준 기록입니다. 과목별 정답률은 반복 풀이를
                포함한 최근 5,000개 응답 기준이며, 시험 기록은 최근 30회까지
                보관합니다.
              </div>
              <SecondStageSummary results={state.results} />
              <div className="subject-stats">
                {SUBJECTS.map((subject, i) => {
                  const attempts = state.attempts.filter(
                    (a) => a.subject === subject,
                  );
                  const rate = attempts.length
                    ? Math.round(
                        (attempts.filter((a) => a.correct).length /
                          attempts.length) *
                          100,
                      )
                    : 0;
                  return (
                    <section className="panel subject-stat" key={subject}>
                      <span className={`tag subject-${i}`}>{subject}</span>
                      <strong>
                        {attempts.length ? rate : "—"}
                        <small>%</small>
                      </strong>
                      <div className="mini-progress">
                        <span style={{ width: `${rate}%` }} />
                      </div>
                      <p>
                        {attempts.length}문제 풀이 ·{" "}
                        {attempts.filter((a) => a.correct).length}문제 정답
                      </p>
                    </section>
                  );
                })}
              </div>
              {weak && (
                <div className="notice">
                  <Target size={18} />
                  현재 취약 과목은 <strong>{weak.subject}</strong>입니다. 정답률{" "}
                  {weak.rate}% · 풀이 수가 적으면 더 학습한 뒤 비교하세요.
                  <button
                    className="text-button"
                    onClick={() => beginPractice(weak.subject)}
                  >
                    복습하기 →
                  </button>
                </div>
              )}
              <section className="panel">
                <div className="panel-heading">
                  <h2>모의시험 점수 기록</h2>
                  <span className="muted small">
                    최근 {state.results.length}회
                  </span>
                </div>
                {state.results.length ? (
                  <div
                    className="score-chart"
                    aria-label="최근 모의시험 점수 그래프"
                  >
                    {state.results
                      .slice(0, 10)
                      .reverse()
                      .map((r, i) => (
                        <button
                          key={r.id}
                          onClick={() => {
                            setResultId(r.id);
                            navigate("result");
                          }}
                          aria-label={`${new Date(r.submittedAt).toLocaleDateString("ko-KR")} ${grade(r).score}점`}
                        >
                          <strong>{grade(r).score}</strong>
                          <span
                            style={{
                              height: `${Math.max(2, grade(r).score * 1.4)}px`,
                            }}
                          />
                          <small>{i + 1}회</small>
                        </button>
                      ))}
                  </div>
                ) : (
                  <Empty title="기록이 쌓이면 성장이 보여요">
                    첫 모의시험을 시작해 보세요.
                  </Empty>
                )}
                {state.results.length > 0 && (
                  <div className="history-list">
                    {state.results.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setResultId(r.id);
                          navigate("result");
                        }}
                      >
                        <ClipboardList size={19} />
                        <span>
                          {new Date(r.submittedAt).toLocaleString("ko-KR")}
                          <small>
                            {VERSION_LABEL[r.version]} ·{" "}
                            {r.reason === "timeout" ? "시간 종료" : "직접 제출"}
                          </small>
                        </span>
                        <b>{grade(r).score}점</b>
                        <span className="tag">
                          {grade(r).verdict}
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
          {view === "bank" && (
            <BankManager
              bank={bank}
              version={state.version}
              notify={notify}
              onImport={(questions) =>
                setState((s) => ({
                  ...s,
                  imported: [...s.imported, ...questions],
                }))
              }
              onApprove={(question) =>
                setState((s) => ({
                  ...s,
                  imported: s.imported.map((q) =>
                    q.id === question.id ? question : q,
                  ),
                }))
              }
            />
          )}
          <footer>
            <span>
              <Zap size={13} /> 공인중개사 필기 CBT
            </span>
            <span>
              나의 속도로, 꾸준하게. <span className="footer-dot">·</span>{" "}
              비공식 학습용 · 기록은 이 기기에 저장됩니다.
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {toast}
          <button aria-label="알림 닫기" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <ConfirmDialog
          title={
            modal === "submit"
              ? "시험을 제출할까요?"
              : "학습 데이터를 초기화할까요?"
          }
          onCancel={() => setModal(null)}
          onConfirm={() => {
            if (modal === "submit") finish();
            else {
              try {
                localStorage.removeItem(STORAGE_KEY);
              } catch {
                /* reset memory even if storage is unavailable */
              }
              setState(emptyStore());
              setCanPersist(true);
              setStorageError("");
              setExamIndex(0);
              setResultId(null);
              setModal(null);
              navigate("home");
              notify("학습 데이터와 가져온 문항을 초기화했습니다.");
            }
          }}
          confirmText={
            modal === "submit" ? "제출하고 결과 보기" : "모든 데이터 초기화"
          }
        >
          {modal === "submit"
            ? `아직 응답하지 않은 문제가 ${state.exam ? examCount - Object.keys(state.exam.answers).length : 0}개입니다. 미응답은 오답으로 처리하며, 제출 후에는 답안을 변경할 수 없습니다.`
            : `진행 중인 시험, 학습 기록, 오답노트, 북마크, 직접 가져온 문항이 삭제됩니다. 기본 ${BASE_BANK.length}문항은 유지됩니다. 필요한 기록을 먼저 백업하세요.`}
        </ConfirmDialog>
      )}
    </div>
  );
}
function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </div>
  );
}
function ConfirmDialog({
  title,
  children,
  onCancel,
  onConfirm,
  confirmText,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  confirmText: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      <p>{children}</p>
      <div className="dialog-actions">
        <Button secondary onClick={onCancel}>
          돌아가기
        </Button>
        <Button onClick={onConfirm}>{confirmText}</Button>
      </div>
    </dialog>
  );
}
function ResultView({
  result,
  bookmarkButton,
  retry,
}: {
  result: Result;
  bookmarkButton: (q: Question) => ReactNode;
  retry: () => void;
}) {
  const score = grade(result);
  const [onlyWrong, setOnlyWrong] = useState(false);
  return (
    <>
      <PageTitle
        eyebrow="나의 실력 점검"
        title="모의시험 결과"
        description={`${new Date(result.submittedAt).toLocaleString("ko-KR")} · ${VERSION_LABEL[result.version]} · ${result.reason === "timeout" ? "시간 종료 자동 제출" : "제출 완료"}`}
      />
      <section className={`panel result-hero ${score.passed ? "passed" : ""}`}>
        <span className="result-medal">
          {score.passed ? <Trophy size={37} /> : <GraduationCap size={37} />}
        </span>
        <span className="tag">{score.verdict}</span>
        <h2>
          {result.paper !== "first" ? "2차 합격 판정은 두 교시 결과를 함께 확인하세요." : score.passed ? "합격 기준을 달성했어요!" : "다음 도전을 위한 한 걸음이에요."}
        </h2>
        <strong className="result-score">
          {score.score}
          <small>점 / 100점</small>
        </strong>
        <p>
          정답 <b>{score.correct}</b> · 오답 <b>{score.wrong}</b>{" "}
          <span className="muted">(미응답 {score.unanswered} 포함)</span>
        </p>
        <div className="result-subjects">
          {score.subjects.map((s) => (
            <div key={s.subject}>
              <span>{s.subject}</span>
              <b>{s.rate}%</b>
              <small>
                {s.correct}/{s.total} 정답
              </small>
            </div>
          ))}
        </div>
        <Button onClick={retry} disabled={!score.wrong}>
          <RotateCcw size={17} /> 이 시험 오답만 다시 풀기
        </Button>
      </section>
      <div className="panel-heading review-heading">
        <h2>정답과 해설</h2>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={onlyWrong}
            onChange={(e) => setOnlyWrong(e.target.checked)}
          />{" "}
          오답만 보기
        </label>
      </div>
      {result.questions.map(
        (q, i) =>
          (!onlyWrong || result.answers[q.id] !== q.answer) && (
            <section className="panel review-card" key={q.id}>
              <div className="question-top">
                <span
                  className={`tag ${result.answers[q.id] === q.answer ? "pass-tag" : "wrong-tag"}`}
                >
                  {i + 1}번 ·{" "}
                  {result.answers[q.id] === q.answer ? "정답" : "오답"}
                </span>
                <span className="topic">
                  {q.subject} · {q.topic}
                </span>
                {bookmarkButton(q)}
              </div>
              <h3>{q.question}</h3>
              <p>
                내 답안:{" "}
                {result.answers[q.id]
                  ? `${result.answers[q.id]}번 · ${q.choices[result.answers[q.id] - 1]}`
                  : "미응답"}
              </p>
              <Choices
                q={q}
                selected={result.answers[q.id]}
                revealed
                onChoose={() => {}}
              />
              <Explanation q={q} selected={result.answers[q.id]} />
            </section>
          ),
      )}
    </>
  );
}
function QuestionCollection({
  questions,
  bookmarkButton,
  retry,
}: {
  questions: Question[];
  bookmarkButton: (q: Question) => ReactNode;
  retry: (ids: string[]) => void;
}) {
  const [subject, setSubject] = useState("전체");
  const [page, setPage] = useState(1);
  const list = questions.filter(
    (q) => subject === "전체" || q.subject === subject,
  );
  return (
    <>
      <div className="collection-toolbar">
        <div className="subject-picker">
          {["전체", ...SUBJECTS].map((s) => (
            <button
              key={s}
              className={subject === s ? "picked" : ""}
              onClick={() => {
                setSubject(s);
                setPage(1);
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <Button
          onClick={() => retry(list.map((q) => q.id))}
          disabled={!list.length}
        >
          <Play size={16} /> {list.length}문제 다시 풀기
        </Button>
      </div>
      {list.length ? (
        list.slice((page - 1) * 20, page * 20).map((q) => (
          <section key={q.id} className="panel review-card">
            <div className="question-top">
              <span className="tag">{q.subject}</span>
              <span className="topic">{q.topic}</span>
              {bookmarkButton(q)}
            </div>
            <h3>{q.question}</h3>
            <details>
              <summary>정답과 해설 보기</summary>
              <Explanation q={q} />
            </details>
          </section>
        ))
      ) : (
        <section className="panel">
          <Empty title="아직 모아둔 문제가 없어요">
            학습 중 틀린 문제와 북마크한 문제를 여기서 복습할 수 있습니다.
          </Empty>
        </section>
      )}
      {list.length > 20 && (
        <Pagination
          page={page}
          pages={Math.ceil(list.length / 20)}
          onChange={setPage}
        />
      )}
    </>
  );
}
function Pagination({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="pagination">
      <Button secondary disabled={page <= 1} onClick={() => onChange(page - 1)}>
        <ArrowLeft size={16} /> 이전
      </Button>
      <span>
        {page} / {pages}
      </span>
      <Button
        secondary
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
      >
        다음 <ArrowRight size={16} />
      </Button>
    </div>
  );
}
function BankManager({
  bank,
  version,
  notify,
  onImport,
  onApprove,
}: {
  bank: Question[];
  version: Version;
  notify: (s: string) => void;
  onImport: (q: Question[]) => void;
  onApprove: (q: Question) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("전체");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [review, setReview] = useState<Question | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const list = bank.filter(
    (q) =>
      q.version === version &&
      (filter === "전체" || q.verificationStatus === filter) &&
      `${q.question} ${q.topic} ${q.subject} ${q.id}`.includes(query),
  );
  const importFile = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      if (file.size > 8 * 1024 * 1024)
        throw new Error("파일은 8MB 이하여야 합니다.");
      const text = await file.text();
      const values = file.name.toLowerCase().endsWith(".csv")
        ? parseCsv(text)
        : JSON.parse(text);
      const { added, duplicates } = importQuestions(values, bank);
      onImport(added);
      notify(
        `${added.length}문항을 검증 대기로 등록했습니다. 중복 ${duplicates}문항은 제외했습니다.`,
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const approve = () => {
    if (!review || !confirmed || !reviewNote.trim()) return;
    try {
      const q = validateQuestion({
        ...review,
        verificationStatus: "reviewed",
        reviewNote: `사용자 로컬 검수: ${reviewNote.trim()}`,
      });
      onApprove(q);
      setReview(null);
      setConfirmed(false);
      setReviewNote("");
      notify(
        "이 브라우저에서 검수 완료로 변경했습니다. 외부 검증을 뜻하지 않습니다.",
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="출처부터 확인하는 학습 자료"
        title="문제은행 관리"
        description="문항과 출처를 투명하게 관리하고 JSON·CSV로 확장하세요."
      />
      <details className="panel source-details"><summary>시험 규칙·문제 출처·검수 범위</summary>
        <ShieldCheck size={19} />
        <div>
          <strong>
            기본 문항은 {BASE_BANK.length}개 모두 자체 제작입니다.
          </strong>
          <br />
          원문 기출 0 · 복원문제 0. 공식 자료 접근 제한으로 기출 원문 및
          출제기준 대조는 완료하지 못했습니다. 기본 문항은 내부 검토 및 계산
          검증을 거쳤으며 외부 전문가 검수는 받지 않았습니다.
        </div>
        <p>목표 1,000개, 실제 등록·내부 검수 1,000개, 부족 0개. 부동산학개론 200개, 민법 200개, 중개사법령·실무 150개, 공법 150개, 공시법 150개, 세법 150개. 계산 조건 변형 960개(40 family), 기본 개념형 40개. 계산식이 유사한 family도 있으므로 1,000개 독립 개념을 뜻하지 않습니다. 법령 최신성·전문가 검수·공식 규칙 확인 대기입니다. 법령 관련 계산 문항은 실제 법정 수치 대신 명시적 가정만 사용합니다. 실제 출제범위 전체를 다룬 은행이 아닙니다. 1차 80문항·100분, 2차 1교시 80문항·100분, 2교시 40문항·50분, 5지선다, 과목 40점·평균 60점은 현재 학습용 설정이며 공식 원문 재확인 대기입니다.</p>
        <a href="https://www.q-net.or.kr/crf005.do?id=crf00503&jmCd=9630" target="_blank" rel="noreferrer">Q-Net 공식 시험정보</a>
      </details>
      <div className="bank-tools panel">
        <div>
          <h2>
            <Upload size={20} /> 문제 일괄 등록
          </h2>
          <p>
            가져온 문항은 모두 검증 대기로 저장됩니다. 출처·권한·정답을 확인한
            문항만 학습에 사용하세요.
          </p>
        </div>
        <div className="import-actions">
          <label className="btn">
            <Plus size={17} /> JSON / CSV 가져오기
            <input
              aria-label="문제 파일 가져오기"
              type="file"
              accept=".json,.csv"
              onChange={(e) => {
                void importFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <a
            className="btn secondary"
            href={`${import.meta.env.BASE_URL}templates/questions.csv`}
            download
          >
            CSV 양식
          </a>
          <a
            className="btn secondary"
            href={`${import.meta.env.BASE_URL}templates/questions.json`}
            download
          >
            JSON 양식
          </a>
          <Button
            secondary
            onClick={() =>
              download("questions.json", JSON.stringify(bank, null, 2))
            }
          >
            <ArrowDownToLine size={16} /> 전체 문항 내보내기
          </Button>
        </div>
        {error && (
          <div role="alert" className="error-text">
            {error}
          </div>
        )}
      </div>
      <div className="bank-filter">
        <label>
          <span className="sr-only">문항 검색</span>
          <input
            type="search"
            aria-label="문항 검색"
            placeholder="문제, 과목, 단원, ID 검색"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label>
          <span className="sr-only">검증 상태</span>
          <select
            aria-label="검증 상태"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(1);
            }}
          >
            <option value="전체">전체 상태</option>
            <option value="reviewed">검수 완료</option>
            <option value="pending">검증 대기</option>
          </select>
        </label>
        <span>
          {VERSION_LABEL[version]} · {list.length}문항
        </span>
      </div>
      <div className="panel bank-list">
        {list.slice((page - 1) * 20, page * 20).map((q) => (
          <details key={q.id} className="bank-row">
            <summary>
              <span className={`tag subject-${SUBJECTS.indexOf(q.subject)}`}>
                {q.subject}
              </span>
              <span>
                {q.question}
                <small>
                  {q.id} · {q.topic} · {TYPE_LABEL[q.type]} ·{" "}
                  {q.verificationStatus === "reviewed"
                    ? "내부 검수 완료"
                    : "검증 대기"}
                </small>
              </span>
              <ChevronRight size={17} />
            </summary>
            <Explanation q={q} />
            <p className="muted small">이용 권한: {q.rights}</p>
            {q.verificationStatus === "pending" && (
              <Button
                secondary
                onClick={() => {
                  setReview(q);
                  setConfirmed(false);
                  setReviewNote("");
                }}
              >
                검수 내용 확인 및 승인
              </Button>
            )}
          </details>
        ))}
        {!list.length && (
          <Empty title="해당하는 문항이 없습니다">
            검색 조건을 확인하세요.
          </Empty>
        )}
      </div>
      {list.length > 20 && (
        <Pagination
          page={page}
          pages={Math.ceil(list.length / 20)}
          onChange={setPage}
        />
      )}
      {review && (
        <div className="review-form panel">
          <h2>문항 검수 · {review.id}</h2>
          <p>{review.question}</p>
          <Explanation q={review} />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />{" "}
            출처 원문, 이용 권한, 정답·풀이, 출제 연도·회차(해당 시)를 직접
            확인했습니다.
          </label>
          <label>
            검수 근거
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="확인한 자료와 계산 검증 내용을 기록하세요."
              maxLength={2000}
            />
          </label>
          <div className="dialog-actions">
            <Button secondary onClick={() => setReview(null)}>
              취소
            </Button>
            <Button
              disabled={!confirmed || !reviewNote.trim()}
              onClick={approve}
            >
              검수 완료로 처리
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
export default App;

function SecondStageSummary({ results }: { results: Result[] }) {
 const a = results.filter(r => r.paper === "second-a"), b = results.filter(r => r.paper === "second-b");
 const [aId, setA] = useState(a[0]?.id ?? ""), [bId, setB] = useState(b[0]?.id ?? "");
 const first = a.find(r => r.id === aId), second = b.find(r => r.id === bId);
 const score = first && second ? gradeSecondStage(first, second) : null;
 return <section className="panel"><h2>2차 종합 결과</h2><p>같이 평가할 두 교시 기록을 선택하세요. 공시법·세법은 합산 한 과목으로 과락을 판정합니다.</p>
 {([["2차 1교시 기록", a, aId, setA], ["2차 2교시 기록", b, bId, setB]] as const).map(([label, items, value, setter]) => <label className="paper-picker" key={label}>{label}<select aria-label={label} value={value} onChange={e => setter(e.target.value)}><option value="">기록 선택</option>{items.map(r => <option key={r.id} value={r.id}>{new Date(r.submittedAt).toLocaleString("ko-KR")} · {grade(r).score}점</option>)}</select></label>)}
 {score ? <div aria-label="2차 종합 판정"><strong>{score.passed ? "합격" : "불합격"} · 평균 {score.score}점</strong>{score.subjects.map(s => <p key={s.subject}>{s.subject}: {s.correct}/{s.total} · {s.rate}점</p>)}</div> : <p>두 교시 기록을 선택하면 평균 60점·각 과목 40점 기준으로 판정합니다.</p>}
 </section>;
}
