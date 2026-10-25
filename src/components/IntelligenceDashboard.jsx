import { useEffect,useState } from "react";
import { hub } from "../lib/serviceRepository.js";
import { releaseCopy } from "../lib/releaseCopy.js";
import { t } from '../lib/i18n.js';
import { ChartNoAxesColumn } from 'lucide-react';
import { FeatureHeader } from './FeatureHeader.jsx';
export function IntelligenceDashboard({language="en"}){
 const L=releaseCopy(language);const [data,setData]=useState(null),[error,setError]=useState("");
 useEffect(()=>{let active=true;hub("metrics").then(result=>{if(active)setData(result);}).catch(err=>{if(active)setError(err.status===401?L.signIn:err.message);});return()=>{active=false;};},[L.signIn]);
 return <section className="release-panel"><FeatureHeader icon={ChartNoAxesColumn} eyebrow="ShelterIQ" title={L.metrics}><p>{L.metricNote}</p></FeatureHeader>{error&&<p role="status">{error}</p>}{data&&<div className="release-card"><p className="muted">{data.periodStart.slice(0,10)} → {data.periodEnd.slice(0,10)}</p><p>{L.count}: {data.totalRequests??L.suppressed}</p><table><thead><tr><th>{L.need}</th><th>{L.count}</th></tr></thead><tbody>{data.counts.map(c=><tr key={c.need}><td>{t(language).typeBadge[c.need]||L[c.need]||c.need}</td><td>{c.suppressed?L.suppressed:c.count}</td></tr>)}</tbody></table>{!data.counts.length&&<p>{L.noMetrics}</p>}<p className="muted">{L.metricNote}</p></div>}</section>;
}
