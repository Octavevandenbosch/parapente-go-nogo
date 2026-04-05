import type { Site, Verdict, HourlyEvaluation } from "../types";

interface SiteListProps {
  sites: Site[];
  siteVerdicts: Map<string, Verdict>;
  siteEvals: Map<string, HourlyEvaluation[]>;
  selectedSite: Site | null;
  onSelectSite: (site: Site) => void;
}

function siteKey(s: Site) {
  return `${s.latitude}-${s.longitude}-${s.name}`;
}

function currentHourLabel(evals: HourlyEvaluation[]): string | null {
  if (!evals.length) return null;
  const now = new Date();
  const currentHour = now.getHours();
  const todayStr = now.toISOString().split("T")[0];

  const match = evals.find((e) => {
    const [date, time] = e.weather.time.split("T");
    const hour = parseInt(time.split(":")[0], 10);
    return date === todayStr && hour === currentHour;
  });

  if (match) {
    return `${currentHour}h`;
  }

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

function goCountToday(evals: HourlyEvaluation[]): number {
  const todayStr = new Date().toISOString().split("T")[0];
  return evals.filter(
    (e) => e.weather.time.startsWith(todayStr) && e.evaluation.verdict === "GO"
  ).length;
}

export function SiteList({
  sites,
  siteVerdicts,
  siteEvals,
  selectedSite,
  onSelectSite,
}: SiteListProps) {
  const sorted = [...sites].sort((a, b) => {
    const va = siteVerdicts.get(siteKey(a)) ?? "NO-GO";
    const vb = siteVerdicts.get(siteKey(b)) ?? "NO-GO";
    const order: Record<string, number> = { GO: 0, MARGINAL: 1, "NO-GO": 2 };
    return (order[va] ?? 3) - (order[vb] ?? 3);
  });

  return (
    <div className="site-list">
      {sorted.map((site) => {
        const key = siteKey(site);
        const verdict = siteVerdicts.get(key);
        const evals = siteEvals.get(key) ?? [];
        const isSelected = selectedSite?.name === site.name;
        const cls =
          verdict === "GO"
            ? "site-card-go"
            : verdict === "MARGINAL"
              ? "site-card-marginal"
              : "site-card-nogo";

        const hourLabel = currentHourLabel(evals);
        const goSlots = goCountToday(evals);

        return (
          <button
            key={key}
            className={`site-card ${cls} ${isSelected ? "selected" : ""}`}
            onClick={() => onSelectSite(site)}
          >
            <div>
              <div className="site-card-name">{site.name}</div>
              <div className="site-card-sub">
                {site.altitude && <span>{site.altitude}m</span>}
                <span className={`source-pill ${site.source === "FFVL / SpotAir" ? "source-ffvl" : "source-pge"}`}>
                  {site.source === "FFVL / SpotAir" ? "FFVL" : "PGE"}
                </span>
                {goSlots > 0 && verdict !== "GO" && (
                  <span className="go-slots-hint">{goSlots} GO auj.</span>
                )}
              </div>
            </div>
            <div className="site-card-verdict">
              <span
                className={`mini-badge ${verdict === "GO" ? "badge-go" : verdict === "MARGINAL" ? "badge-marginal" : "badge-nogo"}`}
              >
                {verdict === "GO" ? "✓" : verdict === "MARGINAL" ? "⚠" : "✗"}{" "}
                {verdict}
              </span>
              {hourLabel && <span className="verdict-hour">à {hourLabel}</span>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
