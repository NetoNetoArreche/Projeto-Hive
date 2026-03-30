import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const apiUrl = process.env.API_INTERNAL_URL || 'http://api:3001';

  try {
    const body = await request.json();
    const response = await fetch(`${apiUrl}/api/videos`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Analyze proxy failed' },
      { status: 500 },
    );
  }
}
