import { NextResponse } from 'next/server';
import { generateRoomCode } from '../../../../lib/roomCode';

export async function POST() {
  try {
    const roomId = generateRoomCode();
    return NextResponse.json({ roomId });
  } catch (error) {
    console.error('Failed to create room ID:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
