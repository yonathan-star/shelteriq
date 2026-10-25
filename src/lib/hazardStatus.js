export function currentWeather(features,now=Date.now()){
  const retired=new Set(features.filter(f=>['Cancel','Update'].includes(f.properties?.messageType)).flatMap(f=>(f.properties.references||[]).flatMap(r=>[r.identifier,r.id].filter(Boolean))));
  return features.filter(f=>{const p=f.properties||{};return p.messageType!=='Cancel'&&!retired.has(p.id)&&!retired.has(f.id)&&(!p.expires||Date.parse(p.expires)>now)&&(!p.ends||Date.parse(p.ends)>now);});
}
export function feedStale(feed,now=Date.now(),maxAge=120000){return !feed||Boolean(feed.error)||!feed.checkedAt||now-Date.parse(feed.checkedAt)>maxAge;}
