# `Promptmaster Architecture`

`This document outlines Promptmaster’s architecture rewrite, which governs all game and socket logic.`

# 

# `Section 1: Game Types`

## **`Core Data Stores`**

### `Player`

| `field` | `type` | `notes` |
| :---- | :---- | :---- |
| `id` | `string` | `socket id, not our reliable identifier` |
| `username` | `string` | `unique within lobby` |
| `connected` | `boolean` | `updated upon socket c/dc event` |
| `lastSeen?` | `Date` | `used for reconnection window` |

### `Lobby`

| `field` | `type` | `notes` |
| :---- | :---- | :---- |
| `lobbyCode` | `string` | `6 digit unique code` |
| `gameState` | `GameState` | `we now store gamestate in lobby` |
| `hostUsername` | `string` |  |
| `players` | `Player[]` |  |
| `settings` | `LobbySettings` |  |
| `status` | `LobbyStatus` |  |
| `createdAt` | `Date` | `potential cleanup purposes` |

### `GameState`

| `field` | `type` | `notes` |
| :---- | :---- | :---- |
| `rounds` | `GameRound[]` | `just check length for round #` |
| `prompterOrder` | `string[]` | `array of usernames randomized upon game initialization. current prompter = prompterOrder[rounds.length % prompterOrder.length]` |
| `totalScores` | `{ username, totalScore }[]` |  |

### `GameRound`

| `field` | `type` | `notes` |
| :---- | :---- | :---- |
| `phase` | `RoundStatus` |  |
| `phaseEndTime` | `number` | `endtime of current phase` |
| `prompter` | `string` | `prompter’s username` |
| `prompt?` | `string` | `prompt they submitted` |
| `imageUrl?` | `string` |  |
| `guesses` | `{ username, guess, submittedAt, score }[]` | `thugging w/o extra type for now. scores between 0-100` |
| `expectedGuessCount?` | `number` | `gonna be calculated and stored right before its time to guess` |
| `readyPlayers` | `string[]` | `array of usernames of ready players` |

## 

## **`Supporting Types`**

### `SessionData`

| `field` | `type` | `notes` |
| :---- | :---- | :---- |
| `lobbyCode` | `string` |  |
| `username` | `string` | `just check length for round #` |
| `socketId?` | `string` | `after someone disconnects and returns to site, we’ll prompt them to rejoin if they were in a valid lobby with a game going on, and the provided username and old socket id were in that lobby.` |
| `joinedAt?` | `Date` | `just cuz` |

### `LobbySettings`

| `field` | `type` | `notes` |
| :---- | :---- | :---- |
| `roundsPerPlayer` | `number` | `between 1-5, determines game length` |
| `timeLimit` | `number` | `between 5-60 seconds, for both prompting and guessing phase` |

### `LobbyStatus is one of:`

| `LobbyStatus` | `notes` |
| :---- | :---- |
| `‘waiting’` | `Players can join, no active game` |
| `‘playing’` | `Game is in progress. no new players can join, but players can dc/rc` |
| `‘inactive’` | `lobby timed out or was closed (either manually or by all players leaving)` |

## 

## **`Socket Events - ServerToClient`**

### `lobby:validated`

* `Server’s response to the player’s request for validation`  
* `Happens every time they visit the /lobby/[code] page`  
  * `hmmm.. also maybe every time they visit game page?`  
  * `If no session data exists, redirect to home`  
  * `If session data, proceed to validation`  
    * `useSocket.validateLobby`  
* `“Prove you belong here” check`  
  * `If not, lobby:errors are emitted if something’s wrong`

### `lobby:updated`

* `Server notifying all players in lobby that something changed`  
* `Player connection:`  
  * `Socket connects`  
  * `Server updates player.connected = true`  
  * `Server emits lobby:updated`  
  * `Vice verse for player disconnection (possible host change)`  
* `Settings change:`  
  * `Host changes settings`  
  * `Host emits lobby:update_settings`  
  * `Server validates and updates settings`  
  * `Server emits lobby:updated`

### `lobby:left`

* `Server notifying a player they’ve successfully left intentionally`  
* `Left player redirects to home`  
* `All other players receive lobby:updated`

### `lobby:kicked`

* `Server notifying a player that they were kicked`  
* `Kicked player redirects to home`  
* `All other players receive lobby:updated`  
* `Exists for additional specificity between kicking and leaving`

### `lobby:error`

* `Triggered when invalid lobby operation occurs`  
  * `lobby:validate fails (client edits sessionStorage?)`  
  * `Lobby doesn’t exist or player’s been kicked`  
  * `Server errors`

### `game:started`

* `Notify all players that the game has begun`  
* `Triggers the redirect to /game/[code] page`  
  * `For now, game:started won’t send lobby data`  
  * `Once on game page, players get game:phase_changed with DATA`

### `game:phase_changed`

