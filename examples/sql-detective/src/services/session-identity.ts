const TEMP_PLAYER_ID_STORAGE_KEY = "sql-detective:temporary-player-id";
export const TEMP_CARD_ID = "card_01";

export function getTemporaryPlayerId(): string {
  try {
    const existingId = localStorage.getItem(TEMP_PLAYER_ID_STORAGE_KEY);
    if (existingId) return existingId;

    const generatedId = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? `user-${crypto.randomUUID()}`
      : `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(TEMP_PLAYER_ID_STORAGE_KEY, generatedId);
    return generatedId;
  } catch {
    return "user-temporario";
  }
}

