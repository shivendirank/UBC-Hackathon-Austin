import { redirect } from "next/navigation";

/** Consistency UI removed — related-market checks live under Compare. */
export default function RelationsRedirect() {
  redirect("/compare");
}
