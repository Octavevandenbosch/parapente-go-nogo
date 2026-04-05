import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, X, Send, Settings, Loader } from "lucide-react";
import type { Site, HourlyEvaluation, Verdict, Balise, GeoLocation } from "../types";
import { siteKey } from "../utils/geo";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface JeanIAProps {
  location: GeoLocation | null;
  sites: Site[];
  siteEvals: Map<string, HourlyEvaluation[]>;
  siteVerdicts: Map<string, Verdict>;
  balises: Balise[];
}

const STORAGE_KEY = "jeania-api-key";
const MODEL = "gpt-4o-mini";

function buildContext(props: JeanIAProps): string {
  const { location, sites, siteEvals, siteVerdicts, balises } = props;

  if (!location || sites.length === 0) {
    return "Aucune recherche en cours. L'utilisateur n'a pas encore cherché de lieu.";
  }

  const lines: string[] = [];
  lines.push(`Lieu recherché : ${location.name}, ${location.country} (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`);
  lines.push(`${sites.length} site(s) de parapente trouvé(s), ${balises.length} balise(s) météo.`);
  lines.push("");

  for (const site of sites) {
    const key = siteKey(site);
    const verdict = siteVerdicts.get(key) ?? "?";
    const evals = siteEvals.get(key) ?? [];

    lines.push(`--- SITE: ${site.name} ---`);
    lines.push(`  Source: ${site.source}`);
    lines.push(`  Altitude: ${site.altitude ?? "?"}m`);
    lines.push(`  Verdict actuel: ${verdict}`);

    const goodOrients = Object.entries(site.orientations)
      .filter(([, v]) => v === 2)
      .map(([k]) => k);
    const okOrients = Object.entries(site.orientations)
      .filter(([, v]) => v === 1)
      .map(([k]) => k);
    if (goodOrients.length) lines.push(`  Orientations idéales: ${goodOrients.join(", ")}`);
    if (okOrients.length) lines.push(`  Orientations acceptables: ${okOrients.join(", ")}`);

    if (site.landing?.name) {
      lines.push(`  Atterrissage: ${site.landing.name} (${site.landing.altitude ?? "?"}m)`);
    }
    if (site.flight_rules) lines.push(`  Règles: ${site.flight_rules.slice(0, 200)}`);
    if (site.description) lines.push(`  Description: ${site.description.slice(0, 200)}`);

    const goSlots: string[] = [];
    const marginalSlots: string[] = [];
    const nogoSlots: string[] = [];

    for (const e of evals) {
      const time = e.weather.time.replace("T", " ").slice(0, 16);
      const w = e.weather;
      const info = `${time} — vent ${w.wind_speed}km/h ${e.evaluation.wind_compass}, rafales ${w.wind_gusts}km/h, pluie ${w.rain}mm, nuages ${w.cloud_cover}%, base ~${e.evaluation.cloud_base.toFixed(0)}m`;

      if (e.evaluation.verdict === "GO") goSlots.push(info);
      else if (e.evaluation.verdict === "MARGINAL") marginalSlots.push(info);
      else nogoSlots.push(info);
    }

    if (goSlots.length) {
      lines.push(`  Créneaux GO (${goSlots.length}):`);
      for (const s of goSlots.slice(0, 6)) lines.push(`    ✓ ${s}`);
    }
    if (marginalSlots.length) {
      lines.push(`  Créneaux MARGINAL (${marginalSlots.length}):`);
      for (const s of marginalSlots.slice(0, 4)) lines.push(`    ⚠ ${s}`);
    }
    if (nogoSlots.length) {
      lines.push(`  Créneaux NO-GO: ${nogoSlots.length}`);
    }
    lines.push("");
  }

  if (balises.length > 0) {
    lines.push("--- BALISES TEMPS RÉEL ---");
    for (const b of balises.slice(0, 10)) {
      const r = b.releves?.[0];
      if (!r) continue;
      const age = Math.floor((Date.now() / 1000 - r.date_releve) / 60);
      lines.push(
        `  ${b.nom} (${b.altitude}m) — ${r.vmoy} km/h moy, rafales ${r.vmax} km/h, dir ${r.direction}°${r.temperature != null ? `, ${r.temperature}°C` : ""} (il y a ${age} min)`
      );
    }
  }

  return lines.join("\n");
}

