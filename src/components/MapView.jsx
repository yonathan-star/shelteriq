import { useState } from 'react';
import { HazardMap } from './HazardMap.jsx';
import { ServiceMap } from './ServiceMap.jsx';
export function MapView(props){
  const targetId=props.navTarget?.id||null;
  const [selection,setSelection]=useState({hazards:!targetId,targetId});
  if(selection.targetId!==targetId)setSelection({hazards:targetId?false:selection.hazards,targetId});
  const language=props.language||'en';
  return <div className="hazard-map-wrapper"><div className="hazard-actions"><button onClick={()=>setSelection({...selection,hazards:true})} aria-pressed={selection.hazards}>{language==='es'?'Desastres y alertas':language==='ht'?'Dezas ak alèt':'Disasters & alerts'}</button><button onClick={()=>setSelection({...selection,hazards:false})} aria-pressed={!selection.hazards}>{language==='es'?'Direcciones':language==='ht'?'Direksyon':'Service directions'}</button></div>{selection.hazards?<HazardMap language={language} userCoords={props.userCoords}/>:<ServiceMap {...props}/>}</div>;
}
