# Promptmaster: Disconnection & Reconnection Guide

## Core Storage Implementation

**Use localStorage instead of sessionStorage because it persists between tabs**

```typescript
// Store session data
const session: SessionData = {
  lobbyCode: lobby.lobbyCode,
  username: username,
  socketId: socket.id,
  joinedAt: new Date().toISOString()
};
localStorage.setItem(`lobby:${lobby.lobbyCode}`, JSON.stringify(session));
```

## Lobby Page Disconnection Flow

1. **Player Disconnects (tab close/network loss)**

   - Socket `disconnect` event fires on server
   - Server updates player: `player.connected = false; player.lastSeen = new Date()`
   - Player remains in lobby object but marked as disconnected
   - If host disconnects, host status transfers to random connected player
   - Server emits `lobby:updated` to all remaining players

2. **Reconnection Before Game Starts**

   - When user visits lobby page, client checks localStorage for session data
   - If found, client calls `lobby:validate` with stored data: `{lobbyCode, username, socketId}`
   - Server verifies identity by checking old socket ID matches sessionStorage value
   - If valid, updates player: `player.id = newSocketId; player.connected = true`
   - Server emits `lobby:validated` to returning player
   - Server emits `lobby:updated` to all players

3. **Game Start with Disconnected Players**
   - When host starts game, server filters to only include connected players
   - Disconnected players are removed from the lobby object

## Home Page Reconnection Flow

1. **Auto-Detection on Home Page**
   - When user visits home page, check localStorage for lobby data
   - Call `verify-session` API with `{lobbyCode, username}`
   - API returns `{canReconnect: boolean, lobbyStatus, isHost}`
   - If can reconnect, show popup modal with option to rejoin
   - On rejoin, redirect to appropriate page (lobby or game)

## Game Page Disconnection Flow

1. **Player Disconnects During Game**

   - Socket `disconnect` event fires on server
   - Server updates player: `player.connected = false; player.lastSeen = new Date()`
   - Player remains in lobby & game state objects
   - Server emits `lobby:updated` to all remaining players

2. **Handling Disconnected Prompter**

   - When creating a new round, check if selected prompter is connected
   - If disconnected, skip to next connected player in prompterOrder
   - If no connected prompters, end the game

3. **Handling Disconnected Guessers**

   - Disconnected players don't count toward expected guess count
   - No special handling needed - treated as if they didn't submit a guess

4. **Reconnection During Game**

   - When user visits game page, client checks localStorage for session data
   - Client calls `lobby:validate` with stored data
   - Server verifies identity by checking old socket ID matches stored value
   - If valid, updates player: `player.id = newSocketId; player.connected = true`
   - Server emits `lobby:validated` with full lobby (including game state)
   - Client renders appropriate game phase based on current state

5. **All Players Disconnect**
   - If all players disconnect, lobby is deleted from Redis
   - If all but one player disconnects, game ends and returns to lobby screen

## Host Management

1. **Host Disconnection**
   - When host disconnects, find first connected player
   - Assign host status: `lobby.hostUsername = newHost.username`
   - Original host cannot regain host privileges upon reconnection

## Edge Cases

1. **Multiple Device/Tab Connections**

   - First connection updates player record with new socket ID
   - Subsequent connection attempts will fail validation

2. **Race Conditions**

   - Player disconnects as their turn begins → server skips to next player
   - No specific timing thresholds implemented

3. **Game End Cleanup**
   - Disconnected players remain in player list until game ends
   - When game ends, lobby status changes to 'waiting'
   - Return to normal lobby flow for next game

## Cleanup Process

1. **Active Player Cleanup**

   - Lobby screen: Disconnected players removed when game starts
   - Game screen: Disconnected players removed when game ends

2. **Lobby Cleanup**
   - Empty lobbies (all players disconnected) are automatically deleted
   - Inactive lobbies without activity for 24 hours are removed via Redis expiry

## Technical Implementation Notes

1. **Player Identification**

   - Use combined `lobbyCode + username + oldSocketId` for reconnection verification
   - Store this in localStorage instead of sessionStorage for persistence

2. **Socket Management**

   - Clean up socket room membership on disconnect
   - Keep socketToLobby map updated for tracking

3. **Security Considerations**
   - Validate reconnection attempts with old socket ID to prevent impersonation
   - Don't expose sensitive game data during validation
