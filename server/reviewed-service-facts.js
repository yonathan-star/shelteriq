export function reviewedServiceFacts(service){
 const allowed=['phone','address','hours','walkin','intakeRequirements','eligibility.minAge','eligibility.maxAge','eligibility.families','eligibility.noId','eligibility.pets'];
 const facts={};
 for(const field of allowed)if(service.fieldVerification?.[field]?.verifiedAt){const value=field.split('.').reduce((v,key)=>v?.[key],service);if(value!==undefined)facts[field]=value;}
 return {name:service.name,directoryPhone:service.phone,verifiedFacts:facts};
}
