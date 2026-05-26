import { useState, useEffect } from "react";

const isSupported =
  typeof navigator !== "undefined" && !!navigator.geolocation;

export function useGeolocation() {
  const [coords, setCoords] = useState(null);
  const [heading, setHeading] = useState(null);
  const [speed, setSpeed] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(
    isSupported ? null : "Geolocation not supported"
  );
  const [loading, setLoading] = useState(isSupported);

  useEffect(() => {
    if (!isSupported) return;

    const updateFromPosition = (pos) => {
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setHeading(Number.isFinite(pos.coords.heading) ? pos.coords.heading : null);
      setSpeed(Number.isFinite(pos.coords.speed) ? pos.coords.speed : null);
      setAccuracy(Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null);
      setError(null);
      setLoading(false);
    };

    navigator.geolocation.getCurrentPosition(
      updateFromPosition,
      err => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );

    const watchId = navigator.geolocation.watchPosition(
      updateFromPosition,
      err => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { coords, heading, speed, accuracy, error, loading };
}
