'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { readStreamableValue } from '@ai-sdk/rsc';

import { refineCanvasState } from '../actions/chatRefiner';
import { processInstagramVibe } from '../actions/processInstagram';
import {
  applyCanvasPatch,
  describePatch,
  type CanvasState,
  type ChatMessage,
} from '../lib/vibeBoard';

function friendlyError(cause: unknown, fallback: string): string {
  const message = cause instanceof Error ? cause.message : '';
  const lower = message.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('destination stream closed') ||
    lower.includes('already closed')
  ) {
    return 'The director got cut off. Try sending that again in a moment.';
  }

  if (lower.includes('quota') || lower.includes('rate limit')) {
    return 'The director is a bit swamped right now. Try again in a minute.';
  }

  return message || fallback;
}

export interface CanvasController {
  /** The live board. Drive every visual off this. */
  canvasState: CanvasState;
  /** Escape hatch, e.g. to seed the board by hand. */
  setCanvasState: (next: CanvasState) => void;
  messages: ChatMessage[];
  /** Streamed nodes from the director, newest last. */
  nodes: ReactNode[];
  /** True while either flow is in flight. */
  isPending: boolean;
  /** A line for the slip under the prompt bar. Empty when idle. */
  status: string;
  error: string | null;
  /** Scrape an Instagram post and rebuild the board from it. */
  runInstagram: (url: string) => Promise<void>;
  /** Send a note to the chat director, which mutates the board. */
  sendMessage: (prompt: string) => Promise<void>;
  /** Put a bank photo on the board, or take it off again. */
  togglePinned: (url: string) => void;
  /** Drop a local file into the photo bank (paperclip button). */
  addToBank: (urls: string[]) => void;
  reset: () => void;
}

/**
 * Holds the canvas, and lets both the Instagram scrape and the Gemini director
 * mutate it.
 *
 * Call this ONCE high in the tree and pass the values down (or wrap it in a
 * context). `useState` is per-component-instance, so calling it in two places
 * gives you two independent canvases.
 */
export function useCanvasController(
  initialState: CanvasState,
): CanvasController {
  const [canvasState, setCanvasStateRaw] = useState<CanvasState>(initialState);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [nodes, setNodes] = useState<ReactNode[]>([]);
  const [isPending, setIsPending] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Mirrors of the two pieces sendMessage needs to read, so a rapid second
  // message does not send a stale canvas or lose the conversation history.
  const canvasRef = useRef(initialState);
  const messagesRef = useRef<ChatMessage[]>([]);

  const setCanvasState = useCallback((next: CanvasState) => {
    canvasRef.current = next;
    setCanvasStateRaw(next);
  }, []);

  /** Same shape for both flows: read a ref, write both the ref and the state. */
  const mutate = useCallback(
    (fn: (state: CanvasState) => CanvasState) => {
      setCanvasState(fn(canvasRef.current));
    },
    [setCanvasState],
  );

  const runInstagram = useCallback(
    async (url: string) => {
      if (isPending) return;

      setIsPending(true);
      setError(null);
      setStatus('developing the photos...');

      try {
        const result = await processInstagramVibe(url);

        setNodes(prev => [...prev, result.ui]);

        // The action resolves before the tool finishes, so the board lands here
        // over time rather than with the return value.
        for await (const board of readStreamableValue(result.board)) {
          if (!board) continue;

          // A fresh post replaces the bank and clears whatever the last post's
          // photos had been pinned to the page.
          setCanvasState({
            vibeSummary: board.vibeSummary,
            colorPalette: board.colorPalette,
            activities: board.activities,
            photoBank: board.photoBank,
            originalImage: board.originalImage,
            backdropImage: board.backdropImage,
            post: board.post,
            pinned: [],
          });
          setStatus('');
        }

        // A conversation about a board the director has never seen goes badly,
        // so start the transcript from the scrape.
        const opener: ChatMessage = {
          role: 'assistant',
          content: `Your board is ready! I turned that Instagram post into a "${canvasRef.current.vibeSummary}" page.`,
        };
        messagesRef.current = [opener];
        setMessages([opener]);
      } catch (cause) {
        setError(friendlyError(cause, 'Could not read that post'));
        setStatus('');
      } finally {
        setIsPending(false);
      }
    },
    [isPending, setCanvasState],
  );

  const sendMessage = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || isPending) return;

      const nextMessages: ChatMessage[] = [
        ...messagesRef.current,
        { role: 'user', content: trimmed },
      ];
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      setIsPending(true);
      setError(null);
      setStatus('rearranging the page...');

      try {
        const result = await refineCanvasState(nextMessages, canvasRef.current);

        setNodes(prev => [...prev, result.ui]);

        // The action resolves before the tools finish, so the patches arrive
        // here over time rather than all at once.
        for await (const patch of readStreamableValue(result.patch)) {
          if (!patch) continue;

          mutate(state => applyCanvasPatch(state, patch));
          setStatus('');

          const assistantTurn: ChatMessage = {
            role: 'assistant',
            content: describePatch(patch),
          };
          messagesRef.current = [...messagesRef.current, assistantTurn];
          setMessages(messagesRef.current);
        }
      } catch (cause) {
        setError(friendlyError(cause, 'Could not reach the director'));
      } finally {
        setStatus('');
        setIsPending(false);
      }
    },
    [isPending, mutate],
  );

  const togglePinned = useCallback(
    (url: string) => {
      mutate(state => ({
        ...state,
        pinned: state.pinned.includes(url)
          ? state.pinned.filter(pinned => pinned !== url)
          : [...state.pinned, url],
      }));
    },
    [mutate],
  );

  const addToBank = useCallback(
    (urls: string[]) => {
      mutate(state => ({
        ...state,
        photoBank: [
          ...state.photoBank,
          ...urls.filter(url => !state.photoBank.includes(url)),
        ],
      }));
    },
    [mutate],
  );

  const reset = useCallback(() => {
    canvasRef.current = initialState;
    messagesRef.current = [];
    setCanvasStateRaw(initialState);
    setMessages([]);
    setNodes([]);
    setStatus('');
    setError(null);
  }, [initialState]);

  return {
    canvasState,
    setCanvasState,
    messages,
    nodes,
    isPending,
    status,
    error,
    runInstagram,
    sendMessage,
    togglePinned,
    addToBank,
    reset,
  };
}
