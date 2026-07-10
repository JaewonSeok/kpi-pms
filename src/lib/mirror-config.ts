// orgKpiId → carrier personalKpiId 명시 매핑.
// 값은 seed(한상준 KPI 생성) 이후 실제 id로 채운다.
// 빈 맵일 때 mirror 달성률은 기록 0건과 동일 동작(UI: '-').
export const CARRIER_KPI_IDS: Record<string, string> = {}
