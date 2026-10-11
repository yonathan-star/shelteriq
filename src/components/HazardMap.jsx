import { useEffect, useRef, useState } from 'react';
import Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { services } from '../data/services.js';
import { hub } from '../lib/serviceRepository.js';

const labels={
  en:{title:'Disasters & alerts',weather:'Weather alerts · Florida',storms:'Hurricane tracks & cones',quakes:'Earthquakes · worldwide, M4.5+, past 7 days',shelters:'Service locations',refresh:'Refresh',florida:'Florida',stormsView:'Storms',world:'World',loading:'Loading official feeds…',failed:'Some feeds could not refresh. This is not an all-clear.',checked:'Source refreshed',noGeometry:'Area named by NWS; no map boundary supplied.',empty:'No notices returned by this feed. This does not confirm safety.',note:'Forecast cones show uncertainty in the storm center. Hazards can occur outside them. Follow official instructions.',source:'Official source'},
  es:{title:'Desastres y alertas',weather:'Alertas del tiempo · Florida',storms:'Trayectorias y conos de huracanes',quakes:'Terremotos · mundo, M4.5+, últimos 7 días',shelters:'Ubicaciones de servicios',refresh:'Actualizar',florida:'Florida',stormsView:'Tormentas',world:'Mundo',loading:'Cargando fuentes oficiales…',failed:'No se pudieron actualizar algunas fuentes. Esto no confirma que no haya peligro.',checked:'Fuente actualizada',noGeometry:'Área indicada por NWS; sin límite de mapa.',empty:'Esta fuente no devolvió avisos. Esto no confirma seguridad.',note:'Los conos muestran incertidumbre sobre el centro de la tormenta. Puede haber peligros fuera del cono. Siga las instrucciones oficiales.',source:'Fuente oficial'},
  ht:{title:'Dezas ak alèt',weather:'Alèt meteyo · Florid',storms:'Chemen ak kòn siklòn',quakes:'Tranblemanntè · mond lan, M4.5+, 7 dènye jou',shelters:'Kote sèvis yo ye',refresh:'Rafrechi',florida:'Florid',stormsView:'Tanpèt',world:'Mond lan',loading:'Ap chaje sous ofisyèl…',failed:'Kèk sous pa t rafrechi. Sa pa vle di pa gen danje.',checked:'Sous rafrechi',noGeometry:'Zòn NWS bay; pa gen limit sou kat.',empty:'Sous sa a pa bay avi. Sa pa konfime sekirite.',note:'Kòn yo montre ensètitid sou sant tanpèt la. Danje ka rive deyò kòn yo. Swiv enstriksyon ofisyèl yo.',source:'Sous ofisyèl'},
};
function popup(text){const node=document.createElement('div');node.textContent=text;return node;}
export function HazardMap({language='en'}){
  const L=labels[language]||labels.en;
  const container=useRef(null),map=useRef(null),layers=useRef(null);
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(false);
  const [enabled,setEnabled]=useState({weather:true,storms:true,earthquakes:false,shelters:true});
  useEffect(()=>{let active=true;const refresh=()=>hub('hazards').then(d=>{if(active){setData(d);setError(false);setLoading(false);}}).catch(()=>{if(active){setError(true);setLoading(false);}});refresh();const timer=setInterval(refresh,300000);return()=>{active=false;clearInterval(timer);};},[]);
  useEffect(()=>{
    const instance=Leaflet.map(container.current).setView([26.15,-80.3],7);
    Leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap contributors',maxZoom:18}).addTo(instance);
    layers.current=Leaflet.layerGroup().addTo(instance);map.current=instance;
    const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(container.current);
    return()=>{observer.disconnect();instance.remove();map.current=null;};
  },[]);
  useEffect(()=>{
    if(!layers.current)return;const group=layers.current;group.clearLayers();
    Leaflet.circleMarker([26.15,-80.3],{radius:7,color:'#166534',fillOpacity:1}).bindTooltip('Broward County · reference location').addTo(group);
    const geo=(feed,style,pointToLayer,text)=>{if(!feed)return;Leaflet.geoJSON({type:'FeatureCollection',features:feed.features.filter(f=>f.geometry)},{style,pointToLayer,onEachFeature:(f,l)=>l.bindPopup(popup(text(f)))}).addTo(group);};
    if(enabled.weather)geo(data?.weather,f=>({color:f.properties.severity==='Extreme'?'#991b1b':'#d97706',weight:2,fillOpacity:.2}),undefined,f=>`${f.properties.headline||f.properties.event}\n${f.properties.areaDesc}\n${f.properties.mapBoundary||'NWS alert boundary'}\n${f.properties.instruction||f.properties.description||''}`);
    if(enabled.storms){
      geo(data?.cone,{color:'#7c3aed',weight:2,fillOpacity:.13},undefined,f=>`${f.properties.stormname||'NHC forecast cone'} · ${f.properties.advdate||''}`);
      geo(data?.track,{color:'#7c3aed',weight:3,dashArray:'7 6'},undefined,f=>`${f.properties.stormname||'NHC forecast track'} · ${f.properties.advdate||''}`);
      geo(data?.storm,undefined,(f,ll)=>Leaflet.circleMarker(ll,{radius:10,color:'#7c3aed',fillOpacity:.9}),f=>`${f.properties.stormname} · ${f.properties.advdate}\nWind: ${f.properties.maxwind} knots`);
    }
    if(enabled.earthquakes)geo(data?.earthquakes,undefined,(f,ll)=>Leaflet.circleMarker(ll,{radius:Math.max(5,f.properties.mag*2),color:'#b91c1c',fillOpacity:.5}),f=>`${f.properties.title}\n${new Date(f.properties.time).toLocaleString()}`);
    if(enabled.shelters)for(const s of services.filter(s=>s.coords&&s.publicStatus!=='closed'))Leaflet.circleMarker([s.coords.lat,s.coords.lng],{radius:4,color:'#166534',fillOpacity:.6}).bindPopup(popup(`${s.name}\n${s.address}\n${s.phone}\nDirectory location; availability not confirmed.`)).addTo(group);
  },[data,enabled]);
  async function refresh(){setLoading(true);try{setData(await hub('hazards'));setError(false);}catch{setError(true);}finally{setLoading(false);}}
  const weather=data?.weather;const notices=weather?.features||[];
  function stormView(){const geo=Leaflet.geoJSON({type:'FeatureCollection',features:[...(data?.track?.features||[]),...(data?.storm?.features||[])]});const bounds=geo.getBounds();if(bounds.isValid())map.current.fitBounds(bounds,{padding:[25,25],maxZoom:6});else map.current.setView([25,-65],3);}
  return <section className="hazard-panel"><h2>{L.title}</h2><div className="hazard-controls">{[['weather',L.weather],['storms',L.storms],['earthquakes',L.quakes],['shelters',L.shelters]].map(([key,label])=><label key={key}><input type="checkbox" checked={enabled[key]} onChange={e=>setEnabled(v=>({...v,[key]:e.target.checked}))}/>{label}</label>)}</div>
    <div className="hazard-actions"><button onClick={()=>map.current.setView([26.15,-80.3],7)}>{L.florida}</button><button onClick={stormView}>{L.stormsView}</button><button onClick={()=>{setEnabled(v=>({...v,earthquakes:true}));map.current.setView([20,0],2);}}>{L.world}</button><button disabled={loading} onClick={refresh}>{L.refresh}</button></div>
    <div ref={container} className="hazard-map" aria-label={L.title}/>
    <p className="hazard-legend">🟠 {L.weather} · 🟣 {L.storms} · 🔴 {L.quakes} · 🟢 {L.shelters}</p>
    {loading&&<p role="status">{L.loading}</p>}{(error||Object.values(data||{}).some(f=>f.stale))&&<p role="alert" className="search-notice">{L.failed}</p>}
    <p>{L.note}</p>
    {data&&<div className="hazard-sources">{Object.entries(data).map(([key,feed])=><p key={key}>{key} · {feed.checkedAt?`${L.checked}: ${new Date(feed.checkedAt).toLocaleString()}`:L.failed}{feed.stale?' · '+L.failed:''} · <a href={feed.sourceUrl} target="_blank" rel="noopener noreferrer">{L.source}</a></p>)}</div>}
    {enabled.weather&&<div><h3>{L.weather} ({notices.length})</h3>{weather&&!weather.error&&!notices.length&&<p>{L.empty}</p>}{notices.map(f=><details className="release-card" key={f.id}><summary>{f.properties.event} · {f.properties.areaDesc}</summary><p>{f.properties.headline}</p><p>{f.properties.expires}</p>{!f.geometry&&<p>{L.noGeometry}</p>}<p className="official-text">{f.properties.instruction||f.properties.description}</p><a href={f.id} target="_blank" rel="noopener noreferrer">NWS · {L.source}</a></details>)}</div>}
  </section>;
}
