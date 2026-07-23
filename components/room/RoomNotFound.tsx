'use client';

import React from 'react';

interface RoomNotFoundProps {
  roomCode: string;
}

export default function RoomNotFound({ roomCode }: RoomNotFoundProps) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-base gap-4 select-none px-4">
      <span className="text-[64px] font-mono text-text-muted select-none">#</span>
      <h1 className="text-text-primary font-sans text-xl font-semibold">
        Room not found
      </h1>
      <p className="text-text-secondary font-sans text-sm text-center max-w-xs leading-relaxed">
        <span className="font-mono text-text-primary">{roomCode}</span>
        {' '}doesn't exist or the host has left. Check the room code and try again.
      </p>
      <a
        href="/"
        className="
          mt-4 px-4 py-2 rounded
          bg-accent hover:bg-accent-hover
          text-white text-sm font-medium font-sans
          transition-colors
        "
      >
        Back to home
      </a>
    </div>
  );
}
