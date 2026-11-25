import { FinancialsError } from '../lib/financials.mjs';
import { getMarket } from '../lib/market.mjs';
import { respond } from '../lib/http.mjs';

// GET /api/market?ticker=MCD&currency=USD
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  return respond(() => getMarket(params.get('ticker'), params.get('currency')), 'No se pudieron descargar los datos de mercado.', FinancialsError);
}
