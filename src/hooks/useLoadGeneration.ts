import { useCallback, useRef } from "react";

export function useLoadGeneration() {
  const generationRef = useRef(0);

  const beginLoad = useCallback(() => {
    generationRef.current += 1;
    return generationRef.current;
  }, []);

  const isCurrentLoad = useCallback((generation: number) => {
    return generation === generationRef.current;
  }, []);

  return { beginLoad, isCurrentLoad };
}
