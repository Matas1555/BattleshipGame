import React, { useState, useContext, useEffect } from 'react';
import { Player, GameState, Ship, Game, EGame } from '../models';
import Board from './Board';
import { SignalRContext } from '../contexts/SignalRContext';
import '../style/GameBoard.css';

interface GameBoardProps {
    players: Player[];
    currentPlayerId: string | null;
    onShipsPlaced: () => void;
}

const GameBoard: React.FC<GameBoardProps> = ({ players, currentPlayerId, onShipsPlaced }) => {
    const [gameStarted, setGameStarted] = useState(false);
    const [isCurrentTurn, setIsCurrentTurn] = useState(false);
    const [gameState, setGameState] = useState<GameState | null>(null);
    const [game, setGame] = useState<EGame | null>(null);

    const { connection } = useContext(SignalRContext)!;

    const currentPlayer = players.find(player => player.id === currentPlayerId);
    const currentTeam = currentPlayer?.team;

    useEffect(() => {
        // Subscribe to the GameStarted event
        connection?.on("GameStarted", (gameState: EGame) => {
            console.log("Game has started!");
            setGameStarted(true);
            setGame(gameState); // Set initial game state
            setIsCurrentTurn(gameState.currentTurn === currentTeam); // Check if it's the current team's turn
        });

        // Subscribe to the UpdateGameState event
        connection?.on("UpdateGameState", (updatedGame: EGame) => {
            console.log("UpdateGameState received:", updatedGame);
            setGame(updatedGame);
            // Check if it's the current team's turn
            setIsCurrentTurn(updatedGame.currentTurn === currentTeam);
        });

        // Handle MoveResult event to manage player's turn
        connection?.on("MoveResult", ({ PlayerId, Row, Col, Result }) => {
            console.log(`${PlayerId} shot at (${Row}, ${Col}): ${Result}`);
        });

        return () => {
            connection?.off("GameStarted");
            connection?.off("UpdateGameState");
            connection?.off("MoveResult");
        };
    }, [connection, currentTeam]);

    const handleShoot = async (row: number, col: number, targetPlayerId: string) => {
        if (!isCurrentTurn || !currentPlayerId || targetPlayerId === currentPlayerId) return;

        try {
            await connection?.invoke("MakeMove", "game-1", currentPlayerId, row, col);
        } catch (error) {
            console.error("Error shooting at target:", error);
        }
    };

    // Function to get a player's board by their ID
    const getPlayerBoard = (playerId: string) => {
        if (game && game.players) {
            const playerInGame = game.players[playerId];
            return playerInGame ? playerInGame.board : null; // Return the board object
        }
        return null; 
    };

    // Identify the teammate
    const getTeammate = (currentPlayerId: string) => {
        if (currentPlayer && game && game.players) {
            return Object.values(game.players).find(
                player => player.team === currentPlayer.team && player.id !== currentPlayerId
            );
        }
        return null; 
    };

    const teammate = currentPlayerId ? getTeammate(currentPlayerId) : null;

    return (
        <div className="game-board-container">
            <h2>Game Board</h2>
            {gameStarted && <p>The game has started!</p>}
            {isCurrentTurn && <p>It's your turn!</p>}
            <div className="boards-container">
                {/* Row for current player and their teammate */}
                <div className="board-row">
                    {currentPlayer && (
                        <>
                            {/* Current Player's Board */}
                            <div key={currentPlayer.id} className={`board-wrapper player-board`}>
                                <div className="board-title">{currentPlayer.name}'s Board</div>
                                {currentPlayer.board && (
                                    <Board
                                        board={currentPlayer.board.grid}
                                        isPlayerBoard={true}
                                        isTeammateBoard={false}
                                        onShipsPlaced={onShipsPlaced}
                                        onShoot={undefined}
                                        playerName={currentPlayer.name}
                                        playerId={currentPlayer.id}
                                        gameId="game-1"
                                    />
                                )}
                            </div>

                            {/* Teammate's Board */}
                            {teammate && (
                                <div key={teammate.id} className={`board-wrapper player-board`}>
                                    <div className="board-title">{teammate.name}'s Board</div>
                                    {teammate.board && (
                                        <Board
                                            board={teammate.board.grid}
                                            isPlayerBoard={false}
                                            isTeammateBoard={true}
                                            onShipsPlaced={undefined}
                                            onShoot={undefined} // Disable shooting for teammates
                                            playerName={teammate.name}
                                            playerId={teammate.id}
                                            gameId="game-1"
                                        />
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Row for Opponent Boards */}
                <div className="board-row">
                    {players.map((player) => {
                        const isOpponentBoard = player.team !== currentTeam;
                        const board = getPlayerBoard(player.id) || player.board;

                        return (
                            isOpponentBoard && (
                                <div key={player.id} className={`board-wrapper opponent-board`}>
                                    <div className="board-title">{player.name}'s Board</div>
                                    {board && (
                                        <Board
                                            board={board.grid}
                                            isPlayerBoard={false}
                                            isTeammateBoard={false}
                                            onShipsPlaced={undefined} // Disable ships placing for opponents
                                            onShoot={isCurrentTurn ? (row, col) => handleShoot(row, col, player.id) : undefined}
                                            playerName={player.name}
                                            playerId={player.id}
                                            gameId="game-1"
                                        />
                                    )}
                                </div>
                            )
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default GameBoard;