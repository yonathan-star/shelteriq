const nhc = 'https://mapservices.weather.noaa.gov/tropical/rest/services/tropical/NHC_tropical_weather_summary/MapServer';
const feeds = {
  weather: 'https://api.weather.gov/alerts/active?area=FL',
  earthquakes: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson',
  track: `${nhc}/6/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`,
  cone: `${nhc}/7/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`,
  storm: `${nhc}/5/query?where=tau%3D0&outFields=*&outSR=4326&f=geojson`,
};
const cache = new Map();
const zones=new Map();
async function weatherGeometry(features){
  const urls=[...new Set(features.filter(f=>!f.geometry).flatMap(f=>f.properties?.affectedZones||[]))].filter(url=>/^https:\/\/api\.weather\.gov\/zones\/(forecast|county)\/[A-Z]{2}[ZC]\d{3}$/.test(url)).slice(0,60);
  await Promise.all(urls.map(async url=>{
    if(zones.has(url))return;
    try{const response=await fetch(url,{headers:{'User-Agent':'ShelterIQ (https://shelteriq-five.vercel.app)'},signal:AbortSignal.timeout(6000)});if(!response.ok)return;const data=await response.json();if(['Polygon','MultiPolygon'].includes(data.geometry?.type))zones.set(url,data.geometry);}catch{/* Keep notices accessible when geometry is unavailable. */}
  }));
  return features.map(f=>{
    if(f.geometry)return f;
    const coordinates=(f.properties?.affectedZones||[]).flatMap(url=>{const geometry=zones.get(url);return geometry?.type==='Polygon'?[geometry.coordinates]:geometry?.type==='MultiPolygon'?geometry.coordinates:[];});
    return coordinates.length?{...f,geometry:{type:'MultiPolygon',coordinates},properties:{...f.properties,mapBoundary:'NWS affected forecast/county zones'}}:f;
  });
}
export function currentWeather(features, now=Date.now()) {
  return features.filter(f=>f.properties?.messageType!=='Cancel' && (!f.properties?.expires || Date.parse(f.properties.expires)>now));
}
export async function getHazards() {
  const items=await Promise.all(Object.entries(feeds).map(async ([key,url])=>{
    let entry=cache.get(key);
    if(!entry || Date.now()-entry.attempt>300000){
      const attempt=Date.now();
      try{
        const response=await fetch(url,{headers:{'User-Agent':'ShelterIQ (https://shelteriq-five.vercel.app)',Accept:'application/geo+json, application/json'},signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new Error('Feed unavailable');
        const data=await response.json();
        if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw new Error('Invalid feed');
        if(key==='weather')data.features=await weatherGeometry(currentWeather(data.features));
        entry={data,checkedAt:new Date().toISOString(),attempt,error:null};
      }catch{entry={...entry,attempt,error:'Official feed could not be refreshed'};}
      cache.set(key,entry);
    }
    const features=entry.data?.features||[];
    return [key,{features:key==='weather'?currentWeather(features):features,checkedAt:entry.checkedAt||null,error:entry.error,stale:Boolean(entry.error)||!entry.checkedAt,sourceUrl:url}];
  }));
  return Object.fromEntries(items);
}
