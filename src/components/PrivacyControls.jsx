import { useState } from 'react';
import { uiCopy } from '../lib/uiCopy.js';
import { localStore,sessionStore } from '../lib/storage.js';
export function PrivacyControls({language}){
 const L=uiCopy(language),[consent,setConsent]=useState(false);
 return <aside className="privacy-footer"><a href="tel:911">{L.emergency}: 911</a><details className="privacy-controls"><summary>{L.privacy}</summary><p>{L.privacyNote}</p><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/>{L.clearConsent}</label><button className="btn-reset" disabled={!consent} onClick={()=>{localStore.clearShelterIQ();sessionStore.clearShelterIQ();window.location.reload();}}>{L.clear}</button></details></aside>;
}
