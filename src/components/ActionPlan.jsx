import { useState,useEffect } from "react";
import { loadPlan,savePlan,clearPlan,downloadCalendar,reminderInstant } from "../lib/plans.js";
import { releaseCopy } from "../lib/releaseCopy.js";
import { preventionPrograms } from "../data/prevention.js";
import { services } from "../data/services.js";
import { ListChecks,LockKeyhole,ArrowRight,Check } from 'lucide-react';
import { FeatureHeader } from './FeatureHeader.jsx';
function ReminderForm({step,L,onSave}){
  const [time,setTime]=useState(""),[consent,setConsent]=useState(false),[error,setError]=useState("");
  return <details className="reminder-form"><summary>{L.follow}</summary><label>{L.due}<input type="datetime-local" value={time} onInput={e=>setTime(e.currentTarget.value)} onChange={e=>setTime(e.target.value)}/></label>
    <p className="muted">{Intl.DateTimeFormat().resolvedOptions().timeZone}</p><p>{L.notificationPreview}: “{L.neutral}”</p>
    <label className="check-label"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{L.reminderConsent}</label>
    <button className="btn-mode" disabled={!consent||!time} onClick={()=>{const instant=reminderInstant(time);if(!instant||Date.parse(instant)<=Date.now()){setError(L.follow);return;}onSave({id:crypto.randomUUID(),stepId:step.id,dueAt:instant,timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone,status:"pending",consentAt:new Date().toISOString(),consentVersion:1});setError("");}}>{L.saveReminder}</button>{error&&<p role="alert">{error}</p>}
  </details>;
}
export function ActionPlan({language,onPrevention}){
  const L=releaseCopy(language);const [plan,setPlan]=useState(loadPlan),[tick,setTick]=useState(()=>Date.now());
  useEffect(()=>{const timer=setInterval(()=>setTick(Date.now()),30000);return()=>clearInterval(timer);},[]);
  const update=next=>setPlan(savePlan(next));
  if(!plan)return <section className="release-panel plan-panel"><FeatureHeader icon={ListChecks} eyebrow="ShelterIQ" title={L.plan}/><div className="plan-empty"><div className="empty-plan-mark"><ListChecks size={38} strokeWidth={1.3}/></div><h3>{language==='es'?'Su próximo paso empieza aquí':language==='ht'?'Pwochen etap ou kòmanse isit':'Your next step starts here'}</h3><p>{L.empty}</p><button className="btn-submit" onClick={onPrevention}>{L.prevention}<ArrowRight size={16}/></button></div><div className="privacy-note"><LockKeyhole size={16}/><span>{L.local}</span></div></section>;
  const due=plan.reminders.filter(r=>r.status==="pending"&&Date.parse(r.dueAt)<=tick&&tick-Date.parse(r.dueAt)<86400000);
  const completed=plan.steps.filter(s=>s.status==='done').length;
  return <section className="release-panel plan-panel"><FeatureHeader icon={ListChecks} eyebrow="ShelterIQ" title={L.plan}/><div className="plan-progress"><div><strong>{completed} / {plan.steps.length}</strong><span>{language==='es'?'pasos completados':language==='ht'?'etap fini':'steps completed'}</span><Check size={18}/></div><progress value={completed} max={plan.steps.length||1}/></div><div className="privacy-note"><LockKeyhole size={16}/><span>{L.local}</span></div><p className="muted">{L.savedTime}: {new Date(plan.updatedAt).toLocaleString()}</p><details className="plan-guidance"><summary>{language==='es'?'Sobre su plan y recordatorios':language==='ht'?'Konsènan plan ak rapèl ou':'About your plan & reminders'}</summary><p>{L.eligibility}</p><p>{L.inApp}</p></details>
    {due.length>0&&<p className="search-notice" role="status">{L.neutral}</p>}
    {plan.noticeDate&&<p>{L.noticeDate}: {plan.noticeDate}<br/>{L.dateNote}</p>}
    {plan.steps.map((step,index)=>{const current=[...services,...preventionPrograms].find(s=>s.id===step.serviceId);const changed=current&&(current.version||1)!==step.serviceVersion;
      const title=step.kind==="contact"?L.contact:step.kind==="backup"?L.backup:step.title===releaseCopy(plan.language).prepare?L.prepare:step.title;
      const requirement=!changed&&current?.kind==="prevention"?(step.kind==="prepare"?L.documents:current.intakeRequirements||current.requirements[language]||step.requirementSnapshot):step.requirementSnapshot;
      return <article className={`release-card plan-step ${step.status==='done'?'step-complete':''}`} key={step.id}><div className="step-number">{step.status==='done'?<Check size={16}/>:String(index+1).padStart(2,'0')}</div><label className="check-label"><input type="checkbox" checked={step.status==="done"} onChange={e=>update({...plan,steps:plan.steps.map(s=>s.id===step.id?{...s,status:e.target.checked?"done":"pending"}:s)})}/><strong>{title}</strong></label>
        <h3>{step.serviceName}</h3><p>{requirement}</p>{changed&&<p className="search-notice">{L.changed}</p>}
        <a href={step.sourceUrl} target="_blank" rel="noopener noreferrer">{L.source}</a>{current?.kind==="prevention"&&current.programState!=="referral"&&<p className="muted">{L.readOnly}</p>}
        <ReminderForm step={step} L={L} onSave={r=>update({...plan,reminders:[...plan.reminders.filter(x=>x.stepId!==step.id),r]})}/>
        {plan.reminders.filter(r=>r.stepId===step.id&&r.status!=="cancelled").map(r=><div className="reminder-row" key={r.id}><p>{new Date(r.dueAt).toLocaleString(undefined,{timeZone:r.timeZone})} · {r.timeZone}</p>
          <button className="btn-mode" onClick={()=>downloadCalendar(r)}>{L.calendar}</button><button className="btn-reset" onClick={()=>update({...plan,reminders:plan.reminders.map(x=>x.id===r.id?{...x,status:"cancelled"}:x)})}>{L.cancel}</button></div>)}
      </article>;
    })}<button className="btn-reset" onClick={()=>{clearPlan();setPlan(null);}}>{L.clear}</button>
  </section>;
}
