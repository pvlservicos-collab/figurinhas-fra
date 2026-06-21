"use client";

import type { QuizData } from "./QuizStep";

interface ConfirmScreenProps {
  data: QuizData;
  fotoPreviewUrl: string | null;
  onConfirm: () => void;
  onBack: () => void;
}

export default function ConfirmScreen({ data, fotoPreviewUrl, onConfirm, onBack }: ConfirmScreenProps) {
  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  };

  const rows = [
    { label: "NOM",              value: data.nome || "—" },
    { label: "E-MAIL",           value: data.email || "—" },
    { label: "CLUB",             value: data.clube || "—" },
    { label: "DATE DE NAISSANCE",value: formatDate(data.dataNascimento) },
    ...(data.jogadorFavorito ? [{ label: "JOUEUR FAVORI", value: data.jogadorFavorito }] : []),
  ];

  return (
    <section
      className="flex flex-col items-center min-h-[100dvh] w-full px-4 py-6 justify-start"
      style={{ background: "linear-gradient(160deg, #001a6e 0%, #002395 60%, #003acc 100%)" }}
    >
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">

        {/* Barra de progresso — Étape 4 de 4 */}
        <div className="px-5 pt-5 pb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-400">Étape 4 / 4</span>
            <span className="text-xs font-bold text-copa-blue">100%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div className="h-2 rounded-full w-full" style={{ background: "#002395" }} />
          </div>
        </div>

        <div className="px-5 pb-6 pt-4 flex flex-col items-center">

          {/* Título */}
          <h2 className="text-2xl font-bold text-center mb-3 tracking-wide" style={{ color: "#002395", fontFamily: "var(--font-papernotes)" }}>
            VÉRIFIEZ VOS DONNÉES
          </h2>

          {/* Avisos */}
          <p className="text-sm text-gray-500 text-center mb-1">
            Votre vignette va être générée dans un instant. Vérifiez vos données attentivement.
          </p>
          <p className="text-sm font-bold text-gray-800 text-center mb-5">
            Aucune modification n&apos;est possible après confirmation et paiement.
          </p>

          {/* Foto circular */}
          <div className="flex flex-col items-center mb-5">
            {fotoPreviewUrl ? (
              <div
                className="w-20 h-20 rounded-full overflow-hidden shadow-md mb-2"
                style={{ border: "4px solid #002395" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fotoPreviewUrl} alt="Votre photo" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div
                className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-2"
                style={{ border: "4px solid #002395" }}
              >
                <span className="text-3xl">📷</span>
              </div>
            )}
            <p className="text-xs font-bold text-center" style={{ color: "#002395" }}>
              VÉRIFIEZ QUE VOTRE VISAGE EST BIEN VISIBLE
            </p>
          </div>

          {/* Tabela de dados */}
          <div className="w-full rounded-xl overflow-hidden border border-gray-100 mb-6">
            {rows.map((row, i) => (
              <div
                key={row.label}
                className={`flex justify-between items-center px-4 py-3 ${i < rows.length - 1 ? "border-b border-gray-100" : ""}`}
                style={{ background: i % 2 === 0 ? "#F8FAFC" : "#fff" }}
              >
                <span className="text-xs font-bold text-gray-400 tracking-widest">{row.label}</span>
                <span className="text-sm font-bold text-gray-700 text-right max-w-[60%] break-words">{row.value}</span>
              </div>
            ))}
          </div>

          {/* Botão confirmar */}
          <button
            onClick={onConfirm}
            className="w-full text-white font-bold text-lg py-4 rounded-2xl shadow-lg active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.08em] mb-3"
            style={{ background: "#002395" }}
          >
            CONFIRMER ET CRÉER MA VIGNETTE ⚽
          </button>

          {/* Botão voltar */}
          <button
            onClick={onBack}
            className="w-full bg-white font-bold text-base py-4 rounded-2xl border-2 hover:bg-blue-50 active:scale-95 transition-all duration-200 cursor-pointer tracking-[0.08em]"
            style={{ color: "#002395", borderColor: "#002395" }}
          >
            CORRIGER MES DONNÉES
          </button>
        </div>
      </div>

      {/* Indicador de etapas */}
      <div className="flex gap-2 mt-5">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="w-3 h-3 rounded-full" style={{ background: "#fff", opacity: i < 4 ? 1 : 0.4 }} />
        ))}
      </div>
    </section>
  );
}
