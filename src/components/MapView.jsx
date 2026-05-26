import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer } from "@react-google-maps/api";
import { useEffect, useRef, useState } from "react";
import { services as allServices } from "../data/services";
import { safeSpots, SPOT_COLORS, SPOT_LABELS } from "../data/safeSpots";
import { t } from "../lib/i18n";
import { Phone, Clock, MapPin, Navigation, Layers, X, CarFront, LocateFixed, Route } from "lucide-react";

const TYPE_COLORS = {
  shelter: "#1D4ED8",
  food: "#B45309",
  mental_health: "#6D28D9",
  substance_abuse: "#6D28D9",
  veteran: "#065F46",
  medical: "#0284C7",
  youth: "#92400E",
  legal: "#6B7280",
  outreach: "#6B7280",
  family: "#1D4ED8",
  default: "#6B7280",
};

const SPOT_BADGE_STYLES = {
  library: { backgroundColor: "#DBEAFE", color: "#1D4ED8", border: "1px solid #93C5FD" },
  cooling: { backgroundColor: "#D1FAE5", color: "#065F46", border: "1px solid #6EE7B7" },
  "24hr": { backgroundColor: "#FEF3C7", color: "#92400E", border: "1px solid #FCD34D" },
  transit: { backgroundColor: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB" },
};

function getDirectionsUrl(coords, address) {
  const dest = encodeURIComponent(address || `${coords.lat},${coords.lng}`);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIOS
    ? `maps://maps.apple.com/?daddr=${dest}`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

export function MapView({
  services: results = [],
  userCoords,
  language = "en",
  navTarget,
  onClearNavTarget,
}) {
  const [selected, setSelected] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [showSafeSpots, setShowSafeSpots] = useState(false);
  const [navDestination, setNavDestination] = useState(null);
  const [directions, setDirections] = useState(null);
  const [navMeta, setNavMeta] = useState(null);
  const [navSteps, setNavSteps] = useState([]);
  const [navError, setNavError] = useState("");
  const mapRef = useRef(null);

  const L = t(language);
  const spotLabels = SPOT_LABELS[language] || SPOT_LABELS.en;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  useEffect(() => {
    if (!navTarget?.coords) return;
    setNavDestination({
      name: navTarget.name,
      address: navTarget.address,
      coords: navTarget.coords,
    });
  }, [navTarget]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !navDestination?.coords) return;
    const bounds = new window.google.maps.LatLngBounds();
    if (userCoords) bounds.extend(userCoords);
    bounds.extend(navDestination.coords);
    mapRef.current.fitBounds(bounds, 72);
  }, [isLoaded, navDestination, userCoords]);

  useEffect(() => {
    if (!isLoaded || !userCoords || !navDestination?.coords) {
      setDirections(null);
      setNavMeta(null);
      setNavSteps([]);
      setNavError(navDestination?.coords && !userCoords ? "Turn on location to use in-app navigation." : "");
      return;
    }

    const svc = new window.google.maps.DirectionsService();
    const timeout = window.setTimeout(() => {
      setDirections(null);
      setNavMeta(null);
      setNavSteps([]);
      setNavError("Route request timed out.");
    }, 10000);

    svc.route(
      {
        origin: userCoords,
        destination: navDestination.coords,
        travelMode: window.google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: false,
      },
      (result, status) => {
        window.clearTimeout(timeout);
        if (status !== "OK" || !result) {
          setDirections(null);
          setNavMeta(null);
          setNavSteps([]);
          setNavError(`Route unavailable (${status}).`);
          return;
        }

        const leg = result.routes[0]?.legs[0];
        setDirections(result);
        setNavMeta({
          distance: leg?.distance?.text || "",
          duration: leg?.duration?.text || "",
        });
        setNavSteps((leg?.steps || []).slice(0, 5).map((step) => step.instructions));
        setNavError("");
      }
    );

    return () => window.clearTimeout(timeout);
  }, [isLoaded, navDestination, userCoords]);

  const handleNavigate = (service) => {
    setSelected(null);
    setNavDestination({ name: service.name, address: service.address, coords: service.coords });
  };

  const clearNav = () => {
    setNavDestination(null);
    setDirections(null);
    setNavMeta(null);
    setNavSteps([]);
    setNavError("");
    onClearNavTarget?.();
  };

  const center = userCoords || { lat: 26.1224, lng: -80.1534 };
  const resultIds = new Set(results.map((s) => s.id));
  const mappable = allServices.filter((s) => s.coords);
  const isNavMode = Boolean(navDestination);

  if (!isLoaded) return <div className="map-loading">Loading map...</div>;

  const circle = window.google.maps.SymbolPath.CIRCLE;

  return (
    <div className="map-shell">
      {!isNavMode && (
        <div className="safe-spots-bar">
          <button
            className={`safe-spots-toggle ${showSafeSpots ? "active" : ""}`}
            onClick={() => setShowSafeSpots((v) => !v)}
          >
            <Layers size={14} />
            <span>{showSafeSpots ? L.safeSpotsOff : L.safeSpotsToggle}</span>
          </button>
          {showSafeSpots && <p className="safe-spots-hint">{L.safeSpotsHint}</p>}
        </div>
      )}

      {isNavMode && (
        <div className="nav-mode-shell">
          <div className="nav-mode-top">
            <div className="nav-mode-title-wrap">
              <span className="nav-mode-icon">
                <CarFront size={18} />
              </span>
              <div className="nav-mode-copy">
                <span className="nav-mode-kicker">Navigation Mode</span>
                <span className="nav-mode-dest">{navDestination.name}</span>
              </div>
            </div>
            <button className="nav-bar-close" onClick={clearNav} title="Exit navigation">
              <X size={14} />
            </button>
          </div>

          <div className="nav-mode-stats">
            <span className="nav-mode-stat">
              <Route size={14} />
              {navMeta ? `${navMeta.distance} route` : "Finding route"}
            </span>
            <span className="nav-mode-stat">
              <Clock size={14} />
              {navMeta ? navMeta.duration : "Estimating ETA"}
            </span>
            <button
              className="nav-mode-locate"
              onClick={() => {
                if (!mapRef.current || !userCoords) return;
                mapRef.current.panTo(userCoords);
                mapRef.current.setZoom(14);
              }}
            >
              <LocateFixed size={14} />
              Recenter
            </button>
          </div>

          <div className="nav-mode-body">
            {navError ? (
              <div className="nav-mode-error">
                <p>{navError}</p>
                <a
                  href={getDirectionsUrl(navDestination.coords, navDestination.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-mode-fallback"
                >
                  Open in maps app
                </a>
              </div>
            ) : navSteps.length > 0 ? (
              <div className="nav-step-list">
                {navSteps.map((step, index) => (
                  <div key={index} className="nav-step-card">
                    <span className="nav-step-num">{index + 1}</span>
                    <div className="nav-step-item" dangerouslySetInnerHTML={{ __html: step }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="nav-mode-loading">Calculating driving directions...</div>
            )}
          </div>
        </div>
      )}

      <GoogleMap
        mapContainerClassName="map-container"
        center={center}
        zoom={11}
        options={{ disableDefaultUI: isNavMode, zoomControl: !isNavMode }}
        onLoad={(map) => {
          mapRef.current = map;
        }}
        onClick={() => {
          setSelected(null);
          setSelectedSpot(null);
        }}
      >
        {userCoords && (
          <Marker
            position={userCoords}
            title={L.yourLocation}
            zIndex={100}
            icon={{
              path: circle,
              scale: 9,
              fillColor: "#1A7A4A",
              fillOpacity: 1,
              strokeColor: "#fff",
              strokeWeight: 3,
            }}
          />
        )}

        {mappable.map((service) => {
          const isResult = resultIds.has(service.id);
          const color = TYPE_COLORS[service.type[0]] || TYPE_COLORS.default;
          return (
            <Marker
              key={service.id}
              position={service.coords}
              zIndex={isResult ? 10 : 1}
              onClick={() => setSelected(service)}
              icon={{
                path: circle,
                scale: isResult ? 9 : 6,
                fillColor: color,
                fillOpacity: isResult ? 1 : 0.55,
                strokeColor: "#fff",
                strokeWeight: isResult ? 2.5 : 1.5,
              }}
            />
          );
        })}

        {!isNavMode &&
          showSafeSpots &&
          safeSpots.map((spot) => (
            <Marker
              key={spot.id}
              position={spot.coords}
              zIndex={5}
              onClick={() => {
                setSelectedSpot(spot);
                setSelected(null);
              }}
              icon={{
                path: circle,
                scale: 8,
                fillColor: SPOT_COLORS[spot.category] || "#6B7280",
                fillOpacity: 0.9,
                strokeColor: "#fff",
                strokeWeight: 2,
              }}
            />
          ))}

        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: "#15803D",
                strokeOpacity: 0.9,
                strokeWeight: 6,
              },
            }}
          />
        )}

        {selectedSpot && selectedSpot.coords && (
          <InfoWindow
            position={selectedSpot.coords}
            onCloseClick={() => setSelectedSpot(null)}
            options={{ pixelOffset: new window.google.maps.Size(0, -10) }}
          >
            <div className="map-info">
              <p className="map-info-title">{selectedSpot.name}</p>
              <div className="map-info-meta">
                <span className="map-info-row">
                  <MapPin size={12} />
                  {selectedSpot.address}
                </span>
                <span className="map-info-row">
                  <Clock size={12} />
                  {selectedSpot.hours}
                </span>
              </div>
              <div
                className="spot-category-chip"
                style={SPOT_BADGE_STYLES[selectedSpot.category] || { backgroundColor: "#F3F4F6", color: "#374151", border: "1px solid #D1D5DB" }}
              >
                {spotLabels[selectedSpot.category] || selectedSpot.category}
              </div>
              {selectedSpot.note && <p className="spot-note">{selectedSpot.note}</p>}
              <div className="map-info-actions">
                <a href={`tel:${selectedSpot.phone}`} className="map-btn map-btn-call">
                  <Phone size={13} />
                  {selectedSpot.phone.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}
                </a>
                <a
                  href={getDirectionsUrl(selectedSpot.coords, selectedSpot.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="map-btn map-btn-dir"
                >
                  <Navigation size={13} />
                  {language === "es" ? "Cómo llegar" : language === "ht" ? "Direksyon" : "Directions"}
                </a>
              </div>
            </div>
          </InfoWindow>
        )}

        {selected && selected.coords && (
          <InfoWindow
            position={selected.coords}
            onCloseClick={() => setSelected(null)}
            options={{ pixelOffset: new window.google.maps.Size(0, -10) }}
          >
            <div className="map-info">
              <p className="map-info-title">{selected.name}</p>

              <div className="map-info-meta">
                <span className="map-info-row">
                  <MapPin size={12} />
                  {selected.address}
                </span>
                <span className="map-info-row">
                  <Clock size={12} />
                  {selected.hours}
                </span>
                <span className="map-info-row">
                  <Phone size={12} />
                  {selected.walkin ? L.walkin : L.callAhead}
                </span>
              </div>

              <div className="map-info-badges">
                {selected.type.map((type) => (
                  <span key={type} className={`type-badge type-${type}`} style={{ fontSize: 10 }}>
                    {L.typeBadge[type] || type}
                  </span>
                ))}
              </div>

              <div className="map-info-actions">
                <a href={`tel:${selected.phone}`} className="map-btn map-btn-call">
                  <Phone size={13} />
                  {selected.phone}
                </a>
                <button className="map-btn map-btn-dir" onClick={() => handleNavigate(selected)}>
                  <Navigation size={13} />
                  {language === "es" ? "Navegar" : language === "ht" ? "Direksyon" : "Navigate"}
                </button>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {!isNavMode && (
        <div className="map-legend">
          <span className="legend-item">
            <span className="legend-dot" style={{ background: "#1A7A4A" }} />
            {L.yourLocation}
          </span>
          {[
            ["shelter", "#1D4ED8"],
            ["food", "#B45309"],
            ["mental_health", "#6D28D9"],
            ["veteran", "#065F46"],
            ["medical", "#0284C7"],
            ["youth", "#92400E"],
            ["legal", "#6B7280"],
          ].map(([type, color]) => (
            <span key={type} className="legend-item">
              <span className="legend-dot" style={{ background: color }} />
              {L.typeBadge[type]}
            </span>
          ))}
          {showSafeSpots &&
            Object.entries(SPOT_COLORS).map(([cat, color]) => (
              <span key={cat} className="legend-item">
                <span className="legend-dot legend-dot-square" style={{ background: color }} />
                {spotLabels[cat]}
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
