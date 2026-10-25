/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react';
import Leaflet from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { services as directory } from '../data/services.js';
import { safeSpots } from '../data/safeSpots.js';
import { directionsUrl, phoneUrl } from '../lib/mapLinks.js';
import { requestRoute, routeInstruction } from '../lib/routing.js';
import { routingCopy } from '../lib/routingCopy.js';
import { getDistanceMiles } from '../lib/geo.js';

const modes = [['WALKING','walk'],['BICYCLING','bike'],['DRIVING','drive'],['TRANSIT','transit']];
function popup(service, L, onNavigate) {
 const node = document.createElement('div');
 const title = document.createElement('strong'); title.textContent = service.name; node.append(title);
 const text = document.createElement('p'); text.textContent = `${service.address || ''}\n${service.hours || ''}\n${L.confirm}`; node.append(text);
 if (phoneUrl(service.phone)) {const a=document.createElement('a');a.href=phoneUrl(service.phone);a.textContent=`${L.call}: ${service.phone}`;node.append(a,document.createElement('br'));}
 if(onNavigate){const button=document.createElement('button');button.className='btn-mode';button.textContent=L.navigate;button.onclick=()=>onNavigate(service);node.append(button,document.createElement('br'));}
 const href=directionsUrl(service);if(href){const a=document.createElement('a');a.href=href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=L.directions;node.append(a);}
 return node;
}
export function ServiceMap({services:results=[],userCoords,userHeading,userAccuracy,language='en',navTarget,onClearNavTarget,onNavigate}) {
 const L=routingCopy(language);
 const container=useRef(null),map=useRef(null),group=useRef(null),location=useRef(null),routeLayer=useRef(null),located=useRef(false);
 const [nearby,setNearby]=useState(false),[mode,setMode]=useState('WALKING'),[retry,setRetry]=useState(0),[follow,setFollow]=useState(false),[stepIndex,setStepIndex]=useState(0);
 const [routeStart,setRouteStart]=useState(null),[routeState,setRouteState]=useState(null);
 const options=(results.length?results:directory).filter(s=>s.publicStatus!=='closed');
 const signature=JSON.stringify(options.map(s=>[s.id,s.name,s.coords,s.address,s.phone,s.hours,s.publicStatus]));
 const destinationKey=navTarget?.coords?`${navTarget.id}:${navTarget.coords.lat}:${navTarget.coords.lng}`:'';
 const routeKey=destinationKey&&routeStart?.key===destinationKey?`${destinationKey}:${mode}:${retry}:${routeStart.coords.lat}:${routeStart.coords.lng}`:'';
 const current=routeState?.key===routeKey?routeState:null;
 const route=current?.route;
 const external=navTarget?directionsUrl(navTarget,mode):null;

 useEffect(()=>{
  const instance=Leaflet.map(container.current,{scrollWheelZoom:false,zoomAnimation:false,fadeAnimation:false,markerZoomAnimation:false}).setView([26.15,-80.2],11);
  instance.createPane('route-lines').style.zIndex=350;
  instance.createPane('navigation-location').style.zIndex=650;
  Leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',maxZoom:19}).addTo(instance);
  map.current=instance;group.current=Leaflet.layerGroup().addTo(instance);location.current=Leaflet.layerGroup().addTo(instance);routeLayer.current=Leaflet.layerGroup().addTo(instance);
  instance.on('dragstart',()=>setFollow(false));
  const observer=new ResizeObserver(()=>instance.invalidateSize());observer.observe(container.current);
  return()=>{observer.disconnect();instance.remove();map.current=null;};
 },[]);
 useEffect(()=>{
  if(!group.current)return;group.current.clearLayers();
  const services=JSON.parse(signature).map(([id,name,coords,address,phone,hours,publicStatus])=>({id,name,coords,address,phone,hours,publicStatus}));
  for(const s of [...services,...(nearby?safeSpots:[])])if(s.coords){
   const marker=Leaflet.circleMarker([s.coords.lat,s.coords.lng],{radius:7,color:'#1A7A4A',fillOpacity:.8,weight:2}).bindPopup(popup(s,routingCopy(language),onNavigate),{minWidth:220,maxWidth:280,maxHeight:260}).bindTooltip(s.name);
   marker.on('add',()=>{const element=marker.getElement();if(element){element.setAttribute('tabindex','0');element.setAttribute('role','button');element.setAttribute('aria-label',s.name);element.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();marker.openPopup();}});}});
   marker.addTo(group.current);
  }
 },[signature,nearby,language,onNavigate]);
 useEffect(()=>{if(map.current&&navTarget?.coords){map.current.setView([navTarget.coords.lat,navTarget.coords.lng],14,{animate:false});container.current.closest('.map-workspace-content')?.scrollTo({top:0});}setStepIndex(0);setFollow(false);},[navTarget]);
 useEffect(()=>{
  if(!location.current)return;location.current.clearLayers();
  if(userCoords){
   const marker=Number.isFinite(userHeading)?Leaflet.marker([userCoords.lat,userCoords.lng],{pane:'navigation-location',icon:Leaflet.divIcon({className:'navigation-user-arrow',iconSize:[32,32],iconAnchor:[16,16],html:`<svg viewBox="0 0 32 32" style="transform:rotate(${userHeading}deg)"><path d="M16 3L27 28L16 23L5 28Z" fill="#2563eb" stroke="white" stroke-width="3"/></svg>`})}):Leaflet.circleMarker([userCoords.lat,userCoords.lng],{pane:'navigation-location',color:'white',weight:3,radius:9,fillColor:'#2563eb',fillOpacity:1});
   marker.bindTooltip(routingCopy(language).yourLocation).addTo(location.current);
   if(follow||(!located.current&&!navTarget)){map.current.setView([userCoords.lat,userCoords.lng],follow?17:13,{animate:false});located.current=true;}}
 },[userCoords,userHeading,language,navTarget,follow]);
 useEffect(()=>{
  if(!destinationKey){setRouteStart(null);return;}
  if(userCoords&&routeStart?.key!==destinationKey)setRouteStart({key:destinationKey,coords:{...userCoords}});
 },[destinationKey,userCoords,routeStart]);
 useEffect(()=>{
  if(!routeKey||mode==='TRANSIT')return;
  const controller=new AbortController();let active=true;const timeout=setTimeout(()=>controller.abort(),15000);
  setStepIndex(0);
  requestRoute(routeStart.coords,navTarget.coords,mode,controller.signal).then(value=>{if(active)setRouteState({key:routeKey,route:value});}).catch(()=>{if(active)setRouteState({key:routeKey,error:true});}).finally(()=>clearTimeout(timeout));
  return()=>{active=false;clearTimeout(timeout);controller.abort();};
 },[routeKey,mode,routeStart,navTarget]);
 useEffect(()=>{
  if(!routeLayer.current)return;routeLayer.current.clearLayers();
  if(route){
   const points=route.coordinates.map(([lng,lat])=>[lat,lng]);
   Leaflet.polyline(points,{pane:'route-lines',color:'white',weight:11,opacity:.95}).addTo(routeLayer.current);
   const line=Leaflet.polyline(points,{pane:'route-lines',color:'#2563eb',weight:6,opacity:1,className:'navigation-route-line'}).addTo(routeLayer.current);
   Leaflet.circleMarker(points.at(-1),{radius:9,color:'white',weight:3,fillColor:'#dc2626',fillOpacity:1}).bindTooltip(navTarget.name,{direction:'top'}).addTo(routeLayer.current);
   map.current.fitBounds(line.getBounds(),{paddingTopLeft:[30,100],paddingBottomRight:[30,45],maxZoom:16,animate:false});
  }
 },[route,navTarget]);
 useEffect(()=>{
  if(!route||!userCoords||(Number.isFinite(userAccuracy)&&userAccuracy>80))return;
  const next=route.steps[stepIndex+1]?.maneuver.location;
  if(next&&getDistanceMiles(userCoords,{lng:next[0],lat:next[1]})<.016)setStepIndex(i=>Math.min(i+1,route.steps.length-1));
 },[route,userCoords,userAccuracy,stepIndex]);
 const activeStep=route?.steps[stepIndex];
 const arrived=navTarget?.coords&&userCoords&&(!Number.isFinite(userAccuracy)||userAccuracy<=80)&&getDistanceMiles(userCoords,navTarget.coords)<.03;
 const turnSymbol=arrived?'●':activeStep?.maneuver.type?.includes('roundabout')?'↻':activeStep?.maneuver.modifier?.includes('left')?'↰':activeStep?.maneuver.modifier?.includes('right')?'↱':'↑';
 const startAgain=()=>{if(userCoords)setRouteStart({key:destinationKey,coords:{...userCoords}});setRetry(v=>v+1);};
 return <section className={`hazard-panel polished-map service-map-polish${navTarget?' navigation-active':''}`}>
  {!navTarget&&<><div className="map-title-row"><div><p className="eyebrow">ShelterIQ</p><h2>{L.title}</h2></div></div>
  <p className="muted service-map-note">{L.confirm}</p>
  <label className="nearby-toggle"><input type="checkbox" checked={nearby} onChange={e=>setNearby(e.target.checked)}/>{L.nearby}</label></>}
  <div className="route-map-stage">
   <div className="map-hero"><div ref={container} className="hazard-map" aria-label={L.title}/></div>
   {navTarget&&route&&<div className="map-turn-banner free-route-step" aria-live="polite"><span className="turn-symbol" aria-hidden="true">{turnSymbol}</span><div><small>{arrived?L.arrival:`${L.step} ${stepIndex+1} ${L.of} ${route.steps.length}`}</small><p>{arrived?navTarget.name:routeInstruction(activeStep,language)}</p>{!arrived&&activeStep&&<small>{Math.round(activeStep.distance)} m</small>}</div></div>}
   {navTarget&&route&&<button className="map-follow-control" aria-pressed={follow} onClick={()=>setFollow(v=>!v)}>{follow?L.following:L.follow}</button>}
  </div>
  {navTarget&&<section className="release-card destination-card" aria-label="In-app navigation">
   <strong>{navTarget.name}</strong>
   <div className="free-route-modes">{modes.map(([id,label])=><button key={id} className="btn-mode" aria-pressed={mode===id} onClick={()=>setMode(id)}>{L[label]}</button>)}</div>
   {mode==='TRANSIT'?<p role="status">{L.transitNote}</p>:!userCoords?<p role="status">{L.location}</p>:current?.error?<p role="alert">{L.failed}</p>:!route?<p role="status">{L.loading}</p>:<>
    <p className="route-summary">{(route.distance/1609.344).toFixed(1)} mi · {Math.max(1,Math.round(route.duration/60))} min</p>
    <div className="free-route-modes route-step-controls"><button className="btn-mode" disabled={stepIndex===0} onClick={()=>setStepIndex(i=>i-1)}>{L.previous}</button><button className="btn-mode" disabled={stepIndex>=route.steps.length-1} onClick={()=>setStepIndex(i=>i+1)}>{L.next}</button></div>
   </>}
   <details className="route-directions"><summary>{L.more}</summary><p>{navTarget.address}</p>{route&&<ol>{route.steps.map((s,i)=><li key={i}>{routeInstruction(s,language)} · {Math.round(s.distance)} m</li>)}</ol>}
    {userCoords&&mode!=='TRANSIT'&&<button className="btn-reset" disabled={Boolean(routeKey&&!current)} onClick={startAgain}>{L.retry}</button>}
    <p className="muted">{L.privacy}</p><p className="muted">{L.caution}</p>
   </details>
   {external&&<a className="official-action" href={external} target="_blank" rel="noopener noreferrer">{L.directions}</a>}
   <button className="btn-reset" onClick={onClearNavTarget}>{L.clear}</button>
  </section>}
  <p className="route-attribution"><a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer">{L.source}</a> · <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">{L.fix}</a></p>
  <div className="section-bar"><h3>{L.places}</h3><span className="count-pill">{options.length}</span></div>
  {options.map(s=><details className="release-card service-map-card" key={s.id}><summary>{s.name}</summary><p>{s.address}</p>{phoneUrl(s.phone)&&<a href={phoneUrl(s.phone)}>{L.call}: {s.phone}</a>}{s.coords&&onNavigate&&<p><button className="btn-mode" onClick={()=>onNavigate(s)}>{L.navigate}</button></p>}{directionsUrl(s)&&<p><a href={directionsUrl(s)} target="_blank" rel="noopener noreferrer">{L.directions}</a></p>}</details>)}
 </section>;
}
