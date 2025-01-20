class GameController {
    constructor() {
        this.board = Array(8).fill().map(() => Array(8).fill(false))

        //used for complex evaluation, unused by default
        this.emptyStraightReward = 40;
        this.clusteredReward = 0;
        this.emptyIslandPenalty = -30;
        this.emptyCellReward = 4;
        this.edgePenalty = -1;

        this.combo = 0;
        this.movesSinceLastClear = 0;
    }


    addPiece(piece, x, y) {
        let result = true;

        for (let i = 0; i < piece.length; i++) {
            let pieceX = piece[i][0] + x
            let pieceY = piece[i][1] + y

            if (pieceX < 0 || pieceX >= 8 || pieceY < 0 || pieceY >= 8 || this.board[pieceX][pieceY]) {
                result = false
                break
            }
        }

        if (!result) {
            return false;
        }

        for (let i = 0; i < piece.length; i++) {
            let pieceX = piece[i][0] + x
            let pieceY = piece[i][1] + y
            this.board[pieceX][pieceY] = true
        }

        this.checkCombos();

        this.movesSinceLastClear += 1;
        if (this.movesSinceLastClear >= 3) {
            this.combo = 0;
        }

        return true;
    }

    checkCombos() {
        let rows = Array(8).fill(false)
        let columns = Array(8).fill(false)

        //if a row or column is fully filled, set the corresponding index to true
        for (let i = 0; i < 8; i++) {
            let row = this.board[i]
            let column = this.board.map(row => row[i])

            if (row.every(cell => cell)) {
                rows[i] = true;

                this.combo += 1;
                this.movesSinceLastClear = -1;
            }

            if (column.every(cell => cell)) {
                columns[i] = true;

                this.combo += 1;
                this.movesSinceLastClear = -1;
            }
        }

        //remove the rows and columns that are filled
        for (let i = 0; i < 8; i++) {
            if (rows[i]) {
                this.board[i] = Array(8).fill(false);
            }

            if (columns[i]) {
                for (let j = 0; j < 8; j++) {
                    this.board[j][i] = false;
                }
            }
        }
    }

    evaluateBoard(useSimpleEvaluation = true) {

        if (useSimpleEvaluation) {
            let numFilled = 0;
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    if (this.board[i][j]) {
                        numFilled += 1;
                    }
                }
            }

            return numFilled;
        }


        let score = 0;

        const size = this.board.length; // 8 for an 8x8 board

        // Check empty rows and columns
        for (let i = 0; i < size; i++) {
            let rowEmpty = true;
            let colEmpty = true;

            for (let j = 0; j < size; j++) {
                if (this.board[i][j]) rowEmpty = false; // Row has a block
                if (this.board[j][i]) colEmpty = false; // Column has a block

                if (this.board[i][j] == false) {
                    score += this.emptyCellReward;
                }
            }

            if (rowEmpty) score += this.emptyStraightReward; // Reward empty rows
            if (colEmpty) score += this.emptyStraightReward; // Reward empty columns
        }

        // Check clustering and edge/corner emptiness
        const directions = [
            [0, 1], [1, 0], [0, -1], [-1, 0], // Adjacent cells (orthogonal)
            [1, 1], [-1, -1], [1, -1], [-1, 1] // Diagonal cells
        ];

        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (this.board[i][j]) {
                    // Reward for each adjacent block
                    for (const [dx, dy] of directions) {
                        const ni = i + dx, nj = j + dy;
                        if (ni >= 0 && ni < size && nj >= 0 && nj < size && this.board[ni][nj]) {
                            score += this.clusteredReward; // Reward clusters
                        }
                    }

                    //penalty for each adjacent empty
                    for (const [dx, dy] of directions) {
                        const ni = i + dx, nj = j + dy;
                        if (ni >= 0 && ni < size && nj >= 0 && nj < size && !this.board[ni][nj]) {
                            score += this.edgePenalty;
                        }
                    }
                }
            }
        }

        const orthoDirections = directions.slice(0, 4);

        // Add penalty for empty islands
        const visited = Array.from({ length: size }, () => Array(size).fill(false));
        const floodFill = (x, y) => {
            let count = 0;
            const stack = [[x, y]];
            visited[x][y] = true;

            while (stack.length > 0) {
                const [cx, cy] = stack.pop();
                count++;

                for (const [dx, dy] of orthoDirections) {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (nx >= 0 && nx < size && ny >= 0 && ny < size &&
                        !visited[nx][ny] && !this.board[nx][ny]) {
                        visited[nx][ny] = true;
                        stack.push([nx, ny]);
                    }
                }
            }

            return count;
        };


        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                if (!visited[i][j] && !this.board[i][j]) {
                    // Found a new island of empty tiles
                    floodFill(i, j);
                    score += this.emptyIslandPenalty; // Apply penalty for each island
                }
            }
        }


        return score;
    }

    clone() {
        let newGame = new GameController()
        newGame.board = this.board.map(row => row.slice());
        newGame.combo = this.combo;
        newGame.movesSinceLastClear = this.movesSinceLastClear;
        return newGame
    }
}

