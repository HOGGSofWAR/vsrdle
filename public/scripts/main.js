// Create a new websocket connection (location.host will make the request to the same host this page is served from)
let socket = new WebSocket(`wss://${location.host}/websockets`);

const validLetters = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'Enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '<<', 'Backspace'];

const rows = 6;
const blocks = 5;
let currentRow = 0;
let currentBlock = 0;
let currentGuess = [];
let playerNumber;
let keypadEnabled = false;
let gameTime = 0;

// Element selectors
const createGameButton = document.querySelector('.start-game__button--create');
const joinGameForm = document.querySelector('.start-game__join');
const gameCodeOutput = document.querySelector('.game-code__code');
const startGameContainer = document.querySelector('.start-game');
const gameContainer = document.querySelector('.game');
const gameboardElements = document.querySelectorAll('.gameboard');
const keypadElements = document.querySelectorAll('.keypad');
const readyButtonContainers = document.querySelectorAll('.ready');
const playerTwoNameOutput = document.querySelector('.player-text--two');
const playerOneReadyButton = document.querySelector('.ready__button--one');
const playerTwoReadyButton = document.querySelector('.ready__button--two');
const countdownContainer = document.querySelector('.countdown');
const keypad = document.querySelector('.keypad--one');
const errorElement = document.querySelector('.error-messages__text--one');
const opponentErrorElement = document.querySelector('.error-messages__text--two');
const messageElements = document.querySelectorAll('.messages__text');
const startGameError = document.querySelector('.start-game__text--error');
const statsModal = document.querySelector('.modal--stats');
const rematchButton = document.querySelector('.modal__button--rematch');
const quitGameButton = document.querySelector('.modal__button--quit');
const timerOutput = document.querySelector('.timer__time');
const matchmakeButton = document.querySelector('.start-game__button--matchmake');
const overlay = document.querySelector('.overlay');
const gameCodeCopy = document.querySelector('.game-code__copy');
const gameCodeReveal = document.querySelector('.game-code__reveal');

// Generate HTML
const generateGameboard = (gameBoardElement) => {
    gameBoardElement.innerHTML = '';
    for(let i = 0; i < rows; i++) {
    let rowElement = document.createElement('div');
    rowElement.classList.add('gameboard__row');

    for(let x = 0; x < blocks; x++) {
      let blockElement = document.createElement('div');
      let p = document.createElement('p');
      blockElement.classList.add('gameboard__block');
      blockElement.appendChild(p);

      rowElement.appendChild(blockElement);
    };

    gameBoardElement.appendChild(rowElement);
  };
};

gameboardElements.forEach(gameBoardElement => {
    generateGameboard(gameBoardElement);
});

const generateKeypad = (keypadElement) => {
    keypadElement.innerHTML = '';
    const keyboardValues = [
        ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
        ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
        ['Enter', 'z', 'x', 'c', 'v', 'b', 'n', 'm', '<<']
    ];

    keyboardValues.forEach(row => {
        let rowElement = document.createElement('div');
        rowElement.classList.add('keypad__row');

        row.forEach(value => {
        let blockElement = document.createElement('button');
        blockElement.classList.add('keypad__button');
        blockElement.textContent = value;
        blockElement.setAttribute('data-letter', value);

        rowElement.appendChild(blockElement);
        });

        keypadElement.appendChild(rowElement);
    });
};

keypadElements.forEach(keypadElement => {
    generateKeypad(keypadElement);
});


// Handle events from our websocket
socket.addEventListener('open', () => {

});

