import { TeamInfo } from '../types';

const BASE = import.meta.env.BASE_URL;

export const IPL_TEAMS: TeamInfo[] = [
  { id:'csk',  name:'Chennai Super Kings',         shortName:'CSK',  primary:'#f5a623', secondary:'#003366', emoji:'🦁', logo:`${BASE}logos/CSK.jpg`  },
  { id:'mi',   name:'Mumbai Indians',              shortName:'MI',   primary:'#004ba0', secondary:'#d4af37', emoji:'🔵', logo:`${BASE}logos/MI.jpg`   },
  { id:'rcb',  name:'Royal Challengers Bengaluru', shortName:'RCB',  primary:'#cc0000', secondary:'#c8a95d', emoji:'🔴', logo:`${BASE}logos/RCB.jpg`  },
  { id:'kkr',  name:'Kolkata Knight Riders',       shortName:'KKR',  primary:'#3a225d', secondary:'#fcd117', emoji:'⚫', logo:`${BASE}logos/KKR.jpg`  },
  { id:'dc',   name:'Delhi Capitals',              shortName:'DC',   primary:'#00008b', secondary:'#ef1c25', emoji:'🔷', logo:`${BASE}logos/DC.jpg`   },
  { id:'pbks', name:'Punjab Kings',                shortName:'PBKS', primary:'#ed1b24', secondary:'#c8a95d', emoji:'🔴', logo:`${BASE}logos/PBKS.jpg` },
  { id:'rr',   name:'Rajasthan Royals',            shortName:'RR',   primary:'#2d4e8a', secondary:'#e91e8c', emoji:'👑', logo:`${BASE}logos/RR.jpg`   },
  { id:'srh',  name:'Sunrisers Hyderabad',         shortName:'SRH',  primary:'#f7a721', secondary:'#000000', emoji:'🟠', logo:`${BASE}logos/SRH.jpg`  },
  { id:'gt',   name:'Gujarat Titans',              shortName:'GT',   primary:'#1c1c5b', secondary:'#c8a95d', emoji:'⚡', logo:`${BASE}logos/GT.jpg`   },
  { id:'lsg',  name:'Lucknow Super Giants',        shortName:'LSG',  primary:'#00457c', secondary:'#a0e1ff', emoji:'🔵', logo:`${BASE}logos/LSG.jpg`  },
];

export function getTeamById(id: string): TeamInfo {
  return IPL_TEAMS.find(t => t.id === id) ?? IPL_TEAMS[0];
}
