import { NextRequest, NextResponse } from 'next/server';

const allowed = new Set(['operation', 'category', 'status', 'code', 'requestId']);

export async function POST(request: NextRequest) {
  try {
    const input = await request.json();
    const event = Object.fromEntries(Object.entries(input || {}).filter(([key, value]) => allowed.has(key) && (typeof value === 'string' || typeof value === 'number')));
    console.error('[FRONTEND_ERROR]', event);
  } catch {
    console.error('[FRONTEND_ERROR]', { category: 'invalid_client_error_payload' });
  }
  return NextResponse.json({ ok: true });
}
