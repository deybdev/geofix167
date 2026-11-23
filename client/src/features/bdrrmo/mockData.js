export const incidents = [
  { id:"GF-101",title:"Residential fire on Rizal Street",category:"Fire",location:"Rizal Street",priorityCode:"P1",incidentStatusCode:"FORWARDED_TO_BDRRMO",reviewType:"BDRRMO_ESCALATION",elapsed:"02:14",lat:14.7312,lng:121.0148,submittedAt:"2026-11-19 08:41",description:"Visible smoke and flames reported from a residential structure.",media:["PHOTO"],timeline:["SUBMITTED","UNDER_REVIEW","FORWARDED_TO_BDRRMO"] },
  { id:"GF-102",title:"Medical emergency near covered court",category:"Medical",location:"Covered Court",priorityCode:"P1",incidentStatusCode:"EN_ROUTE",elapsed:"06:31",lat:14.7305,lng:121.0162,submittedAt:"2026-11-19 08:36",description:"Resident reported a person who became unresponsive.",media:["PHOTO"],timeline:["SUBMITTED","VERIFIED","ASSIGNED","EN_ROUTE"] },
  { id:"GF-103",title:"Flooded pathway",category:"Flood",location:"Quezon Avenue",priorityCode:"P2",incidentStatusCode:"ON_SCENE",elapsed:"18:09",lat:14.7298,lng:121.0129,submittedAt:"2026-11-19 08:24",description:"Floodwater is blocking the pedestrian lane.",media:["PHOTO","VIDEO"],timeline:["SUBMITTED","VERIFIED","ASSIGNED","EN_ROUTE","ON_SCENE"] },
  { id:"GF-104",title:"Vehicular accident near Gate 2",category:"Accident",location:"Gate 2",priorityCode:"P1",incidentStatusCode:"ON_SCENE",elapsed:"09:42",lat:14.7321,lng:121.0171,submittedAt:"2026-11-19 08:33",description:"Two vehicles involved; Police support requested under the same Incident ID.",media:["PHOTO"],timeline:["SUBMITTED","VERIFIED","ASSIGNED","ON_SCENE"] },
  { id:"GF-105",title:"Electrical spark at service line",category:"Electrical",location:"Magsaysay Street",priorityCode:"P3",incidentStatusCode:"FOR_CLOSURE_REVIEW",elapsed:"44:20",lat:14.7289,lng:121.0155,submittedAt:"2026-11-19 07:58",description:"Responder submitted completion notes and a proof photo.",media:["PHOTO"],timeline:["SUBMITTED","VERIFIED","ASSIGNED","ON_SCENE","FOR_CLOSURE_REVIEW"] },
];
export const assignments = [
  { id:"TA-102",incidentId:"GF-102",responderId:"T-02",statusCode:"EN_ROUTE",assignedAt:"2026-11-19 08:38",acceptedAt:"2026-11-19 08:39",completedAt:null,notes:null },
  { id:"TA-103",incidentId:"GF-103",responderId:"T-03",statusCode:"ON_SCENE",assignedAt:"2026-11-19 08:27",acceptedAt:"2026-11-19 08:28",completedAt:null,notes:null },
  { id:"TA-104",incidentId:"GF-104",responderId:"T-01",statusCode:"ON_SCENE",assignedAt:"2026-11-19 08:35",acceptedAt:"2026-11-19 08:36",completedAt:null,notes:null },
  { id:"TA-105",incidentId:"GF-105",responderId:"T-05",statusCode:"COMPLETED",assignedAt:"2026-11-19 08:01",acceptedAt:"2026-11-19 08:02",completedAt:"2026-11-19 08:40",notes:"Proof photo submitted." },
];
export const responders = [
  { id:"T-01",name:"Maria Santos",unit:"Tanod T-01",availabilityStatus:"BUSY",updated:"Now" },
  { id:"T-02",name:"Joel Ramirez",unit:"Tanod T-02",availabilityStatus:"BUSY",updated:"1 min ago" },
  { id:"T-03",name:"Carlo Mendoza",unit:"Tanod T-03",availabilityStatus:"BUSY",updated:"2 min ago" },
  { id:"T-04",name:"Ana Villanueva",unit:"Tanod T-04",availabilityStatus:"UNAVAILABLE",updated:"5 min ago" },
  { id:"T-05",name:"Ruben Cruz",unit:"Tanod T-05",availabilityStatus:"BUSY",updated:"3 min ago" },
  { id:"T-06",name:"Luis Garcia",unit:"Tanod T-06",availabilityStatus:"AVAILABLE",updated:"Now" },
];
export const supportRequests = [{ id:"SR-104",incidentId:"GF-104",organization:"Caloocan Police",statusCode:"REQUESTED",requestedAt:"2026-11-19 08:37",acceptedAt:null,completedAt:null,reason:"Traffic control and incident documentation." }];
export const handovers = [
  { id:"QH-028",incidentId:"GF-104",receiver:"Caloocan Police Substation",receiverType:"POLICE",organization:"Caloocan Police",officer:"PSSg. R. Dela Cruz",method:"Authenticated account",qrStatusCode:"PENDING_ACCEPTANCE",createdAt:"Nov 19, 8:38 AM",acceptedAt:null,expiresAt:"Nov 19, 9:08 AM",remarks:"Awaiting receiving officer confirmation.",authenticatedReceiver:true },
  { id:"QH-027",incidentId:"GF-102",receiver:"Hospital ER Staff",receiverType:"HOSPITAL",organization:"District Hospital",officer:"Nurse A. Reyes",method:"Protected QR",qrStatusCode:"ACCEPTED",createdAt:"Nov 19, 8:32 AM",acceptedAt:"Nov 19, 8:39 AM",expiresAt:"Nov 19, 9:02 AM",remarks:"Patient received at ER entrance; capability acknowledgment requires BDRRMO review.",authenticatedReceiver:false },
  { id:"QH-026",incidentId:"GF-103",receiver:"Patient companion",receiverType:"COMPANION",organization:"External receiver",officer:"M. Santos",method:"Protected QR",qrStatusCode:"NEEDS_CORRECTION",createdAt:"Nov 19, 8:20 AM",acceptedAt:"Nov 19, 8:27 AM",expiresAt:"Nov 19, 8:50 AM",remarks:"Receiver role needs clarification.",authenticatedReceiver:false },
];

export const vehicles = [
  { id: "V-01", name: "Tanod Patrol Unit 1", type: "Patrol Motorcycle", plate: "BRGY-167-01", capacity: "2 personnel", availabilityStatus: "AVAILABLE", location: "Barangay Hall", updated: "Now" },
  { id: "V-02", name: "Tanod Patrol Unit 2", type: "Patrol Motorcycle", plate: "BRGY-167-02", capacity: "2 personnel", availabilityStatus: "BUSY", location: "Gate 2", updated: "2 min ago" },
  { id: "V-03", name: "Emergency Transport Van", type: "Transport Van", plate: "BRGY-167-03", capacity: "6 personnel / 1 patient", availabilityStatus: "AVAILABLE", location: "Barangay Hall", updated: "Now" },
  { id: "V-04", name: "Response Tricycle", type: "Tricycle", plate: "BRGY-167-04", capacity: "3 personnel", availabilityStatus: "OUT_OF_SERVICE", location: "Motorpool", updated: "15 min ago" },
];
