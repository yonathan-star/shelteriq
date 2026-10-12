import { validService } from './storage.js';
import { localStore as localStorage } from './storage.js';
import { services } from "../data/services.js";
import { preventionPrograms } from "../data/prevention.js";
export async function hub(resource,body){
  const response=await fetch(`/api/hub?resource=${resource}`,body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{});
  const data=await response.json();if(!response.ok){const error=new Error(data.error||"Request failed");error.status=response.status;throw error;}return data;
}
export async function refreshServices(){
  try{const data=await hub("services");if(!Array.isArray(data.items)||!data.items.every(validService))throw new Error("Invalid directory");services.splice(0,services.length,...data.items);if(data.programs)preventionPrograms.splice(0,preventionPrograms.length,...data.programs);localStorage.setItem("sq_directory",JSON.stringify(data));return data;}
  catch{try{const cached=JSON.parse(localStorage.getItem("sq_directory")||"null");if(Array.isArray(cached?.items)&&cached.items.every(validService))services.splice(0,services.length,...cached.items);if(cached?.programs)preventionPrograms.splice(0,preventionPrograms.length,...cached.programs);return {...cached,offline:true};}catch{return {items:services,offline:true};}}
}
export function logRequest(need,area,count,language="en",serviceIds,who="alone"){
  if(!["shelter","food","mental_health","substance_abuse","veteran","youth","other","rent","mortgage","utilities","eviction","accommodation"].includes(need))return;
  hub("activity-ticket",{requestedNeed:need,broadArea:area||"unsure",language,serviceIds,who}).then(ticket=>hub("events",{...ticket,eventType:"request"})).catch(()=>{});
}
