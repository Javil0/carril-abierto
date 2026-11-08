import { FinancialsError, getFinancials } from '../lib/financials.mjs';
import { respond } from '../lib/http.mjs';

// GET /api/financials?ticker=AAPL
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  return respond(() => getFinancials(params.get('ticker')), 'No se pudo completar el análisis. Inténtalo más tarde.', FinancialsError);
}
