"use strict";
const test = require('node:test'), assert = require('node:assert/strict');
const { inboxSelection, inboxFiles } = require('../domain/inbox-selection');
const { bulkEligibility } = require('../domain/inbox-bulk');
const { sortedCaptures } = require('../domain/inbox');
const text = (id, createdAt, type = 'note') => ({ id, createdAt, text: id, attachments: [], intent: { type } });
const items = [text('a',1,'task'),{id:'file',createdAt:2,text:'',attachments:[{path:'A.pdf'}]},text('b',3),{id:'mixed',createdAt:4,text:'Legacy',attachments:[{path:'B.pdf'}]},text('c',5),{...text('pending',6),operation:{kind:'note',state:'prepared'}}];
const choose = (selected,anchor,target,modifiers={},rows=items,batch=null) => inboxSelection(rows,new Set(selected),anchor,target,modifiers,c=>bulkEligibility(c,batch));

test('ordinary clicks select exactly one eligible or ineligible item',()=>{
    assert.deepEqual(choose(['a','b'],'a','c'),{ids:['c'],anchor:'c'});
    assert.deepEqual(choose(['a','b'],'a','mixed'),{ids:['mixed'],anchor:'mixed'});
});
test('Ctrl toggles members and permits an empty selection',()=>{
    assert.deepEqual(choose(['a'],'a','b',{ctrlKey:true}).ids,['a','b']);
    assert.deepEqual(choose(['a','b'],'b','a',{ctrlKey:true}).ids,['b']);
    assert.deepEqual(choose(['b'],'b','b',{ctrlKey:true}).ids,[]);
});
test('Meta offers the same additive selection on Mac',()=>assert.deepEqual(choose(['a'],'a','b',{metaKey:true}).ids,['a','b']));
test('Shift selects a homogeneous range and skips incompatible and retained items',()=>{
    assert.deepEqual(choose(['a'],'a','c',{shiftKey:true}),{ids:['a','b','c'],anchor:'a'});
    assert(choose(['a'],'a','file',{shiftKey:true}).reason);
    assert(choose(['a'],'a','pending',{shiftKey:true}).reason);
});
test('backward Shift ranges follow displayed order and retain the anchor',()=>assert.deepEqual(choose(['c'],'c','a',{shiftKey:true}),{ids:['a','b','c'],anchor:'c'}));
test('Ctrl+Shift adds a range, while Shift alone replaces previous selection',()=>{
    assert.deepEqual(choose(['a','c'],'b','b',{ctrlKey:true,shiftKey:true}).ids,['a','b','c']);
    assert.deepEqual(choose(['a','c'],'b','c',{shiftKey:true}).ids,['b','c']);
});
for(const order of ['newest','oldest','type'])test('ranges and selection order use the current '+order+' sort',()=>{
    const rows=sortedCaptures(items,{sort:order}),eligible=rows.filter(c=>!bulkEligibility(c).reason&&bulkEligibility(c).kind==='text');
    const result=choose([eligible[0].id],eligible[0].id,eligible.at(-1).id,{shiftKey:true},rows);
    assert.deepEqual(result.ids,eligible.map(c=>c.id));
});
test('hidden or missing anchors fall back to a visible selection',()=>assert.deepEqual(choose(['b'],'removed','c',{shiftKey:true}).ids,['b','c']));
test('mixed and retained operations stay individually navigable but cannot join ranges',()=>{
    assert(choose(['mixed'],'mixed','a',{ctrlKey:true}).reason);
    assert(choose(['a'],'a','mixed',{ctrlKey:true}).reason);
    const batch={id:'batch',state:'failed',members:[{id:'a',state:'pending'},{id:'b',state:'pending'}]};
    assert.deepEqual(choose(['a'],'a','b',{ctrlKey:true},items,batch).ids,['a','b']);
    assert(choose(['a'],'a','c',{ctrlKey:true},items,batch).reason);
});
test('file rows flatten legacy groups in Inbox order and deduplicate resolved shared paths',()=>{
    const a={id:'a',path:'old/A.pdf',name:'A.pdf'},b={id:'b',path:'B.pdf',name:'B.pdf'},shared={id:'c',path:'new/A.pdf',name:'Shared A.pdf'};
    assert.deepEqual(inboxFiles([{attachments:[b,shared]},{attachments:[a]}],r=>r.path.replace('old/','new/')),[b,shared]);
    assert.deepEqual(inboxFiles([{attachments:[a,b]},{attachments:[shared]}],r=>r.path.replace('old/','new/')),[a,b]);
});
test('selection calculations leave captures and the previous Set unchanged',()=>{
    const selected=new Set(['a']),before=JSON.stringify(items);inboxSelection(items,selected,'a','c',{shiftKey:true},c=>bulkEligibility(c));
    assert.deepEqual([...selected],['a']);assert.equal(JSON.stringify(items),before);
});