socket.addEventListener('message', ({data: message}) => {
    const parsedMessage = JSON.parse(message);

    // console.log(parsedMessage);

    const { method, success, data } = parsedMessage;

    if(!success) {
        handleError(data);
        return;
    }

    switch(method) {
        case 'set-player-number':
            handleSetPlayerNumber(data);
            break;
        case 'create-game':
            handleCreateGame(data);
            break;
        case 'join-game':
            handleCreateGame(data);
            handleJoinGame();
            break;
        case 'player-ready':
            handlePlayerReady(data);
            break;
        case 'begin-countdown':
            handleCountdown();
            break;
        case 'start-game':
            handleStartGame();
            break;
        case 'update-opponent-letter':
            handleOpponentLetter(data);
            break;
        case 'update-opponent-backspace':
            handleOpponentBackspace(data);
            break;
        case 'invalid-word':
            handleInvalidWord();
            break;
        case 'opponent-invalid-word':
            handleOpponentInvalidWord();
            break;
        case 'guess-response':
            handleGuessResponse(data);
            break;
        case 'opponent-guess-response':
            handleOpponentGuessResponse(data);
            break;
        case 'your-game-ended':
            handleYourGameEnded(data);
            break;
        case 'opponent-game-ended':
            handleOpponentGameEnded();
            break;
        case 'game-ended':
            handleGameEnded(data);
            break;
        case 'rematch-game':
            handleRematchGame();
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

const handleError = ({message}) => {
    // console.log(message);

    startGameError.innerText = message;
}

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

const handleCreateGame = ({ gameId }) => {
    gameCodeOutput.value = gameId;
    startGameContainer.classList.add('start-game--hidden');
    gameContainer.classList.add('game--visible');
}

const handleJoinGame = () => {
    readyButtonContainers.forEach(readyButtonContainer => {
        readyButtonContainer.classList.add('ready--visible');
    });
    playerTwoNameOutput.innerText = 'Player two';
}

playerOneReadyButton.addEventListener('click', () => {
    messageServer('player-ready');
})

const handlePlayerReady = ({player}) => {
    if(player === 'one') {
        if(playerNumber === 'one') {
            playerOneReadyButton.classList.add('ready__button--active');
            playerOneReadyButton.disabled = true;
        } else {
            playerTwoReadyButton.classList.add('ready__button--active');
        }
    } else {
        if(playerNumber === 'two') {
            playerOneReadyButton.classList.add('ready__button--active');
            playerOneReadyButton.disabled = true;
        } else {
            playerTwoReadyButton.classList.add('ready__button--active');
        }
    }
}

const handleSetPlayerNumber = ({number}) => {
    playerNumber = number;
}

const handleCountdown = () => {
    countdownContainer.classList.add('countdown--visible');

    let countdown = 3;
    const countdownInterval = setInterval(() => {
        countdown--;
        if(countdown === 1) {
            clearInterval(countdownInterval);
        }
        countdownContainer.children[0].innerText = countdown;
    }, 1000);
}

const handleStartGame = () => {
    hideReadyButtons();
    countdownContainer.children[0].innerText = 'Go!';
    setTimeout(() => {
        countdownContainer.children[0].innerText = '3';
        countdownContainer.classList.remove('countdown--visible');
    }, 1000);

    enableKeypad();
    startGameTimer();
}

keypad.addEventListener('click', e => {
    if(keypadEnabled) {
        if(!e.target.classList.contains('keypad__button')) return;
        const letter = e.target.dataset.letter;
        handleKeypadInput(letter);
    }
})

document.addEventListener('keydown', e => {
    if(keypadEnabled) {
        const letter = e.key;
        handleKeypadInput(letter);
    }
})

const handleKeypadInput = letter => {
    if(!validLetters.includes(letter)) return;

    switch(letter){
        case '<<':
        case 'Backspace':
          handleBackspace();
          break;
        case 'Enter':
          handleEnter();
          break;
        default:
          handleLetter(letter);
      }
}

const handleBackspace = () => {
    if(currentBlock === 0) return;
    currentGuess.pop();
  
    currentBlock--;
    gameboardElements[0].children[currentRow].children[currentBlock].children[0].innerHTML = '';

    messageServer('update-backspace', {currentRow, currentBlock});
};

const handleEnter = () => {
    errorElement.innerHTML = '';

    if(currentBlock !== blocks){
      errorElement.innerHTML = 'Not enough letters';
      clearErrorTimer(false, 5000);
      return;
    }

    disableKeypad();
    messageServer('make-guess', {guess: currentGuess});
};

const handleLetter = (letter) => {

    if(currentBlock > (blocks - 1)) return;
    gameboardElements[0].children[currentRow].children[currentBlock].children[0].innerHTML = letter;
    
    currentGuess[currentBlock] = letter;

    messageServer('update-letter', {currentRow, currentBlock});

    currentBlock++;
};

const handleOpponentLetter = (data) => {
    gameboardElements[1].children[data.currentRow].children[data.currentBlock].children[0].innerHTML = '?';
};

const handleOpponentBackspace = (data) => {
    gameboardElements[1].children[data.currentRow].children[data.currentBlock].children[0].innerHTML = '';
};

const handleInvalidWord = () => {
    errorElement.innerText = 'This is not a valid word';
    clearErrorTimer(false, 5000);
    enableKeypad();
};

const handleOpponentInvalidWord = () => {
    opponentErrorElement.innerText = 'Lol they guessed an invalid word';
    clearErrorTimer(true, 5000);
};

const handleGuessResponse = ({response, currentRow: serverCurrentRow}) => {
    response.forEach(({letter, match}, index) => {
        if(match === 2) {
            gameboardElements[0].children[currentRow].children[index].classList.add('gameboard__block--green');
            keypadElements[0].querySelector(`[data-letter=${letter}]`).classList.add('keypad__button--green');
        } else if(match === 1) {
            gameboardElements[0].children[currentRow].children[index].classList.add('gameboard__block--yellow');
            keypadElements[0].querySelector(`[data-letter=${letter}]`).classList.add('keypad__button--yellow');
        } else {
            gameboardElements[0].children[currentRow].children[index].classList.add('gameboard__block--grey');
            keypadElements[0].querySelector(`[data-letter=${letter}]`).classList.add('keypad__button--grey');
        }
    })

    currentRow++;
    currentBlock = 0;

    enableKeypad();
};

const handleOpponentGuessResponse = ({opponentResponse, opponentCurrentRow}) => {
    opponentResponse.forEach(({letter, match}, index) => {
        gameboardElements[1].children[opponentCurrentRow].children[index].innerText = '';
        if(match === 2) {
            gameboardElements[1].children[opponentCurrentRow].children[index].classList.add('gameboard__block--green');
        } else if(match === 1) {
            gameboardElements[1].children[opponentCurrentRow].children[index].classList.add('gameboard__block--yellow');
        } else {
            gameboardElements[1].children[opponentCurrentRow].children[index].classList.add('gameboard__block--grey');
        }
    });
}

const handleYourGameEnded = ({correct}) => {
    disableKeypad();
    stopGameTimer();
    if(correct) {
        messageElements[0].innerText = 'Congrats! You guessed the correct word!';
    } else {
        messageElements[0].innerText = 'Out of guesses! You did not guess the correct word. :(';
    }
}

const handleOpponentGameEnded = () => {

}

const handleGameEnded = ({stats}) => {
    const playerOneStatsOutput = statsModal.querySelector('.modal__player--one');
    const playerTwoStatsOutput = statsModal.querySelector('.modal__player--two');

    if (playerNumber === 'one') {
        playerOneStatsOutput.children[0].innerText = 'Your stats';
        playerTwoStatsOutput.children[0].innerText = 'Opponent stats';
    } else {
        playerOneStatsOutput.children[0].innerText = 'Opponent stats';
        playerTwoStatsOutput.children[0].innerText = 'Your stats';
    }

    playerOneStatsOutput.children[1].innerText = `points: ${stats.playerOnePoints}`;
    playerOneStatsOutput.children[2].innerText = `guesses: ${stats.playerOneGuesses}`;
    if (stats.playerOneInvalidGuesses.length > 0) {
        playerOneStatsOutput.children[3].innerText = `invalid guesses: ${stats.playerOneInvalidGuesses.join(', ')}`;
    } else {
        playerOneStatsOutput.children[3].innerText = '';
    }
    playerOneStatsOutput.children[4].innerText = `time: ${stats.playerOneTime}`;
    if (stats.playerOneWin) {
        playerOneStatsOutput.children[5].innerText = 'Player one guessed correctly!';
    } else {
        playerOneStatsOutput.children[5].innerText = 'Player one did not guess the word!';
    }

    playerTwoStatsOutput.children[1].innerText = `points: ${stats.playerTwoPoints}`;
    playerTwoStatsOutput.children[2].innerText = `guesses: ${stats.playerTwoGuesses}`;
    if (stats.playerTwoInvalidGuesses.length > 0) {
        playerTwoStatsOutput.children[3].innerText = `invalid guesses: ${stats.playerTwoInvalidGuesses.join(', ')}`;
    } else {
        playerTwoStatsOutput.children[3].innerText = '';
    }
    playerTwoStatsOutput.children[4].innerText = `time: ${stats.playerTwoTime}`;
    if (stats.playerTwoWin) {
        playerTwoStatsOutput.children[5].innerText = 'Player two guessed correctly!';
    } else {
        playerTwoStatsOutput.children[5].innerText = 'Player two did not guess the word!';
    }

    let winText = '';

    if (stats.winner === 0) {
        winText = `It's a draw!`;
    } else if (stats.winner === 1) {
        if (playerNumber === 'one') {
            winText = 'You win!';
        } else {
            winText = 'You lose!';
        }
    } else {
        if (playerNumber === 'two') {
            winText = 'You win!';
        } else {
            winText = 'You lose!';
        }
    }
    statsModal.querySelector('.modal__winner').innerText = winText;
    statsModal.querySelector('.modal__word').innerText = `The word was: ${stats.word.join('')}`;

    statsModal.classList.add('modal--visible');
    overlay.classList.add('overlay--active');
}

const handleQuitGame = () => {
    location.reload();
}

const handleCloseModal = () => {
    statsModal.classList.remove('modal--visible');
    overlay.classList.remove('overlay--active');
}

const disableKeypad = () => {
    keypadEnabled = false;
}

const enableKeypad = () => {
    keypadEnabled = true;
}

rematchButton.addEventListener('click', () => {
    rematchButton.classList.add('modal__button--active');
    rematchButton.disabled = true;
    messageServer('request-rematch');
})

quitGameButton.addEventListener('click', () => {
    handleQuitGame();
})

const handleRematchGame = () => {
    handleCloseModal();
    disableKeypad();
    currentRow = 0;
    currentBlock = 0;
    currentGuess = [];

    gameboardElements.forEach(gameBoardElement => {
        generateGameboard(gameBoardElement);
    });
    
    keypadElements.forEach(keypadElement => {
        generateKeypad(keypadElement);
    });

    playerOneReadyButton.disabled = false;
    playerOneReadyButton.classList.remove('ready__button--active');
    playerTwoReadyButton.classList.remove('ready__button--active');

    clearErrors();
    clearOpponentErrors();

    clearMessages();
    clearOpponentMessages();

    rematchButton.classList.remove('modal__button--active');
    rematchButton.disabled = false;

    showReadyButtons();
}

const clearErrors = () => {
    errorElement.innerText = '';
}

const clearOpponentErrors = () => {
    opponentErrorElement.innerText = '';
}

const clearMessages = () => {
    messageElements[0].innerText = '';
}

const clearOpponentMessages = () => {
    messageElements[1].innerText = '';
}

let errorTimer;
let messageTimer;

const clearErrorTimer = (opponentError, time) => {
    clearTimeout(errorTimer);
    runErrorTimer(opponentError, time);
}

const runErrorTimer = (opponentError, time) => {
    errorTimer = setTimeout(() => {
        if (opponentError) {
            clearOpponentErrors();
        } else {
            clearErrors();
        }
    }, time);
}

const clearMessageTimer = (opponentMessage, time) => {
    clearTimeout(messageTimer);
    runMessageTimer(opponentMessage, time);
}

const runMessageTimer = (opponentMessage, time) => {
    messageTimer = setTimeout(() => {
        if (opponentMessage) {
            clearOpponentMessages();
        } else {
            clearMessages();
        }
    }, time);
}

let gameTimer;

const startGameTimer = () => {
    gameTime = 0;
    timerOutput.innerText = formatTime(gameTime);
    runGameTimer();
}

const stopGameTimer = () => {
    clearInterval(gameTimer);
}

const runGameTimer = () => {
    gameTimer = setInterval(() => {
        gameTime++;
        timerOutput.innerText = formatTime(gameTime);
    }, 1000);
}

const formatTime = (gameTime) => {
    const sec_num = parseInt(gameTime, 10); // don't forget the second param
    let hours   = Math.floor(sec_num / 3600);
    let minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    let seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    
    if (hours === '00') {
        return minutes+':'+seconds;
    } else {
        return hours+':'+minutes+':'+seconds;
    }
}

matchmakeButton.addEventListener('click', () => {
    matchmakeButton.innerText = 'Searching...';
    matchmakeButton.classList.add('start-game__button--active');
    messageServer('join-public-game');
})

const hideReadyButtons = () => {
    playerOneReadyButton.classList.add('ready__button--hidden');
    playerTwoReadyButton.classList.add('ready__button--hidden');
};

const showReadyButtons = () => {
    playerOneReadyButton.classList.remove('ready__button--hidden');
    playerTwoReadyButton.classList.remove('ready__button--hidden');
};

gameCodeCopy.addEventListener('click', () => {
    const code = gameCodeOutput.value;

    navigator.clipboard.writeText(code);
})

gameCodeReveal.addEventListener('click', () => {
    gameCodeOutput.classList.add('game-code__code--no-blur');
})