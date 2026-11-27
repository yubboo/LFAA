// 项目画布入口：选择或创建持久化画布，并负责载入与重试。
import { useEffect, useState, type FormEvent } from "react";
import type { BoardDetail } from "@lfaa/canvas/contract";
import { boardsPath, createBoard, getBoard, getModels, listBoards, type CanvasListItem, type CanvasModel } from "../api/canvas-api";
import { labels } from "../locales";
import { CanvasEditor } from "./Canvas-Editor";
import styles from "./Canvas.module.css";

export default function CanvasWorkspace({ projectId, isZh }: { projectId: string | null; isZh: boolean }) {
  const t = labels[isZh ? "zh" : "en"];
  const [boards, setBoards] = useState<CanvasListItem[]>([]);
  const [models, setModels] = useState<CanvasModel[]>([]);
  const [boardId, setBoardId] = useState("");
  const [initial, setInitial] = useState<BoardDetail | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const base = projectId ? boardsPath(projectId) : "";
  const preference = "lfaa-canvas-board:" + projectId;
  const path = boardId ? base + "/" + boardId : "";

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    void listBoards(projectId, controller.signal).then((items) => {
      setBoards(items);
      const remembered = localStorage.getItem(preference);
      if (remembered && items.some((item) => item.canvasId === remembered)) setBoardId(remembered);
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(String(cause)); });
    void getModels(controller.signal).then(setModels).catch((cause: unknown) => { if (!controller.signal.aborted) setError(String(cause)); });
    return () => controller.abort();
  }, [projectId, preference, retry]);

  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setError("");
    void getBoard(path, controller.signal).then((data) => {
      setInitial(data);
      localStorage.setItem(preference, data.board.canvasId);
    }).catch((cause: unknown) => { if (!controller.signal.aborted) setError(String(cause)); });
    return () => controller.abort();
  }, [path, preference, retry]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId || !name.trim() || creating) return;
    setCreating(true);
    setError("");
    try {
      const board = await createBoard(projectId, name.trim());
      setBoards((items) => [...items, board]);
      setBoardId(board.canvasId);
      setName("");
    } catch (cause) {
      setError(String(cause));
    } finally {
      setCreating(false);
    }
  }

  if (!projectId) return <div className={styles.start}><p>{t.noProject}</p></div>;
  if (initial && initial.board.canvasId === boardId) {
    return <CanvasEditor key={boardId} path={path} initial={initial} models={models} isZh={isZh}
      onBack={() => { setBoardId(""); localStorage.removeItem(preference); }} />;
  }
  return (
    <div className={styles.start}>
      <form className={styles.inline} onSubmit={(event) => void create(event)}>
        <input maxLength={120} aria-label={t.title} placeholder={t.title} value={name} onChange={(event) => setName(event.target.value)} />
        <button type="submit" disabled={!name.trim() || creating}>{t.create}</button>
      </form>
      {error && <div role="alert" className={styles.error}>{error} <button onClick={() => setRetry(retry + 1)}>{t.reload}</button></div>}
      {boards.length === 0 && !boardId && <p>{t.empty}</p>}
      {boards.length > 0 && <ul className={styles.boards}>
        {boards.map((board) => <li key={board.canvasId}>
          <button onClick={() => setBoardId(board.canvasId)}>{board.title}</button>
        </li>)}
      </ul>}
    </div>
  );
}
