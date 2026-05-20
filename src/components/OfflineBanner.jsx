import { useOnlineStatus } from "../hooks/useOfflineCache";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div className="offline-banner">
      You are offline - showing cached nearby services
    </div>
  );
}
