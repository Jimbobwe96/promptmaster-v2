# Promptmaster: Disconnection & Reconnection Guide

Updated 5/19/2025

## Core Concepts

### Session Data Storage

```
localStorage.setItem(`lobby:${lobbyCode}`, JSON.stringify({
  lobbyCode: lobby.lobbyCode,
  username: username,
  socketId: socket.id,
  joinedAt: new Date().toISOString()
}));
```

## Connection Flow

### Initial Connection

1. User visits lobby or game page
2. Check localStorage for session data
3. Establish socket connection (unconditional)
4. Call `validateLobby(code, username)` through socket
5. Server verifies identity and responds with lobby data
6. Client updates state with received lobby data

### Disconnection Process

1. Socket `disconnect` event triggers on server
2. Server updates player: `player.connected = false; player.lastSeen = new Date()`
3. Player record remains in lobby with disconnected status
4. Server emits `lobby:updated` to remaining players

## Scenario-Based Flows

### Lobby Reconnection

1. User revisits lobby page
2. Component reads session data from localStorage
3. Socket connects, then validates through `lobby:validate`
4. Server verifies identity using stored session data
5. Server marks player as connected and updates socket ID
6. User resumes lobby experience with updated state
7. **Important:** Disconnected players only have until game start to reconnect - they are removed when game starts

### Game Reconnection

1. User revisits game page
2. Component reads session data from localStorage
3. Socket connects, then validates through `lobby:validate`
4. Server checks game state and player status
5. Server sends complete lobby object with current game state
6. Client renders appropriate game phase based on state
7. **Important:** Players have until the entire game ends to reconnect (all rounds completed)

### Auto-Reconnect Detection

1. User visits home page
2. Client checks localStorage for recent sessions
3. Calls `verify-session` API endpoint
4. If reconnection is possible, shows rejoin modal
5. User can choose to rejoin or abandon session

## Edge Cases

### Host Disconnection

- Host status transfers to a random connected player
- Original host rejoins as regular player

### Prompter Disconnection

- New rounds are created dynamically with the prompter selected at creation time
- Server selects the next connected player from prompterOrder at the moment of round creation
- If current prompter disconnects during their round, the round continues normally
- For the next round, only connected players are considered when selecting a prompter

### Timing-Specific Cases

- Disconnect during phase transition: Server completes transition first
- All players disconnect: Lobby preserved with inactive status
- Disconnected players don't count for expected guesses
- Multiple reconnection attempts: Only most recent socket ID is valid

## Implementation Notes

- Use combined validation with `username + lobbyCode + oldSocketId`
- Don't expose game state in API endpoints, only through socket validation
- When game starts: all disconnected players are removed from lobby
- When game ends: all disconnected players are removed before returning to lobby
- Use readiness system to handle transition timing with reconnected players
