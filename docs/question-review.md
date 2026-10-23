# 문항 검토 기록

2026-10-23 작성. 원고: `scripts/generate-bank.py`, 실제 배포용 기본 JSON: `src/data/questions-main.json`.

## provenance와 이용 조건

전 문항은 이 작업에서 자체 작성한 한국어 원고다. 생성형 모델의 일반 지식과 문제 안에 직접 제시한 수학적 가정에서 작성했다. 외부 기출·민간 사이트·읽지 않은 교재를 가져오거나 인용하지 않았다. 기출·복원은 각각 0, 연도·회차는 전부 null이다. 작성 위치를 가리키는 GitHub URL은 외부의 정답 증빙이 아니다. 신규 원고 CC BY 4.0, 표시 주체 Licensed-Real-Estate-Agent-CBT contributors. 원본 electrician 코드 MIT 고지는 LICENSE에 유지한다.

Q-Net 공식 페이지는 프록시 CONNECT 403으로 본문을 받지 못했다. 공식 시험 규칙·최신 법령·원문 문제의 배포 조건을 검증 완료로 표기하지 않는다. 법정 세율·중개보수 상한 등을 추정하여 진짜 법령처럼 출제하지 않는다. 법률 관련 계산 문제에는 조건을 명시하고 그 조건의 법적 유효성·현행 한도는 판단 대상에서 제외했다. 공법의 건폐율·용적률 등은 문제에서 이미 산정 대상으로 제공한 면적만 사용한다.

## 수량과 중복

기본 JSON 1,000, 전부 자체 제작·내부 검수, 검증 대기 0, 제외 후 부족 0. 개념형 40 + 계산 조건 변형 960이다. 사용자 로컬 등록은 기본 집계에 포함하지 않는다.

- ID 중복 0.
- NFKC·공백 제거·소문자화한 본문과 정렬된 보기의 지문 중복 0. 보기 순서만 바꾼 가져오기도 중복 제거한다.
- 의미상 같은 풀이 틀을 쓰는 수치 변형은 아래 family로 명시한다. 서로 다른 family에 차감·비례 같은 공통 연산이 있다. 이들은 **독립 개념 1,000개가 아니며** 과목을 달리한 동일 공식이 포함된다.
- 기존 민법 개념 ID `REA-C-001`~`040`을 보존했다. 생성 순서와 조건은 고정이며 무작위 생성으로 수량을 바꾸지 않는다.

| 영역 | family (생성 코드의 kind) | family별 조건 수 | 합계 |
| --- | --- | ---: | ---: |
| 학개론 | capitalization, ltv, unit-price, gross-rent, depreciation, effective-income, noi, equilibrium | 25 | 200 |
| 민법 | civil-share, civil-expense, civil-arrears, civil-deposit, civil-damages, civil-balance, civil-interest, civil-offset | 20 | 160 |
| 중개 실무 | broker-fee, broker-split, broker-net, broker-balance, broker-negotiation, broker-quarter-rent | 25 | 150 |
| 공법 면적 수리 | public-coverage, public-far, public-footprint, public-floor, public-remaining, public-land-deduction | 25 | 150 |
| 공시 면적 수리 | registry-distance, registry-map-area, registry-division, registry-merger, registry-share-area, registry-rectangle | 25 | 150 |
| 세법 가정 수리 | tax-proportional, tax-deduction, tax-credit, tax-gain, tax-installment, tax-progressive | 25 | 150 |

40 family 합계 960개 외에 민법 기초 개념 40개를 등록했다. 민법의 계약별 성질·능력·대리·물권·채권 등 기본 설명을 내부적으로 읽고 정답 및 다른 네 보기를 검토했다. 특정 판례 번호나 최신 개정 수치를 만들어 붙이지 않았다. 민사특별법, 거래신고, 도시계획 제도, 등기 절차, 세목별 실제 세율·감면 등을 포괄하는 종합 은행은 아니다.

## 수행한 검수와 한계

1. **계산**: Python 원고의 계산과 별도로 TypeScript 단위 테스트의 재배열한 검증식으로 960조건의 결과를 재계산한다. 균형가격은 수요·공급 양쪽 대입도 확인한다. 면적은 축척 제곱, cm→m 및 ㎠→㎡를 구별한다. 정답 위치·수치상 동치 보기·단위를 함께 검사한다.
2. **반올림**: 기본 계산형은 Fraction 정수 조건만 채택하여 정답은 정확한 정수다. 임의 반올림이나 정답 맞추기용 오차를 허용하지 않는다. 합격 채점은 표시 반올림 전 값을 사용한다.
3. **문장**: 각 family의 조건·공식·단위·대입과 개념형 40개의 설명을 내부적으로 검토했다. 생성된 조건에는 비율의 가정임을 문항/해설에 표시한다. 오답은 정답과 다른 네 수이며 난이도는 하로 표시했다. 고난도 판단·판례 비교를 제공한다고 주장하지 않는다.
4. **재현성**: 원고 재실행 전후 JSON 바이트 동일성을 테스트한다. 5지선다·출처·이용권한·검수 메타데이터도 검증한다.
5. **미완료**: 외부 전문가의 독립 문장 검수, 공식 출제기준 대조, 법령 최신성 확인, 실제 시험 난이도/분포 검증, 실기기 브라우저 확인. 내부 검수 완료는 이 범위를 넘어서지 않는다.

정확한 1,000개 등록 목표는 충족했지만 위 과목별 내용 범위·기출·법령 검증 한계는 남는다. 이후 실제 법령·개념형 문항을 확보해도 기존 ID와 풀이 참조를 보존하고, 신규 문항 검증과 중복 제거를 다시 수행해야 한다.
