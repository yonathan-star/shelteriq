import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { useState } from "react";
import { services as allServices } from "../data/services";
import { safeSpots, SPOT_COLORS, SPOT_LABELS } from "../data/safeSpots";
import { t } from "../lib/i18n";
import { Phone, Clock, MapPin, Navigation, Layers } from "lucide-react";

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

function getDirectionsUrl(coords, address) {
  const dest = encodeURIComponent(address || `${coords.lat},${coords.lng}`);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIOS
    ? `maps://maps.apple.com/?daddr=${dest}`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
}

export function MapView({ services: results = [], userCoords, language = "en" }) {
  const [selected, setSelected] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [showSafeSpots, setShowSafeSpots] = useState(false);
  const L = t(language);
  const spotLabels = SPOT_LABELS[language] || SPOT_LABELS.en;

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
  });

  const center = userCoords || { lat: 26.1224, lng: -80.1534 };
  const resultIds = new Set(results.map(s => s.id));
  const mappable = allServices.filter(s => s.coords);

  if (!isLoaded) return <div className="map-loading">Loading map...</div>;

  const circle = window.google.maps.SymbolPath.CIRCLE;

  return (
    <div className="map-shell">
      {/* Safe Spots toggle */}
      <div className="safe-spots-bar">
        <button
          className={`safe-spots-toggle ${showSafeSpots ? "active" : ""}`}
          onClick={() => setShowSafeSpots(v => !v)}
        >
          <Layers size={14} />
          <span>{showSafeSpots ? L.safeSpotsOff : L.safeSpotsToggle}</span>
        </button>
        {showSafeSpots && (
          <p className="safe-spots-hint">{L.safeSpotsHint}</p>
        )}
      </div>

      <GoogleMap
        mapContainerClassName="map-container"
        center={center}
        zoom={11}
        options={{ disableDefaultUI: false, zoomControl: true }}
        onClick={() => { setSelected(null); setSelectedSpot(null); }}
      >
        {userCoords && (
          <Marker
            position={userCoords}
            title={L.yourLocation}
            zIndex={100}
            icon={{ path: circle, scale: 9, fillColor: "#1A7A4A", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 3 }}
          />
        )}

        {mappable.map(service => {
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
                strokeColor: isResult ? "#fff" : "#fff",
                strokeWeight: isResult ? 2.5 : 1.5,
              }}
            />
          );
        })}

        {/* Safe Waiting Spots layer */}
        {showSafeSpots && safeSpots.map(spot => (
          <Marker
            key={spot.id}
            position={spot.coords}
            zIndex={5}
            onClick={() => { setSelectedSpot(spot); setSelected(null); }}
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

        {selectedSpot && selectedSpot.coords && (
          <InfoWindow
            position={selectedSpot.coords}
            onCloseClick={() => setSelectedSpot(null)}
            options={{ pixelOffset: new window.google.maps.Size(0, -10) }}
          >
            <div className="map-info">
              <p className="map-info-title">{selectedSpot.name}</p>
              <div className="map-info-meta">
                <span className="map-info-row"><MapPin size={12} />{selectedSpot.address}</span>
                <span className="map-info-row"><Clock size={12} />{selectedSpot.hours}</span>
              </div>
              <span className={`spot-category-badge cat-${selectedSpot.category}`}>
                {spotLabels[selectedSpot.category] || selectedSpot.category}
              </span>
              {selectedSpot.note && (
                <p className="spot-note">{selectedSpot.note}</p>
              )}
              <div className="map-info-actions">
                <a href={`tel:${selectedSpot.phone}`} className="map-btn map-btn-call">
                  <Phone size={13} />
                  {selectedSpot.phone.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(selectedSpot.address)}`}
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
                {selected.type.map(type => (
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
                <a
                  href={getDirectionsUrl(selected.coords, selected.address)}
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
      </GoogleMap>

      <div className="map-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: "#1A7A4A" }} />
          {L.yourLocation}
        </span>
        {[
          ["shelter",       "#1D4ED8"],
          ["food",          "#B45309"],
          ["mental_health", "#6D28D9"],
          ["veteran",       "#065F46"],
          ["medical",       "#0284C7"],
          ["youth",         "#92400E"],
          ["legal",         "#6B7280"],
        ].map(([type, color]) => (
          <span key={type} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />
            {L.typeBadge[type]}
          </span>
        ))}
        {showSafeSpots && Object.entries(SPOT_COLORS).map(([cat, color]) => (
          <span key={cat} className="legend-item">
            <span className="legend-dot legend-dot-square" style={{ background: color }} />
            {spotLabels[cat]}
          </span>
        ))}
      </div>
    </div>
  );
}
