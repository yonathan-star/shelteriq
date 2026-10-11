const KEY="sq_plan_v1";
export function loadPlan(){try{return JSON.parse(localStorage.getItem(KEY)||"null");}catch{return null;}}
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
