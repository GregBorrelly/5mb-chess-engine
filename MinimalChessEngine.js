class MinimalChessEngine {
  constructor() {
    this.board = new Uint8Array(64);
    this.moveHistory = new Uint16Array(256);
    this.historyCount = 0;

    // Movement patterns
    this.knightOffsets = [-17, -15, -10, -6, 6, 10, 15, 17];
    this.kingOffsets = [-9, -8, -7, -1, 1, 7, 8, 9];
    this.bishopOffsets = [-9, -7, 7, 9];
    this.rookOffsets = [-8, -1, 1, 8];

    // Enhanced piece values for better positional play
    this.pieceValues = [0, 100, 330, 350, 550, 1000, 25000];

    // Piece-square tables for improved positional evaluation
    this.pawnTable = new Int8Array([
      0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30,
      30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5,
      -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0,
      0, 0, 0,
    ]);

    // Initialize transposition table for move ordering
    this.transpositionTable = new Map();

    this.setupInitialPosition();
  }

  setupInitialPosition() {
    this.board.fill(0);
    for (let i = 0; i < 8; i++) {
      this.board[8 + i] = 1;
      this.board[48 + i] = 9;
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
    const captured = move >> 12;
    this.board[from] = this.board[to];
    this.board[to] = captured;
  }

  evaluate() {
    let score = 0;
    const isEndgame = this.historyCount > 30;

    for (let square = 0; square < 64; square++) {
      const piece = this.board[square];
      if (!piece) continue;

      const pieceType = this.getPieceType(piece);
      const isWhite = this.isWhite(piece);
      let value = this.pieceValues[pieceType];

      // Position value based on piece-square tables
      if (pieceType === 1) {
        value += this.isWhite(piece)
          ? this.pawnTable[square]
          : this.pawnTable[63 - square];
      }

      // Positional bonuses
      const rank = Math.floor(square / 8);
      const file = square % 8;

      // Center control bonus
      if ((rank === 3 || rank === 4) && (file === 3 || file === 4)) {
        value += isEndgame ? 10 : 20;
      }

      // Pawn advancement bonus
      if (pieceType === 1) {
        value += (isWhite ? 6 - rank : rank - 1) * 8;
      }

      // King safety penalty
      if (pieceType === 6) {
        value -= Math.abs(4 - file) * 10;
      }

      score += isWhite ? value : -value;
    }

    return this.historyCount % 2 === 0 ? score : -score;
  }

  search(depth, alpha, beta, startTime) {
    if (Date.now() - startTime > 3000) return alpha;
    if (depth === 0) return this.quiescenceSearch(alpha, beta);

    const moves = Array.from(this.generateMoves());
    if (moves.length === 0) return -20000;

    // Improved move ordering
    moves.sort((a, b) => {
      const moveA = this.decodeMove(a);
      const moveB = this.decodeMove(b);
      return this.getMoveScore(moveB) - this.getMoveScore(moveA);
    });

    for (const move of moves) {
      this.makeMove(move);
      const score = -this.search(depth - 1, -beta, -alpha, startTime);
      this.unmakeMove();

      if (score >= beta) return beta;
      alpha = Math.max(alpha, score);
    }

    return alpha;
  }

  quiescenceSearch(alpha, beta) {
    const standPat = this.evaluate();
    if (standPat >= beta) return beta;
    alpha = Math.max(alpha, standPat);

    const captures = Array.from(this.generateCaptures());
    for (const move of captures) {
      this.makeMove(move);
      const score = -this.quiescenceSearch(-beta, -alpha);
      this.unmakeMove();

      if (score >= beta) return beta;
      alpha = Math.max(alpha, score);
    }

    return alpha;
  }

  *generateCaptures() {
    for (const move of this.generateMoves()) {
      const { to } = this.decodeMove(move);
      if (this.board[to]) yield move;
    }
  }

  getMoveScore(move) {
    const { to, captured } = move;
    let score = 0;

    if (captured) {
      score += 10 * this.pieceValues[this.getPieceType(captured)];
    }

    const piece = this.board[move.from];
    const rank = Math.floor(to / 8);
    const file = to % 8;

    if ((rank === 3 || rank === 4) && (file === 3 || file === 4)) {
      score += 50;
    }

    return score;
  }

  getBestMove() {
    const startTime = Date.now();
    let bestMove = null;
    let bestScore = -Infinity;

    for (let depth = 1; depth <= 6; depth++) {
      if (Date.now() - startTime > 9800) break;

      let currentBestMove = null;
      let currentBestScore = -Infinity;

      for (const move of this.generateMoves()) {
        this.makeMove(move);
        const score = -this.search(depth - 1, -Infinity, Infinity, startTime);
        this.unmakeMove();

        if (score > currentBestScore) {
          currentBestScore = score;
          currentBestMove = move;
        }
      }

      if (currentBestScore > bestScore) {
        bestScore = currentBestScore;
        bestMove = currentBestMove;
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

  *generateMoves() {
    const isWhiteTurn = this.historyCount % 2 === 0;
    for (let square = 0; square < 64; square++) {
      const piece = this.board[square];
      if (!piece || this.isWhite(piece) !== isWhiteTurn) continue;

      switch (this.getPieceType(piece)) {
        case 1:
          yield* this.generatePawnMoves(square);
          break;
        case 2:
          yield* this.generateKnightMoves(square);
          break;
        case 3:
          yield* this.generateSlidingMoves(square, this.bishopOffsets);
          break;
        case 4:
          yield* this.generateSlidingMoves(square, this.rookOffsets);
          break;
        case 5:
          yield* this.generateSlidingMoves(square, [
            ...this.bishopOffsets,
            ...this.rookOffsets,
          ]);
          break;
        case 6:
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
    const file = square % 8;

    let dest = square + direction;
    if (this.isValidSquare(dest) && !this.board[dest]) {
      yield this.encodeMove(square, dest);
      if (rank === startRank && !this.board[dest + direction]) {
        yield this.encodeMove(square, dest + direction);
      }
    }

    for (const offset of [direction - 1, direction + 1]) {
      dest = square + offset;
      if (!this.isValidSquare(dest) || Math.abs((dest % 8) - file) !== 1)
        continue;
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
}

module.exports = { MinimalChessEngine };


