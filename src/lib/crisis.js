// Crisis keyword detection — runs client-side, no AI needed
const PATTERNS = {
  suicide: [
    /suicid/i, /kill myself/i, /end my life/i, /take my life/i,
    /want to die/i, /don.t want to live/i, /dont want to live/i,
    /hurt myself/i, /self.harm/i, /cut myself/i, /overdos/i,
    /no reason to live/i, /better off dead/i, /hanging myself/i,
    // Spanish
    /suicidio/i, /matarme/i, /quitarme la vida/i, /hacerme daño/i,
    // Haitian Creole
    /touye tèt mwen/i, /pa vle viv/i,
  ],
  domestic_violence: [
    /domestic violence/i, /being hit/i, /hitting me/i, /beat me/i, /beats me/i,
    /abusing me/i, /scared of (?:my|him|her)/i,
    /partner (?:hurt|hit|beat|abuse)/i,
    /husband (?:hurt|hit|beat|abuse)/i,
    /boyfriend (?:hurt|hit|beat|abuse)/i,
    /girlfriend (?:hurt|hit|beat|abuse)/i,
    /wife (?:hurt|hit|beat|abuse)/i,
    /he.s hurting me/i, /she.s hurting me/i,
    /in danger from/i, /running from/i,
    // Spanish
    /violencia doméstica/i, /me golpea/i, /me está golpeando/i,
    /tengo miedo de/i, /escapando de/i,
  ],
  medical_emergency: [
    /medical emergency/i, /chest pain/i, /can.t breathe/i, /cant breathe/i,
    /heart attack/i, /stroke/i, /unconscious/i, /not breathing/i,
    /bleeding badly/i, /badly injured/i,
  ],
};

export function detectCrisis(text) {
  if (!text || text.trim().length < 5) return null;
  const normalized=text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/\b(?:cannot|can not|can't|cant) breathe\b|no puedo respirar|no respira|dolor (?:en el|de) pecho|mwen pa ka respire|li pa respire|doule nan pwatrin/.test(normalized))return 'medical_emergency';
  if(/mwen vle touye tet mwen|mwen vle mouri|quiero morir|me quiero matar/.test(normalized)&&!/no quiero morir|mwen pa vle mouri/.test(normalized))return 'suicide';
  if(/patne mwen ap bat|mari mwen ap bat|mennaj mwen ap bat|li ap bat mwen/.test(normalized))return 'domestic_violence';
  // Remove only explicit denials, preserving any separate positive danger statement.
  const screened=text.replace(/\b(?:i am|i'm|im) not suicidal\b|\bnot (?:suicidal|self.harming)\b|no (?:soy suicida|quiero suicidarme)|mwen pa anvi touye tet mwen/gi,'');
  for (const [type, patterns] of Object.entries(PATTERNS)) {
    if (patterns.some(p => p.test(screened))) return type;
  }
  return null;
}

export const CRISIS_RESOURCES = {
  suicide: {
    name: "988 Suicide & Crisis Lifeline",
    phone: "988",
    displayPhone: "988",
    description: "Free, confidential crisis support — call or text, 24/7",
    color: "#7C3AED",
    bg: "#F5F0FF",
  },
  domestic_violence: {
    name: "National DV Hotline",
    phone: "18007997233",
    displayPhone: "1-800-799-7233",
    description: "Confidential help for domestic violence situations — 24/7",
    color: "#DC2626",
    bg: "#FFF0F0",
  },
  medical_emergency: {
    name: "Emergency Services",
    phone: "911",
    displayPhone: "911",
    description: "Call immediately for life-threatening emergencies",
    color: "#DC2626",
    bg: "#FFF0F0",
  },
};
