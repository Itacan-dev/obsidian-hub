import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt();

// The picker holds these offsets only while its note revision and draft still match.
export function notePositions(text) {
  const lines = text.split('\n');
  const offsets = [0];
  for (const line of lines) offsets.push(Math.min(text.length,offsets.at(-1)+line.length+1));
  const frontmatterEnd = lines[0]?.trim()==='---' ? lines.findIndex((line,i)=>i>0 && /^(---|\.\.\.)$/.test(line.trim())) : -1;
  const start = frontmatterEnd < 0 ? 0 : offsets[frontmatterEnd+1];
  const result = [{label:'End of note',offset:text.length},{label:'Start of note',offset:start}];
  const tokens = markdown.parse(text.slice(start),{});
  const offset = line => offsets[(frontmatterEnd<0?0:frontmatterEnd+1)+line] ?? text.length;
  for (const [index,token] of tokens.entries()) {
    if (token.level!==0 || !token.map) continue;
    if (token.type==='heading_open') {
      const label = tokens[index+1].content;
      const next = tokens.slice(index+1).find(t=>t.level===0 && t.type==='heading_open' && t.tag<=token.tag);
      result.push({label:'Top of '+label,offset:offset(token.map[1])},{label:'End of '+label,offset:next?offset(next.map[0]):text.length});
    } else if (['ordered_list_open','bullet_list_open'].includes(token.type)) {
      const first = offset(token.map[0]), last=offset(token.map[1]);
      const name = text.slice(first).split('\n')[0].trim().slice(0,60);
      const items=tokens.slice(index+1).filter(t=>t.type==='list_item_open' && t.level===1 && t.map[0]<token.map[1]);
      for (const [label,at,i] of [['First',first,0],['Last',last,items.length]]) {
        const marker=token.type==='ordered_list_open'?String(Number(token.attrGet('start') || 1)+i)+token.markup:token.markup;
        result.push({label:label+' item in '+name,offset:at,marker});
      }
    }
  }
  return result;
}
