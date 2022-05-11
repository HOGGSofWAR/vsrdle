// Import packages
const WebSocket = require('ws');
const short = require('short-uuid');

const games = [];

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
        const { method } = parsedMessage;

        switch(method) {
            case 'create-game':
                createGame(ws);
                break;
            case 'join-game':
                joinGame(ws, parsedMessage);
                break;
        };
    };

    const handleClose = (ws) => {
        console.log(`${ws.socketId} disconnected`);

        // update any games with this player
    };

    // Create a new game object and add it to our games array - send it to the client
    const createGame = (ws) => {
        let gameId = short.generate();
                
        const newGame = {
            gameId,
            playerOne: ws.socketId,
            status: '0-waiting-for-player-two'
        };

        games.push(newGame);
        ws.gameId = gameId;

        messageClient(ws, 'create-game', true, newGame);
    };

    // Find a game object by id and update it with the new player - send to both clients
    const joinGame = (ws, message) => {
        let gameId = message.data.gameId;

        const game = games.find(game => {
            return game.gameId === gameId;
        });

        if(game === undefined) {
            messageClient(ws, 'join-game', false, {message: 'game not found'});
            return;
        }

        if(game.status !== '0-waiting-for-player-two') {
            messageClient(ws, 'join-game', false, {message: 'game already playing'});
            return;
        }

        if(game.playerTwo) {
            messageClient(ws, 'join-game', false, {message: 'game already has two players'});
            return;
        }

        if(game.playerOne === ws.socketId) {
            messageClient(ws, 'join-game', false, {message: 'you are already in this game'});
            return;
        }

        game.playerTwo = ws.socketId;
        game.status = '1-waiting-for-ready';

        ws.gameId = gameId;

        messageAllClientsInGame({method: 'join-game', success: true, data: game}, gameId);
    };

    const messageClient = (ws, method, success, data) => {
        ws.send(JSON.stringify({
            method, success, data 
        }))
    }

    // Checks all clients for the matching game id and sends a message
    const messageAllClientsInGame = (message, gameId) => {
        wss.clients.forEach(client => {
            if(client.gameId === gameId) {
                client.send(JSON.stringify(message));
            }
        });
    };
}