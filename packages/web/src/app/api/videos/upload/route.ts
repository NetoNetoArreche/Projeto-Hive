import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Disable Next.js body parsing - we stream directly to API
export async function POST(request: NextRequest) {
  const apiUrl = process.env.API_INTERNAL_URL || 'http://api:3001';

  try {
    // Forward the entire request to the API (streaming, no body limit)
    const response = await fetch(`${apiUrl}/api/videos/upload`, {
      method: 'POST',
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
        'Content-Type': request.headers.get('Content-Type') || '',
      },
      body: request.body,
      // @ts-ignore - duplex is needed for streaming
      duplex: 'half',
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Upload proxy failed' },
      { status: 500 },
    );
  }
}
