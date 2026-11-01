import { useRef } from 'react';
import type { AgentController } from './controller.js';

/** A conversation belongs to its controller as well as its record ID. */
export function useSelectionKey(agent: AgentController, id: string) {
  const selection = useRef({ agent, id, key: 0 });
  if (selection.current.agent !== agent || selection.current.id !== id) {
    selection.current = { agent, id, key: selection.current.key + 1 };
  }
  return selection.current.key;
}
