// MinimalChessEngine.js
class MinimalChessEngine {
  constructor() {
    // Board representation
    this.board = new Int8Array(64);
    this.moveHistory = new Int32Array(512);
    this.historyCount = 0;

    // Movement patterns
    this.knightOffsets = [-17, -15, -10, -6, 6, 10, 15, 17];
    this.kingOffsets = [-9, -8, -7, -1, 1, 7, 8, 9];
    this.bishopOffsets = [-9, -7, 7, 9];
    this.rookOffsets = [-8, -1, 1, 8];

    // Piece values
    this.pieceValues = new Int16Array([0, 100, 320, 330, 500, 900, 20000]);

    // Initialize position
    this.setupInitialPosition();
  }

  setupInitialPosition() {
    // Clear board
    this.board.fill(0);

    // Set pawns
    for (let i = 0; i < 8; i++) {
      this.board[8 + i] = 1; // Black pawns (1)
      this.board[48 + i] = 9; // White pawns (9 = 1 + 8)
    }

    // Set pieces in order: Rook(4), Knight(2), Bishop(3), Queen(5), King(6)
    const backRank = [4, 2, 3, 5, 6, 3, 2, 4];
    for (let i = 0; i < 8; i++) {
      this.board[i] = backRank[i]; // Black pieces
      this.board[i + 56] = backRank[i] + 8; // White pieces (+8 for white)
    }

    this.historyCount = 0;
  }

  isWhite(piece) {
    return piece >= 8;
  }

  getPieceType(piece) {
    return piece & 7;
  }

  isValidSquare(square) {
    return square >= 0 && square < 64;
  }

  makeMove(move) {
    const { from, to } = this.decodeMove(move);
    const captured = this.board[to];

    // Save move in history with captured piece
    this.moveHistory[this.historyCount++] = from | (to << 6) | (captured << 12);

    // Move piece
    this.board[to] = this.board[from];
    this.board[from] = 0;
  }

  unmakeMove() {
    const move = this.moveHistory[--this.historyCount];
    const from = move & 0x3f;
    const to = (move >> 6) & 0x3f;
    const captured = move >> 12;

    // Restore position
    this.board[from] = this.board[to];
    this.board[to] = captured;
  }

  *generatePawnMoves(square) {
    const piece = this.board[square];
    const isWhite = this.isWhite(piece);
    const direction = isWhite ? -8 : 8;
    const startRank = isWhite ? 6 : 1;
    const rank = Math.floor(square / 8);
    const file = square % 8;

    // Forward move
    let dest = square + direction;
    if (this.isValidSquare(dest) && !this.board[dest]) {
      yield this.encodeMove(square, dest);

      // Double move from start
      if (rank === startRank) {
        dest = square + 2 * direction;
        if (!this.board[dest]) {
          yield this.encodeMove(square, dest);
        }
      }
    }

    // Captures
    for (const offset of [direction - 1, direction + 1]) {
      dest = square + offset;
      if (!this.isValidSquare(dest)) continue;
      if (Math.abs((dest % 8) - file) !== 1) continue;

      const target = this.board[dest];
      if (target && this.isWhite(target) !== isWhite) {
        yield this.encodeMove(square, dest);
      }
    }
  }

  *generateKnightMoves(square) {
    const piece = this.board[square];
    const isWhite = this.isWhite(piece);

    for (const offset of this.knightOffsets) {
      const dest = square + offset;
      if (!this.isValidSquare(dest)) continue;

      // Verify L-shape
      const srcRank = Math.floor(square / 8);
      const srcFile = square % 8;
      const destRank = Math.floor(dest / 8);
      const destFile = dest % 8;

      if (Math.abs(destRank - srcRank) + Math.abs(destFile - srcFile) !== 3)
        continue;
      if (
        Math.abs(destRank - srcRank) === 0 ||
        Math.abs(destFile - srcFile) === 0
      )
        continue;

      const target = this.board[dest];
      if (!target || this.isWhite(target) !== isWhite) {
        yield this.encodeMove(square, dest);
      }
    }
  }

