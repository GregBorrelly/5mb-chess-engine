// MinimalChessEngine.js

class MinimalChessEngine {
    constructor() {
        // Board representation: 0-63, piece values: PNBRQK = 1-6, color: +8 for white
        this.board = new Int8Array(64);
        this.moveHistory = new Int32Array(1024);
        this.historyCount = 0;
        
        // Piece values and tables
        this.pieceValues = new Int16Array([0, 100, 320, 330, 500, 900, 20000]);
        
        // Movement patterns
        this.knightMoves = [-17, -15, -10, -6, 6, 10, 15, 17];
        this.kingMoves = [-9, -8, -7, -1, 1, 7, 8, 9];
        this.bishopDirs = [-9, -7, 7, 9];
        this.rookDirs = [-8, -1, 1, 8];
        
        // Center squares for positional evaluation
        this.centerSquares = new Set([27, 28, 35, 36]);
        
        this.setupBoard();
    }

    setupBoard() {
        // Clear the board
        this.board.fill(0);
        
        // Set up pawns
        for (let i = 0; i < 8; i++) {
            this.board[8 + i] = 1;      // Black pawns
            this.board[48 + i] = 1 + 8;  // White pawns
        }
        
        // Set up pieces (RNBQKBNR)
        const backRank = [4, 2, 3, 5, 6, 3, 2, 4];
        for (let i = 0; i < 8; i++) {
            this.board[i] = backRank[i];          // Black pieces
            this.board[56 + i] = backRank[i] + 8; // White pieces
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

    *generateMoves() {
        const isWhiteTurn = (this.historyCount % 2) === 0;
        
        for (let square = 0; square < 64; square++) {
            const piece = this.board[square];
            if (!piece || this.isWhite(piece) !== isWhiteTurn) continue;
            
            const pieceType = this.getPieceType(piece);
            switch (pieceType) {
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
                    yield* this.generateSlidingMoves(square, [...this.bishopDirs, ...this.rookDirs]);
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
        
        // Forward move
        let dest = square + direction;
        if (this.isValidSquare(dest) && !this.board[dest]) {
            yield this.encodeMove(square, dest);
            
            // Double move from start
            if (Math.floor(square / 8) === startRank) {
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
            
            // Check if diagonal move is valid
            const srcFile = square % 8;
            const destFile = dest % 8;
            if (Math.abs(destFile - srcFile) !== 1) continue;
            
            const target = this.board[dest];
            if (target && this.isWhite(target) !== isWhite) {
                yield this.encodeMove(square, dest);
            }
        }
    }

    *generateKnightMoves(square) {
        const piece = this.board[square];
        for (const offset of this.knightMoves) {
            const dest = square + offset;
            if (!this.isValidSquare(dest)) continue;
            
            // Verify knight's L-shape movement
            const srcRank = Math.floor(square / 8);
            const srcFile = square % 8;
            const destRank = Math.floor(dest / 8);
            const destFile = dest % 8;
            
            if (Math.abs(destRank - srcRank) + Math.abs(destFile - srcFile) !== 3) continue;
            
            const target = this.board[dest];
            if (!target || this.isWhite(target) !== this.isWhite(piece)) {
                yield this.encodeMove(square, dest);
            }
        }
    }

    *generateKingMoves(square) {
        const piece = this.board[square];
        for (const offset of this.kingMoves) {
            const dest = square + offset;
            if (!this.isValidSquare(dest)) continue;
            
            // Verify one square movement
            const srcRank = Math.floor(square / 8);
            const srcFile = square % 8;
            const destRank = Math.floor(dest / 8);
            const destFile = dest % 8;
            
            if (Math.abs(destRank - srcRank) > 1 || Math.abs(destFile - srcFile) > 1) continue;
            
            const target = this.board[dest];
            if (!target || this.isWhite(target) !== this.isWhite(piece)) {
                yield this.encodeMove(square, dest);
            }
        }
    }

    *generateSlidingMoves(square, directions) {
        const piece = this.board[square];
        for (const dir of directions) {
            let dest = square + dir;
            
            while (this.isValidSquare(dest)) {
                const srcRank = Math.floor(square / 8);
                const srcFile = square % 8;
                const destRank = Math.floor(dest / 8);
                const destFile = dest % 8;
                
                // Check if we've wrapped around the board
                if (Math.abs(destRank - srcRank) > 7 || Math.abs(destFile - srcFile) > 7) break;
                
                const target = this.board[dest];
                if (!target) {
                    yield this.encodeMove(square, dest);
                } else {
                    if (this.isWhite(target) !== this.isWhite(piece)) {
                        yield this.encodeMove(square, dest);
                    }
                    break;
                }
                dest += dir;
            }
        }
    }

    encodeMove(from, to) {
        return (from) | (to << 6) | (this.board[to] << 12);
    }

    decodeMove(move) {
        return {
            from: move & 0x3F,
            to: (move >> 6) & 0x3F,
            captured: move >> 12
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
            
            // Base piece value
            let value = this.pieceValues[this.getPieceType(piece)];
            
            // Position bonus
            if (this.centerSquares.has(square)) {
                value += 20;
            }
            
            // Add or subtract based on color
            score += this.isWhite(piece) ? value : -value;
        }
        
        return (this.historyCount % 2 === 0) ? score : -score;
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

        return bestScore;
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
            
            // Print progress
            console.log(`Depth ${depth}: score=${bestScore/100}, move=${this.moveToString(bestMove)}`);
        }

        return bestMove;
    }

    moveToString(move) {
        if (!move) return "null";
        const { from, to } = this.decodeMove(move);
        const files = 'abcdefgh';
        const ranks = '87654321';
        return `${files[from % 8]}${ranks[Math.floor(from / 8)]}${files[to % 8]}${ranks[Math.floor(to / 8)]}`;
    }
}

module.exports = { MinimalChessEngine };