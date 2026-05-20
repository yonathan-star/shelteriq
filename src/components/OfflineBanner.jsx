import { useOnlineStatus } from "../hooks/useOfflineCache";
import { t } from "../lib/i18n";

export function OfflineBanner({ language = "en" }) {
  const isOnline = useOnlineStatus();
  const L = t(language);
  if (isOnline) return null;
  return <div className="offline-banner">{L.offline}</div>;
}
