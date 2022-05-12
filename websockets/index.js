// Import packages
const WebSocket = require('ws');
const short = require('short-uuid');
const moment = require('moment');

const wordList = require('../utils/words');

const games = [];
let playerWaiting = null;

// Export this function to use in our server.js file
module.exports = async(expressServer) => {
    // Create a websocket server
    const wss = new WebSocket.Server({
        noServer: true,
        path: '/websockets',
    });

    // Handle the 'upgrade' request from our express server, pass it to our websocket server to handle the upgrade and emit a connection event
    expressServer.on('upgrade', (request, socket, head) => {
        wss.handleUpgrade(request, socket, head, (websocket) => {
            wss.emit('connection', websocket, request);
        });
    });

    // Handle the websocket server connection event
    wss.on('connection', (ws, connectionRequest) => {
        handleConnection(ws, connectionRequest);

        // Handle events from our websocket
        ws.on('message', (message) => {
            handleMessage(ws, message);
        });

        ws.on('close', () => {
            handleClose(ws);
        });
    });

    const handleConnection = (ws, connectionRequest) => {
        // Assign an id to the websocket so we can keep track of it
        ws.socketId = short.generate();

        console.log(`${ws.socketId} connected`);
    };

    const handleMessage = (ws, message) => {
        const parsedMessage = JSON.parse(message);
        const { method, data } = parsedMessage;

        switch(method) {
            case 'create-game':
                createGame(ws);
                break;
            case 'join-game':
                joinGame(ws, data);
                break;
            case 'player-ready':
                playerReady(ws);
                break;
            case 'update-letter':
                updateLetter(ws, data);
                break;
            case 'update-backspace':
                updateBackspace(ws, data);
                break;
            case 'make-guess':
                handleGuess(ws, data);
                break;
            case 'request-rematch':
                handleRematch(ws);
                break;
            case 'join-public-game':
                handleJoinPublicGame(ws);
                break;
        };
    };

    const handleClose = (ws) => {
        console.log(`${ws.socketId} disconnected`);

        if (playerWaiting === ws.socketId) {
            playerWaiting = null;
        }

        // update any games with this player
    };

    // Create a new game object and add it to our games array - send it to the client
    const createGame = (ws) => {
        if (playerWaiting === ws.socketId) {
            playerWaiting = null;
        }

        const gameId = short.generate();
                
        const newGame = {
            gameId,
            playerOne: ws.socketId,
            status: '0-waiting-for-player-two'
        };

        games.push(newGame);
        ws.gameId = gameId;

        messageClient(ws, 'set-player-number', true, {number: 'one'});
        messageClient(ws, 'create-game', true, {gameId});
        messageAllClients('game-id', true, gameId); // for testing only - remove later
    };

    // Find a game object by id and update it with the new player - send to both clients
    const joinGame = (ws, { gameId }) => {
        if (playerWaiting === ws.socketId) {
            playerWaiting = null;
        }

        const game = findGame(gameId);

        if(game === undefined) {
            messageClient(ws, 'join-game', false, {message: 'Game not found'});
            return;
        }

        if(game.status !== '0-waiting-for-player-two') {
            messageClient(ws, 'join-game', false, {message: 'Unable to join game'});
            return;
        }

        if(game.playerTwo) {
            messageClient(ws, 'join-game', false, {message: 'Game already has two players'});
            return;
        }

        if(game.playerOne === ws.socketId) {
            messageClient(ws, 'join-game', false, {message: 'You are already in this game'});
            return;
        }

        game.playerTwo = ws.socketId;
        game.status = '1-waiting-for-ready';
        game.playerOneReady = false;
        game.playerTwoReady = false;

        ws.gameId = gameId;

        messageClient(ws, 'set-player-number', true, {number: 'two'});
        messageAllClientsInGame(gameId, 'join-game', true, game);
    };

    const playerReady = (ws) => {
        // check if ws.gameId exists - send error if not

        const game = findGame(ws.gameId);
        
        // check if game exists - send error if not

        if(game.status !== '1-waiting-for-ready') {
            messageClient(ws, 'player-ready', false, {message: 'Unable to ready game'});
            return;
        }

        if(game.playerOne === ws.socketId) {
            game.playerOneReady = true;
            messageAllClientsInGame(ws.gameId, 'player-ready', true, {player: 'one'});
        } else if(game.playerTwo === ws.socketId) {
            game.playerTwoReady = true;
            messageAllClientsInGame(ws.gameId, 'player-ready', true, {player: 'two'});
        }
        
        if(game.playerOneReady && game.playerTwoReady) {
            game.status = '2-beginning-countdown';
            messageAllClientsInGame(ws.gameId, 'begin-countdown', true);

            setTimeout(() => {
                game.status = '3-start-game';
                game.word = generateWord();
                console.log(ws.gameId, game.word);
                game.playerOneRow = 0;
                game.playerTwoRow = 0;
                game.playerOneEnded = false;
                game.playerTwoEnded = false;
                game.playerOneInvalidGuesses = [];
                game.playerTwoInvalidGuesses = [];
                game.startedAt = moment();
                messageAllClientsInGame(ws.gameId, 'start-game', true);
            }, 3000);
        };
    }

    const findGame = gameId => {
        return games.find(game => {
            return game.gameId === gameId;
        });
    }

    const messageClient = (ws, method, success, data) => {
        ws.send(JSON.stringify({
            method, success, data 
        }))
    }

    // Checks all clients for the matching game id and sends a message
    const messageAllClientsInGame = (gameId, method, success, data) => {
        wss.clients.forEach(client => {
            if(client.gameId === gameId) {
                client.send(JSON.stringify({
                    method, success, data 
                }));
            }
        });
    };

    const messageAllClients = (method, success, data) => {
        wss.clients.forEach(client => {
            client.send(JSON.stringify({
                method, success, data 
            }));
        });
    }

    const messageOpponent = (playerId, game, method, success, data) => {
        let opponentId;
        if (game.playerOne === playerId) {
            opponentId = game.playerTwo;
        } else {
            opponentId = game.playerOne;
        }
        wss.clients.forEach(client => {
            if(client.socketId === opponentId) {
                messageClient(client, method, success, data);
            }
        })
    }

    const updateLetter = (ws, data) => {
        handleGameUpdate(ws, 'update-opponent-letter', data);
    }

    const updateBackspace = (ws, data) => {
        handleGameUpdate(ws, 'update-opponent-backspace', data);
    }

    const handleGameUpdate = (ws, method, data) => {
        const game = findGame(ws.gameId);

        if(game.status !== '3-start-game') return;

        // check if game exists

        messageOpponent(ws.socketId, game, method, true, data);
    }

    const handleGuess = (ws, { guess }) => {
        const game = findGame(ws.gameId);

        if(game.status !== '3-start-game') return;

        let player = getPlayer(ws, game);

        if(player === 1 && game.playerOneEnded) return;
        if(player === 2 && game.playerTwoEnded) return;

        const guessAsString = guess.join('');

        if(!wordList.includes(guessAsString)) {
            if(player === 1) {
                game.playerOneInvalidGuesses.push(guessAsString);
            } else {
                game.playerTwoInvalidGuesses.push(guessAsString);
            }
            messageClient(ws, 'invalid-word', true);
            messageOpponent(ws.socketId, game, 'opponent-invalid-word', true);
            return;
        }

        let response = [{}, {}, {}, {}, {}];
        let exactMatches = 0;

        const uniqueLetters = guess.filter(
            (element, index) => guess.indexOf(element) === index
        );

        uniqueLetters.forEach((letter) => {
            const guessPositions = guess
                .map((guessLetter, index) => (guessLetter === letter ? index : undefined))
                .filter((i) => i !== undefined);

            const actualPositions = game.word
                .map((actualLetter, index) => (actualLetter === letter ? index : undefined))
                .filter((i) => i !== undefined);

            const exactMatchPositions = guessPositions
                .map((index) => (actualPositions.includes(index) ? index : undefined))
                .filter((i) => i !== undefined);

            const partialMatchPositions = guessPositions
                .map((index) => (!actualPositions.includes(index) ? index : undefined))
                .filter((i) => i !== undefined);

            const remainingPartialMatchPositions = partialMatchPositions.slice(
                0,
                actualPositions.length - exactMatchPositions.length
            );

            const nonMatchPositions = partialMatchPositions.slice(
                actualPositions.length - exactMatchPositions.length
            );

            exactMatchPositions.forEach((index) => {
                response[index] = { letter, match: 2 };
                exactMatches++;
            });

            remainingPartialMatchPositions.forEach((index) => {
                response[index] = { letter, match: 1 };
            });

            nonMatchPositions.forEach((index) => {
                response[index] = { letter, match: 0 };
            });
        });

        const opponentResponse = response.map(r => {return {match: r.match}});

        if(exactMatches === 5) {
            //you win
            if(player === 1) {
                messageClient(ws, 'guess-response', true, {response, currentRow: game.playerOneRow});
                messageOpponent(ws.socketId, game, 'opponent-guess-response', true, {opponentResponse, opponentCurrentRow: game.playerOneRow});
                game.playerOneEnded = true;
                game.playerOneWin = true;
                game.playerOneTime = 0;
                game.playerOneEndedAt = moment();
                game.playerOneRow++;
                messageClient(ws, 'your-game-ended', true, {correct: true});
                messageOpponent(ws.socketId, game, 'opponent-game-ended', true);
                checkGameOver(game);
            } else {
                messageClient(ws, 'guess-response', true, {response, currentRow: game.playerTwoRow});
                messageOpponent(ws.socketId, game, 'opponent-guess-response', true, {opponentResponse, opponentCurrentRow: game.playerTwoRow});
                game.playerTwoEnded = true;
                game.playerTwoWin = true;
                game.playerTwoTime = 0;
                game.playerTwoEndedAt = moment();
                game.playerTwoRow++;
                messageClient(ws, 'your-game-ended', true, {correct: true});
                messageOpponent(ws.socketId, game, 'opponent-game-ended', true);
                checkGameOver(game);
            }
        } else {
            if(player === 1) {
                messageClient(ws, 'guess-response', true, {response, currentRow: game.playerOneRow});
                messageOpponent(ws.socketId, game, 'opponent-guess-response', true, {opponentResponse, opponentCurrentRow: game.playerOneRow});
                if(game.playerOneRow === 5) {
                    //you lose
                    game.playerOneEnded = true;
                    game.playerOneWin = false;
                    game.playerOneTime = 0;
                    game.playerOneEndedAt = moment();
                    game.playerOneRow++;
                    messageClient(ws, 'your-game-ended', true, {correct: false});
                    messageOpponent(game.playerTwo, game, 'opponent-game-ended', true);
                    checkGameOver(game);
                } else {
                    game.playerOneRow++
                }
            } else {
                messageClient(ws, 'guess-response', true, {response, currentRow: game.playerTwoRow});
                messageOpponent(ws.socketId, game, 'opponent-guess-response', true, {opponentResponse, opponentCurrentRow: game.playerTwoRow});
                if(game.playerTwoRow === 5) {
                    //you lose
                    game.playerTwoEnded = true;
                    game.playerTwoWin = false;
                    game.playerTwoTime = 0;
                    game.playerTwoEndedAt = moment();
                    game.playerTwoRow++;
                    messageClient(ws, 'your-game-ended', true, {correct: false});
                    messageOpponent(game.playerOne, game, 'opponent-game-ended', true);
                    checkGameOver(game);
                } else {
                    game.playerTwoRow++
                }
            }
        }
    }

    const generateWord = () => {
        return Array.from(wordList[Math.floor(Math.random() * wordList.length)]);
    }

    const checkGameOver = (game) => {
        if(game.playerOneEnded && game.playerTwoEnded) {
            game.status = '4-game-ended';
            
            const playerOneTimeInMs = calculateGameLength(game.startedAt, game.playerOneEndedAt);
            const playerTwoTimeInMs = calculateGameLength(game.startedAt, game.playerTwoEndedAt);
            
            const playerOneTime = formatGameLength(playerOneTimeInMs);
            const playerTwoTime = formatGameLength(playerTwoTimeInMs);

            const playerOnePoints = calculatePoints(game.playerOneRow, playerOneTimeInMs, game.playerOneWin);
            const playerTwoPoints = calculatePoints(game.playerTwoRow, playerTwoTimeInMs, game.playerTwoWin);

            let winner = 0;

            if (playerOnePoints === playerTwoPoints) {
                winner = 0;
            } else if (playerOnePoints > playerTwoPoints) {
                winner = 1;
            } else {
                winner = 2;
            }

            const stats = {
                playerOneGuesses: game.playerOneRow,
                playerOneTime: playerOneTime,
                playerOneWin: game.playerOneWin,
                playerOneInvalidGuesses: game.playerOneInvalidGuesses,
                playerOnePoints: playerOnePoints,
                playerTwoGuesses: game.playerTwoRow,
                playerTwoTime: playerTwoTime,
                playerTwoWin: game.playerTwoWin,
                playerTwoInvalidGuesses: game.playerTwoInvalidGuesses,
                playerTwoPoints: playerTwoPoints,
                winner,
                word: game.word
            }
            messageAllClientsInGame(game.gameId, 'game-ended', true, {stats});
        }
    }

    const getPlayer = (ws, game) => {
        if(ws.socketId === game.playerOne) {
            return 1;
        } else {
            return 2;
        }
    }

    const formatGameLength = (diff) => {
        const duration = moment.duration(diff);

        const minutes = duration.minutes().toString();

        let seconds = duration.seconds().toString();

        if (seconds.length === 1) seconds = `0${seconds}`;

        let milliseconds = duration.milliseconds().toString();

        if (milliseconds.length < 3) {
        milliseconds =
            milliseconds.length === 2 ? `0${milliseconds}` : `00${milliseconds}`;
        }

        const formattedTime = `${minutes}:${seconds}.${milliseconds}`;

        return formattedTime;
    }

    const calculateGameLength = (startedAt, endedAt) => {
        return endedAt.diff(startedAt);
    }

    const handleRematch = (ws) => {
        const game = findGame(ws.gameId);

        if (game.status !== '4-game-ended');

        const player = getPlayer(ws, game);

        if (player === 1) {
            game.playerOneRematch = true;
        } else {
            game.playerTwoRematch = true;
        }

        checkRematch(game);
    }

    const checkRematch = game => {
        if (game.playerOneRematch && game.playerTwoRematch) {
            game.status = '5-resetting';
            resetGame(game);
        }
    }

    const resetGame = (game) => {
        delete game.playerOneReady;
        delete game.playerTwoReady;
        delete game.word;
        delete game.playerOneRow;
        delete game.playerTwoRow;
        delete game.playerOneEnded;
        delete game.playerTwoEnded;
        delete game.playerOneInvalidGuesses;
        delete game.playerTwoInvalidGuesses;
        delete game.startedAt;
        delete game.playerOneWin;
        delete game.playerOneTime;
        delete game.playerOneEndedAt;
        delete game.playerTwoWin;
        delete game.playerTwoTime;
        delete game.playerTwoEndedAt;
        delete game.playerOneRematch;
        delete game.playerTwoRematch;

        game.status = '1-waiting-for-ready';
        game.playerOneReady = false;
        game.playerTwoReady = false;

        messageAllClientsInGame(game.gameId, 'rematch-game', true);
    }

    const handleJoinPublicGame = ws => {
        if (playerWaiting === null) {
            playerWaiting = ws.socketId;
        } else {
            const playerWaitingSocket = getWsBySocketId(playerWaiting);
            playerWaiting = null;

            const gameId = short.generate();

            const newGame = {
                gameId,
                playerOne: playerWaitingSocket.socketId,
                playerTwo: ws.socketId,
                status: '1-waiting-for-ready',
                playerOneReady: false,
                playerTwoReady: false
            };
    
            games.push(newGame);
            playerWaitingSocket.gameId = gameId;
            ws.gameId = gameId;

            messageClient(playerWaitingSocket, 'set-player-number', true, {number: 'one'});
            messageClient(ws, 'set-player-number', true, {number: 'two'});
            messageAllClientsInGame(gameId, 'join-game', true, newGame);
        }
    }

    const getWsBySocketId = id => {
        let socket;
        wss.clients.forEach(client => {
            if (client.socketId === id) {
                socket = client;
            }
        })
        return socket;
    }

    const calculatePoints = (guesses, time, win) => {
        let points = 0;
        if (guesses === 1) {
            points = points + 100;
        } else if (guesses === 2) {
            points = points + 70;
        } else if (guesses < 4) {
            points = points + 50;
        } else if (guesses < 6) {
            points = points + 20;
        }

        if (win) {
            points = points + 100;
        }

        if (win && time < 10000) {
            points = points + 100;
        } else if (win && time < 30000) {
            points = points + 50;
        } else if (win && time < 60000) {
            points = points + 20;
        }

        return points;
    }
}