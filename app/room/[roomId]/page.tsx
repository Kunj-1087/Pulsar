import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { isValidRoomCode } from '../../../lib/roomCode';
import { ChatWindow } from '../../../components/room/ChatWindow';
import { IdentityGate } from '../../../components/room/IdentityGate';

interface RoomPageProps {
  params: {
    roomId: string;
  };
}

/**
 * Dynamically updates document tab titles.
 */
export async function generateMetadata({ params }: RoomPageProps): Promise<Metadata> {
  const cleanRoomId = params.roomId.toUpperCase();
  return {
    title: `Quark · Room ${cleanRoomId}`,
  };
}

export default function RoomPage({ params }: RoomPageProps) {
  const { roomId } = params;
  const cleanRoomId = roomId.toUpperCase();

  // Validate room code structure
  if (!isValidRoomCode(cleanRoomId)) {
    redirect('/');
  }

  return (
    <IdentityGate>
      <ChatWindow roomId={cleanRoomId} />
    </IdentityGate>
  );
}
