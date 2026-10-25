import { useState } from "react";
import { matchPrevention } from "../data/prevention.js";
import { savePlan } from "../lib/plans.js";
import { releaseCopy } from "../lib/releaseCopy.js";
import { logRequest } from "../lib/serviceRepository.js";
import { HouseHeart,ShieldCheck,ArrowRight } from 'lucide-react';
import { FeatureHeader } from './FeatureHeader.jsx';
export function PreventionIntake({language,onPlan,onShelter}){
  const L=releaseCopy(language);const [concern,setConcern]=useState("rent"),[timing,setTiming]=useState("today"),[area,setArea]=useState("unsure"),[noticeDate,setNoticeDate]=useState("");
  const create=()=>{
    const programs=matchPrevention(concern);const now=new Date().toISOString();
    const steps=programs.flatMap((p,index)=>[{id:crypto.randomUUID(),serviceId:p.id,kind:index?"backup":"contact",title:index?L.backup:L.contact,serviceName:p.name,sourceUrl:p.sourceUrl,requirementSnapshot:p.intakeRequirements||p.requirements[language]||p.requirements.en,serviceVersion:p.version||1,status:"pending"},{id:crypto.randomUUID(),serviceId:p.id,kind:"prepare",title:L.prepare,serviceName:p.name,sourceUrl:p.sourceUrl,requirementSnapshot:L.documents,serviceVersion:p.version||1,status:"pending"}]);
    const plan=savePlan({id:crypto.randomUUID(),language,concern,timing,area,noticeDate:noticeDate||null,createdAt:now,steps,reminders:[]});
    logRequest(concern,area,programs.length,language);onPlan(plan);
  };
  return <section className="release-panel prevention-panel"><FeatureHeader icon={HouseHeart} eyebrow={language==='es'?'UN PASO A LA VEZ':language==='ht'?'YON ETAP ALAFWA':'ONE STEP AT A TIME'} title={L.prevention}><p>{language==='es'?'Encuentre un próximo paso para proteger su vivienda.':language==='ht'?'Jwenn yon pwochen etap pou pwoteje lojman ou.':'Find a next step to protect your housing.'}</p></FeatureHeader><div className="privacy-note"><ShieldCheck size={16}/><span>{L.privacy}</span></div><div className="intake-surface">
    <label>{L.concern}<select value={concern} onChange={e=>setConcern(e.target.value)}>{["rent","mortgage","utilities","eviction","accommodation"].map(x=><option value={x} key={x}>{L[x]}</option>)}</select></label>
    <label>{L.timing}<select value={timing} onChange={e=>setTiming(e.target.value)}>{["today","week","later","unsure"].map(x=><option value={x} key={x}>{L[x]}</option>)}</select></label>
    <label>{L.area}<select value={area} onChange={e=>setArea(e.target.value)}>{["unsure","north","central","south"].map(x=><option value={x} key={x}>{L[x]}</option>)}</select></label>
    <label>{L.noticeDate}<input type="date" value={noticeDate} onInput={e=>setNoticeDate(e.currentTarget.value)} onChange={e=>setNoticeDate(e.target.value)}/></label><p className="muted">{L.dateNote}</p>
    {concern==="eviction"&&<p className="search-notice">{language==="es"?"Busque ayuda legal cuanto antes. No espere un recordatorio para responder a un aviso." :language==="ht"?"Chèche èd legal san pèdi tan. Pa tann yon rapèl pou reponn yon avi.":"Seek qualified legal help promptly. Do not wait for a reminder to respond to a notice."}</p>}
    <button className="btn-submit" onClick={create}>{L.create}<ArrowRight size={17}/></button></div><button className="secondary-path" onClick={onShelter}>{language==="es"?"Necesito un lugar para dormir":language==="ht"?"Mwen bezwen yon kote pou dòmi":"I need somewhere to sleep"}<ArrowRight size={16}/></button>
  </section>;
}
