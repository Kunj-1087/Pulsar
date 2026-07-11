import { NextResponse } from 'next/server';
import Ably from 'ably';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ABLY_API_KEY is not configured on the server. Please check your .env file.' },
      { status: 500 }
    );
  }

  try {
    const client = new Ably.Rest({ key: apiKey });
    
    // Generate unique client id for the peer connection
    const clientId = `peer-${Math.random().toString(36).substring(2, 10)}`;
    const tokenParams = {
      clientId,
    };
    
    const tokenRequest = await client.auth.createTokenRequest(tokenParams);
    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error('Failed to generate Ably token request:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
