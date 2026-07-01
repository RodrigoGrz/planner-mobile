import { useNetwork } from "@/contexts/NetworkContext";
import { useEffect, useRef } from "react";

export function useIsOnlineRef() {
  const { isOnline } = useNetwork();
  const isOnlineRef = useRef(isOnline);

  useEffect(() => {
    isOnlineRef.current = isOnline;
  }, [isOnline]);

  return isOnlineRef;
}
