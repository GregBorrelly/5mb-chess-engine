import chess
import chess.pgn
import time
from datetime import datetime
from typing import List, Tuple

class ChessGameAnalyzer:
    def __init__(self, engine_class):
        self.engine_class = engine_class
        self.game_history: List[Tuple[chess.Board, float, str]] = []
        
    def play_game(self, max_moves: int = 200) -> chess.pgn.Game:
        """Play a complete game and return it in PGN format."""
        engine = self.engine_class()
        game = chess.pgn.Game()
        
        # Set up game metadata
        game.headers["Date"] = datetime.now().strftime("%Y.%m.%d")
        game.headers["White"] = "ChessEngine (White)"
        game.headers["Black"] = "ChessEngine (Black)"
        game.headers["Event"] = "Self-Play Analysis"
        
        node = game
        move_count = 0
        
        print("\nStarting new game...")
        print(engine.board)
        
        while not engine.board.is_game_over() and move_count < max_moves:
            start_time = time.time()
            
            # Get and make the move
            move = engine.make_move()
            if not move:
                break
                
            # Record evaluation and time
            elapsed = time.time() - start_time
            eval_score = engine.evaluate_position()
            
            # Store the game state
            self.game_history.append((engine.board.copy(), eval_score, str(move)))
            
            # Add move to PGN
            node = node.add_variation(move)
            
            # Display the move
            move_count += 1
            turn = "White" if engine.board.turn else "Black"
            print(f"\nMove {move_count//2 + 1}. {turn}: {move}")
            print(f"Evaluation: {eval_score/100:.2f}")
            print(f"Time taken: {elapsed:.2f}s")
            print(engine.board)
            
            # Check for threefold repetition or fifty-move rule
            if engine.board.is_repetition(3):
                print("Draw by threefold repetition")
                break
            if engine.board.is_fifty_moves():
                print("Draw by fifty-move rule")
                break
        
        # Print game result
        result = self.get_result(engine.board)
        game.headers["Result"] = result
        print(f"\nGame Over! Result: {result}")
        
        return game
    
    def get_result(self, board: chess.Board) -> str:
        """Get the game result in PGN format."""
        if board.is_checkmate():
            return "1-0" if not board.turn else "0-1"
        if board.is_stalemate() or board.is_insufficient_material() or \
           board.is_fifty_moves() or board.is_repetition(3):
            return "1/2-1/2"
        return "*"

    def analyze_game(self, game: chess.pgn.Game) -> dict:
        """Analyze the completed game and return statistics."""
        stats = {
            "total_moves": len(self.game_history),
            "captures": 0,
            "checks": 0,
            "max_eval": float("-inf"),
            "min_eval": float("inf"),
            "avg_eval": 0
        }
        
        total_eval = 0
        prev_board = chess.Board()
        
        for board, eval_score, move in self.game_history:
            # Count captures
            if prev_board.piece_at(chess.parse_square(move[2:4])):
                stats["captures"] += 1
            
            # Count checks
            if board.is_check():
                stats["checks"] += 1
            
            # Track evaluation
            stats["max_eval"] = max(stats["max_eval"], eval_score)
            stats["min_eval"] = min(stats["min_eval"], eval_score)
            total_eval += eval_score
            
            prev_board = board.copy()
        
        if self.game_history:
            stats["avg_eval"] = total_eval / len(self.game_history)
        
        return stats

def main():
    """Run multiple self-play games and analyze them."""
    from optimized_chess_engine import CompactChessEngine  # Updated import
    
    num_games = 3
    analyzer = ChessGameAnalyzer(CompactChessEngine)
    
    print(f"Starting {num_games} self-play games...")
    
    for game_num in range(num_games):
        print(f"\n=== Game {game_num + 1} ===")
        game = analyzer.play_game()
        stats = analyzer.analyze_game(game)
        
        print("\nGame Statistics:")
        print(f"Total Moves: {stats['total_moves']}")
        print(f"Captures: {stats['captures']}")
        print(f"Checks: {stats['checks']}")
        print(f"Max Evaluation: {stats['max_eval']/100:.2f}")
        print(f"Min Evaluation: {stats['min_eval']/100:.2f}")
        print(f"Average Evaluation: {stats['avg_eval']/100:.2f}")
        
        # Save game to PGN file
        filename = f"game_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pgn"
        with open(filename, "w") as f:
            print(game, file=f, end="\n\n")
        print(f"\nGame saved to {filename}")

if __name__ == "__main__":
    main()