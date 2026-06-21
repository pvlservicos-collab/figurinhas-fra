import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { validateAdminRequest } from "@/lib/adminAuth";

function periodToCutoff(period: string): Date | null {
  const now = Date.now();
  const hourMatch = period.match(/^(\d+)h$/);
  if (hourMatch) return new Date(now - parseInt(hourMatch[1]) * 3600_000);
  if (period === "today") {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }
  if (period === "7d")  return new Date(now - 7  * 86400_000);
  if (period === "30d") return new Date(now - 30 * 86400_000);
  return null;
}

export async function GET(req: NextRequest) {
  if (!validateAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getDb();
  try {
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          id SERIAL PRIMARY KEY,
          session_id VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(255),
          nome VARCHAR(100),
          step VARCHAR(50) NOT NULL,
          cta_clicked BOOLEAN DEFAULT FALSE,
          obrigado BOOLEAN DEFAULT FALSE,
          oferta VARCHAR(20),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      await sql`ALTER TABLE sessions ADD COLUMN IF NOT EXISTS oferta VARCHAR(20)`;
      await sql`ALTER TABLE sessions ALTER COLUMN oferta TYPE VARCHAR(20)`;
    } catch { /* ok */ }

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "today";
    const lite   = searchParams.get("lite") !== "0";
    const cutoff = periodToCutoff(period);

    const pfSession = cutoff ? sql`AND s.updated_at >= ${cutoff}` : sql``;
    const pfSimple  = cutoff ? sql`AND updated_at >= ${cutoff}`   : sql``;

    const [sessionRow, funnelSteps, dailySessions, segundaRow] = await Promise.all([
      sql`
        SELECT
          COUNT(DISTINCT session_id)::int AS total,
          COUNT(DISTINCT session_id) FILTER (WHERE step IN ('result_view','result_ok'))::int AS viu_preco,
          COUNT(DISTINCT session_id) FILTER (WHERE cta_clicked = TRUE)::int                  AS cta,
          COUNT(DISTINCT session_id) FILTER (WHERE obrigado = TRUE)::int                     AS obrigados,
          COUNT(DISTINCT session_id) FILTER (WHERE oferta = 'a' OR oferta IS NULL)::int                                         AS total_a,
          COUNT(DISTINCT session_id) FILTER (WHERE step IN ('result_view','result_ok') AND (oferta='a' OR oferta IS NULL))::int  AS viu_preco_a,
          COUNT(DISTINCT session_id) FILTER (WHERE cta_clicked = TRUE AND (oferta='a' OR oferta IS NULL))::int                  AS cta_a,
          COUNT(DISTINCT session_id) FILTER (WHERE obrigado = TRUE    AND (oferta='a' OR oferta IS NULL))::int                  AS obrigados_a,
          COUNT(DISTINCT session_id) FILTER (WHERE oferta = 'pets')::int                                                        AS total_pets,
          COUNT(DISTINCT session_id) FILTER (WHERE step IN ('result_view','result_ok') AND oferta='pets')::int                  AS viu_preco_pets,
          COUNT(DISTINCT session_id) FILTER (WHERE cta_clicked = TRUE AND oferta='pets')::int                                   AS cta_pets,
          COUNT(DISTINCT session_id) FILTER (WHERE obrigado = TRUE    AND oferta='pets')::int                                   AS obrigados_pets
        FROM sessions
        WHERE email IS NOT NULL ${pfSimple}
      `,
      sql`
        SELECT step,
          COUNT(*)::int AS count,
          COUNT(*) FILTER (WHERE oferta = 'a' OR oferta IS NULL)::int AS count_a,
          COUNT(*) FILTER (WHERE oferta = 'pets')::int                AS count_pets
        FROM sessions
        WHERE email IS NOT NULL ${pfSimple}
        GROUP BY step
        ORDER BY count DESC
      `,
      sql`
        SELECT updated_at::date AS day,
          COUNT(DISTINCT session_id)::int AS count,
          COUNT(DISTINCT session_id) FILTER (WHERE oferta = 'a' OR oferta IS NULL)::int AS count_a,
          COUNT(DISTINCT session_id) FILTER (WHERE oferta = 'pets')::int                AS count_pets
        FROM sessions
        WHERE email IS NOT NULL AND updated_at >= NOW() - INTERVAL '14 days'
        GROUP BY day ORDER BY day
      `,
      sql`
        SELECT
          COUNT(DISTINCT session_id) FILTER (WHERE step = 'segunda_obg')::int                              AS cliques,
          COUNT(DISTINCT session_id) FILTER (WHERE step = 'segunda_start')::int                            AS starts,
          COUNT(DISTINCT session_id) FILTER (WHERE oferta = 'segunda' AND step IN ('result_view','result_ok'))::int AS viu_preco_seg,
          COUNT(DISTINCT session_id) FILTER (WHERE oferta = 'segunda' AND cta_clicked = TRUE)::int         AS cta_seg,
          COUNT(DISTINCT session_id) FILTER (WHERE oferta = 'segunda' AND obrigado = TRUE)::int            AS obrigados_seg
        FROM sessions
        WHERE (step IN ('segunda_obg','segunda_start') OR oferta = 'segunda') ${pfSimple}
      `,
    ]);

    const s   = sessionRow[0] ?? { total: 0, viu_preco: 0, cta: 0, obrigados: 0, total_a: 0, viu_preco_a: 0, cta_a: 0, obrigados_a: 0, total_pets: 0, viu_preco_pets: 0, cta_pets: 0, obrigados_pets: 0 };
    const seg = segundaRow[0] ?? { cliques: 0, starts: 0, viu_preco_seg: 0, cta_seg: 0, obrigados_seg: 0 };

    const base = {
      sessions: {
        total: s.total, cta: s.cta, obrigados: s.obrigados,
        daily: dailySessions,
        a:    { total: s.total_a,    viu_preco: s.viu_preco_a,    cta: s.cta_a,    obrigados: s.obrigados_a    },
        pets: { total: s.total_pets, viu_preco: s.viu_preco_pets, cta: s.cta_pets, obrigados: s.obrigados_pets },
      },
      funnel: funnelSteps,
      segunda: {
        cliques: seg.cliques, starts: seg.starts, compras: 0, receita: null,
        viu_preco: seg.viu_preco_seg, cta: seg.cta_seg, obrigados: seg.obrigados_seg,
      },
      pagos: 0, obrigadosCount: s.obrigados,
      vendas: { pagos: 0, a_count: 0, a_total: 0, b_count: 0, b_total: 0, bumps_count: 0, bumps_receita: 0, daily: [] },
      leads: [], obrigados: [],
    };

    if (lite) return NextResponse.json(base);

    const pfPedidos = cutoff ? sql`AND created_at >= ${cutoff}` : sql``;
    const [leads, obrigados] = await Promise.all([
      sql`
        SELECT s.session_id, s.email, s.nome, s.step,
               to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
               COALESCE(s.cta_clicked, FALSE) AS cta_clicked,
               COALESCE(s.obrigado,    FALSE) AS obrigado,
               pi.price AS price_paid
        FROM sessions s
        LEFT JOIN LATERAL (
          SELECT price FROM pedido_items
          WHERE (item_type IS NULL OR item_type != 'order_bump')
            AND email = s.email
          ORDER BY created_at DESC LIMIT 1
        ) pi ON TRUE
        WHERE s.email IS NOT NULL ${pfSession}
        ORDER BY s.updated_at DESC
        LIMIT 500
      `,
      sql`
        SELECT s.session_id, s.email, s.nome,
               to_char(s.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at,
               COALESCE(p.telefone, s.email) AS telefone
        FROM sessions s
        LEFT JOIN LATERAL (
          SELECT telefone FROM pedidos
          WHERE email = s.email AND telefone IS NOT NULL
          ORDER BY created_at DESC LIMIT 1
        ) p ON TRUE
        WHERE s.obrigado = TRUE ${pfSession}
        ORDER BY s.updated_at DESC
        LIMIT 300
      `,
    ]);

    return NextResponse.json({ ...base, leads, obrigados });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[funil] erro:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
