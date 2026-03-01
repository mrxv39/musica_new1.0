/**
 * C:\Users\Usuario\Desktop\proyectos\poker_boss\src\pages\strategy\db\queries.ts
 *
 * SQL queries/helpers for strategy DB boundary.
 */

export const SQL = {
  countSubsForSituationKey:
    "SELECT COUNT(*) as n\n" +
    "FROM sub_strategies ss\n" +
    "JOIN situations s ON s.id = ss.situation_id\n" +
    "WHERE s.key = ?1;",
  selectSituationIdByKey: "SELECT id FROM situations WHERE key = ?1 LIMIT 1;",
  updateSituationKey: "UPDATE situations SET key = ?1, updated_at = datetime('now') WHERE key = ?2;",
  deleteSituationByKey: "DELETE FROM situations WHERE key = ?1;",
} as const;
