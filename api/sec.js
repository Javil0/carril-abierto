import { FinancialsError } from '../lib/financials.mjs';
import { getSecFacts } from '../lib/sec.mjs';
import { respond } from '../lib/http.mjs';

// GET /api/sec?ticker=MCD&dates=2025-12-31,2024-12-31
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  return respond(() => getSecFacts(params.get('ticker'), String(params.get('dates') || '').split(',')), 'No se pudo completar el contraste con la SEC.', FinancialsError);
}
