import { useNetwork } from "@/contexts/NetworkContext";
import { useEffect, useRef } from "react";

export function useSyncOnReconnect(sync: () => void | Promise<void>) {
  const { registerReconnectCallback, isOnline } = useNetwork();
  const syncRef = useRef(sync);
  const wasOnlineRef = useRef(isOnline);

  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);

  useEffect(() => {
    return registerReconnectCallback(() => {
      void syncRef.current();
    });
  }, [registerReconnectCallback]);

  useEffect(() => {
    if (!wasOnlineRef.current && isOnline) {
      void syncRef.current();
    }

    wasOnlineRef.current = isOnline;
  }, [isOnline]);
}

export function useReloadWhenOnline(reload: () => void | Promise<void>) {
  const { isOnline } = useNetwork();
  const reloadRef = useRef(reload);
  const wasOnlineRef = useRef(isOnline);

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    if (!wasOnlineRef.current && isOnline) {
      void reloadRef.current();
    }

    wasOnlineRef.current = isOnline;
  }, [isOnline]);
}
