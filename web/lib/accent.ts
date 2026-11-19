export function categoryAccent(category: string | null | undefined): { stroke: string; wash: string } {
  const c = (category ?? "").toLowerCase();
  if (c.includes("crypto")) return { stroke: "#f0a322", wash: "rgba(240,163,34,0.20)" };
  if (c.includes("politic")) return { stroke: "#6aa4ff", wash: "rgba(106,164,255,0.18)" };
  if (c.includes("econ")) return { stroke: "#3dce7a", wash: "rgba(61,206,122,0.16)" };
  if (c.includes("sport") || c.includes("football") || c.includes("basket")) return { stroke: "#ff7a3c", wash: "rgba(255,122,60,0.18)" };
  if (c.includes("commod") || c.includes("energy")) return { stroke: "#e0a15a", wash: "rgba(224,161,90,0.18)" };
  if (c.includes("weather")) return { stroke: "#7fd4ff", wash: "rgba(127,212,255,0.16)" };
  if (c.includes("tech") || c.includes("business")) return { stroke: "#b08cff", wash: "rgba(176,140,255,0.18)" };
  return { stroke: "#5ee0ff", wash: "rgba(94,224,255,0.14)" };
}
