import { ASSIGNMENT_STATUS, AVAILABILITY_STATUS, INCIDENT_STATUS, PRIORITY, QR_STATUS, SUPPORT_STATUS } from "./statusModel";

const valid = (catalog, code) => Boolean(code && Object.hasOwn(catalog, code));
export function validateIncident(incident) {
  const errors=[];
  if(!incident?.id) errors.push("Incident ID is required.");
  if(!valid(INCIDENT_STATUS,incident?.incidentStatusCode)) errors.push("Incident status is not migration-backed.");
  if(!valid(PRIORITY,incident?.priorityCode)) errors.push("Priority must be P1, P2, P3, or P4.");
  if(!incident?.location) errors.push("Location is required.");
  if(!Number.isFinite(incident?.lat)||!Number.isFinite(incident?.lng)) errors.push("Valid coordinates are required.");
  return errors;
}
export function validateDispatch({incident,responder,existingAssignment}) {
  const errors=validateIncident(incident);
  if(!responder) errors.push("Select a responder.");
  if(responder&&!valid(AVAILABILITY_STATUS,responder.availabilityStatus)) errors.push("Responder availability is invalid.");
  if(responder&&["UNAVAILABLE","OUT_OF_SERVICE"].includes(responder.availabilityStatus)) errors.push("This responder cannot receive an assignment.");
  if(existingAssignment&&!valid(ASSIGNMENT_STATUS,existingAssignment.statusCode)) errors.push("Existing assignment status is invalid.");
  if(existingAssignment&&!['COMPLETED','CANCELLED','DECLINED'].includes(existingAssignment.statusCode)) errors.push("An active assignment already exists for this incident.");
  return errors;
}
export function validateHandover(record,{correctionReason=""}={}) {
  const errors=[];
  if(!record?.incidentId) errors.push("Linked Incident ID is required.");
  if(!record?.receiverType||!record?.receiver) errors.push("Receiver type and receiver are required.");
  if(!valid(QR_STATUS,record?.qrStatusCode)) errors.push("QR handover status is invalid.");
  if(record?.qrStatusCode==="NEEDS_CORRECTION"&&!correctionReason.trim()) errors.push("Correction remarks are required.");
  return errors;
}
export function validateClosure({incident,assignment,linkedHandovers=[]}) {
  const errors=validateIncident(incident);
  if(incident?.incidentStatusCode!=="FOR_CLOSURE_REVIEW") errors.push("Incident must be FOR_CLOSURE_REVIEW.");
  if(!assignment||assignment.statusCode!=="COMPLETED") errors.push("A COMPLETED assignment record is required.");
  if(linkedHandovers.some(h=>!["ACCEPTED","DECLINED","CANCELLED","EXPIRED"].includes(h.qrStatusCode))) errors.push("Resolve outstanding QR handovers before closure.");
  return errors;
}
export function validateSupport(record){return record&&valid(SUPPORT_STATUS,record.statusCode)?[]:["Support request status is invalid."];}
export function validateReport({template,month,rowCount,previewed}){const errors=[];if(!template)errors.push("Select a report template.");if(!/^\d{4}-\d{2}$/.test(month))errors.push("Select a valid reporting month.");if(!previewed)errors.push("Preview the report before export.");if(rowCount===0)errors.push("No records match the selected filters.");return errors;}
