const needs = {en:{shelter:'shelter',food:'food',mental_health:'mental health support',substance_abuse:'treatment',veteran:'veteran services',youth:'youth services',other:'help'},es:{shelter:'refugio',food:'comida',mental_health:'apoyo de salud mental',substance_abuse:'tratamiento',veteran:'servicios para veteranos',youth:'servicios para jóvenes',other:'ayuda'},ht:{shelter:'abri',food:'manje',mental_health:'sipò sante mantal',substance_abuse:'tretman',veteran:'sèvis veteran',youth:'sèvis pou jèn',other:'èd'}};
export const callNeeds = Object.keys(needs.en);
// Questions deliberately avoid asserting ID possession, eligibility, or live availability.
export function safeCallScript(service, need='shelter', who='alone', language='en') {
  const label=(needs[language]||needs.en)[need]||needs.en.other;
  if(language==='es')return `Hola, llamo a ${service.name} porque necesito ${label}${who==='family'?' para mí y mis hijos':''}. ¿Pueden ayudarme hoy y qué requisitos y documentos debo confirmar? ¿Debo llamar o recibir una referencia antes de ir, y cuál es el horario de admisión?`;
  if(language==='ht')return `Bonjou, m ap rele ${service.name} paske mwen bezwen ${label}${who==='family'?' pou mwen ak timoun mwen yo':''}. Èske nou ka ede mwen jodi a, epi ki kondisyon ak dokiman mwen dwe konfime? Èske mwen bezwen rele oswa jwenn yon referans anvan mwen vini, epi ki lè admisyon fèt?`;
  return `Hi, I'm calling ${service.name} because I need ${label}${who==='family'?' for myself and my children':''}. Can you help today, and what eligibility requirements and documents should I confirm? Should I call or get a referral before traveling, and what are your intake hours?`;
}
