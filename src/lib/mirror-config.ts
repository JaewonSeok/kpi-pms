// orgKpiId → carrier personalKpiId 명시 매핑.
// 캐리어: 한상준(cmpev9i04000x04jst5idpj33)의 '국내 영업 매출 달성 (본부 공통)'
// seed-mirror-kpi.ts 실행 결과 반영 (2026-07-10).
// 2026-07-13 기술지원본부 매출 캐리어 3종(국내영업 217억·유지보수 35억·중국법인 1.65억) 수동 추가.
export const CARRIER_KPI_IDS: Record<string, string> = {
  'cmr0ab87u000004jpeddn6nic': 'cmref3eig0000hguu6i76jm6e',
  'cmqeymsmx000004l149g0a7cw': '94237570-efb4-432c-86cc-72cab4fcb49e',  // 기술지원본부 국내영업 217억
  'cmqeyr6en000004l83u01cltl': '68b295d4-9079-4a47-ac15-f767c13dfbd2',  // 기술지원본부 유지보수(MA) 35억
  'cmqeyolgc000004jsjzsxk9ii': '4a1e0834-4add-4a28-9204-fe296b9aa691',  // 기술지원본부 중국법인 1.65억
  // SaaS 트랙 캐리어 2종 (2026-07-16 추가) — 팀 앵커 방식, 캐리어: 남양원(cmpevaffq007x04jsc5maqvai)
  'cmqyypa9a000804jsqze36bw4': '6b54fb04-2387-4597-8394-7d81a99f434f',  // SaaS 갱신영업팀 49.12억
  'cmqyyvzs6000e04js1mwm6e86': '7473f27c-5fdf-4d9e-9246-10be18178157',  // SaaS 신규영업팀 22.88억
}
