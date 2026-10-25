export function FeatureHeader({icon:Icon,eyebrow,title,children}){
  return <div className="feature-heading"><div className="feature-symbol"><Icon size={23} strokeWidth={1.7}/></div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2>{children&&<div className="feature-intro">{children}</div>}</div>;
}
