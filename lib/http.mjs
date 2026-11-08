// Respuesta JSON común para las funciones de /api: errores conocidos con su código y mensaje; el resto, 500 genérico.
export async function respond(run, fallback, KnownError) {
  try {
    return Response.json(await run(), { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } });
  } catch (error) {
    const known = error instanceof KnownError;
    if (!known) console.error(error);
    return Response.json({ error: known ? error.message : fallback }, { status: known ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
