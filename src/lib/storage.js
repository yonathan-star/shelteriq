function store(kind){return {
 getItem(key){try{return globalThis[kind]?.getItem(key)??null;}catch{return null;}},
 setItem(key,value){try{globalThis[kind]?.setItem(key,value);return true;}catch{globalThis.dispatchEvent?.(new Event('sq-storage-error'));return false;}},
 removeItem(key){try{globalThis[kind]?.removeItem(key);}catch{/* Storage may be disabled. */}},
 clearShelterIQ(){try{const data=globalThis[kind];for(const key of Object.keys(data||{}))if(key.startsWith('sq_')||key.startsWith('shelteriq_'))data.removeItem(key);}catch{/* Other sites' data is never cleared. */}}
};}
export const localStore=store('localStorage'),sessionStore=store('sessionStorage');
export function validService(s){return Boolean(s&&typeof s==='object'&&typeof s.id==='string'&&typeof s.name==='string'&&Array.isArray(s.type)&&s.type.every(t=>typeof t==='string')&&s.eligibility&&typeof s.eligibility==='object');}
