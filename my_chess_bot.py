import chess


class SmartChessEngine:
    def __init__(self, depth=4):
        self.board = chess.Board()
        self.depth = depth

    def evaluate_board(self):
        """Evaluate the board's material and positional balance."""
        material = 0
        material_values = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}

        for piece in material_values:
            material += len(self.board.pieces(piece, chess.WHITE)) * material_values[piece]
            material -= len(self.board.pieces(piece, chess.BLACK)) * material_values[piece]

        # Penalize lack of development
        activity_bonus = sum([self.is_active_piece(sq) for sq in chess.SQUARES if self.board.piece_at(sq)])
        return material + activity_bonus

    def is_active_piece(self, square):
        """Reward active piece positions (centralized, developed)."""
        piece = self.board.piece_at(square)
        if not piece:
            return 0

        activity_score = 0
        if piece.piece_type in {chess.KNIGHT, chess.BISHOP}:
            activity_score += 0.5
        elif piece.piece_type == chess.QUEEN:
            activity_score += 0.3

        # Central position bonus
        center_squares = [chess.D4, chess.E4, chess.D5, chess.E5]
        if square in center_squares:
            activity_score += 0.3

        return activity_score if piece.color == self.board.turn else -activity_score

    def minimax(self, depth, alpha, beta, maximizing):
        """Minimax algorithm with alpha-beta pruning."""
        if depth == 0 or self.board.is_game_over():
            return self.evaluate_board()

        if maximizing:
            max_eval = float("-inf")
            for move in self.board.legal_moves:
                self.board.push(move)
                if self.board.is_repetition(3):
                    eval = -float("inf")
                else:
                    eval = self.minimax(depth - 1, alpha, beta, False)
                self.board.pop()
                max_eval = max(max_eval, eval)
                alpha = max(alpha, eval)
                if beta <= alpha:
                    break
            return max_eval
        else:
            min_eval = float("inf")
            for move in self.board.legal_moves:
                self.board.push(move)
                if self.board.is_repetition(3):
                    eval = float("inf")
                else:
                    eval = self.minimax(depth - 1, alpha, beta, True)
                self.board.pop()
                min_eval = min(min_eval, eval)
                beta = min(beta, eval)
                if beta <= alpha:
                    break
            return min_eval

    def get_best_move(self):
        """Find the best move."""
        best_score = float("-inf") if self.board.turn else float("inf")
        best_move = None

        for move in self.board.legal_moves:
            self.board.push(move)
            if self.board.is_repetition(3):
                score = -float("inf") if self.board.turn else float("inf")
            else:
                score = self.minimax(self.depth - 1, float("-inf"), float("inf"), not self.board.turn)
            self.board.pop()

            if (self.board.turn and score > best_score) or (not self.board.turn and score < best_score):
                best_score = score
                best_move = move

        return best_move

    def play_move(self):
        """Play the best move."""
        best_move = self.get_best_move()
        if best_move:
            self.board.push(best_move)
        return best_move

    def display_board(self):
        """Display the board."""
        print(self.board)


class ChessSelfPlayBot:
    def __init__(self, depth=4):
        self.engine = SmartChessEngine(depth=depth)

    def play_self(self):
        """Run a self-play match."""
        move_count = 1
        while not self.engine.board.is_game_over():
            if self.engine.board.is_repetition(3):
                print("\nGame Over! Draw by threefold repetition.")
                break
            if self.engine.board.is_fifty_moves():
                print("\nGame Over! Draw by 50-move rule.")
                break

            print(f"\nMove {move_count}: {'White' if self.engine.board.turn else 'Black'}")
            move = self.engine.play_move()
            print(f"Move played: {move}")
            self.engine.display_board()
            move_count += 1

        print("\nGame Over!")
        print(f"Result: {self.engine.board.result()}")


if __name__ == "__main__":
    bot = ChessSelfPlayBot(depth=4)
    bot.play_self()
