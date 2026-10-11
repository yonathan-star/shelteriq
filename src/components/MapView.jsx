import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer, OverlayView } from "@react-google-maps/api";
import { useEffect, useRef, useState } from "react";
import { services as allServices } from "../data/services";
import { safeSpots, SPOT_COLORS, SPOT_LABELS } from "../data/safeSpots";
import { t } from "../lib/i18n";
import { getDistanceMiles } from "../lib/geo";
import { HazardMap } from './HazardMap.jsx';
import {
  Phone,
  Clock,
  MapPin,
  Navigation,
  Layers,
  X,
  CarFront,
  LocateFixed,
  Route,
  ArrowUp,
} from "lucide-react";

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

function htmlToText(html) {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function latLngToCoords(latLng) {
  return { lat: latLng.lat(), lng: latLng.lng() };
}

function pointToSegmentDistanceMiles(point, start, end) {
  if (!point || !start || !end) return Infinity;
  const milesPerLat = 69;
  const milesPerLng = Math.cos((point.lat * Math.PI) / 180) * 69;
  const px = point.lng * milesPerLng;
  const py = point.lat * milesPerLat;
  const ax = start.lng * milesPerLng;
  const ay = start.lat * milesPerLat;
  const bx = end.lng * milesPerLng;
  const by = end.lat * milesPerLat;
  const abx = bx - ax;
  const aby = by - ay;
  const ab2 = abx * abx + aby * aby;
  if (ab2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / ab2));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

function getMinDistanceToPathMiles(point, path) {
  if (!point || !path || path.length < 2) return Infinity;
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i += 1) {
    min = Math.min(min, pointToSegmentDistanceMiles(point, path[i], path[i + 1]));
  }
  return min;
}

function getCarIcon(googleMaps, heading) {
  return {
    path: googleMaps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 6,
    rotation: heading || 0,
    fillColor: "#15803D",
    fillOpacity: 1,
    strokeColor: "#FFFFFF",
    strokeWeight: 2,
  };
}

