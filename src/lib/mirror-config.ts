// orgKpiId → carrier personalKpiId 명시 매핑.
// 캐리어: 한상준(cmpev9i04000x04jst5idpj33)의 '국내 영업 매출 달성 (본부 공통)'
// seed-mirror-kpi.ts 실행 결과 반영 (2026-07-10).
// 2026-07-13 기술지원본부 매출 캐리어 3종(국내영업 217억·유지보수 35억·중국법인 1.65억) 수동 추가.
export const CARRIER_KPI_IDS: Record<string, string> = {
  'cmr0ab87u000004jpeddn6nic': 'cmref3eig0000hguu6i76jm6e',
  'cmqeymsmx000004l149g0a7cw': '94237570-efb4-432c-86cc-72cab4fcb49e',  // 기술지원본부 국내영업 217억
  'cmqeyr6en000004l83u01cltl': '68b295d4-9079-4a47-ac15-f767c13dfbd2',  // 기술지원본부 유지보수(MA) 35억
  'cmqeyolgc000004jsjzsxk9ii': '4a1e0834-4add-4a28-9204-fe296b9aa691',  // 기술지원본부 중국법인 1.65억
}
