import { getLibraryCatalog } from '@/lib/library-service';
export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get('refresh') === '1';
  try { return Response.json(await getLibraryCatalog(force), { headers: { 'Cache-Control': force ? 'no-store' : 'private, max-age=60', 'X-Content-Type-Options': 'nosniff' } }); }
  catch { return Response.json({ error: 'The library catalog is temporarily unavailable. Your saved versions have been kept.' }, { status: 503 }); }
}
