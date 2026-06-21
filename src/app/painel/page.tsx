"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Chart as ChartType } from "chart.js";

// ==============================
// TYPES
// ==============================

type Tab = "figurinhas" | "metricas" | "apis" | "leads" | "orderbumps";
type DateFilter = "all" | "today" | "yesterday";
type Period =
  | "today" | "7d" | "30d" | "all"
  | "1h" | "2h" | "3h" | "4h" | "5h" | "6h"
  | "7h" | "8h" | "9h" | "10h" | "11h" | "12h";

interface Figurinha {
  id: number;
  nome: string | null;
  clube: string | null;
  telefone: string | null;
  sticker_url: string;
  preview_url: string | null;
  sticker_id: string;
  status: string;
  created_at: string;
}

interface Lead {
  session_id: string;
  email: string;
  nome: string | null;
  step: string;
  updated_at: string;
  cta_clicked: boolean;
  obrigado: boolean;
  price_paid: number | null;
}

interface ApiKeyStats {
  api_key_used: number;
  total: number;
  avg_ms: number;
  min_ms: number;
  max_ms: number;
}

interface ApiGenRecente {
  nome: string | null;
  email: string;
  api_key_used: number;
  generation_ms: number;
  created_at: string;
}

interface ApiStats {
  perKey: ApiKeyStats[];
  recentes: ApiGenRecente[];
}

interface FunilData {
  sessions: {
    total: number; cta: number; obrigados: number;
    daily: { day: string; count: number; count_a: number }[];
    a: { total: number; viu_preco: number; cta: number; obrigados: number };
    pets: { total: number; viu_preco: number; cta: number; obrigados: number };
  };
  funnel: { step: string; count: number; count_a: number }[];
  vendas: { pagos: number; a_count: number; a_total: number; b_count: number; b_total: number; bumps_count: number; bumps_receita: number; daily: { day: string; count: number }[] };
  segunda: { cliques: number; starts: number; compras: number; receita: number | null; viu_preco: number; cta: number; obrigados: number };
  leads: Lead[];
  obrigados: { session_id: string; email: string; nome: string | null; updated_at: string; telefone: string | null }[];
  pagos: number;
  obrigadosCount: number;
}

// ==============================
// CONSTANTS
// ==============================

const STEP_LABEL: Record<string, string> = {
  hero_view:    "Chegou na página",
  quiz_1:       "Card 2 — Nome/foto",
  quiz_2:       "Card 3 — Clube",
  quiz_3:       "Card 4 — Email",
  confirm:      "Confira seus dados",
  loading:      "Gerou vignette",
  saiu_gerando: "Saiu durante geração",
  result_view:  "Viu preview c/ preço",
  result_ok:    "Viu preview c/ preço",
  result_error: "Erro na geração",
  checkout:     "Clicou em comprar",
  obrigado:     "Comprou ✓",
};

const FUNNEL_STEPS = [
  { key: "hero_view",    label: "Chegou na página",     color: "#64748b" },
  { key: "quiz_1",       label: "Nome/foto",            color: "#3b82f6" },
  { key: "quiz_2",       label: "Clube",                color: "#3b82f6" },
  { key: "quiz_3",       label: "Email",                color: "#3b82f6" },
  { key: "loading",      label: "Gerou vignette",       color: "#eab308" },
  { key: "saiu_gerando", label: "Saiu na geração",      color: "#f97316" },
  { key: "result_view",  label: "Viu o preço",          color: "#22c55e" },
  { key: "result_error", label: "Erro na geração",      color: "#ef4444" },
  { key: "checkout",     label: "Clicou em comprar",    color: "#a855f7" },
  { key: "obrigado",     label: "Chegou no obrigado",   color: "#059669" },
];

const EMPTY_FUNIL: FunilData = {
  sessions: { total: 0, cta: 0, obrigados: 0, daily: [], a: { total: 0, viu_preco: 0, cta: 0, obrigados: 0 }, pets: { total: 0, viu_preco: 0, cta: 0, obrigados: 0 } },
  funnel: [],
  vendas: { pagos: 0, a_count: 0, a_total: 0, b_count: 0, b_total: 0, bumps_count: 0, bumps_receita: 0, daily: [] },
  segunda: { cliques: 0, starts: 0, compras: 0, receita: null, viu_preco: 0, cta: 0, obrigados: 0 },
  leads: [], obrigados: [],
  pagos: 0, obrigadosCount: 0,
};

// ==============================
// AUTH HELPERS
// ==============================

const UNAUTH_EVENT = "painel:unauthorized";
function dispatchUnauthorized() { window.dispatchEvent(new Event(UNAUTH_EVENT)); }

