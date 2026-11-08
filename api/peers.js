import { FinancialsError } from '../lib/financials.mjs';
import { getPeerComparison } from '../lib/peers.mjs';
import { respond } from '../lib/http.mjs';

// GET /api/peers?ticker=ITX.MC&date=2026-01-31
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  return respond(() => getPeerComparison(params.get('ticker'), params.get('date'), params.get('group')), 'No se pudo completar la comparación sectorial.', FinancialsError);
}
