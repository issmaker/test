import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Trophy, Zap } from "lucide-react";

const SIZE = 8;
const EMPTY_BOARD = () => Array(SIZE * SIZE).fill(0);
const SHAPES = [
  [[0, 0]],
  [[0, 0], [1, 0]],
  [[0, 0], [0, 1]],
  [[0, 0], [1, 0], [2, 0]],
  [[0, 0], [0, 1], [0, 2]],
  [[0, 0], [1, 0], [0, 1]],
  [[0, 0], [1, 0], [1, 1]],
  [[0, 0], [0, 1], [1, 1]],
  [[1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [1, 1]],
  [[0, 0], [0, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [2, 1]],
  [[0, 0], [1, 0], [1, 1], [2, 1]],
  [[1, 0], [2, 0], [0, 1], [1, 1]],
  [[0, 0], [1, 0], [2, 0], [3, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]],
  [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]],
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
];

let pieceSerial = 0;
const shapeBounds = (cells) => ({
  width: Math.max(...cells.map(([x]) => x)) + 1,
  height: Math.max(...cells.map(([, y]) => y)) + 1,
});
const createPieces = () => Array.from({ length: 3 }, (_, index) => {
  const cells = SHAPES[Math.floor(Math.random() * SHAPES.length)];
  return { id: `blade-${Date.now()}-${pieceSerial++}`, cells, tone: (pieceSerial + index) % 5 + 1 };
});
const canPlace = (board, piece, column, row) => piece?.cells.every(([x, y]) => {
  const px = column + x, py = row + y;
  return px >= 0 && px < SIZE && py >= 0 && py < SIZE && !board[py * SIZE + px];
});
const pieceFits = (board, piece) => {
  if (!piece) return false;
  const bounds = shapeBounds(piece.cells);
  for (let row = 0; row <= SIZE - bounds.height; row += 1)
    for (let column = 0; column <= SIZE - bounds.width; column += 1)
      if (canPlace(board, piece, column, row)) return true;
  return false;
};

function readSession() {
  try {
    const parsed = JSON.parse(localStorage.getItem("agr-blade-grid-session") || "null");
    if (Array.isArray(parsed?.board) && parsed.board.length === 64 && Array.isArray(parsed?.pieces)) return parsed;
  } catch {
    // Start a clean game if Chromium storage was cleared or damaged.
  }
  return { board: EMPTY_BOARD(), pieces: createPieces(), score: 0, combo: 0, gameOver: false };
}

function PieceShape({ piece, ghost = false }) {
  const bounds = shapeBounds(piece.cells);
  return <div className={`blade-piece-shape tone-${piece.tone} ${ghost ? "ghost" : ""}`} style={{ "--piece-w": bounds.width, "--piece-h": bounds.height }}>
    {piece.cells.map(([x, y], index) => <i key={`${x}-${y}-${index}`} style={{ "--cell-x": x, "--cell-y": y }} />)}
  </div>;
}

export default function BladeGrid({ backgroundBusy = false, backgroundProgress = 0, backgroundStatus = "", onBack }) {
  const initial = useMemo(readSession, []);
  const [board, setBoard] = useState(initial.board);
  const [pieces, setPieces] = useState(initial.pieces);
  const [score, setScore] = useState(Number(initial.score || 0));
  const [combo, setCombo] = useState(Number(initial.combo || 0));
  const [best, setBest] = useState(() => Number(localStorage.getItem("agr-blade-grid-best") || 0));
  const [gameOver, setGameOver] = useState(Boolean(initial.gameOver));
  const [drag, setDrag] = useState(null);
  const [clearing, setClearing] = useState([]);
  const boardNode = useRef(null), dragRef = useRef(null), clearTimer = useRef(0);
  const boardRef = useRef(board), piecesRef = useRef(pieces), comboRef = useRef(combo);
  useEffect(() => { boardRef.current = board; }, [board]);
  useEffect(() => { piecesRef.current = pieces; }, [pieces]);
  useEffect(() => { comboRef.current = combo; }, [combo]);
  useEffect(() => { dragRef.current = drag; }, [drag]);
  useEffect(() => {
    try { localStorage.setItem("agr-blade-grid-session", JSON.stringify({ board, pieces, score, combo, gameOver })); } catch { /* optional persistence */ }
  }, [board, pieces, score, combo, gameOver]);
  useEffect(() => {
    if (score <= best) return;
    setBest(score);
    try { localStorage.setItem("agr-blade-grid-best", String(score)); } catch { /* optional persistence */ }
  }, [score, best]);
  useEffect(() => () => clearTimeout(clearTimer.current), []);

  const resetGame = useCallback(() => {
    clearTimeout(clearTimer.current);
    const nextPieces = createPieces();
    setBoard(EMPTY_BOARD()); setPieces(nextPieces); setScore(0); setCombo(0); setClearing([]); setGameOver(false); setDrag(null);
  }, []);

  const finishTurn = useCallback((nextBoard, nextPieces) => {
    let offer = nextPieces;
    if (offer.every((piece) => !piece)) offer = createPieces();
    setPieces(offer);
    setGameOver(!offer.some((piece) => pieceFits(nextBoard, piece)));
  }, []);

  const place = useCallback((pieceIndex, column, row) => {
    const piece = piecesRef.current[pieceIndex], currentBoard = boardRef.current;
    if (!piece || clearing.length || !canPlace(currentBoard, piece, column, row)) return;
    const placed = [...currentBoard];
    piece.cells.forEach(([x, y]) => { placed[(row + y) * SIZE + column + x] = piece.tone; });
    const fullRows = Array.from({ length: SIZE }, (_, y) => y).filter((y) => Array.from({ length: SIZE }, (_, x) => placed[y * SIZE + x]).every(Boolean));
    const fullColumns = Array.from({ length: SIZE }, (_, x) => x).filter((x) => Array.from({ length: SIZE }, (_, y) => placed[y * SIZE + x]).every(Boolean));
    const cleared = new Set();
    fullRows.forEach((y) => { for (let x = 0; x < SIZE; x += 1) cleared.add(y * SIZE + x); });
    fullColumns.forEach((x) => { for (let y = 0; y < SIZE; y += 1) cleared.add(y * SIZE + x); });
    const lines = fullRows.length + fullColumns.length;
    const nextCombo = lines ? comboRef.current + 1 : 0;
    const nextPieces = piecesRef.current.map((value, index) => index === pieceIndex ? null : value);
    setBoard(placed); setPieces(nextPieces); setCombo(nextCombo);
    setScore((value) => value + piece.cells.length * 5 + lines * 120 * Math.max(1, nextCombo));
    if (!cleared.size) { finishTurn(placed, nextPieces); return; }
    setClearing([...cleared]);
    clearTimer.current = setTimeout(() => {
      const released = placed.map((value, index) => cleared.has(index) ? 0 : value);
      setBoard(released); setClearing([]); finishTurn(released, nextPieces);
    }, 330);
  }, [clearing.length, finishTurn]);

  const locate = useCallback((clientX, clientY, pieceIndex) => {
    const node = boardNode.current, piece = piecesRef.current[pieceIndex];
    if (!node || !piece) return { column: -99, row: -99, valid: false };
    const rect = node.getBoundingClientRect(), cell = rect.width / SIZE, bounds = shapeBounds(piece.cells);
    const column = Math.round((clientX - rect.left) / cell - bounds.width / 2);
    const row = Math.round((clientY - rect.top) / cell - bounds.height / 2);
    return { column, row, valid: canPlace(boardRef.current, piece, column, row) };
  }, []);

  const beginDrag = useCallback((event, pieceIndex) => {
    if (gameOver || clearing.length || !piecesRef.current[pieceIndex]) return;
    event.preventDefault();
    const location = locate(event.clientX, event.clientY, pieceIndex);
    setDrag({ pieceIndex, x: event.clientX, y: event.clientY, ...location });
  }, [gameOver, clearing.length, locate]);

  const dragging = Boolean(drag);
  useEffect(() => {
    if (!dragging) return undefined;
    const move = (event) => {
      const active = dragRef.current;
      if (!active) return;
      const location = locate(event.clientX, event.clientY, active.pieceIndex);
      setDrag({ ...active, x: event.clientX, y: event.clientY, ...location });
    };
    const end = (event) => {
      const active = dragRef.current;
      if (!active) return;
      const location = locate(event.clientX, event.clientY, active.pieceIndex);
      if (location.valid) place(active.pieceIndex, location.column, location.row);
      setDrag(null);
    };
    const cancel = () => setDrag(null);
    addEventListener("pointermove", move, { passive: true });
    addEventListener("pointerup", end, { once: true });
    addEventListener("pointercancel", cancel, { once: true });
    return () => { removeEventListener("pointermove", move); removeEventListener("pointerup", end); removeEventListener("pointercancel", cancel); };
  }, [dragging, locate, place]);

  const previewCells = useMemo(() => {
    const indexes = new Set();
    if (!drag?.valid) return indexes;
    pieces[drag.pieceIndex]?.cells.forEach(([x, y]) => indexes.add((drag.row + y) * SIZE + drag.column + x));
    return indexes;
  }, [drag, pieces]);

  return <main className="blade-game workspace">
    <section className="blade-game-shell">
      <header className="blade-game-head">
        <div><small>8 × 8 · LOGIC RELAY</small><h1>BLADE GRID</h1></div>
        <div className="blade-score"><span><Zap /> SCORE <b>{score}</b></span><span><Trophy /> BEST <b>{best}</b></span>{combo > 1 && <em>COMBO ×{combo}</em>}</div>
        <div className="blade-game-actions"><button onClick={resetGame}><RotateCcw /> НОВАЯ ИГРА</button><button onClick={onBack}>ВЕРНУТЬСЯ</button></div>
      </header>
      {backgroundBusy && <div className="blade-background-task"><i style={{ "--progress": Math.max(0, Math.min(1, backgroundProgress)) }} /><span><small>ОПТИМИЗАТОР РАБОТАЕТ В ФОНЕ</small><b>{backgroundStatus || "Подготовка изображения"}</b></span><strong>{Math.round(backgroundProgress * 100)}%</strong></div>}
      <div className="blade-game-stage">
        <div ref={boardNode} className="blade-board" aria-label="Игровое поле 8 на 8">
          {board.map((tone, index) => <i key={index} className={`${tone ? `filled tone-${tone}` : ""} ${clearing.includes(index) ? "clearing" : ""} ${previewCells.has(index) ? "preview" : ""}`} />)}
          {gameOver && <div className="blade-game-over"><small>NO AVAILABLE MOVES</small><strong>КАНАЛ ЗАКРЫТ</strong><b>{score} ОЧКОВ</b><button onClick={resetGame}>НАЧАТЬ СНОВА</button></div>}
        </div>
        <div className="blade-piece-tray">
          <div><small>ТРИ МОДУЛЯ НА ХОД</small><b>Перетащите фигуру на свободные клетки</b></div>
          <section>{pieces.map((piece, index) => <button key={piece?.id || `used-${index}`} className={`blade-piece ${piece ? "" : "used"}`} disabled={!piece || gameOver} onPointerDown={(event) => beginDrag(event, index)}>{piece ? <PieceShape piece={piece} /> : <span>РАЗМЕЩЕНО</span>}</button>)}</section>
        </div>
      </div>
    </section>
    {drag && pieces[drag.pieceIndex] && <div className={`blade-drag-ghost ${drag.valid ? "valid" : "invalid"}`} style={{ left: drag.x, top: drag.y }}><PieceShape piece={pieces[drag.pieceIndex]} ghost /></div>}
  </main>;
}