function getToken(): string { return localStorage.getItem("admin_token") || ""; }
function authHeaders(): Record<string, string> {
  return { "Authorization": `Bearer ${getToken()}`, "Content-Type": "application/json" };
}

// ==============================
// HELPERS
// ==============================

function StatusBadge({ status }: { status: string | null }) {
  const MAP: Record<string, [string, string, string]> = {
    pendente:    ["#f1f5f9", "#475569", "Pendente"],
    gerando:     ["#fefce8", "#854d0e", "Gerando"],
    pago:        ["#dbeafe", "#1d4ed8", "Pago"],
    entregue:    ["#d1fae5", "#065f46", "Entregue"],
    recuperado:  ["#ede9fe", "#5b21b6", "Recuperado"],
    recuperacao: ["#ffedd5", "#c2410c", "Em Recuperação"],
  };
  const [bg, color, label] = MAP[status || ""] ?? ["#f1f5f9", "#94a3b8", "Sem pedido"];
  return (
    <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: bg, color, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

// ==============================
// LOGIN SCREEN
// ==============================

function LoginScreen({ onLogin }: { onLogin: (user: string) => void }) {
  const [value, setValue]     = useState("");
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const name = value.trim().toLowerCase();
    if (!name) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (json.ok) {
        localStorage.setItem("painel_user", json.user);
        if (json.token) localStorage.setItem("admin_token", json.token);
        onLogin(json.user);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0a0f1e 0%, #0f172a 60%, #0d1f3c 100%)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{
        background: "#1e293b", borderRadius: 20, padding: "44px 40px",
        maxWidth: 380, width: "100%", boxShadow: "0 25px 50px rgba(0,0,0,.5)", textAlign: "center",
      }}>
        <div style={{
          width: 72, height: 72,
          background: "linear-gradient(135deg, #002395 0%, #ED2939 100%)",
          borderRadius: 20, display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 24px", fontSize: 36,
        }}>
          ⚽
        </div>
        <h1 style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-.02em" }}>
          Painel Vignette
        </h1>
        <p style={{ color: "#475569", fontSize: 13, margin: "0 0 32px" }}>Copa do Mundo 2026 — França</p>
        <input
          type="text"
          placeholder=""
          value={value}
          onChange={e => { setValue(e.target.value); setError(false); }}
          onKeyDown={e => e.key === "Enter" && !loading && handleSubmit()}
          autoFocus
          style={{
            width: "100%", boxSizing: "border-box",
            border: `1px solid ${error ? "#ef4444" : "#334155"}`,
            borderRadius: 10, padding: "14px 16px", fontSize: 15,
            background: "#0f172a", color: "#f1f5f9", outline: "none",
            marginBottom: 10, textAlign: "center",
          }}
        />
        {error && (
          <p style={{ color: "#ef4444", fontSize: 12, margin: "0 0 10px", fontWeight: 600 }}>
            Nome não reconhecido. Tente novamente.
          </p>
        )}
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: "100%", background: "#002395", border: "none", borderRadius: 10,
            color: "#fff", fontSize: 15, fontWeight: 700, padding: "15px 20px",
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}

// ==============================
// SIDEBAR
// ==============================

const NAV_ITEMS: { tab: Tab; label: string; icon: string }[] = [
  { tab: "figurinhas",  label: "Vignettes",    icon: "⚽" },
  { tab: "metricas",    label: "Métricas",     icon: "📊" },
  { tab: "apis",        label: "Uso de APIs",  icon: "⚡" },
  { tab: "leads",       label: "Leads",        icon: "👥" },
  { tab: "orderbumps",  label: "Order Bumps",  icon: "🛒" },
];

function Sidebar({ tab, onTab, user, onLogout }: {
  tab: Tab; onTab: (t: Tab) => void; user: string; onLogout: () => void;
}) {
  return (
    <aside style={{
      width: 220, minWidth: 220, background: "#0f172a", display: "flex",
      flexDirection: "column", height: "100vh", position: "sticky", top: 0,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      boxShadow: "2px 0 8px rgba(0,0,0,.3)",
    }}>
      <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34,
            background: "linear-gradient(135deg, #002395, #ED2939)",
            borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>⚽</div>
          <div>
            <div style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 13, letterSpacing: ".05em" }}>VIGNETTE</div>
            <div style={{ color: "#475569", fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase" }}>Admin Panel</div>
          </div>
        </div>
      </div>

      <nav style={{ flex: 1, padding: "12px 8px", overflowY: "auto" }}>
        {NAV_ITEMS.map(item => (
          <button
            key={item.tab}
            onClick={() => onTab(item.tab)}
            style={{
              width: "100%", display: "flex", alignItems: "center", gap: 10,
              padding: "11px 12px", borderRadius: 8, border: "none",
              background: tab === item.tab ? "#002395" : "transparent",
              color: tab === item.tab ? "#fff" : "#64748b",
              cursor: "pointer", fontSize: 13,
              fontWeight: tab === item.tab ? 700 : 500,
              marginBottom: 2, textAlign: "left",
            }}
          >
            <span style={{ fontSize: 17 }}>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div style={{ padding: "14px 12px", borderTop: "1px solid #1e293b" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", background: "#002395", flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 800, fontSize: 14,
          }}>
            {user[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ color: "#e2e8f0", fontWeight: 600, fontSize: 13, textTransform: "capitalize" }}>{user}</div>
            <div style={{ color: "#475569", fontSize: 10 }}>Administrador</div>
          </div>
        </div>
        <button
          onClick={onLogout}
          style={{
            width: "100%", background: "#1e293b", color: "#64748b", border: "none",
            borderRadius: 6, padding: "9px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600,
          }}
        >
          ← Sair
        </button>
      </div>
    </aside>
  );
}

// ==============================
// FIGURINHAS TAB
// ==============================

function FigurinhasTab() {
  const [nomeSearch, setNomeSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [pageLimit, setPageLimit]   = useState(24);
  const [page, setPage]             = useState(0);
  const [figurinhas, setFigurinhas] = useState<Figurinha[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [copiedId, setCopiedId]     = useState<number | null>(null);

  const fetchFigurinhas = useCallback(async (
    p: number, limit: number, nome: string, date: DateFilter
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ all: "1", limit: String(limit), offset: String(p * limit) });
      if (nome.trim()) params.set("nome", nome.trim());
      if (date !== "all") params.set("date", date);
      const res = await fetch(`/api/admin/pedidos?${params}`, { headers: authHeaders() });
      if (res.status === 401) { dispatchUnauthorized(); return; }
      const json = await res.json();
      setFigurinhas(json.pedidos || []);
      setTotal(json.totalFiltered || 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchFigurinhas(0, pageLimit, nomeSearch, dateFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    setPage(0);
    fetchFigurinhas(0, pageLimit, nomeSearch, dateFilter);
  };

  const handleDateFilter = (d: DateFilter) => {
    setDateFilter(d);
    setPage(0);
    fetchFigurinhas(0, pageLimit, nomeSearch, d);
  };

  const handleLimitChange = (limit: number) => {
    setPageLimit(limit);
    setPage(0);
    fetchFigurinhas(0, limit, nomeSearch, dateFilter);
  };

  const handlePageChange = (p: number) => {
    setPage(p);
    fetchFigurinhas(p, pageLimit, nomeSearch, dateFilter);
  };

  const copyUrl = (id: number, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const totalPages = Math.ceil(total / pageLimit) || 1;

  return (
    <div style={{ padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>
          Vignettes{" "}
          {total > 0 && <span style={{ color: "#64748b", fontWeight: 500, fontSize: 14 }}>({total} total)</span>}
        </h2>
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>Toutes les vignettes générées</p>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.07)", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Nom..."
            value={nomeSearch}
            onChange={e => setNomeSearch(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            style={{ flex: "1 1 160px", border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", color: "#334155" }}
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            style={{ background: "#002395", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1, whiteSpace: "nowrap" }}
          >
            {loading ? "..." : "Buscar"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {([["all", "Tudo"], ["today", "Hoje"], ["yesterday", "Ontem"]] as [DateFilter, string][]).map(([d, label]) => (
              <button
                key={d}
                onClick={() => handleDateFilter(d)}
                style={{
                  padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${dateFilter === d ? "#002395" : "#e2e8f0"}`,
                  background: dateFilter === d ? "#002395" : "#f8fafc",
                  color: dateFilter === d ? "#fff" : "#64748b",
                  cursor: "pointer",
                }}
              >{label}</button>
            ))}
          </div>

          <div style={{ width: 1, height: 20, background: "#e2e8f0" }} />

          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Mostrar:</span>
          <div style={{ display: "flex", gap: 4 }}>
            {[12, 24, 48, 100].map(n => (
              <button
                key={n}
                onClick={() => handleLimitChange(n)}
                style={{
                  padding: "5px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${pageLimit === n ? "#0f172a" : "#e2e8f0"}`,
                  background: pageLimit === n ? "#0f172a" : "#f8fafc",
                  color: pageLimit === n ? "#fff" : "#64748b",
                  cursor: "pointer",
                }}
              >{n}</button>
            ))}
          </div>

          {loading && <span style={{ fontSize: 11, color: "#94a3b8" }}>Carregando...</span>}
        </div>
      </div>

      {figurinhas.length === 0 && !loading ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 14, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
          Nenhuma vignette encontrada.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 14 }}>
          {figurinhas.map(f => (
            <div key={f.id} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.09)", display: "flex", flexDirection: "column" }}>
              <div style={{ position: "relative", aspectRatio: "2/3", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.preview_url || f.sticker_url}
                  alt={f.nome || "vignette"}
                  style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                />
                <span style={{
                  position: "absolute", top: 5, right: 5,
                  background: f.status === "entregue" ? "#059669" : f.status === "pago" ? "#2563eb" : f.status === "recuperado" ? "#7c3aed" : "#64748b",
                  color: "#fff", fontSize: 8, fontWeight: 700, borderRadius: 4, padding: "2px 5px", textTransform: "uppercase",
                }}>{f.status}</span>
              </div>
              <div style={{ padding: "8px 10px 4px", flex: 1 }}>
                <p style={{ margin: "0 0 3px", fontSize: 11, fontWeight: 700, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.nome || "—"}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 9, color: "#94a3b8" }}>
                  {new Date(f.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div style={{ padding: "6px 8px 9px", display: "flex", gap: 4 }}>
                <a
                  href={`/api/download?url=${encodeURIComponent(f.sticker_url)}&name=vignette-${(f.nome || "sem-nome").toLowerCase().replace(/\s+/g, "-")}`}
                  style={{ flex: 1, background: "#059669", color: "#fff", borderRadius: 6, padding: "5px 4px", fontSize: 10, fontWeight: 700, textDecoration: "none", textAlign: "center", display: "block" }}
                >⬇ Baixar</a>
                <button
                  onClick={() => copyUrl(f.id, f.sticker_url)}
                  style={{
                    flex: 1, background: copiedId === f.id ? "#22c55e" : "#6366f1",
                    color: "#fff", border: "none", borderRadius: 6,
                    padding: "5px 4px", fontSize: 10, fontWeight: 700, cursor: "pointer",
                  }}
                >{copiedId === f.id ? "✓ OK" : "🔗 URL"}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, background: "#fff", borderRadius: 10, padding: "12px 16px", boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {page * pageLimit + 1}–{Math.min((page + 1) * pageLimit, total)} de {total}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => handlePageChange(0)} disabled={page === 0}
              style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: page === 0 ? "default" : "pointer", color: page === 0 ? "#cbd5e1" : "#334155", background: "#fff" }}>«</button>
            <button onClick={() => handlePageChange(Math.max(0, page - 1))} disabled={page === 0}
              style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: page === 0 ? "default" : "pointer", color: page === 0 ? "#cbd5e1" : "#334155", background: "#fff" }}>‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(0, Math.min(page - 2, totalPages - 5));
              const p = start + i;
              return (
                <button key={p} onClick={() => handlePageChange(p)}
                  style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", background: p === page ? "#002395" : "#fff", color: p === page ? "#fff" : "#334155", fontWeight: p === page ? 700 : 400 }}>
                  {p + 1}
                </button>
              );
            })}
            <button onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1}
              style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: page === totalPages - 1 ? "default" : "pointer", color: page === totalPages - 1 ? "#cbd5e1" : "#334155", background: "#fff" }}>›</button>
            <button onClick={() => handlePageChange(totalPages - 1)} disabled={page === totalPages - 1}
              style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: page === totalPages - 1 ? "default" : "pointer", color: page === totalPages - 1 ? "#cbd5e1" : "#334155", background: "#fff" }}>»</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ==============================
// METRICAS TAB
// ==============================

function MetricasTab() {
  const [data, setData]           = useState<FunilData>(EMPTY_FUNIL);
  const [period, setPeriod]       = useState<Period>("today");
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  const dailyRef   = useRef<HTMLCanvasElement>(null);
  const funnelRef  = useRef<HTMLCanvasElement>(null);
  const dailyInst  = useRef<ChartType | null>(null);
  const funnelInst = useRef<ChartType | null>(null);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/funil?period=${p}`, { headers: authHeaders() });
      if (res.status === 401) { dispatchUnauthorized(); return; }
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(period); }, [period, fetchData]);

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchData(period); return 60; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [period, fetchData]);

  useEffect(() => {
    if (!dailyRef.current || !funnelRef.current) return;
    import("chart.js/auto").then(({ default: Chart }) => {
      const last14 = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - 13 + i);
        return d.toISOString().slice(0, 10);
      });
      const dailyMap = new Map(data.sessions.daily.map(d => [String(d.day).slice(0, 10), d]));
      const dailyLabels = last14.map(d => { const [, m, dy] = d.split("-"); return `${dy}/${m}`; });

      dailyInst.current?.destroy();
      if (dailyRef.current) {
        dailyInst.current = new Chart(dailyRef.current, {
          type: "bar",
          data: {
            labels: dailyLabels,
            datasets: [
              { label: "Sessões", data: last14.map(d => dailyMap.get(d)?.count_a || 0), backgroundColor: "#002395aa", borderColor: "#002395", borderWidth: 1.5, borderRadius: 3 },
            ],
          },
          options: { responsive: true, plugins: { legend: { position: "top" as const, labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { y: { beginAtZero: true, grid: { color: "#E2E8F0" } }, x: { grid: { display: false } } } },
        });
      }

      funnelInst.current?.destroy();
      if (funnelRef.current) {
        funnelInst.current = new Chart(funnelRef.current, {
          type: "bar",
          data: {
            labels: FUNNEL_STEPS.map(s => s.label),
            datasets: [
              { label: "Sessões", data: FUNNEL_STEPS.map(s => data.funnel.find(f => f.step === s.key || (s.key === "result_view" && f.step === "result_ok"))?.count_a || 0), backgroundColor: "#002395aa", borderColor: "#002395", borderWidth: 1.5, borderRadius: 3 },
            ],
          },
          options: { responsive: true, indexAxis: "y" as const, plugins: { legend: { position: "top" as const, labels: { boxWidth: 12, font: { size: 11 } } } }, scales: { x: { beginAtZero: true, grid: { color: "#E2E8F0" } }, y: { grid: { display: false } } } },
        });
      }
    });
    return () => {
      dailyInst.current?.destroy();  dailyInst.current  = null;
      funnelInst.current?.destroy(); funnelInst.current = null;
    };
  }, [data]);

  const PERIODS: { key: Period; label: string }[] = [
    { key: "today", label: "Hoje" },
    { key: "7d",    label: "7 dias" },
    { key: "30d",   label: "30 dias" },
    { key: "all",   label: "Tudo" },
  ];
  const hourPeriods  = [1,2,3,4,5,6,7,8,9,10,11,12].map(h => ({ key: `${h}h` as Period, label: `${h}h` }));
  const selectedHour = hourPeriods.find(h => h.key === period)?.key ?? "";

  const s = data.sessions;
  const sa = s.a ?? { total: 0, viu_preco: 0, cta: 0, obrigados: 0 };
  const taxaA = sa.total > 0 ? Math.round(sa.obrigados / sa.total * 100) : 0;
  const chartBox = { background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.07)" } as const;

  return (
    <div style={{ padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>Métricas</h2>
          <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
            {loading ? "Carregando..." : `Atualiza em ${countdown}s`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => { setPeriod(p.key); setCountdown(60); }}
              style={{ background: period === p.key ? "#002395" : "#fff", color: period === p.key ? "#fff" : "#64748b", border: `1px solid ${period === p.key ? "#002395" : "#e2e8f0"}`, borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              {p.label}
            </button>
          ))}
          <select
            value={selectedHour}
            onChange={e => { if (e.target.value) { setPeriod(e.target.value as Period); setCountdown(60); } }}
            style={{ background: selectedHour ? "#002395" : "#fff", color: selectedHour ? "#fff" : "#64748b", border: `1px solid ${selectedHour ? "#002395" : "#e2e8f0"}`, borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontSize: 12, fontWeight: 600, outline: "none" }}
          >
            <option value="">⏱ horas</option>
            {hourPeriods.map(h => <option key={h.key} value={h.key}>{h.label}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
          {error}
        </div>
      )}

      <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 16px", marginBottom: 16, fontSize: 13, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, color: "#166534" }}>🔗 Checkout:</span>
        <a href="https://folem.mycartpanda.com/checkout/211132890:1" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline", wordBreak: "break-all" }}>
          https://folem.mycartpanda.com/checkout/211132890:1
        </a>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,.07)", marginBottom: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#002395", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 14, borderBottom: "2px solid #002395", paddingBottom: 8 }}>
          Funil Principal
        </div>
        {[
          { label: "Sessões",           value: sa.total,      sub: "emails capturados" },
          { label: "Chegaram no preço", value: sa.viu_preco,  sub: "viram o preço final" },
          { label: "Clicaram no botão", value: sa.cta,        sub: "clicaram em comprar" },
          { label: "Obrigados",         value: sa.obrigados,  sub: "chegaram na pág. merci" },
          { label: "Taxa obrigado",     value: `${taxaA}%`,   sub: "sessões → obrigado" },
        ].map(c => (
          <div key={c.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "7px 0", borderBottom: "1px solid #f1f5f9" }}>
            <span style={{ fontSize: 12, color: "#475569" }}>{c.label}</span>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#002395" }}>{c.value}</span>
              <div style={{ fontSize: 10, color: "#94a3b8" }}>{c.sub}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div style={chartBox}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>📈 Sessões por dia (14 dias)</h3>
          <canvas ref={dailyRef} style={{ maxHeight: 220 }} />
        </div>
        <div style={chartBox}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>🚪 Funil — onde as pessoas saem</h3>
          <canvas ref={funnelRef} style={{ maxHeight: 220 }} />
        </div>
      </div>
    </div>
  );
}

// ==============================
// APIS TAB
// ==============================

function ApisTab() {
  const [apiStats, setApiStats]     = useState<ApiStats | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [countdown, setCountdown]   = useState(30);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/api-stats", { headers: authHeaders() });
      if (res.status === 401) { dispatchUnauthorized(); return; }
      if (!res.ok) throw new Error(`Erro ${res.status}`);
      setApiStats(await res.json());
      setLastUpdate(new Date());
      setCountdown(30);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { fetchStats(); return 30; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [fetchStats]);

  return (
    <div style={{ padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>Uso de APIs</h2>
          <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
            {lastUpdate
              ? `Atualizado às ${lastUpdate.toLocaleTimeString("pt-BR")} — atualiza em ${countdown}s`
              : "Carregando..."}
          </p>
        </div>
        <button onClick={fetchStats} disabled={loading}
          style={{ background: "#002395", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "..." : "↺ Atualizar"}
        </button>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, marginBottom: 16, fontSize: 12 }}>
          {error}
        </div>
      )}

      {apiStats && apiStats.perKey.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 24 }}>
          {apiStats.perKey.map(k => (
            <div key={k.api_key_used} style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
                API Key {k.api_key_used}
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>{k.total}</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2, marginBottom: 12 }}>gerações totais</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 14, color: "#334155" }}>
                  <span style={{ fontWeight: 800, color: k.avg_ms < 30000 ? "#059669" : k.avg_ms < 60000 ? "#d97706" : "#dc2626" }}>
                    {k.avg_ms ? (k.avg_ms / 1000).toFixed(1) : "—"}s
                  </span>
                  <span style={{ color: "#94a3b8", fontSize: 11 }}> média</span>
                </div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>
                  min {k.min_ms ? (k.min_ms / 1000).toFixed(1) : "—"}s · max {k.max_ms ? (k.max_ms / 1000).toFixed(1) : "—"}s
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : !loading && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 24, color: "#94a3b8", fontSize: 13, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
          Nenhum dado de API disponível ainda.
        </div>
      )}

      {apiStats && apiStats.recentes.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>
            Últimas gerações ({apiStats.recentes.length})
          </h3>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr>
                  {["Nome", "Email", "API Key", "Tempo", "Data"].map(h => (
                    <th key={h} style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apiStats.recentes.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "8px 12px", color: "#334155", fontWeight: 600 }}>{r.nome || "—"}</td>
                    <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.email}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                        Key {r.api_key_used}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontWeight: 700, color: r.generation_ms < 30000 ? "#059669" : r.generation_ms < 60000 ? "#d97706" : "#dc2626" }}>
                        {(r.generation_ms / 1000).toFixed(1)}s
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px", color: "#94a3b8" }}>
                      {new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ==============================
// ORDER BUMPS TAB
// ==============================

const OB_PRODUTOS: Record<string, string> = {
  "figurinha": "Vignette Personnalisée — PDF",
  "pacotinho": "Pacotinho Vignettes — PDF",
  "poster":    "Poster A4 — PDF",
};

interface OBItem {
  id: number;
  order_id: string;
  email: string;
  telefone: string | null;
  nome: string | null;
  offer_name: string;
  offer_hash: string;
  price: number;
  status: string;
  created_at: string;
  manual: boolean;
}

function OrderBumpsTab() {
  const [items, setItems]     = useState<OBItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saveOk, setSaveOk]   = useState(false);

  const [formEmail, setFormEmail] = useState("");
  const [formNome, setFormNome]   = useState("");
  const [formProd, setFormProd]   = useState("figurinha");

  const load = useCallback((q = "") => {
    setLoading(true);
    fetch(`/api/admin/orderbumps${q ? `?q=${encodeURIComponent(q)}` : ""}`, { headers: authHeaders() })
      .then(r => { if (r.status === 401) { dispatchUnauthorized(); throw new Error("401"); } return r.json(); })
      .then(d => setItems(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (v: string) => { setSearch(v); load(v); };

  const handleAdd = async () => {
    const emailClean = formEmail.trim().toLowerCase();
    if (!emailClean || !emailClean.includes("@")) { setSaveErr("Email inválido"); return; }
    if (!formProd) { setSaveErr("Selecione um produto"); return; }
    setSaving(true); setSaveErr(null); setSaveOk(false);
    try {
      const res = await fetch("/api/admin/orderbumps", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ email: emailClean, offer_hash: formProd, nome: formNome }),
      });
      if (res.status === 401) { dispatchUnauthorized(); return; }
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Erro"); }
      setSaveOk(true);
      setFormEmail(""); setFormNome("");
      load(search);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remover esse acesso manual?")) return;
    await fetch(`/api/admin/orderbumps?id=${id}`, { method: "DELETE", headers: authHeaders() }).catch(() => {});
    load(search);
  };

  return (
    <div style={{ padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>
          Order Bumps{" "}
          {items.length > 0 && <span style={{ color: "#64748b", fontWeight: 500, fontSize: 14 }}>({items.length} produtos)</span>}
        </h2>
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>Produtos adicionais comprados + acessos manuais</p>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.07)", padding: "20px 24px", marginBottom: 20 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", margin: "0 0 14px" }}>Adicionar acesso manual</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Email *</label>
            <input
              type="email"
              placeholder="Ex: client@email.com"
              value={formEmail}
              onChange={e => setFormEmail(e.target.value)}
              style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, width: 200, color: "#0f172a" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Nome (opcional)</label>
            <input
              type="text"
              placeholder="Nome do cliente"
              value={formNome}
              onChange={e => setFormNome(e.target.value)}
              style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, width: 180, color: "#0f172a" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>Produto *</label>
            <select
              value={formProd}
              onChange={e => setFormProd(e.target.value)}
              style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "#0f172a", cursor: "pointer" }}
            >
              {Object.entries(OB_PRODUTOS).map(([code, label]) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={handleAdd}
            disabled={saving}
            style={{
              background: "#002395", color: "#fff", border: "none", borderRadius: 8,
              padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.7 : 1, height: 36,
            }}
          >
            {saving ? "Salvando..." : "+ Adicionar"}
          </button>
        </div>
        {saveErr && <p style={{ color: "#dc2626", fontSize: 12, margin: "8px 0 0" }}>{saveErr}</p>}
        {saveOk && <p style={{ color: "#059669", fontSize: 12, margin: "8px 0 0" }}>Acesso adicionado com sucesso!</p>}
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Buscar por email, nome ou produto..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#334155", width: 320, outline: "none" }}
        />
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 14, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
          Carregando...
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.07)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 600 }}>
            <thead>
              <tr>
                {["Data", "Nome", "Email", "Produto", "Status", ""].map(h => (
                  <th key={h} style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "#94a3b8", padding: 48, fontSize: 13 }}>Nenhum order bump ainda.</td></tr>
              ) : items.map(item => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 11, whiteSpace: "nowrap" }}>
                    {new Date(item.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#334155", fontWeight: 600 }}>{item.nome || <span style={{ color: "#cbd5e1" }}>—</span>}</td>
                  <td style={{ padding: "10px 12px", color: "#64748b", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.email}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ padding: "3px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: "#eff6ff", color: "#1d4ed8" }}>
                      {OB_PRODUTOS[item.offer_hash] || item.offer_name}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <StatusBadge status={item.status} />
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {item.manual && (
                      <button
                        onClick={() => handleDelete(item.id)}
                        style={{ background: "none", border: "1px solid #fecaca", color: "#dc2626", cursor: "pointer", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}
                      >
                        Remover
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==============================
// LEADS TAB
// ==============================

function LeadsTab() {
  const [data, setData]         = useState<FunilData>(EMPTY_FUNIL);
  const [loading, setLoading]   = useState(true);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage]         = useState(0);
  const [search, setSearch]     = useState("");

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/funil?period=all&lite=0", { headers: authHeaders() })
      .then(r => { if (r.status === 401) { dispatchUnauthorized(); throw new Error("401"); } return r.json(); })
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sortedLeads = [...(data.leads ?? [])].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );

  const filteredLeads = search.trim()
    ? sortedLeads.filter(l => {
        const q = search.toLowerCase().trim();
        const nome = (l.nome || "").toLowerCase();
        return nome.includes(q) || (l.email || "").toLowerCase().includes(q);
      })
    : sortedLeads;

  const totalLeads = filteredLeads.length;
  const totalPages = Math.max(1, Math.ceil(totalLeads / pageSize));
  const pagedLeads = filteredLeads.slice(page * pageSize, page * pageSize + pageSize);

  const downloadCSV = () => {
    const rows = [
      ["Nome", "Email", "Último passo", "CTA", "Data"].join(","),
      ...data.leads.map(l => [
        l.nome || "",
        l.email || "",
        STEP_LABEL[l.step] || l.step,
        l.cta_clicked ? "Sim" : "Não",
        new Date(l.updated_at).toLocaleString("pt-BR"),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")),
    ];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8;" }));
    a.download = "leads-vignette-fra.csv";
    a.click();
  };

  return (
    <div style={{ padding: 24, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>
            Leads{" "}
            {totalLeads > 0 && <span style={{ color: "#64748b", fontWeight: 500, fontSize: 14 }}>({totalLeads})</span>}
          </h2>
          <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>Sessões com email capturado</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", fontSize: 12, color: "#334155", outline: "none", width: 210 }}
          />
          <select
            value={pageSize}
            onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
            style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "#334155", cursor: "pointer" }}
          >
            {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} por página</option>)}
          </select>
          <button onClick={downloadCSV}
            style={{ background: "#002395", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ⬇ CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ background: "#fff", borderRadius: 12, padding: 48, textAlign: "center", color: "#94a3b8", fontSize: 14, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
          Carregando leads...
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 3px rgba(0,0,0,.07)", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 500 }}>
            <thead>
              <tr>
                {["Data", "Nome", "Email", "Último Passo", "CTA"].map(h => (
                  <th key={h} style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#94a3b8", padding: 48, fontSize: 13 }}>
                    Nenhum lead ainda.
                  </td>
                </tr>
              ) : pagedLeads.map(l => (
                <tr key={l.session_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 12px", color: "#94a3b8", fontSize: 11, whiteSpace: "nowrap" }}>
                    {new Date(l.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#334155", fontWeight: 600 }}>
                    {l.nome || <span style={{ color: "#cbd5e1" }}>—</span>}
                  </td>
                  <td style={{ padding: "10px 12px", color: "#64748b" }}>
                    {l.email}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: "#f1f5f9", color: "#475569" }}>
                      {STEP_LABEL[l.step] || l.step}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {l.cta_clicked
                      ? <span style={{ padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: "#d1fae5", color: "#065f46" }}>✓ Clicou</span>
                      : <span style={{ color: "#cbd5e1" }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid #f1f5f9", flexWrap: "wrap", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                {page * pageSize + 1}–{Math.min((page + 1) * pageSize, totalLeads)} de {totalLeads}
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setPage(0)} disabled={page === 0}
                  style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: page === 0 ? "default" : "pointer", color: page === 0 ? "#cbd5e1" : "#334155", background: "#fff" }}>«</button>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: page === 0 ? "default" : "pointer", color: page === 0 ? "#cbd5e1" : "#334155", background: "#fff" }}>‹</button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                  const p = start + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 10px", fontSize: 12, cursor: "pointer", background: p === page ? "#002395" : "#fff", color: p === page ? "#fff" : "#334155", fontWeight: p === page ? 700 : 400 }}>
                      {p + 1}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                  style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: page === totalPages - 1 ? "default" : "pointer", color: page === totalPages - 1 ? "#cbd5e1" : "#334155", background: "#fff" }}>›</button>
                <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1}
                  style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "4px 8px", fontSize: 12, cursor: page === totalPages - 1 ? "default" : "pointer", color: page === totalPages - 1 ? "#cbd5e1" : "#334155", background: "#fff" }}>»</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ==============================
// MAIN COMPONENT
// ==============================

export default function Painel() {
  const [user, setUser]   = useState<string | null>(null);
  const [tab, setTab]     = useState<Tab>("figurinhas");
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("painel_user");
    setUser(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    const savedUser = localStorage.getItem("painel_user");
    if (token && savedUser) setUser(savedUser);
    setReady(true);
  }, []);

  useEffect(() => {
    window.addEventListener(UNAUTH_EVENT, logout);
    return () => window.removeEventListener(UNAUTH_EVENT, logout);
  }, [logout]);

  if (!ready) return null;
  if (!user) return <LoginScreen onLogin={(u) => setUser(u)} />;

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      background: "#f1f5f9", fontSize: 14, color: "#1e293b",
    }}>
      <Sidebar tab={tab} onTab={setTab} user={user} onLogout={logout} />
      <main style={{ flex: 1, overflowY: "auto" }}>
        {tab === "figurinhas"  && <FigurinhasTab />}
        {tab === "metricas"    && <MetricasTab />}
        {tab === "apis"        && <ApisTab />}
        {tab === "leads"       && <LeadsTab />}
        {tab === "orderbumps"  && <OrderBumpsTab />}
      </main>
    </div>
  );
}
