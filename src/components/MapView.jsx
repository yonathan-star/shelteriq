import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { useState } from "react";
import { t } from "../lib/i18n";

const TYPE_COLORS = {
  shelter: "#1D4ED8",
  food: "#B45309",
  mental_health: "#6D28D9",
  veteran: "#065F46",
  medical: "#1A7A4A",
  default: "#374151"
};

export function MapView({ services, userCoords, language = "en" }) {
  const [selected, setSelected] = useState(null);
  const L = t(language);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""
  });

  const center = userCoords || { lat: 26.1224, lng: -80.1534 };

  if (!isLoaded) {
    return <div className="map-loading">Loading map...</div>;
  }

  const circle = window.google.maps.SymbolPath.CIRCLE;

  return (
    <div className="map-shell">
      <GoogleMap
        mapContainerClassName="map-container"
        center={center}
        zoom={11}
        options={{ disableDefaultUI: false, zoomControl: true }}
      >
        {userCoords && (
          <Marker
            position={userCoords}
            title={L.yourLocation}
            icon={{ path: circle, scale: 8, fillColor: "#1A7A4A", fillOpacity: 1, strokeColor: "#fff", strokeWeight: 2 }}
          />
        )}
        {services.filter(s => s.coords).map(service => (
          <Marker
            key={service.id}
            position={service.coords}
            onClick={() => setSelected(service)}
            icon={{
              path: circle,
              scale: 7,
              fillColor: TYPE_COLORS[service.type[0]] || TYPE_COLORS.default,
              fillOpacity: 0.9,
              strokeColor: "#fff",
              strokeWeight: 2
            }}
          />
        ))}
        {selected && (
          <InfoWindow position={selected.coords} onCloseClick={() => setSelected(null)}>
            <div className="map-info">
              <p className="map-info-title">{selected.name}</p>
              <p className="map-info-detail">{selected.hours}</p>
              <a href={`tel:${selected.phone}`} className="map-info-phone">{selected.phone}</a>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
      <div className="map-legend">
        <span className="legend-item">
          <span className="legend-dot" style={{ background: "#1A7A4A" }} />
          {L.yourLocation}
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: "#1D4ED8" }} />
          {L.legendShelter}
        </span>
        <span className="legend-item">
          <span className="legend-dot" style={{ background: "#B45309" }} />
          {L.legendFood}
        </span>
      </div>
    </div>
  );
}
