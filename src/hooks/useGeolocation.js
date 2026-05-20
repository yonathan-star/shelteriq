import { useState, useEffect } from "react";

const isSupported =
  typeof navigator !== "undefined" && !!navigator.geolocation;

export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(
    isSupported ? null : "Geolocation not supported"
  );
  const [loading, setLoading] = useState(isSupported);

  useEffect(() => {
    if (!isSupported) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLoading(false);
      },
      err => {
        setError(err.message);
        setLoading(false);
      },
      { timeout: 8000 }
    );
  }, []);

  return { coords, error, loading };
}
