export const INCIDENT_STATUS = Object.freeze({ SUBMITTED:"Submitted", UNDER_REVIEW:"Under Front Desk Review", NEEDS_CLARIFICATION:"Needs Clarification", VERIFIED:"Verified", FORWARDED_TO_BDRRMO:"Forwarded to BDRRMO", ASSIGNED:"Assigned", EN_ROUTE:"En Route", ON_SCENE:"On Scene", FOR_CLOSURE_REVIEW:"For Closure Review", CLOSED:"Closed", REJECTED:"Rejected", LINKED_DUPLICATE:"Linked Duplicate" });
export const ASSIGNMENT_STATUS = Object.freeze({ OFFERED:"Offered", ACCEPTED:"Accepted", DECLINED:"Declined", EN_ROUTE:"En Route", ON_SCENE:"On Scene", COMPLETED:"Completed", CANCELLED:"Cancelled" });
export const SUPPORT_STATUS = Object.freeze({ REQUESTED:"Requested", ACCEPTED:"Accepted", DECLINED:"Declined", UNAVAILABLE:"Unavailable", EN_ROUTE:"En Route", ON_SCENE:"On Scene", COMPLETED:"Completed", CANCELLED:"Cancelled" });
export const QR_STATUS = Object.freeze({ DRAFT:"Draft", PENDING_ACCEPTANCE:"Pending Acceptance", ACCEPTED:"Accepted", NEEDS_CORRECTION:"Needs Correction", DECLINED:"Declined", CANCELLED:"Cancelled", EXPIRED:"Expired" });
export const AVAILABILITY_STATUS = Object.freeze({ AVAILABLE:"Available", BUSY:"Busy", UNAVAILABLE:"Unavailable", OUT_OF_SERVICE:"Out of Service" });
export const PRIORITY = Object.freeze({ P1:"Urgent + Important", P2:"Important, Not Urgent", P3:"Urgent, Less Important", P4:"Not Urgent + Not Important" });
export const displayStatus = (catalog, code) => catalog[code] ?? "Not recorded";
export const activeIncidentCodes = ["ASSIGNED", "EN_ROUTE", "ON_SCENE"];
