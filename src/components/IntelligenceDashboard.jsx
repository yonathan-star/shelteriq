import { useEffect,useState } from "react";
import { hub } from "../lib/serviceRepository.js";
import { releaseCopy } from "../lib/releaseCopy.js";
export function IntelligenceDashboard({language="en"}){
 const L=releaseCopy(language);const [data,setData]=useState(null),[error,setError]=useState("");
 useEffect(()=>{let active=true;hub("metrics").then(result=>{if(active)setData(result);}).catch(err=>{if(active)setError(err.message);});return()=>{active=false;};},[]);
 return <section className="release-panel"><h2>{L.metrics}</h2><p>{L.metricNote}</p>{error&&<p role="status">{error}</p>}{data&&<><p className="muted">{data.periodStart.slice(0,10)} → {data.periodEnd.slice(0,10)}</p><p>{L.count}: {data.totalRequests??L.suppressed}</p><table><thead><tr><th>{L.need}</th><th>{L.count}</th></tr></thead><tbody>{data.counts.map(c=><tr key={c.need}><td>{c.need.replaceAll("_"," ")}</td><td>{c.suppressed?L.suppressed:c.count}</td></tr>)}</tbody></table>{!data.counts.length&&<p>{L.noMetrics}</p>}<p>{data.coverage}</p></>}</section>;
}