export function MapView(props) {
  const [hazards,setHazards]=useState(!props.navTarget);
  const language=props.language||'en';
  return <div className="hazard-map-wrapper"><div className="hazard-actions"><button onClick={()=>setHazards(true)} aria-pressed={hazards}>{language==='es'?'Desastres y alertas':language==='ht'?'Dezas ak alèt':'Disasters & alerts'}</button><button onClick={()=>setHazards(false)} aria-pressed={!hazards}>{language==='es'?'Direcciones':language==='ht'?'Direksyon':'Service directions'}</button></div>{hazards?<HazardMap language={language}/>:<ServiceMapView {...props}/>}</div>;
}
function ServiceMapView({
  services: results = [],
  userCoords,
  userHeading,
  userSpeed,
  userAccuracy,
  language = "en",
  navTarget,
  onClearNavTarget,
}) {
  const [mapUnavailable, setMapUnavailable] = useState(false);
  useEffect(() => {
    const previous = window.gm_authFailure;
    const handler = () => { setMapUnavailable(true); previous?.(); };
    window.gm_authFailure = handler;
    // Billing/configuration errors can appear after the script successfully loads.
    const detectError = () => {
      if (document.body.textContent.includes("This page can't load Google Maps correctly.") || document.querySelector(".gm-err-container")) setMapUnavailable(true);
    };
    const observer = new MutationObserver(detectError);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (window.gm_authFailure === handler) window.gm_authFailure = previous;
    };
  }, []);
  const [selected, setSelected] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [showSafeSpots, setShowSafeSpots] = useState(false);
  const [navDestination, setNavDestination] = useState(() => navTarget?.coords ? { name: navTarget.name, address: navTarget.address, coords: navTarget.coords } : null);
  const [directions, setDirections] = useState(null);
  const [navMeta, setNavMeta] = useState(null);
  const [navSteps, setNavSteps] = useState([]);
  const [navError, setNavError] = useState("");
  const [followMode, setFollowMode] = useState(true);
  const [routePath, setRoutePath] = useState([]);
  const [rerouteNonce, setRerouteNonce] = useState(0);
  const mapRef = useRef(null);
  const lastRerouteAtRef = useRef(0);

  const L = t(language);
  const spotLabels = SPOT_LABELS[language] || SPOT_LABELS.en;

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
  });

  useEffect(() => {
    if (isLoaded) return;
    const timer = setTimeout(() => setMapUnavailable(true), 15000);
    return () => clearTimeout(timer);
  }, [isLoaded]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !navDestination?.coords) return;
    const bounds = new window.google.maps.LatLngBounds();
    if (userCoords) bounds.extend(userCoords);
    bounds.extend(navDestination.coords);
    mapRef.current.fitBounds(bounds, 72);
  }, [isLoaded, navDestination, userCoords]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || !userCoords || !navDestination || !followMode) return;
    mapRef.current.panTo(userCoords);
    mapRef.current.setZoom(17);
  }, [isLoaded, userCoords, navDestination, followMode]);

  useEffect(() => {
    if (!isLoaded || !userCoords || !navDestination?.coords) {
      return;
    }

    const svc = new window.google.maps.DirectionsService();
    let active = true;
    const timeout = window.setTimeout(() => {
      setDirections(null);
      setNavMeta(null);
      setNavSteps([]);
      setRoutePath([]);
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
        if (!active) return;
        window.clearTimeout(timeout);
        if (status !== "OK" || !result) {
          setDirections(null);
          setNavMeta(null);
          setNavSteps([]);
          setRoutePath([]);
          setNavError(`Route unavailable (${status}).`);
          return;
        }

        const leg = result.routes[0]?.legs[0];
        const steps = (leg?.steps || []).map((step) => ({
          instructionHtml: step.instructions,
          instructionText: htmlToText(step.instructions),
          distanceText: step.distance?.text || "",
          durationText: step.duration?.text || "",
          endCoords: latLngToCoords(step.end_location),
          startCoords: latLngToCoords(step.start_location),
        }));

        setDirections(result);
        setNavMeta({
          distance: leg?.distance?.text || "",
          duration: leg?.duration?.text || "",
        });
        setNavSteps(steps);
        setRoutePath(result.routes[0]?.overview_path?.map(latLngToCoords) || []);
        setNavError("");
      }
    );

    return () => { active = false; window.clearTimeout(timeout); };
  }, [isLoaded, navDestination, rerouteNonce, userCoords]);

  useEffect(() => {
    if (!userCoords || navSteps.length === 0 || !navDestination?.coords) return;
    const routeOffset = getMinDistanceToPathMiles(userCoords, routePath);
    const now = Date.now();
    if (routeOffset > 0.08 && now - lastRerouteAtRef.current > 8000) {
      const timer = window.setTimeout(() => {
        lastRerouteAtRef.current = Date.now();
        setRerouteNonce((value) => value + 1);
      }, 250);
      return () => window.clearTimeout(timer);
    }
  }, [navDestination, navSteps, routePath, userCoords]);

  const handleNavigate = (service) => {
    setSelected(null);
    setSelectedSpot(null);
    setNavDestination({ name: service.name, address: service.address, coords: service.coords });
    setFollowMode(true);
  };

  const handleNavigateToSafeSpot = (spot) => {
    setSelected(null);
    setSelectedSpot(null);
    setNavDestination({ name: spot.name, address: spot.address, coords: spot.coords });
    setFollowMode(true);
  };

  const clearNav = () => {
    setNavDestination(null);
    setDirections(null);
    setNavMeta(null);
    setNavSteps([]);
    setNavError("");
    setRoutePath([]);
    setFollowMode(true);
    onClearNavTarget?.();
  };

  const center = userCoords || { lat: 26.1224, lng: -80.1534 };
  const resultIds = new Set(results.map((s) => s.id));
  const mappable = allServices.filter((s) => s.coords);
  const isNavMode = Boolean(navDestination);
  const arrived = Boolean(userCoords && navDestination?.coords && getDistanceMiles(userCoords, navDestination.coords) < 0.05);
  const nextIndex = userCoords ? navSteps.findIndex(step => getDistanceMiles(userCoords, step.endCoords) > 0.03) : 0;
  const activeStepIndex = nextIndex < 0 ? Math.max(0, navSteps.length - 1) : nextIndex;
  const displayNavError = navDestination && !userCoords ? "Turn on location to use in-app navigation." : navError;
  const activeStep = navSteps[activeStepIndex] || null;
  const remainingSteps = navSteps.slice(activeStepIndex + 1, activeStepIndex + 4);
  const speedMph = Number.isFinite(userSpeed) ? Math.max(0, userSpeed * 2.23694) : null;

  if (mapUnavailable || loadError) {
    const options = navTarget ? [navTarget] : results.length ? results : allServices;
    return <div className="map-fallback">
      <h2>{language === "es" ? "El mapa no está disponible" : language === "ht" ? "Kat la pa disponib" : "Map unavailable"}</h2>
      <p>{language === "es" ? "Use las direcciones y los enlaces para llegar. Llame antes de viajar." : language === "ht" ? "Sèvi ak adrès ak lyen yo. Rele anvan ou deplase." : "Use these addresses and directions links. Call before traveling."}</p>
      {options.map(s => <div className="map-fallback-card" key={s.id}>
        <h3>{s.name}</h3><p>{s.address}</p>
        <a href={`tel:${s.phone}`}>{language === "es" ? "Llamar" : language === "ht" ? "Rele" : "Call"}: {s.phone}</a>
        {s.coords && <a href={getDirectionsUrl(s.coords,s.address)} target="_blank" rel="noopener noreferrer">{language === "es" ? "Abrir direcciones" : language === "ht" ? "Louvri direksyon" : "Open directions"}</a>}
      </div>)}
    </div>;
  }
  if (!isLoaded) return <div className="map-loading">{language === "es" ? "Cargando mapa..." : language === "ht" ? "Kat la ap chaje..." : "Loading map..."}</div>;

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
              {navMeta ? `${navMeta.distance} route` : displayNavError ? "Route unavailable" : "Finding route"}
            </span>
            <span className="nav-mode-stat">
              <Clock size={14} />
              {arrived ? "Arrived" : navMeta ? navMeta.duration : displayNavError ? "Use directions link" : "Estimating ETA"}
            </span>
            {speedMph !== null && (
              <span className="nav-mode-stat">
                <Navigation size={14} />
                {`${speedMph.toFixed(0)} mph`}
              </span>
            )}
            <button
              className="nav-mode-locate"
              onClick={() => {
                if (!mapRef.current || !userCoords) return;
                setFollowMode(true);
                mapRef.current.panTo(userCoords);
                mapRef.current.setZoom(17);
              }}
            >
              <LocateFixed size={14} />
              Follow
            </button>
          </div>

          <div className="nav-mode-body">
            {displayNavError ? (
              <div className="nav-mode-error">
                <p>{displayNavError}</p>
                <a
                  href={getDirectionsUrl(navDestination.coords, navDestination.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-mode-fallback"
                >
                  Open in maps app
                </a>
              </div>
            ) : arrived ? (
              <div className="nav-primary-card nav-primary-arrived">
                <span className="nav-step-label">Arrival</span>
                <div className="nav-step-main">You have arrived</div>
              </div>
            ) : activeStep ? (
              <>
                <div className="nav-primary-card">
                  <span className="nav-step-label">Next step</span>
                  <div className="nav-step-main">
                    <ArrowUp size={16} />
                    <span dangerouslySetInnerHTML={{ __html: activeStep.instructionHtml }} />
                  </div>
                  <div className="nav-step-sub">
                    {activeStep.distanceText}
                    {activeStep.durationText ? ` · ${activeStep.durationText}` : ""}
                    {userAccuracy ? ` · ±${Math.round(userAccuracy)} ft` : ""}
                  </div>
                </div>
                {remainingSteps.length > 0 && (
                  <div className="nav-secondary-list">
                    {remainingSteps.map((step, index) => (
                      <div key={`${step.instructionText}-${index}`} className="nav-secondary-item">
                        <span className="nav-secondary-num">{activeStepIndex + index + 2}</span>
                        <div>
                          <div className="nav-secondary-text">{step.instructionText}</div>
                          <div className="nav-secondary-meta">
                            {step.distanceText}
                            {step.durationText ? ` · ${step.durationText}` : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
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
        onDragStart={() => {
          if (isNavMode) setFollowMode(false);
        }}
        onZoomChanged={() => {
          if (isNavMode) setFollowMode(false);
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
            icon={
              isNavMode
                ? getCarIcon(window.google.maps, userHeading)
                : {
                    path: circle,
                    scale: 9,
                    fillColor: "#1A7A4A",
                    fillOpacity: 1,
                    strokeColor: "#fff",
                    strokeWeight: 3,
                  }
            }
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
          <OverlayView
            position={selectedSpot.coords}
            mapPaneName={OverlayView.FLOAT_PANE}
            getPixelPositionOffset={(width, height) => ({
              x: Math.round(-width / 2),
              y: Math.round(-height - 16),
            })}
          >
            <div className="safe-spot-overlay">
              <button
                className="safe-spot-overlay-close"
                onClick={() => setSelectedSpot(null)}
                aria-label="Close safe waiting spot"
              >
                <X size={12} />
              </button>
              <p className="safe-spot-overlay-title">{selectedSpot.name}</p>
              <div className="safe-spot-overlay-meta">
                <span className="map-info-row">
                  <MapPin size={12} />
                  {selectedSpot.address}
                </span>
                <span className="map-info-row">
                  <Clock size={12} />
                  {selectedSpot.hours}
                </span>
              </div>
              <p
                style={{
                  marginTop: 8,
                  marginBottom: 0,
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  color:
                    selectedSpot.category === "library" ? "#1D4ED8"
                    : selectedSpot.category === "cooling" ? "#065F46"
                    : selectedSpot.category === "24hr" ? "#92400E"
                    : "#374151",
                }}
              >
                {spotLabels[selectedSpot.category] || selectedSpot.category}
              </p>
              {selectedSpot.note && <p className="spot-note">{selectedSpot.note}</p>}
              <div className="map-info-actions">
                <a href={`tel:${selectedSpot.phone}`} className="map-btn map-btn-call">
                  <Phone size={13} />
                  {selectedSpot.phone.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}
                </a>
                <button
                  className="map-btn map-btn-dir"
                  onClick={() => handleNavigateToSafeSpot(selectedSpot)}
                >
                  <Navigation size={13} />
                  {language === "es" ? "Navegar" : language === "ht" ? "Direksyon" : "Navigate"}
                </button>
              </div>
            </div>
          </OverlayView>
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
