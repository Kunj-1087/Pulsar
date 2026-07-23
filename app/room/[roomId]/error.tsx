'use client';

import React from 'react';
import RoomNotFound from '../../../components/room/RoomNotFound';

export default function RoomError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return <RoomNotFound roomCode="ROOM" />;
}
