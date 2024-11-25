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

    // Modified piece values for increased dynamic play
    this.pieceValues = [0, 100, 330, 350, 550, 1000, 25000];

    // Piece-square tables for improved positional play
    this.pawnTable = new Int8Array([
      0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30,
      30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5,
      -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0,
      0, 0, 0,
    ]);

    // Initialize transposition table
    this.transpositionTable = new Map();

    // Predefined opening book moves
    this.openingBook = [
      { moves: ["e2e4", "e7e5"], description: "Open Game" },
      { moves: ["e2e4", "c7c5"], description: "Sicilian Defense" },
      { moves: ["d2d4", "d7d5"], description: "Queen's Gambit" },
      { moves: ["e2e4", "e7e6"], description: "French Defense" },
      { moves: ["e2e4", "c7c6"], description: "Caro-Kann Defense" },
      { moves: ["d2d4", "g8f6"], description: "Indian Game" },
      { moves: ["e2e4", "g8f6"], description: "Alekhine's Defense" },
      { moves: ["c2c4", "e7e5"], description: "English Opening" },
      { moves: ["g1f3", "d7d5"], description: "Reti Opening" },
      { moves: ["e2e4", "d7d6"], description: "Pirc Defense" },
    ];

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
          ? -Math.abs(4 - (square % 8)) * 5
          : -Math.abs(4 - (square % 8)) * 5;
      }

      // King safety: increased penalty for lack of nearby defenders
      if (pieceType === 6) {
        value -= this.countNearbyDefenders(square, piece) * 20;
      }

      // Pawn structure: bonus for connected pawns, penalty for isolated pawns
      if (pieceType === 1) {
        value += this.evaluatePawnStructure(square, piece);
      }

      // Central control: increased bonus for controlling central squares
      if ([1, 2, 3, 4, 5].includes(pieceType)) {
        if ([27, 28, 35, 36].includes(square)) {
          value += 20;
        }
      }

      // Mobility evaluation
      value += this.evaluateMobility(square, piece);

      score += this.isWhite(piece) ? value : -value;
    }

    return this.historyCount % 2 === 0 ? score : -score;
  }

  countNearbyDefenders(square, piece) {
    const offsets = this.kingOffsets;
    let defenders = 0;
    for (const offset of offsets) {
      const dest = square + offset;
      if (
        this.isValidSquare(dest) &&
        this.board[dest] &&
        this.isWhite(this.board[dest]) === this.isWhite(piece)
      ) {
        defenders++;
      }
    }
    return defenders;
  }

  evaluatePawnStructure(square, piece) {
    const direction = this.isWhite(piece) ? -8 : 8;
    const left = square + direction - 1;
    const right = square + direction + 1;
    let value = 0;

    if (this.isValidSquare(left) && this.board[left] === piece) {
      value += 25; // Bonus for connected pawns
    }
    if (this.isValidSquare(right) && this.board[right] === piece) {
      value += 25; // Bonus for connected pawns
    }
    if (!this.isValidSquare(left) && !this.isValidSquare(right)) {
      value -= 20; // Penalty for isolated pawn
    }
    return value;
  }

  evaluateMobility(square, piece) {
    const moves = Array.from(this.generateMovesForPiece(square));
    const mobilityScore =
      moves.length * (this.getPieceType(piece) === 1 ? 10 : 5); // Example weights for mobility
    return this.isWhite(piece) ? mobilityScore : -mobilityScore;
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
    const { to, captured } = this.decodeMove(move);
    let score = 0;

    if (captured) {
      score += 10 * this.pieceValues[this.getPieceType(captured)];
    }

    const piece = this.board[move & 0x3f];
    const rank = Math.floor(to / 8);
    const file = to % 8;

    if ((rank === 3 || rank === 4) && (file === 3 || file === 4)) {
      score += 50;
    }

    return score;
  }

  getBestMove() {
    const startTime = Date.now();

    // Ensure white always moves first
    if (this.historyCount === 0 && this.historyCount % 2 === 0) {
      console.log("White to move first");
    }

    // Check if the current position matches any predefined opening book
    for (const opening of this.openingBook) {
      const historyMoves = this.moveHistory
        .slice(0, this.historyCount)
        .map((move) => this.moveToString(move));
      if (
        opening.moves
          .slice(0, historyMoves.length)
          .every((m, i) => m === historyMoves[i])
      ) {
        const nextMove = opening.moves[historyMoves.length];
        if (nextMove) {
          console.log(`Using opening book: ${opening.description}`);
          return this.encodeMoveFromString(nextMove);
        }
      }
    }

    let bestMove = null;
    let bestScore = -Infinity;

    for (let depth = 1; depth <= 2; depth++) {
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

  encodeMoveFromString(moveStr) {
    const files = "abcdefgh";
    const ranks = "87654321";
    const fromFile = files.indexOf(moveStr[0]);
    const fromRank = ranks.indexOf(moveStr[1]);
    const toFile = files.indexOf(moveStr[2]);
    const toRank = ranks.indexOf(moveStr[3]);
    const from = fromRank * 8 + fromFile;
    const to = toRank * 8 + toFile;
    return this.encodeMove(from, to);
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

      yield* this.generateMovesForPiece(square);
    }
  }

  *generateMovesForPiece(square) {
    const piece = this.board[square];
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
