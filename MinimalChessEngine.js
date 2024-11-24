class MinimalChessEngine {
  constructor() {
    this.board = new Uint8Array(64); // Changed from Int8Array for reduced memory use
    this.moveHistory = new Uint16Array(256); // Further reduced size to save memory
    this.historyCount = 0;

    // Movement patterns
    this.knightOffsets = [-17, -15, -10, -6, 6, 10, 15, 17];
    this.kingOffsets = [-9, -8, -7, -1, 1, 7, 8, 9];
    this.bishopOffsets = [-9, -7, 7, 9];
    this.rookOffsets = [-8, -1, 1, 8];

    // Simplified piece values for memory efficiency
    this.pieceValues = [0, 100, 320, 330, 500, 900, 20000];

    // Piece-square tables for improved positional play
    this.pawnTable = new Int8Array([
      0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30,
      30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5,
      -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0,
      0, 0, 0,
    ]);

    // Initialize transposition table
    this.transpositionTable = new Map();

    this.setupInitialPosition();
  }

  setupInitialPosition() {
    this.board.fill(0);
    for (let i = 0; i < 8; i++) {
      this.board[8 + i] = 1; // Pawn
      this.board[48 + i] = 9; // Pawn
    }
    const backRank = [4, 2, 3, 5, 6, 3, 2, 4];
    for (let i = 0; i < 8; i++) {
      this.board[i] = backRank[i];
      this.board[i + 56] = backRank[i] + 8;
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
    this.moveHistory[this.historyCount++] = from | (to << 6) | (captured << 12);
    this.board[to] = this.board[from];
    this.board[from] = 0;
  }

  unmakeMove() {
    const move = this.moveHistory[--this.historyCount];
    const from = move & 0x3f;
    const to = (move >> 6) & 0x3f;
    const captured = (move >> 12) & 0xf;
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

      // Position value based on piece-square tables
      if (pieceType === 1) {
        value += this.isWhite(piece)
          ? this.pawnTable[square]
          : this.pawnTable[63 - square];
      }

      // Add positional value for piece activity and king safety
      if (pieceType === 6) {
        value += this.isWhite(piece)
          ? -Math.abs(4 - (square % 8))
          : -Math.abs(4 - (square % 8));
      }

      score += this.isWhite(piece) ? value : -value;
    }

    return this.historyCount % 2 === 0 ? score : -score;
  }

  search(depth, alpha, beta) {
    if (depth === 0) {
      return this.evaluate();
    }

    const moves = Array.from(this.generateMoves()).sort((a, b) => {
      const { to: toA } = this.decodeMove(a);
      const { to: toB } = this.decodeMove(b);
      return (this.board[toB] || 0) - (this.board[toA] || 0); // Prioritize captures
    });
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
    let bestMove = null;
    let bestScore = -Infinity;
    const moves = Array.from(this.generateMoves()).sort((a, b) => {
      const { to: toA } = this.decodeMove(a);
      const { to: toB } = this.decodeMove(b);
      return (this.board[toB] || 0) - (this.board[toA] || 0); // Prioritize captures
    });

    for (const move of moves) {
      this.makeMove(move);
      const score = -this.search(3, -Infinity, Infinity); // Reduced depth for lower memory usage
      this.unmakeMove();

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  encodeMove(from, to) {
    return from | (to << 6);
  }

  decodeMove(move) {
    return {
      from: move & 0x3f,
      to: (move >> 6) & 0x3f,
      captured: (move >> 12) & 0xf,
    };
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
          yield* this.generateKingMoves(square);
          break;
      }
    }
  }

  *generatePawnMoves(square) {
    const piece = this.board[square];
    const isWhite = this.isWhite(piece);
    const direction = isWhite ? -8 : 8;
    const startRank = isWhite ? 6 : 1;
    const rank = Math.floor(square / 8);

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
      if (Math.abs((dest % 8) - (square % 8)) !== 1) continue;

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

  *generateKingMoves(square) {
    const piece = this.board[square];
    const isWhite = this.isWhite(piece);

    for (const offset of this.kingOffsets) {
      const dest = square + offset;
      if (!this.isValidSquare(dest)) continue;

      const target = this.board[dest];
      if (!target || this.isWhite(target) !== isWhite) {
        yield this.encodeMove(square, dest);
      }
    }
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
