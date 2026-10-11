import { useState } from "react";
import { hub } from "../lib/serviceRepository.js";
import { releaseCopy } from "../lib/releaseCopy.js";
export function CorrectionForm({service,language,onClose}){
  const L=releaseCopy(language);const [requestId]=useState(()=>crypto.randomUUID());const [field,setField]=useState("hours"),[value,setValue]=useState(""),[note,setNote]=useState(""),[evidence,setEvidence]=useState(""),[receipt,setReceipt]=useState(null),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setBusy(true);setError("");try{setReceipt(await hub("corrections",{requestId,serviceId:service.id,field,suggestedValue:value,note,evidenceUrl:evidence}));}catch(err){setError(err.message);}finally{setBusy(false);}};
  return <section className="correction-form"><h4>{L.report}</h4><p>{L.reportNote}</p>{receipt?<div role="status"><p>{L.pending}</p><p>{L.tracking}: <code>{receipt.token}</code></p></div>:<form onSubmit={submit}>
    <label>{L.field}<select value={field} onChange={e=>{setField(e.target.value);setValue(e.target.value==="publicStatus"?"unknown":"");}}>{["hours","phone","address","intakeRequirements","publicStatus"].map(f=><option key={f} value={f}>{L[f]}</option>)}</select></label>
    <label>{L.value}{field==="publicStatus"?<select value={value} onChange={e=>setValue(e.target.value)}>{["unknown","open","closed"].map(v=><option key={v} value={v}>{L[v]}</option>)}</select>:<input required maxLength={500} value={value} onChange={e=>setValue(e.target.value)}/>}</label>
    <label>{L.evidence}<input type="url" value={evidence} onChange={e=>setEvidence(e.target.value)} placeholder="https://"/></label><label>{L.note}<textarea maxLength={600} value={note} onChange={e=>setNote(e.target.value)}/></label>
    <button className="btn-mode" disabled={busy||!value.trim()}>{L.submit}</button></form>}{error&&<p role="alert">{error}</p>}<button className="btn-reset" onClick={onClose}>{L.back}</button>
  </section>;
}
