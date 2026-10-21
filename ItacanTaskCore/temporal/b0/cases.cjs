"use strict";
const NOW=1792224000000;
const cases=[];
function add(id,category,rule,dates="📅 2026-10-17",extra={}){cases.push({id,category,line:`- [ ] Synthetic <!-- hub-task:b0-parent --> 🔁 ${rule}${dates?" "+dates:""}`,now:NOW,settings:{},statuses:[],query:null,...extra});}
add("BOUND-unbounded","bounded","every day");
for(const n of[1,2,5,0])add("BOUND-count-"+n,"bounded",`every day for ${n} time${n===1?"":"s"}`);
add("BOUND-exhausted-count-probe","bounded","every day for 2 times","📅 2026-10-17",{query:"2026-10-20T23:59:59.999Z"});
for(const[meaning,date]of[["before","October 16, 2026"],["equal","October 17, 2026"],["next","October 18, 2026"],["after","October 20, 2026"]])add("BOUND-until-"+meaning,"bounded","every day until "+date);
add("BOUND-before-weekly-next","bounded","every week until October 20, 2026");
add("BOUND-iso-until","bounded","every day until 2026-10-18");
add("BOUND-invalid-end","bounded","every day until February 30, 2026");
add("BOUND-count-and-end","bounded","every day for 2 times until October 20, 2026");
add("BOUND-unknown-grammar","bounded","every ???");
add("BOUND-permissive","bounded","every frobnication");
add("BOUND-month-clamp","bounded","every month for 2 times","📅 2026-01-31");
add("BOUND-leap-clamp","bounded","every year for 2 times","📅 2024-02-29");
add("BOUND-delete-count-one","bounded","every day for 1 time 🏁 delete");
add("BOUND-delete-unsupported","bounded","every day until 2026-10-17 🏁 delete");
add("REF-start-only","reference","every week","🛫 2026-10-10");
add("REF-scheduled-only","reference","every week","⏳ 2026-10-10");
add("REF-due-only","reference","every week","📅 2026-10-10");
add("REF-all-dates","reference","every week","🛫 2026-10-09 ⏳ 2026-10-10 📅 2026-10-12");
add("REF-start-scheduled-default","reference","every week","🛫 2026-10-09 ⏳ 2026-10-12");
add("REF-start-scheduled-remove","reference","every week","🛫 2026-10-09 ⏳ 2026-10-12",{settings:{removeScheduledDateOnRecurrence:true}});
add("REF-date-free-fixed","reference","every day","");
add("REF-date-free-when-done","reference","every day when done","");
add("REF-early-fixed","reference","every day","📅 2026-12-01");
add("REF-early-when-done","reference","every day when done","📅 2026-12-01");
add("REF-late-fixed","reference","every day","📅 2026-01-01");
add("REF-late-when-done","reference","every day when done","📅 2026-01-01");
add("REF-weekly-when-done-offsets","reference","every week when done","🛫 2026-10-08 📅 2026-10-10");
add("CAL-winter","calendar","every day","📅 2026-01-15");
add("CAL-summer","calendar","every day","📅 2026-07-15");
add("CAL-spring","calendar","every day","📅 2026-03-28");
add("CAL-autumn","calendar","every day","📅 2026-10-24");
add("CAL-month-through-spring","calendar","every month","📅 2026-03-01");
add("CAL-year-boundary","calendar","every day","📅 2026-12-31");
add("CAL-overlap-early-when-done","calendar","every day when done","📅 2026-01-01",{now:Date.parse("2026-10-25T00:30:00Z")});
add("CAL-overlap-late-when-done","calendar","every day when done","📅 2026-01-01",{now:Date.parse("2026-10-25T01:30:00Z")});
add("CAL-midnight-when-done","calendar","every day when done","📅 2026-01-01",{now:Date.parse("2026-03-28T23:00:00Z")});
add("TIME-plain-clock","time","every day","📅 2026-10-17 09:00");
add("TIME-clock-before-tokens","time","every day","",{line:"- [ ] Synthetic at 09:00 <!-- hub-task:b0-parent --> 🔁 every day 📅 2026-10-17"});
add("TIME-midnight-text","time","every day","📅 2026-10-17 00:00");
add("TIME-iso-clock","time","every day","📅 2026-10-17T09:00");
add("TIME-dataview-clock","time","every day", "",{settings:{taskFormat:"dataview"},line:"- [ ] Synthetic <!-- hub-task:b0-parent --> [repeat:: every day] [due:: 2026-10-17T09:00]"});
add("SET-order-next-last","settings","every day","📅 2026-10-17",{settings:{recurrenceOnNextLine:true}});
add("SET-no-done","settings","every day","📅 2026-10-17",{settings:{setDoneDate:false}});
add("SET-filtered","settings","every day","📅 2026-10-17",{settings:{globalFilter:"#task"}});
add("SET-cancel-transition","settings","every day","📅 2026-10-17",{line:"- [?] Synthetic <!-- hub-task:b0-parent --> 🔁 every day 📅 2026-10-17",statuses:[{symbol:"?",name:"To cancel",nextStatusSymbol:"-",type:"TODO"}]});
add("SET-recurring-cancelled-reopen","settings","every day","📅 2026-10-17",{line:"- [-] Synthetic <!-- hub-task:b0-parent --> 🔁 every day 📅 2026-10-17"});
const chainCases=[
 {id:"CHAIN-count-reset",line:"- [ ] Synthetic <!-- hub-task:b0-parent --> 🔁 every day for 2 times 📅 2026-10-17",actions:["next","next","next"]},
 {id:"CHAIN-month-clamp",line:"- [ ] Synthetic <!-- hub-task:b0-parent --> 🔁 every month 📅 2026-01-31",actions:["next","next","next"]},
 {id:"CHAIN-leap-clamp",line:"- [ ] Synthetic <!-- hub-task:b0-parent --> 🔁 every year 📅 2024-02-29",actions:["next","next","next","next"]},
 {id:"CHAIN-reopen-recomplete",line:"- [ ] Synthetic <!-- hub-task:b0-parent --> 🔁 every day 📅 2026-10-17",actions:["completed","open","next"]},
 {id:"CHAIN-edited-rule",line:"- [ ] Synthetic <!-- hub-task:b0-parent --> 🔁 every day 📅 2026-10-17",actions:["next","replace-rule","next"]},
 {id:"CHAIN-edited-due",line:"- [ ] Synthetic <!-- hub-task:b0-parent --> 🔁 every day 📅 2026-10-17",actions:["next","replace-due","next"]}
];
const clockCases=[
 {id:"CLOCK-winter",from:{date:"2026-01-15",time:"09:00"},to:{date:"2026-01-16",time:"09:00"}},
 {id:"CLOCK-summer",from:{date:"2026-07-15",time:"09:00"},to:{date:"2026-07-16",time:"09:00"}},
 {id:"CLOCK-daily-spring",from:{date:"2026-03-28",time:"09:00"},to:{date:"2026-03-29",time:"09:00"}},
 {id:"CLOCK-daily-autumn",from:{date:"2026-10-24",time:"09:00"},to:{date:"2026-10-25",time:"09:00"}},
 {id:"CLOCK-weekly-spring",from:{date:"2026-03-22",time:"09:00"},to:{date:"2026-03-29",time:"09:00"}},
 {id:"CLOCK-monthly-spring",from:{date:"2026-03-01",time:"09:00"},to:{date:"2026-04-01",time:"09:00"}},
 {id:"CLOCK-gap",from:{date:"2026-03-28",time:"02:30"},to:{date:"2026-03-29",time:"02:30"}},
 {id:"CLOCK-overlap",from:{date:"2026-10-24",time:"02:30"},to:{date:"2026-10-25",time:"02:30"}},
 {id:"CLOCK-midnight-spring",from:{date:"2026-03-29",time:"00:00"},to:{date:"2026-03-30",time:"00:00"}},
 {id:"CLOCK-date-only",from:{date:"2026-03-28",time:null},to:{date:"2026-03-29",time:null}}
 ,{id:"CLOCK-ny-gap",from:{date:"2026-03-07",time:"02:30"},to:{date:"2026-03-08",time:"02:30"}}
 ,{id:"CLOCK-ny-overlap",from:{date:"2026-10-31",time:"01:30"},to:{date:"2026-11-01",time:"01:30"}}
 ,{id:"CLOCK-ny-daily-spring",from:{date:"2026-03-07",time:"09:00"},to:{date:"2026-03-08",time:"09:00"}}
 ,{id:"CLOCK-ny-daily-autumn",from:{date:"2026-10-31",time:"09:00"},to:{date:"2026-11-01",time:"09:00"}}
];
module.exports={NOW,cases,chainCases,clockCases};
