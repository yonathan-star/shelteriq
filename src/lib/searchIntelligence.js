import { logRequest } from "./serviceRepository.js";
export function logSearch({requestedNeed="other",broadArea="unsure",resultsCount,language="en"}){logRequest(requestedNeed,broadArea,resultsCount,language);}
