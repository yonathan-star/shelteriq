import { localStore as localStorage } from './storage.js';
const KEY="sq_plan_v1";
function validZone(value){try{if(typeof value!=='string')return false;new Intl.DateTimeFormat('en',{timeZone:value});return true;}catch{return false;}}
export function loadPlan(){try{const p=JSON.parse(localStorage.getItem(KEY)||"null");return p&&typeof p.id==="string"&&Array.isArray(p.steps)&&p.steps.every(s=>s&&typeof s.id==="string"&&typeof s.serviceName==="string"&&typeof s.sourceUrl==="string"&&s.sourceUrl.startsWith("https://")&&["done","pending"].includes(s.status))&&Array.isArray(p.reminders)&&p.reminders.every(r=>r&&typeof r.id==="string"&&Number.isFinite(Date.parse(r.dueAt))&&validZone(r.timeZone))?p:null;}catch{return null;}}
export function savePlan(plan){const next={...plan,updatedAt:new Date().toISOString()};localStorage.setItem(KEY,JSON.stringify(next));return next;}
export function clearPlan(){localStorage.removeItem(KEY);}
export function appendPlanSteps(steps,language){
  const existing=loadPlan()||{id:crypto.randomUUID(),language,createdAt:new Date().toISOString(),steps:[],reminders:[]};
  return savePlan({...existing,steps:[...existing.steps,...steps.filter(s=>!existing.steps.some(old=>old.serviceId===s.serviceId&&old.kind===s.kind))]});
}
export function reminderInstant(value){
  const date=new Date(value);if(!Number.isFinite(date.getTime()))return null;
  const local=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}T${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;
  return local===value?date.toISOString():null;
}
export function calendarText(reminder){
  const utc=date=>new Date(date).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
  const start=utc(reminder.dueAt),end=utc(Date.parse(reminder.dueAt)+15*60000);
  // Neutral calendar content: the sensitive plan stays inside ShelterIQ.
  return ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//ShelterIQ//Follow-up//EN","BEGIN:VEVENT",`UID:${reminder.id}@shelteriq`,`DTSTAMP:${utc(Date.now())}`,`DTSTART:${start}`,`DTEND:${end}`,"SUMMARY:ShelterIQ follow-up","DESCRIPTION:Open ShelterIQ to review your saved plan.","BEGIN:VALARM","ACTION:DISPLAY","TRIGGER:-PT10M","DESCRIPTION:Your ShelterIQ reminder is ready.","END:VALARM","END:VEVENT","END:VCALENDAR",""].join("\r\n");
}
export function downloadCalendar(reminder){const blob=new Blob([calendarText(reminder)],{type:"text/calendar;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="ShelterIQ-reminder.ics";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
