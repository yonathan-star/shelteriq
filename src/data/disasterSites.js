// Manually checked on the official county site. Expiry is a product freshness limit.
export const disasterSites=[
 {id:"storm-monarch",name:"Monarch High School",city:"Coconut Creek",activationState:"closed",pets:"No pets allowed",accessibility:"unknown",registration:"Confirm with county",sourceUrl:"https://www.broward.org/Hurricane",verifiedAt:"2026-10-11T22:17:00Z",statusExpiresAt:"2026-10-11T23:17:00Z"},
 {id:"storm-everglades",name:"Everglades High School",city:"Miramar",activationState:"closed",pets:"Pet friendly at the county source",accessibility:"unknown",registration:"Confirm with county",sourceUrl:"https://www.broward.org/Hurricane",verifiedAt:"2026-10-11T22:17:00Z",statusExpiresAt:"2026-10-11T23:17:00Z"},
];
export function siteState(site,now){return !site.verifiedAt||!site.statusExpiresAt||Date.parse(site.statusExpiresAt)<=now?"unknown":site.activationState;}
