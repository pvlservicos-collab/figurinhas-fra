"use client";

import { useState, useEffect } from "react";

interface SiteConfig {
  locale: string;
  currency: string;
  price: string;
  checkoutUrl: string;
  firstButtonText: string;
  purchaseButtonText: string;
}

interface SecretCheck {
  ok: boolean;
  secrets: Record<string, boolean>;
}

const FIELD_LABELS: Record<keyof SiteConfig, string> = {
  locale: "Locale (ex: fr-FR)",
  currency: "Devise (ex: EUR)",
  price: "Prix affiché (ex: €2,99)",
  checkoutUrl: "URL de paiement (checkout)",
  firstButtonText: "Texte bouton Hero (COMMENCER)",
  purchaseButtonText: "Texte bouton achat (RECEVOIR MA VIGNETTE)",
};

export default function ConfigPage() {
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [tab, setTab] = useState<"config" | "check">("config");
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [form, setForm] = useState<SiteConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [checkResult, setCheckResult] = useState<SecretCheck | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("admin_token");
    if (saved) {
      setToken(saved);
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (authenticated) loadConfig();
  }, [authenticated]);

  async function loadConfig() {
    const res = await fetch("/api/config");
    if (res.ok) {
      const data = await res.json();
      setConfig(data);
      setForm(data);
    }
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem("admin_token", tokenInput);
    setToken(tokenInput);
    setAuthenticated(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setSaveMsg("");
    const res = await fetch("/api/config", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setConfig(updated);
      setForm(updated);
      setSaveMsg("✅ Configuration enregistrée !");
    } else {
      const err = await res.json().catch(() => ({}));
      setSaveMsg(`❌ Erreur: ${err.error || res.status}`);
    }
  }

  async function handleCheck() {
    setChecking(true);
    setCheckResult(null);
    const res = await fetch("/api/config/check", {
      headers: { Authorization: `Bearer ${token}` },
    });
    setChecking(false);
    if (res.ok) {
      setCheckResult(await res.json());
    } else {
      setCheckResult({ ok: false, secrets: {} });
    }
  }

  if (!authenticated) {
    return (
      <main className="flex items-center justify-center min-h-screen bg-gray-50">
        <form onSubmit={handleLogin} className="bg-white rounded-2xl p-8 shadow-lg w-full max-w-sm flex flex-col gap-4">
          <h1 className="text-2xl font-bold text-center">Config — Accès admin</h1>
          <input
            type="password"
            placeholder="Token admin"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-3 text-base w-full"
            autoComplete="current-password"
          />
          <button
            type="submit"
            className="bg-blue-700 text-white font-bold py-3 rounded-xl hover:bg-blue-800 transition-colors"
          >
            Connexion
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Configuration du site</h1>

        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("config")}
            className={`px-5 py-2 rounded-xl font-semibold transition-colors ${tab === "config" ? "bg-blue-700 text-white" : "bg-white text-gray-700 border border-gray-300"}`}
          >
            Configuration
          </button>
          <button
            onClick={() => setTab("check")}
            className={`px-5 py-2 rounded-xl font-semibold transition-colors ${tab === "check" ? "bg-blue-700 text-white" : "bg-white text-gray-700 border border-gray-300"}`}
          >
            Vérification
          </button>
          <button
            onClick={() => { localStorage.removeItem("admin_token"); setAuthenticated(false); setToken(""); }}
            className="ml-auto px-4 py-2 rounded-xl text-sm text-gray-500 border border-gray-300 hover:bg-gray-100"
          >
            Déconnexion
          </button>
        </div>

        {tab === "config" && form && (
          <form onSubmit={handleSave} className="bg-white rounded-2xl p-6 shadow flex flex-col gap-4">
            {(Object.keys(FIELD_LABELS) as (keyof SiteConfig)[]).map((key) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-sm font-semibold text-gray-600">{FIELD_LABELS[key]}</label>
                <input
                  type="text"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="border border-gray-300 rounded-lg px-4 py-2 text-base"
                />
              </div>
            ))}
            {saveMsg && <p className="text-sm font-semibold">{saveMsg}</p>}
            <div className="flex gap-3 mt-2">
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-700 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50"
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={loadConfig}
                className="bg-gray-100 text-gray-700 font-semibold py-3 px-5 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Actualiser
              </button>
            </div>
          </form>
        )}

        {tab === "check" && (
          <div className="bg-white rounded-2xl p-6 shadow flex flex-col gap-4">
            <p className="text-gray-600 text-sm">Vérifie la présence des secrets Vercel requis. Les valeurs ne sont jamais exposées.</p>
            <button
              onClick={handleCheck}
              disabled={checking}
              className="bg-blue-700 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-800 transition-colors disabled:opacity-50 self-start"
            >
              {checking ? "Vérification…" : "Vérifier les secrets"}
            </button>
            {checkResult && (
              <div className="flex flex-col gap-2 mt-2">
                <p className={`font-bold text-lg ${checkResult.ok ? "text-green-600" : "text-red-600"}`}>
                  {checkResult.ok ? "✅ Tous les secrets sont présents" : "❌ Secrets manquants"}
                </p>
                {Object.entries(checkResult.secrets).map(([key, present]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <span>{present ? "✅" : "❌"}</span>
                    <span className="font-mono">{key}</span>
                    <span className={present ? "text-green-600" : "text-red-600"}>
                      {present ? "présent" : "manquant"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