class Move {
    constructor(x, y, piece, projectedScore) {
        this.x = x;
        this.y = y;
        this.piece = piece;
        this.projectedScore = projectedScore;
        this.nextMove = null;
    }
}

let game = new GameController();
let currentMove = null;
let pieces = [];

function placeSelectedPiece() {

    if(!currentMove) {
        return;
    }

    let cells = gameGridDiv.getElementsByClassName('cell');
    for (let i = 0; i < cells.length; i++) {
        cells[i].classList.remove('highlighted');
    }

    game.addPiece(currentMove.piece, currentMove.x, currentMove.y);

    //copy the board to the grid
    for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
            let cell = cells[i * 8 + j];
            if (game.board[i][j]) {
                cell.classList.add('on');
            } else {
                cell.classList.remove('on');
            }
        }
    }



    currentMove = currentMove.nextMove;
    if (currentMove) {
        //highlight the next move
        for (let i = 0; i < currentMove.piece.length; i++) {
            let x = currentMove.piece[i][0] + currentMove.x;
            let y = currentMove.piece[i][1] + currentMove.y;
            cells[x * 8 + y].classList.add('highlighted');
        }
    }
}

function loadBestSequence() {

    if(pieces.length == 0) {
        return;
    }

    let bestMove = getBestMoveFromPieces(game, pieces, game.combo);

    if(bestMove == null) {
        document.getElementById('errorDiv').style.display = 'block';
        return;
    }else{
        document.getElementById('errorDiv').style.display = 'none';
    }

    //highlight the first move
    for (let i = 0; i < bestMove.piece.length; i++) {
        let x = bestMove.piece[i][0] + bestMove.x;
        let y = bestMove.piece[i][1] + bestMove.y;

        gameGridDiv.getElementsByClassName('cell')[x * 8 + y].classList.add('highlighted');
    }

    pieces = [];
    document.getElementById('piecesDiv').innerHTML = '';

    currentMove = bestMove;
}

function getBestMoveFromPieces(currentGame, givenPieces, originalCombo) {

    let bestMove = null;

    for (let piece of givenPieces) {
        let newPieces = givenPieces.filter(p => p !== piece);

        //for each position
        for (let x = 0; x < 8; x++) {
            for (let y = 0; y < 8; y++) {
                let newGame = currentGame.clone();

                if (!newGame.addPiece(piece, x, y)) {
                    continue;
                }

                let score;
                let nextMove;
                if (newPieces.length > 0) {
                    nextMove = getBestMoveFromPieces(newGame, newPieces, originalCombo);
                    if (nextMove == null) {
                        continue;
                    }
                    score = nextMove.projectedScore;

                } else {
                    score = newGame.evaluateBoard();

                    score += movesSinceLastClearPenalty * newGame.movesSinceLastClear;
                    if (newGame.combo < originalCombo) {
                        score += lowComboPenalty;
                    }
                }

                if (bestMove == null || score > bestMove.projectedScore) {
                    bestMove = new Move(x, y, piece, score);
                    bestMove.nextMove = nextMove;
                }
            }
        }
    }

    return bestMove;
}

