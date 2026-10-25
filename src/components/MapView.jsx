import { HazardMap } from './HazardMap.jsx';
import { ServiceMap } from './ServiceMap.jsx';
const copy={en:{services:'Service map & navigation',hazards:'Disaster alert map',views:'Map views'},es:{services:'Mapa de servicios y navegación',hazards:'Mapa de alertas',views:'Vistas del mapa'},ht:{services:'Kat sèvis ak navigasyon',hazards:'Kat alèt dezas',views:'Kalite kat'}};
export function MapView({mapMode='services',onMapModeChange,onNavigateService,...props}){
 const L=copy[props.language]||copy.en;
 return <div className="map-workspace"><div className="map-mode-toolbar" aria-label={L.views}>
  <button className="btn-mode" aria-pressed={mapMode==='services'} onClick={()=>onMapModeChange('services')}>{L.services}</button>
  <button className="btn-mode" aria-pressed={mapMode==='hazards'} onClick={()=>onMapModeChange('hazards')}>{L.hazards}</button>
 </div><div className="map-workspace-content">{mapMode==='hazards'?<HazardMap userCoords={props.userCoords} language={props.language}/>:<ServiceMap {...props} onNavigate={onNavigateService}/>}</div></div>;
}
