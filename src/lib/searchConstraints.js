export const searchNeeds=['shelter','food','mental_health','substance_abuse','veteran','youth','other'];
export const searchAreas=['unsure','north','central','south'];
export function constrainResults(result,filters,directory){
 if(!filters||result.type!=='results')return result;
 const matches=result.data.matches.filter(id=>{const s=directory.find(v=>v.id===id);if(!s)return false;
  if(filters.need!=='other'&&!s.type.includes(filters.need))return false;
  if(filters.area==='unsure')return true;
  const area=s.area||(s.coords?(s.coords.lat<26.07?'south':s.coords.lat>=26.20?'north':'central'):null);return !area||area===filters.area;
 });
 return {...result,meta:{...result.meta,need:filters.need==='other'?(result.meta?.need||'other'):filters.need,area:filters.area},data:{matches,reasons:Object.fromEntries(matches.map(id=>[id,result.data.reasons[id]]))}};
}
