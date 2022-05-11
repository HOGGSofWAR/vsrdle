// Create a new websocket connection (location.host will make the request to the same host this page is served from)
let socket = new WebSocket(`ws://${location.host}/websockets`);

// Element selectors
const createGameButton = document.querySelector('.start-game__button--create');
const joinGameForm = document.querySelector('.start-game__join');
const gameCodeOutput = document.querySelector('.game-code__code');

// Handle events from our websocket
socket.addEventListener('open', () => {

});

socket.addEventListener('message', ({data}) => {
    const parsedMessage = JSON.parse(data);

    console.log(parsedMessage);

    const { method } = parsedMessage;

    switch(method) {
        case 'create-game':
            const gameId = parsedMessage.data.gameId;
            gameCodeOutput.innerText = gameId;
            break;
    }
});

socket.addEventListener('close', () => {
    console.log('close');

    // show some kind of disconnected message
});

socket.addEventListener('error', (e) => {
    console.log('error', e);

    // show some kind of error message
});

createGameButton.addEventListener('click', () => {
    messageServer('create-game');
});

joinGameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const gameId = e.target.gameId.value;
    if(gameId === null || gameId === '') return;
    messageServer('join-game', {gameId});
});

const messageServer = (method, data) => {
    socket.send(JSON.stringify({
        method, data 
    }))
}