const SYSTEM_PROMPT = `Tu es Jean-IA, un assistant spécialisé en parapente intégré à l'application "Parapente Go/No-Go".

Tu as accès aux données actuellement affichées sur le site : sites de vol, prévisions météo horaires, verdicts Go/Marginal/No-Go, et mesures temps réel des balises.

Ton rôle :
- Répondre aux questions sur les conditions de vol actuelles et à venir
- Expliquer pourquoi un site est GO, MARGINAL ou NO-GO
- Conseiller sur le meilleur créneau et le meilleur site pour voler
- Expliquer les critères d'évaluation (vent, orientation, rafales, pluie, orages, visibilité, nuages)
- Comparer les sites entre eux
- Donner des conseils de sécurité en parapente

Critères Go/No-Go utilisés par l'app :
- Vent : 5-25 km/h idéal, >30 = NO-GO
- Direction : face au déco = GO, vent arrière = NO-GO
- Rafales : écart >15 km/h = NO-GO
- Pluie : toute pluie = NO-GO
- Orages : NO-GO
- Visibilité : <1.5 km = NO-GO
- Nuages : >85% = MARGINAL
- Base nuages : <300m AGL = MARGINAL

Réponds toujours en français, de manière concise et pratique. Si l'utilisateur n'a pas encore fait de recherche, invite-le à chercher un lieu d'abord.

IMPORTANT : rappelle toujours que tu es une aide à la décision et que rien ne remplace le jugement du pilote sur place.`;

export function JeanIA(props: JeanIAProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "");
  const [keyInput, setKeyInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const saveKey = useCallback(() => {
    const trimmed = keyInput.trim();
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
      setApiKey(trimmed);
      setKeyInput("");
      setShowSettings(false);
    }
  }, [keyInput]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    const userMsg: ChatMessage = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    const context = buildContext(props);

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "system",
              content: `Données actuelles du site :\n\n${context}`,
            },
            ...newMessages.map((m) => ({ role: m.role, content: m.content })),
          ],
          temperature: 0.7,
          max_tokens: 800,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => null);
        throw new Error(
          err?.error?.message ?? `Erreur API (${resp.status})`
        );
      }

      const data = await resp.json();
      const reply = data.choices?.[0]?.message?.content ?? "Pas de réponse.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Erreur : ${msg}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, messages, isLoading, apiKey, props]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {isOpen && (
        <div className="jeania-panel">
          <div className="jeania-header">
            <div className="jeania-title">
              <span className="jeania-avatar">🪂</span>
              <div>
                <strong>Jean-IA</strong>
                <span className="jeania-subtitle">Assistant parapente</span>
              </div>
            </div>
            <div className="jeania-header-actions">
              <button
                className="jeania-icon-btn"
                onClick={() => setShowSettings(!showSettings)}
                title="Paramètres API"
              >
                <Settings size={16} />
              </button>
              <button
                className="jeania-icon-btn"
                onClick={() => setIsOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="jeania-settings">
              <label>Clé API OpenAI :</label>
              <div className="jeania-key-row">
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder={apiKey ? "••••••••" : "sk-..."}
                  onKeyDown={(e) => e.key === "Enter" && saveKey()}
                />
                <button onClick={saveKey}>OK</button>
              </div>
              {apiKey && (
                <span className="jeania-key-status">Clé configurée</span>
              )}
            </div>
          )}

          <div className="jeania-messages">
            {messages.length === 0 && (
              <div className="jeania-welcome">
                <p>
                  Salut ! Je suis <strong>Jean-IA</strong>, ton assistant
                  parapente.
                </p>
                <p>
                  Pose-moi des questions sur les conditions de vol, les sites
                  affichés ou les prévisions météo.
                </p>
                <div className="jeania-suggestions">
                  {[
                    "Quel est le meilleur site pour voler ?",
                    "Pourquoi ce site est NO-GO ?",
                    "Quand sera le meilleur créneau ?",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInput(q);
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`jeania-msg jeania-msg-${m.role}`}>
                <div className="jeania-msg-content">{m.content}</div>
              </div>
            ))}
            {isLoading && (
              <div className="jeania-msg jeania-msg-assistant">
                <div className="jeania-msg-content jeania-typing">
                  <Loader size={14} className="spin" />
                  <span>Jean-IA réfléchit...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="jeania-input-bar">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pose ta question..."
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="jeania-send-btn"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      <button
        className={`jeania-fab ${isOpen ? "jeania-fab-hidden" : ""}`}
        onClick={() => setIsOpen(true)}
        title="Demander à Jean-IA"
      >
        <MessageCircle size={24} />
      </button>
    </>
  );
}
