import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import { isValidRoomCode } from '../../../lib/roomCode';
import { ChatWindow } from '../../../components/room/ChatWindow';

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
    title: `Pulsar · Room ${cleanRoomId}`,
  };
}

export default function RoomPage({ params }: RoomPageProps) {
  const { roomId } = params;
  const cleanRoomId = roomId.toUpperCase();

  // Validate room code structure
  if (!isValidRoomCode(cleanRoomId)) {
    redirect('/');
  }

  return <ChatWindow roomId={cleanRoomId} />;
}
