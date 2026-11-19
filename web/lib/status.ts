import type { Market } from "@/lib/api";

export type BookStatus = "Empty" | "Runs out" | "OK";

export function bookStatus(m: Pick<Market, "status" | "score">): BookStatus {
  if (m.status) return m.status;
  if (m.score.mid_c == null) return "Empty";
  if (m.score.exhausted) return "Runs out";
  return "OK";
}

export function statusMeaning(status: BookStatus): string {
  if (status === "Empty") return "No buy and sell quote, so this percent is not a real price.";
  if (status === "Runs out") return "The visible orders run out before the odds can move 10¢.";
  return "There are enough visible orders to move the odds by 10¢.";
}
