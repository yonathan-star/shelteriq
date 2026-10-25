export function directionsUrl(service){if(!service.coords)return null;const destination=service.address||`${service.coords.lat},${service.coords.lng}`;return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;}
export function phoneUrl(phone){const number=String(phone||'').replace(/[^\d+]/g,'');return /^\+?\d{3,15}$/.test(number)?`tel:${number}`:null;}
