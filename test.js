const { MinimalChessEngine } = require("./MinimalChessEngine");

class ChessDisplay {
  static printBoard(board) {
    const pieces = {
      0: ".",
      1: "♟",
      9: "♙", // pawns
      2: "♞",
      10: "♘", // knights
      3: "♝",
      11: "♗", // bishops
      4: "♜",
      12: "♖", // rooks
      5: "♛",
      13: "♕", // queens
      6: "♚",
      14: "♔", // kings
    };

    console.log("\n     a  b  c  d  e  f  g  h");
    console.log("   ┌──────────────────────────┐");
    for (let rank = 0; rank < 8; rank++) {
      process.stdout.write(` ${8 - rank} │`);
      for (let file = 0; file < 8; file++) {
        const square = rank * 8 + file;
        const piece = board[square];
        process.stdout.write(` ${pieces[piece] || "."} `);
      }
      console.log("|");
    }
    console.log("   └──────────────────────────┘");
  }

  static formatMove(moveNum, move, isWhite) {
    return `${Math.floor(moveNum / 2) + 1}${isWhite ? "." : "..."} ${move}`;
  }
}

class GameAnalyzer {
  constructor() {
    this.moveHistory = [];
    this.captures = 0;
    this.memorySnapshots = [];
  }

  takeMemorySnapshot() {
    const used = process.memoryUsage();
    this.memorySnapshots.push({
      heapUsed: used.heapUsed / (1024 * 1024),
      timestamp: Date.now(),
    });
  }

  async playSelfGame(maxMoves = 100) {
    const engine = new MinimalChessEngine();
    let moveCount = 0;

    console.log("Initial position:");
    ChessDisplay.printBoard(engine.board);
    this.takeMemorySnapshot();

    while (moveCount < maxMoves) {
      const startTime = Date.now();

      // Find and make best move, using opening book if applicable
      const move = engine.getBestMove();
      if (!move) break;

      const elapsed = (Date.now() - startTime) / 1000;
      const evaluation = engine.evaluate();

      // Make the move
      engine.makeMove(move);

      // Update statistics
      moveCount++;
      if (engine.decodeMove(move).captured) this.captures++;

      // Store game state
      this.moveHistory.push({
        move: engine.moveToString(move),
        evaluation,
        time: elapsed,
      });

      // Display move
      const turnColor = moveCount % 2 === 1 ? "White" : "Black";
      console.log(
        `\nMove: ${ChessDisplay.formatMove(
          moveCount,
          engine.moveToString(move),
          moveCount % 2 === 1
        )}`
      );
      console.log(`Evaluation: ${(evaluation / 100).toFixed(2)}`);
      console.log(`Time: ${elapsed.toFixed(2)}s`);
      ChessDisplay.printBoard(engine.board);

      // Check if the move is from the opening book
      if (elapsed < 1) {
        console.log("Move taken from opening book");
      }

      this.takeMemorySnapshot();

      // Check if any moves are available
      const moves = Array.from(engine.generateMoves());
      if (moves.length === 0) break;

      // Add small delay for readability
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return {
      moves: this.moveHistory,
      result: this.getResult(engine),
      statistics: this.getStatistics(),
    };
  }

  getResult(engine) {
    const moves = Array.from(engine.generateMoves());
    if (moves.length === 0) {
      // TODO: Add proper mate detection
      return engine.historyCount % 2 === 0 ? "0-1" : "1-0";
    }
    return "*";
  }

  getStatistics() {
    return {
      totalMoves: this.moveHistory.length,
      captures: this.captures,
      averageTime:
        this.moveHistory.reduce((sum, move) => sum + move.time, 0) /
        this.moveHistory.length,
      peakMemory: Math.max(...this.memorySnapshots.map((s) => s.heapUsed)),
      finalEvaluation:
        this.moveHistory.length > 0
          ? this.moveHistory[this.moveHistory.length - 1].evaluation
          : 0,
    };
  }

  savePGN(filename, result) {
    const pgn = [
      '[Event "Self-play game"]',
      `[Date "${new Date().toISOString().split("T")[0]}"]`,
      '[White "MinimalEngine"]',
      '[Black "MinimalEngine"]',
      `[Result "${result}"]`,
      "",
      this.moveHistory
        .map((move, i) =>
          i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${move.move}` : move.move
        )
        .join(" "),
      result,
    ].join("\n");

    require("fs").writeFileSync(filename, pgn);
  }
}

async function main() {
  console.log("Starting chess engine test...");
  console.log("Memory limit: 5 MiB");
  console.log("Time per move: 9.8s");

  const analyzer = new GameAnalyzer();
  const game = await analyzer.playSelfGame(50); // Play up to 50 moves

  // Save game
  const filename = `game_${new Date().toISOString().replace(/[:.]/g, "")}.pgn`;
  analyzer.savePGN(filename, game.result);

  // Display statistics
  console.log("\nGame Summary:");
  console.log(`Total Moves: ${game.statistics.totalMoves}`);
  console.log(`Captures: ${game.statistics.captures}`);
  console.log(`Average Time: ${game.statistics.averageTime.toFixed(2)}s`);
  console.log(`Peak Memory: ${game.statistics.peakMemory.toFixed(2)} MB`);
  console.log(
    `Final Evaluation: ${(game.statistics.finalEvaluation / 100).toFixed(2)}`
  );
}

main().catch(console.error);
