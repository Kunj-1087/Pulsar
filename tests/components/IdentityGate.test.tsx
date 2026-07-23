import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IdentityGate } from '../../components/room/IdentityGate';

describe('IdentityGate Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('bypasses identity gate when valid quark_identity exists in localStorage', () => {
    const existingIdentity = {
      handle: 'testuser',
      color: '#E50914',
      peerColor: '#E50914',
      peerId: 'peer_12345',
    };
    localStorage.setItem('quark_identity', JSON.stringify(existingIdentity));

    render(
      <IdentityGate>
        <div data-testid="room-content">Room Content Loaded</div>
      </IdentityGate>
    );

    expect(screen.getByTestId('room-content')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders intro phase and transitions to form phase after 1200ms', () => {
    render(
      <IdentityGate>
        <div data-testid="room-content">Room Content Loaded</div>
      </IdentityGate>
    );

    // Initial state renders the dialog with wordmark
    expect(screen.getByRole('dialog', { name: /set up your identity/i })).toBeInTheDocument();
    expect(screen.getByText('quark')).toBeInTheDocument();

    // Fast forward intro timer (1200ms)
    act(() => {
      vi.advanceTimersByTime(1200);
    });

    // Form elements should now be visible
    expect(screen.getByText('Choose your identity')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('yourhandle')).toBeInTheDocument();
    expect(screen.getByText('Pick a color')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enter quark/i })).toBeInTheDocument();
  });

  it('rejects invalid input characters and spaces silently', () => {
    render(
      <IdentityGate>
        <div>Content</div>
      </IdentityGate>
    );

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    const input = screen.getByPlaceholderText('yourhandle') as HTMLInputElement;

    // Type valid handle
    fireEvent.change(input, { target: { value: 'alice_123' } });
    expect(input.value).toBe('alice_123');

    // Attempt typing space (should be rejected)
    fireEvent.change(input, { target: { value: 'alice 123' } });
    expect(input.value).toBe('alice_123');

    // Attempt typing special character ! (should be rejected)
    fireEvent.change(input, { target: { value: 'alice!' } });
    expect(input.value).toBe('alice_123');
  });

  it('allows picking colors and submitting valid identity', async () => {
    const onCompleteMock = vi.fn();

    render(
      <IdentityGate onComplete={onCompleteMock}>
        <div data-testid="room-content">Room Content Loaded</div>
      </IdentityGate>
    );

    act(() => {
      vi.advanceTimersByTime(1200);
    });

    const input = screen.getByPlaceholderText('yourhandle');
    fireEvent.change(input, { target: { value: 'bob_builder' } });

    // Select color swatch (sky blue: #4FC3F7)
    const skyBlueSwatch = screen.getByRole('button', { name: /select color sky blue/i });
    fireEvent.click(skyBlueSwatch);

    const submitBtn = screen.getByRole('button', { name: /enter quark/i });
    fireEvent.click(submitBtn);

    // Submitting state loader
    act(() => {
      vi.advanceTimersByTime(250);
    });

    // Exit transition completion (300ms)
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Verify localStorage item created with correct shape
    const stored = localStorage.getItem('quark_identity');
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.handle).toBe('bob_builder');
    expect(parsed.color).toBe('#4FC3F7');
    expect(parsed.peerColor).toBe('#4FC3F7');
    expect(typeof parsed.peerId).toBe('string');
    expect(parsed.peerId.length).toBeGreaterThan(0);

    expect(onCompleteMock).toHaveBeenCalled();
    expect(screen.getByTestId('room-content')).toBeInTheDocument();
  });
});
