let cache={items:[],lastSuccessfulRefresh:null,lastAttempt:null,error:null};
// Fixed Broward county area; this is county coverage, not precise personal location.
const source="https://api.weather.gov/alerts/active?zone=FLC011";
export function activeAlerts(features,now=Date.now()){
  const cancelled=new Set(features.filter(f=>["Cancel","Update"].includes(f.properties?.messageType)).flatMap(f=>(f.properties.references||[]).flatMap(r=>[r.identifier,r.id].filter(Boolean))));
  return features.filter(f=>{const p=f.properties||{};return p.messageType!=="Cancel"&&!cancelled.has(p.id)&&(!p.expires||Date.parse(p.expires)>now)&&(!p.ends||Date.parse(p.ends)>now);}).map(f=>{
    const p=f.properties;return {id:p.id||f.id,event:p.event,headline:p.headline,severity:p.severity,urgency:p.urgency,certainty:p.certainty,area:p.areaDesc,instruction:p.instruction||"",description:p.description||"",effective:p.effective,expires:p.expires,sourceUrl:f.id?.startsWith("https://api.weather.gov/alerts/")?f.id:p.web||"https://alerts.weather.gov/",messageType:p.messageType};
  });
}
export async function getAlerts(){
  if(!cache.lastAttempt||Date.now()-Date.parse(cache.lastAttempt)>30000){
    cache.lastAttempt=new Date().toISOString();
    try{
      const response=await fetch(source,{headers:{"User-Agent":"ShelterIQ (https://shelteriq-five.vercel.app)",Accept:"application/geo+json"},signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw new Error("Official feed unavailable");
      const data=await response.json();if(!Array.isArray(data.features))throw new Error("Invalid feed");
      cache={...cache,items:activeAlerts(data.features),lastSuccessfulRefresh:new Date().toISOString(),error:null};
    }catch{cache.error="Could not refresh official alerts";}
  }
  const items=cache.items.filter(p=>(!p.expires||Date.parse(p.expires)>Date.now()));
  return {...cache,items,sourceUrl:source,area:"Broward County",stale:Boolean(cache.error)||!cache.lastSuccessfulRefresh||Date.now()-Date.parse(cache.lastSuccessfulRefresh)>120000};
}