const gameGridDiv = document.getElementById('gameGridDiv');
const selectionGridDiv = document.getElementById('selectionGridDiv');
let isDragging = false;
let toggledCells = new Set(); // To keep track of toggled cells during a drag

const movesSinceLastClearPenalty = -500;
const lowComboPenalty = -10_000;

function createGrid(div, editable = true) {
    // Create the 8x8 grid
    for (let i = 0; i < 64; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        div.appendChild(cell);
    }

    if (!editable) {
        return;
    }


    // Event handlers
    div.addEventListener('mousedown', (event) => {
        if (event.target.classList.contains('cell')) {
            event.preventDefault();
            isDragging = true;
            toggledCells = new Set(); // Reset toggled cells
            toggleCell(event.target); // Toggle the initial cell
        }
    });

    div.addEventListener('mouseup', () => {
        isDragging = false;
    });

    div.addEventListener('mouseleave', () => {
        isDragging = false;
    });

    div.addEventListener('mousemove', (event) => {

        if (isDragging && event.target.classList.contains('cell') && !toggledCells.has(event.target)) {
            toggleCell(event.target);
        }
    });
}

function toggleCell(cell) {
    cell.classList.toggle('on');
    toggledCells.add(cell); // Mark the cell as toggled for this drag

    //if this cell is a child of gameGridDiv, set the cell value in the game object
    if (cell.parentElement == gameGridDiv) {

        let index = Array.from(cell.parentElement.children).indexOf(cell);

        let x = Math.floor(index / 8);
        let y = index % 8;

        game.board[x][y] = cell.classList.contains('on');
    }
}

document.getElementById('addPieceButton').addEventListener('click', () => {
    const selectionCells = selectionGridDiv.getElementsByClassName('cell');

    const pieceDiv = document.createElement('div');
    pieceDiv.classList.add('gridDiv');
    pieceDiv.classList.add('pieceGridDiv');
    pieceDiv.addEventListener('click', () => {
        //remove the pieceDiv when clicked, from both pieceCells and pieces
        for (let i = 0; i < pieces.length; i++) {
            if (pieces[i] == piece) {
                pieces.splice(i, 1);
                break;
            }
        }

        pieceDiv.parentNode.removeChild(pieceDiv);
    });
    createGrid(pieceDiv, false);

    const pieceCells = pieceDiv.getElementsByClassName('cell');

    let piece = [];
    let minX = 8;
    let minY = 8;

    for (let i = 0; i < selectionCells.length; i++) {
        if (selectionCells[i].classList.contains('on')) {
            //turn on the corresponding cell in the pieceDiv
            pieceCells[i].classList.add('on');

            let x = Math.floor(i / 8);
            let y = i % 8;

            piece.push([x, y]);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
        }
    }

    if(piece.length == 0) {
        return;
    }

    //normalize the piece
    for (let i = 0; i < piece.length; i++) {
        piece[i][0] -= minX;
        piece[i][1] -= minY;
    }

    pieces.push(piece);



    //clear selectionGridDiv
    for (let i = 0; i < selectionCells.length; i++) {
        selectionCells[i].classList.remove('on');
    }

    document.getElementById('piecesDiv').appendChild(pieceDiv);
});

document.getElementById('placePieceButton').addEventListener('click', () => {
    placeSelectedPiece();
});

document.getElementById('loadSequenceButton').addEventListener('click', () => {
    loadBestSequence();
});

createGrid(gameGridDiv);
createGrid(selectionGridDiv);