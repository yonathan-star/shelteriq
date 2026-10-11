import { useEffect,useState } from "react";
import { hub,refreshServices } from "../lib/serviceRepository.js";
import { services } from "../data/services.js";
import { preventionPrograms } from "../data/prevention.js";
import { releaseCopy } from "../lib/releaseCopy.js";
import { ShieldCheck } from 'lucide-react';
import { FeatureHeader } from './FeatureHeader.jsx';
export function ProviderReviewQueue({language}){
  const L=releaseCopy(language);const [session,setSession]=useState(null),[items,setItems]=useState([]),[error,setError]=useState(""),[reasons,setReasons]=useState({}),[sources,setSources]=useState({});
  const [accessCode,setAccessCode]=useState('');
  const refresh=async()=>{try{const info=await hub("session");setSession(info);if(info.authenticated){await refreshServices();setItems((await hub("corrections")).items);}}catch(err){setError(err.message);}};
  useEffect(()=>{let active=true;hub("session").then(info=>{if(active)setSession(info);if(info.authenticated)return hub("corrections").then(data=>{if(active)setItems(data.items);});}).catch(err=>{if(active)setError(err.message);});return()=>{active=false;};},[]);
  async function signIn(){try{await hub("review-login",{token:accessCode});setAccessCode('');await refresh();}catch(err){setError(err.message);}}
  async function decide(item,decision){setError("");try{await hub("review",{id:item.id,decision,expectedVersion:item.baseVersion,reason:reasons[item.id],sourceUrl:sources[item.id]});await refresh();}catch(err){setError(err.status===409?L.conflict:err.message);}}
  return <section className="release-panel"><FeatureHeader icon={ShieldCheck} eyebrow="ShelterIQ" title={L.review}><p>{L.reviewScope}</p></FeatureHeader>{error&&<p role="alert" className="search-notice">{error}</p>}
    {!session?.authenticated?<>{session?.remoteReviewAvailable&&!session?.localReviewAvailable&&<label>{language==='es'?'Código privado del propietario':language==='ht'?'Kòd prive pwopriyetè a':'Private owner access code'}<input type="password" autoComplete="off" value={accessCode} onChange={e=>setAccessCode(e.target.value)}/></label>}{(session?.localReviewAvailable||session?.remoteReviewAvailable)&&<button className="btn-submit" disabled={!session.localReviewAvailable&&!accessCode} onClick={signIn}>{L.signIn}</button>}</>:<><button className="btn-mode" onClick={refresh}>{L.refresh}</button><button className="btn-reset" onClick={async()=>{await hub("review-logout",{});await refresh();}}>{L.logout}</button>
      {!items.length&&<p>{L.noCorrections}</p>}{items.map(item=>{const s=[...services,...preventionPrograms].find(s=>s.id===item.serviceId);return <article key={item.id} className="release-card"><h3>{s?.name||item.serviceId}</h3><p>{L[item.field]} · v{item.baseVersion} → v{s?.version}</p><p><strong>{L.current}:</strong> {s?.[item.field]}</p><p><strong>{L.proposed}:</strong> {item.suggestedValue}</p><p>{item.note}</p>{item.evidenceUrl&&<a href={item.evidenceUrl} target="_blank" rel="noopener noreferrer">{L.source}</a>}<p className="eyebrow">{item.state}</p>
        {["submitted","in_review","needs_information"].includes(item.state)&&<><label>{L.reason}<textarea maxLength={600} value={reasons[item.id]||""} onChange={e=>setReasons({...reasons,[item.id]:e.target.value})}/></label><label>{L.reviewSource}<input type="url" value={sources[item.id]||""} onChange={e=>setSources({...sources,[item.id]:e.target.value})}/></label><button className="btn-mode" disabled={!reasons[item.id]?.trim()||!sources[item.id]} onClick={()=>decide(item,"approved")}>{L.approve}</button><button className="btn-reset" disabled={!reasons[item.id]?.trim()} onClick={()=>decide(item,"rejected")}>{L.reject}</button></>}
      </article>;})}</>}
  </section>;
}