* `Handles ALL phase transitions within a game`  
* `prompting, generating, guessing, scoring, results`

### `game:guess_submitted`

* `Think of as guessing_state_update`  
* `Notifies all players that another guesser has submitted`

### `game:request_prompt_draft`

* `Time’s up! notification to prompter`  
* `Prompter then is forced to emit game:submit_prompt with draft`  
  * `1 second window to reply with draft, otherwise we skip round and mark old one with ‘skipped’ status`

### `game:request_guess_draft`

* `Time’s up! notification to guessers who have not yet guessed*`  
* `Guessers then forced to emit game:submit_guess with draft`  
  * `1 second window to reply with draft, otherwise no guess`

### `game:ready_state_update`

* `Notifies all players that someone new has readied up`  
* `Sent even when the final person readies up before phase_changed`

### `game:ended`

* `Notifies players that game is over and sends them to game results`

## **`Socket Events - ClientToServer`**

### `lobby:validate`

* `Client’s request to be validated as a member of the lobby`  
* `Send upon visitation to lobby page and maybe game page`  
* `Params should be SessionData? (lobbycode, username)`  
  * `not socketId… players only get socketId after being validated on lobbyPage after joining/creating`  
* `Client on loading, then gets lobby:validated response w/ data`

### `lobby:update_settings`

* `Host’s request to change settings`  
* `Sends Partial<LobbySettings> - either rounds/player or time limit`  
* `Once validated, everyone receives lobby:updated`

### `lobby:kick_player`

* `Host’s request to kick a player by their username`  
* `Once validated, kicked player gets lobby:kicked, everyone else receives lobby:updated with new lobby data`

### `lobby:leave`

* `Player’s request to leave formally`  
* `Could maybe also become an option in-game: show pop-up alert`  
* `Once validated, left player gets lobby:left, everyone else receives lobby:updated with new lobby data`

### `lobby:start_game`

* `Host’s request to start the game`  
* `Server validates then sends game:started to everyone, sending them to the game page, where they promptly receive game:phase_changed`

### `game:submit_prompt`

* `Prompter’s prompt submission`  
* `Also called automatically when timer expires`

### `game:submit_guess`

* `Guesser’s guess submission`  
* `Also called automatically when timer expires`

### `game:mark_ready`

* `Ready up event`  
* `Once validated, other players are notified with game: ready_state_update`

# `Section 2: Backend Logic Flow`

## **`Game Initialization`**

### `Socket Event: ‘lobby:start_game’ -> initializeGame()`

* `Receive ‘lobby:start_game’ event from frontend`  
  * `Call initializeGame`  
* `initializeGame`  
  * `Create and store initial GameState`  
  * `Call createNewRound`  
* `createNewRound`  
  * `Create and store first GameRound`  
  * `Call transitionToPhase`  
* `transitionToPhase`

## **`Game Initialization and Prompting Phase Flow`**

`1. Socket Event: 'lobby:start_game'`  
   `↓`  
   `socketService.ts (Event Handler)`  
   `↓`  
`2. gameService.initializeGame(lobbyCode: string): Promise<GameState>`  
   `- Validates lobby exists and has enough players`  
   `- Creates initial game state with:`  
     `* lobbyCode`  
     `* empty rounds array`  
     `* randomized prompterOrder (player IDs)`  
     `* scores array initialized to zero for each player`  
   `↓`  
`3. gameService.createNewRound(lobbyCode: string): Promise<GameRound>`  
   `- Determines current prompter using: prompterOrder[rounds.length % prompterOrder.length]`  
   `- Creates round object with:`  
     `* prompterId`  
     `* status: 'prompting'`  
     `* empty guesses array`  
     `* expectedGuessCount (connected players - 1)`  
   `- Adds round to gameState.rounds`  
   `↓`  
`4. gameService.updateGameState(gameState: GameState): Promise<void>`  
   `- Saves updated game state to Redis`  
   `↓`  
`5. gameService.transitionToPhase(lobbyCode: string, 'prompting', {timeLimit: number}): Promise<void>`  
   `- Central method for all phase changes`  
   `- Updates round status to 'prompting'`  
   `- Calls startPromptPhase()`  
   `↓`  
`6. gameService.startPromptPhase(lobbyCode: string, timeLimit: number): Promise<void>`  
   `- Calculates endTime = Date.now() + (timeLimit * 1000)`  
   `- Updates round with endTime`  
   `- Saves updated game state`  
   `↓`  
`7. gameService.startPhaseTimer(lobbyCode: string, 'prompting', timeLimit: number): void`  
   `- Creates timeout: setTimeout(() => handlePromptTimeout(lobbyCode), timeLimit * 1000)`  
   `- Stores timer reference in activeGameTimers map`  
   `↓`  
`8. Socket Emit: 'game:started' with initial gameState`  
   `↓`  
`9. Socket Emit: 'game:phase_changed' with {phase: 'prompting', round: currentRound}`