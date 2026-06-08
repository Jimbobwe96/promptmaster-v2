import type { Server } from 'socket.io';
import type { Lobby2 } from '@promptmaster/shared';
import { redactLobbyFor } from './logic';

/** Server-to-client events whose payload is a full lobby. */
export type LobbyBroadcastEvent =
  | 'lobby:updated'
  | 'game:started'
  | 'game:phase_changed'
  | 'game:guess_submitted'
  | 'game:ready_state_update'
  | 'game:ended';

/**
 * Emit a lobby-carrying event to every connected player, each receiving a view
 * redacted for what they're allowed to see. We fan out per-socket (rather than a single
 * room broadcast) precisely so each player gets their own redaction — this is what keeps
 * the prompt and rivals' guesses out of the wire mid-round.
 */
// `any` event maps so this accepts both the loosely- and strictly-typed Server instances
// the two services hold; this is purely a transport boundary.
export function broadcastLobby(io: Server<any, any>, lobby: Lobby2, event: LobbyBroadcastEvent): void {
  for (const player of lobby.players) {
    if (player.connected && player.id) {
      io.to(player.id).emit(event, redactLobbyFor(lobby, player.username));
    }
  }
}
