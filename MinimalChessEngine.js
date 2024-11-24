// MinimalChessEngine.js
class MinimalChessEngine {
  constructor() {
    // Board representation: 0-63, piece values: PNBRQK = 1-6, color: +8 for black
    this.board = new Int8Array(64);
    this.moveHistory = new Int32Array(1024);
    this.historyCount = 0;

    // Movement patterns
    this.knightMoves = [-17, -15, -10, -6, 6, 10, 15, 17];
    this.kingMoves = [-9, -8, -7, -1, 1, 7, 8, 9];
    this.bishopDirs = [-9, -7, 7, 9];
    this.rookDirs = [-8, -1, 1, 8];

    // Piece values
    this.pieceValues = new Int8Array([0, 100, 320, 330, 500, 900, 20000]);

    // Center squares map
    this.centerSquares = new Int8Array(64);
    for (let i = 0; i < 64; i++) {
      const rank = Math.floor(i / 8);
      const file = i % 8;
      if (rank >= 2 && rank <= 5 && file >= 2 && file <= 5) {
        this.centerSquares[i] = 1;
      }
    }

    this.setupInitialPosition();
  }

  setupInitialPosition() {
    // Set up pawns
    for (let i = 0; i < 8; i++) {
      this.board[i + 8] = 1; // Black pawns
      this.board[i + 48] = 1 + 8; // White pawns
    }

    // Set up pieces (RNBQKBNR)
    const backRank = [4, 2, 3, 5, 6, 3, 2, 4];
    for (let i = 0; i < 8; i++) {
      this.board[i] = backRank[i]; // Black pieces
      this.board[i + 56] = backRank[i] + 8; // White pieces
    }
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

  *generatePawnMoves(square) {
    const piece = this.board[square];
    const isWhite = this.isWhite(piece);
    const direction = isWhite ? -8 : 8;
    const startRank = isWhite ? 6 : 1;

    // Forward move
    let dest = square + direction;
    if (this.isValidSquare(dest) && !this.board[dest]) {
      yield this.encodeMove(square, dest);

      // Double move from start
      if (Math.floor(square / 8) === startRank) {
        dest = square + direction * 2;
        if (!this.board[dest]) {
          yield this.encodeMove(square, dest);
        }
      }
    }

    // Captures
    for (const offset of [direction - 1, direction + 1]) {
      dest = square + offset;
      if (!this.isValidSquare(dest)) continue;
      const target = this.board[dest];
      if (target && this.isWhite(target) !== isWhite) {
        yield this.encodeMove(square, dest);
      }
    }
  }

  *generateKnightMoves(square) {
    const piece = this.board[square];
    const isWhite = this.isWhite(piece);

    for (const offset of this.knightMoves) {
      const dest = square + offset;
      if (!this.isValidSquare(dest)) continue;
      // Check if knight's move is valid (max 2 squares in any direction)
      const fromRank = Math.floor(square / 8);
      const fromFile = square % 8;
      const toRank = Math.floor(dest / 8);
      const toFile = dest % 8;
      if (Math.abs(fromRank - toRank) > 2 || Math.abs(fromFile - toFile) > 2)
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
    for (let square = 0; square < 64; square++) {
      const piece = this.board[square];
      if (!piece) continue;
      if (this.isWhite(piece) !== (this.historyCount % 2 === 0)) continue;

      switch (this.getPieceType(piece)) {
        case 1: // Pawn
          yield* this.generatePawnMoves(square);
          break;
        case 2: // Knight
          yield* this.generateKnightMoves(square);
          break;
        case 3: // Bishop
          yield* this.generateSlidingMoves(square, this.bishopDirs);
          break;
        case 4: // Rook
          yield* this.generateSlidingMoves(square, this.rookDirs);
          break;
        case 5: // Queen
          yield* this.generateSlidingMoves(square, [
            ...this.bishopDirs,
            ...this.rookDirs,
          ]);
          break;
        case 6: // King
          yield* this.generateSlidingMoves(square, this.kingMoves);
          break;
      }
    }
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

  makeMove(move) {
    const { from, to } = this.decodeMove(move);
    this.moveHistory[this.historyCount++] = move;
    this.board[to] = this.board[from];
    this.board[from] = 0;
  }

  unmakeMove() {
    const move = this.moveHistory[--this.historyCount];
    const { from, to, captured } = this.decodeMove(move);
    this.board[from] = this.board[to];
    this.board[to] = captured;
  }

  evaluate() {
    let score = 0;

    for (let square = 0; square < 64; square++) {
      const piece = this.board[square];
      if (!piece) continue;

      const pieceType = this.getPieceType(piece);
      let value = this.pieceValues[pieceType];

      // Position bonus
      if (this.centerSquares[square]) {
        value += 20;
      }

      score += this.isWhite(piece) ? value : -value;
    }

    return this.historyCount % 2 === 0 ? score : -score;
  }

  search(depth, alpha, beta) {
    if (depth === 0) {
      return this.evaluate();
    }

    let bestScore = -Infinity;

    for (const move of this.generateMoves()) {
      this.makeMove(move);
      const score = -this.search(depth - 1, -beta, -alpha);
      this.unmakeMove();

      if (score >= beta) {
        return beta;
      }
      if (score > bestScore) {
        bestScore = score;
        alpha = Math.max(alpha, score);
      }
    }

    return bestScore || -20000;
  }

  getBestMove() {
    const startTime = Date.now();
    let bestMove = null;
    let bestScore = -Infinity;

    for (let depth = 1; depth <= 4; depth++) {
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
