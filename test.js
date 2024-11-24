// test.js
const { MinimalChessEngine } = require("./MinimalChessEngine");

class ChessDisplay {
  static pieces = {
    0: ".",
    1: "♟",
    9: "♙", // Pawns
    2: "♞",
    10: "♘", // Knights
    3: "♝",
    11: "♗", // Bishops
    4: "♜",
    12: "♖", // Rooks
    5: "♛",
    13: "♕", // Queens
    6: "♚",
    14: "♔", // Kings
  };

  static delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  static printBoard(board, lastMove = null) {
    console.log("\n     a  b  c  d  e  f  g  h");
    console.log("   ┌─────────────────────────┐");

    for (let rank = 0; rank < 8; rank++) {
      process.stdout.write(` ${8 - rank} │`);
      for (let file = 0; file < 8; file++) {
        const square = rank * 8 + file;
        const piece = board[square];
        const isLastMove =
          lastMove && (square === lastMove.from || square === lastMove.to);

        if (isLastMove) {
          process.stdout.write("\x1b[43m"); // Yellow background
        }

        process.stdout.write(` ${this.pieces[piece] || "."} `);

        if (isLastMove) {
          process.stdout.write("\x1b[0m"); // Reset colors
        }
      }
      console.log("│");
    }
    console.log("   └─────────────────────────┘\n");
  }

  static formatMove(moveNum, move, isWhite) {
    if (!move) return "null";
    const { from, to } = move;
    const files = "abcdefgh";
    const ranks = "87654321";
    const fromSquare = `${files[from % 8]}${ranks[Math.floor(from / 8)]}`;
    const toSquare = `${files[to % 8]}${ranks[Math.floor(to / 8)]}`;
    return `${Math.floor(moveNum / 2) + 1}${
      isWhite ? "." : "..."
    } ${fromSquare}-${toSquare}`;
  }
}

async function playSelfGame(maxMoves = 50, moveDelay = 2000) {
  const engine = new MinimalChessEngine();
  let moveCount = 0;
  let lastMove = null;

  // Track game state
  const gameStats = {
    totalMoves: 0,
    captures: 0,
    evaluations: [],
    times: [],
    memoryUsage: [],
  };

  console.log("\nInitial position:");
  ChessDisplay.printBoard(engine.board);
  await ChessDisplay.delay(moveDelay);

  while (moveCount < maxMoves) {
    const startTime = Date.now();
    const isWhiteTurn = moveCount % 2 === 0;

    // Get and validate move
    const move = engine.getBestMove();
    if (!move) break;

    // Track move statistics
    const moveTime = (Date.now() - startTime) / 1000;
    const beforeMove = engine.evaluate();

    // Make the move
    engine.makeMove(move);
    lastMove = engine.decodeMove(move);

    // Evaluate position
    const afterMove = engine.evaluate();
    const captured = lastMove.captured > 0;

    // Update statistics
    gameStats.totalMoves++;
    if (captured) gameStats.captures++;
    gameStats.evaluations.push(afterMove);
    gameStats.times.push(moveTime);
    gameStats.memoryUsage.push(process.memoryUsage().heapUsed / 1024 / 1024);

    // Display move
    console.log(
      `\nMove: ${ChessDisplay.formatMove(moveCount, lastMove, isWhiteTurn)}`
    );
    console.log(`Evaluation: ${(afterMove / 100).toFixed(2)}`);
    console.log(`Time: ${moveTime.toFixed(2)}s`);
    console.log(
      `Memory: ${gameStats.memoryUsage[
        gameStats.memoryUsage.length - 1
      ].toFixed(2)} MB`
    );

    ChessDisplay.printBoard(engine.board, lastMove);

    moveCount++;
    await ChessDisplay.delay(moveDelay);
  }

  // Print game summary
  console.log("\nGame Summary:");
  console.log(`Total Moves: ${gameStats.totalMoves}`);
  console.log(`Captures: ${gameStats.captures}`);
  console.log(
    `Average Time: ${(
      gameStats.times.reduce((a, b) => a + b, 0) / gameStats.times.length
    ).toFixed(2)}s`
  );
  console.log(
    `Peak Memory: ${Math.max(...gameStats.memoryUsage).toFixed(2)} MB`
  );
  console.log(
    `Final Evaluation: ${(
      gameStats.evaluations[gameStats.evaluations.length - 1] / 100
    ).toFixed(2)}`
  );
}

async function main() {
  console.log("Starting chess engine test...");
  console.log("Memory limit: 5 MiB");
  console.log("Time per move: 9.8s");

  try {
    await playSelfGame(100, 1000); // 100 moves max, 1 second delay between moves
  } catch (error) {
    console.error("Error during game:", error);
  }
}

// Run the test
main().catch(console.error);