  *generateSlidingMoves(square, directions) {
    const piece = this.board[square];
    const isWhite = this.isWhite(piece);

    for (const dir of directions) {
      let dest = square + dir;

      while (this.isValidSquare(dest)) {
        // Check if move wraps around the board
        const srcRank = Math.floor(square / 8);
        const srcFile = square % 8;
        const destRank = Math.floor(dest / 8);
        const destFile = dest % 8;

        if (
          Math.abs(destRank - srcRank) > 7 ||
          Math.abs(destFile - srcFile) > 7
        )
          break;

        const target = this.board[dest];
        if (!target) {
          yield this.encodeMove(square, dest);
        } else {
          if (this.isWhite(target) !== isWhite) {
            yield this.encodeMove(square, dest);
          }
          break;
        }
        dest += dir;
      }
    }
  }

  *generateMoves() {
    const isWhiteTurn = this.historyCount % 2 === 0;

    for (let square = 0; square < 64; square++) {
      const piece = this.board[square];
      if (!piece || this.isWhite(piece) !== isWhiteTurn) continue;

      switch (this.getPieceType(piece)) {
        case 1: // Pawn
          yield* this.generatePawnMoves(square);
          break;
        case 2: // Knight
          yield* this.generateKnightMoves(square);
          break;
        case 3: // Bishop
          yield* this.generateSlidingMoves(square, this.bishopOffsets);
          break;
        case 4: // Rook
          yield* this.generateSlidingMoves(square, this.rookOffsets);
          break;
        case 5: // Queen
          yield* this.generateSlidingMoves(square, [
            ...this.bishopOffsets,
            ...this.rookOffsets,
          ]);
          break;
        case 6: // King
          yield* this.generateSlidingMoves(square, this.kingOffsets);
          break;
      }
    }
  }

  evaluate() {
    let score = 0;

    for (let square = 0; square < 64; square++) {
      const piece = this.board[square];
      if (!piece) continue;

      // Material value
      const pieceType = this.getPieceType(piece);
      let value = this.pieceValues[pieceType];

      // Position value
      const rank = Math.floor(square / 8);
      const file = square % 8;

      // Center control
      if (rank >= 3 && rank <= 4 && file >= 3 && file <= 4) {
        value += 20;
      }

      // Pawn structure
      if (pieceType === 1) {
        value += (this.isWhite(piece) ? 6 - rank : rank - 1) * 5; // Fixed here
      }

      score += this.isWhite(piece) ? value : -value;
    }

    return this.historyCount % 2 === 0 ? score : -score;
  }

  search(depth, alpha, beta) {
    if (depth === 0) {
      return this.evaluate();
    }

    const moves = Array.from(this.generateMoves());
    if (moves.length === 0) return -20000; // Checkmate

    let bestScore = -Infinity;

    for (const move of moves) {
      this.makeMove(move);
      const score = -this.search(depth - 1, -beta, -alpha);
      this.unmakeMove();

      if (score >= beta) return beta;
      bestScore = Math.max(bestScore, score);
      alpha = Math.max(alpha, score);
    }

    return bestScore;
  }

  getBestMove() {
    const startTime = Date.now();
    let bestMove = null;
    let bestScore = -Infinity;

    // Iterative deepening
    for (let depth = 1; depth <= 6; depth++) {
      if (Date.now() - startTime > 9800) break;

      for (const move of this.generateMoves()) {
        this.makeMove(move);
        const score = -this.search(depth - 1, -Infinity, Infinity);
        this.unmakeMove();

        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
      }

      console.log(
        `Depth ${depth} complete - best: ${this.moveToString(bestMove)}`
      );
    }

    return bestMove;
  }

  encodeMove(from, to) {
    return from | (to << 6) | (this.board[to] << 12);
  }

  decodeMove(move) {
    return {
      from: move & 0x3f,
      to: (move >> 6) & 0x3f,
      captured: move >> 12,
    };
  }

  moveToString(move) {
    if (!move) return "null";
    const { from, to } = this.decodeMove(move);
    const files = "abcdefgh";
    const ranks = "87654321";
    return `${files[from % 8]}${ranks[Math.floor(from / 8)]}${files[to % 8]}${
      ranks[Math.floor(to / 8)]
    }`;
  }
}

module.exports = { MinimalChessEngine };
