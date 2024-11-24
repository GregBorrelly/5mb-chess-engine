import chess
import time
from typing import Optional, Tuple

class EnhancedChessEngine:
    # Piece-Square Tables for positional evaluation
    PAWN_TABLE = [
        0,  0,  0,  0,  0,  0,  0,  0,
        50, 50, 50, 50, 50, 50, 50, 50,
        10, 10, 20, 30, 30, 20, 10, 10,
        5,  5, 10, 25, 25, 10,  5,  5,
        0,  0,  0, 20, 20,  0,  0,  0,
        5, -5,-10,  0,  0,-10, -5,  5,
        5, 10, 10,-20,-20, 10, 10,  5,
        0,  0,  0,  0,  0,  0,  0,  0
    ]

    KNIGHT_TABLE = [
        -50,-40,-30,-30,-30,-30,-40,-50,
        -40,-20,  0,  0,  0,  0,-20,-40,
        -30,  0, 10, 15, 15, 10,  0,-30,
        -30,  5, 15, 20, 20, 15,  5,-30,
        -30,  0, 15, 20, 20, 15,  0,-30,
        -30,  5, 10, 15, 15, 10,  5,-30,
        -40,-20,  0,  5,  5,  0,-20,-40,
        -50,-40,-30,-30,-30,-30,-40,-50
    ]

    def __init__(self, depth: int = 4):
        self.board = chess.Board()
        self.max_depth = depth
        self.nodes_evaluated = 0
        self.transposition_table = {}
        self.start_time = 0
        self.time_limit = 9.8  # Leave 0.2s buffer for move transmission
        
        # Material values with additional precision
        self.piece_values = {
            chess.PAWN: 100,
            chess.KNIGHT: 320,
            chess.BISHOP: 330,
            chess.ROOK: 500,
            chess.QUEEN: 900,
            chess.KING: 20000
        }

    def evaluate_position(self) -> int:
        """Enhanced position evaluation with multiple components."""
        if self.board.is_checkmate():
            return -20000 if self.board.turn else 20000
        if self.board.is_stalemate() or self.board.is_insufficient_material():
            return 0

        score = self.evaluate_material()
        score += self.evaluate_piece_position()
        score += self.evaluate_mobility()
        score += self.evaluate_pawn_structure()
        
        return score if self.board.turn else -score

    def evaluate_material(self) -> int:
        """Evaluate material balance with specialized piece values."""
        score = 0
        for piece_type in self.piece_values:
            score += (len(self.board.pieces(piece_type, chess.WHITE)) - 
                     len(self.board.pieces(piece_type, chess.BLACK))) * self.piece_values[piece_type]
        return score

    def evaluate_piece_position(self) -> int:
        """Evaluate piece positioning using piece-square tables."""
        score = 0
        for square in chess.SQUARES:
            piece = self.board.piece_at(square)
            if not piece:
                continue
            
            # Flip square index for black pieces
            adjusted_square = square if piece.color else square ^ 56
            
            if piece.piece_type == chess.PAWN:
                score += self.PAWN_TABLE[adjusted_square] if piece.color else -self.PAWN_TABLE[adjusted_square]
            elif piece.piece_type == chess.KNIGHT:
                score += self.KNIGHT_TABLE[adjusted_square] if piece.color else -self.KNIGHT_TABLE[adjusted_square]
        
        return score

    def evaluate_mobility(self) -> int:
        """Evaluate piece mobility and control of the center."""
        mobility = len(list(self.board.legal_moves))
        self.board.turn = not self.board.turn
        opponent_mobility = len(list(self.board.legal_moves))
        self.board.turn = not self.board.turn
        
        return (mobility - opponent_mobility) * 10

    def evaluate_pawn_structure(self) -> int:
        """Evaluate pawn structure including doubled and isolated pawns."""
        score = 0
        
        # Create masks for each file to detect pawns
        for file in range(8):
            # Create file mask
            file_mask = chess.BB_FILES[file]
            
            # Count pawns on the file
            white_pawns = bin(self.board.pieces(chess.PAWN, chess.WHITE) & file_mask).count('1')
            black_pawns = bin(self.board.pieces(chess.PAWN, chess.BLACK) & file_mask).count('1')
            
            # Penalize doubled pawns
            if white_pawns > 1:
                score -= 30
            if black_pawns > 1:
                score += 30
            
            # Check for isolated pawns
            if white_pawns > 0:
                isolated = True
                for adjacent_file in [file - 1, file + 1]:
                    if 0 <= adjacent_file < 8:
                        adjacent_mask = chess.BB_FILES[adjacent_file]
                        if self.board.pieces(chess.PAWN, chess.WHITE) & adjacent_mask:
                            isolated = False
                            break
                if isolated:
                    score -= 20
            
            if black_pawns > 0:
                isolated = True
                for adjacent_file in [file - 1, file + 1]:
                    if 0 <= adjacent_file < 8:
                        adjacent_mask = chess.BB_FILES[adjacent_file]
                        if self.board.pieces(chess.PAWN, chess.BLACK) & adjacent_mask:
                            isolated = False
                            break
                if isolated:
                    score += 20
        
        return score

    def get_move_ordering(self, moves):
        """Order moves to improve alpha-beta pruning efficiency."""
        move_scores = []
        for move in moves:
            score = 0
            moving_piece = self.board.piece_at(move.from_square)
            captured_piece = self.board.piece_at(move.to_square)
            
            # Prioritize captures by MVV-LVA (Most Valuable Victim - Least Valuable Aggressor)
            if captured_piece:
                score = 10 * self.piece_values[captured_piece.piece_type] - self.piece_values[moving_piece.piece_type]
            
            # Prioritize promotions
            if move.promotion:
                score += self.piece_values[move.promotion]
            
            # Bonus for checks
            self.board.push(move)
            if self.board.is_check():
                score += 50
            self.board.pop()
            
            move_scores.append((move, score))
        
        return [move for move, _ in sorted(move_scores, key=lambda x: x[1], reverse=True)]

    def negamax(self, depth: int, alpha: int, beta: int, color: int) -> Tuple[int, Optional[chess.Move]]:
        """Negamax search with alpha-beta pruning and time management."""
        # Check time limit
        if time.time() - self.start_time > self.time_limit:
            return float('-inf'), None

        # Transposition table lookup
        alpha_orig = alpha
        tt_entry = self.transposition_table.get(self.board.fen())
        if tt_entry and tt_entry[1] >= depth:
            if tt_entry[2] == 0:  # Exact score
                return tt_entry[0], None
            elif tt_entry[2] == 1:  # Lower bound
                alpha = max(alpha, tt_entry[0])
            else:  # Upper bound
                beta = min(beta, tt_entry[0])
            if alpha >= beta:
                return tt_entry[0], None

        if depth == 0 or self.board.is_game_over():
            return color * self.evaluate_position(), None

        best_score = float('-inf')
        best_move = None
        moves = self.get_move_ordering(self.board.legal_moves)
        
        for move in moves:
            self.board.push(move)
            score, _ = self.negamax(depth - 1, -beta, -alpha, -color)
            score = -score
            self.board.pop()
            
            if score > best_score:
                best_score = score
                best_move = move
                alpha = max(alpha, score)
                if alpha >= beta:
                    break

        # Store position in transposition table
        if best_score <= alpha_orig:
            flag = 2  # Upper bound
        elif best_score >= beta:
            flag = 1  # Lower bound
        else:
            flag = 0  # Exact score
        self.transposition_table[self.board.fen()] = (best_score, depth, flag)

        return best_score, best_move

    def get_best_move(self) -> Optional[chess.Move]:
        """Iterative deepening with time management."""
        self.start_time = time.time()
        best_move = None
        
        # Iterative deepening
        for depth in range(1, self.max_depth + 1):
            try:
                _, move = self.negamax(depth, float('-inf'), float('inf'), 1)
                if move:
                    best_move = move
            except TimeoutError:
                break
            
            # Check if we're running out of time
            if time.time() - self.start_time > self.time_limit:
                break
        
        return best_move

    def make_move(self) -> Optional[chess.Move]:
        """Make the best move on the board."""
        move = self.get_best_move()
        if move:
            self.board.push(move)
        return move

def create_engine():
    """Factory function to create engine instance for competition."""
    return EnhancedChessEngine(depth=6)