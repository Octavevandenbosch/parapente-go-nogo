import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function MapLegend() {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="map-legend">
      <button className="legend-toggle" onClick={() => setIsOpen(!isOpen)}>
        <span>Légende</span>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      {isOpen && (
        <div className="legend-content">
          <div className="legend-section">
            <div className="legend-title">Sites de vol</div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#22c55e" }} />
              <span>GO — conditions favorables</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#f59e0b" }} />
              <span>MARGINAL — prudence</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#ef4444" }} />
              <span>NO-GO — conditions défavorables</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ background: "#6b7280" }} />
              <span>En attente de données</span>
            </div>
          </div>
          <div className="legend-section">
            <div className="legend-title">Balises météo (temps réel)</div>
            <div className="legend-item">
              <span className="legend-balise" style={{ borderColor: "#22c55e", color: "#22c55e" }}>12</span>
              <span>≤ 15 km/h — calme</span>
            </div>
            <div className="legend-item">
              <span className="legend-balise" style={{ borderColor: "#f59e0b", color: "#f59e0b" }}>20</span>
              <span>≤ 25 km/h — modéré</span>
            </div>
            <div className="legend-item">
              <span className="legend-balise" style={{ borderColor: "#ef4444", color: "#ef4444" }}>35</span>
              <span>&gt; 25 km/h — fort</span>
            </div>
          </div>
          <div className="legend-section">
            <div className="legend-title">Sources</div>
            <div className="legend-source">
              <span className="source-tag source-ffvl">FFVL</span>
              Sites &amp; balises via SpotAir
            </div>
            <div className="legend-source">
              <span className="source-tag source-pge">PGE</span>
              ParaglidingEarth (CC BY-SA 3.0)
            </div>
            <div className="legend-source">
              <span className="source-tag source-meteo">MF</span>
              Météo-France AROME via Open-Meteo
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
