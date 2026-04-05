import type { HourlyEvaluation, Verdict } from "../types";

export function currentHourVerdict(evals: HourlyEvaluation[]): Verdict {
  if (!evals.length) return "NO-GO";

  const now = new Date();
  const currentHour = now.getHours();
  const todayStr = now.toISOString().split("T")[0];

  const currentEval = evals.find((e) => {
    const [date, time] = e.weather.time.split("T");
    const hour = parseInt(time.split(":")[0], 10);
    return date === todayStr && hour === currentHour;
  });
  if (currentEval) return currentEval.evaluation.verdict;

  const nextEval = evals.find((e) => {
    const [date, time] = e.weather.time.split("T");
    const hour = parseInt(time.split(":")[0], 10);
    return date === todayStr && hour > currentHour;
  });
  if (nextEval) return nextEval.evaluation.verdict;

  if (evals.some((e) => e.evaluation.verdict === "GO")) return "GO";
  if (evals.some((e) => e.evaluation.verdict === "MARGINAL")) return "MARGINAL";
  return "NO-GO";
}

export function currentHourLabel(evals: HourlyEvaluation[]): string | null {
  if (!evals.length) return null;
  const now = new Date();
  const currentHour = now.getHours();
  const todayStr = now.toISOString().split("T")[0];

  const match = evals.find((e) => {
    const [date, time] = e.weather.time.split("T");
    const hour = parseInt(time.split(":")[0], 10);
    return date === todayStr && hour === currentHour;
  });
  if (match) return `${currentHour}h`;

  const next = evals.find((e) => {
    const [date, time] = e.weather.time.split("T");
    const hour = parseInt(time.split(":")[0], 10);
    return date === todayStr && hour > currentHour;
  });
  if (next) {
    const h = parseInt(next.weather.time.split("T")[1].split(":")[0], 10);
    return `${h}h`;
  }

  return null;
}

export function formatAge(timestampSeconds: number): {
  label: string;
  isStale: boolean;
} {
  const ageSeconds = Math.floor(Date.now() / 1000 - timestampSeconds);
  const ageMin = Math.floor(ageSeconds / 60);
  const label =
    ageMin < 1
      ? "< 1 min"
      : ageMin < 60
        ? `${ageMin} min`
        : `${Math.floor(ageMin / 60)}h${ageMin % 60}`;
  return { label, isStale: ageMin > 30 };
}

export function goCountToday(evals: HourlyEvaluation[]): number {
  const todayStr = new Date().toISOString().split("T")[0];
  return evals.filter(
    (e) => e.weather.time.startsWith(todayStr) && e.evaluation.verdict === "GO"
  ).length;
}
