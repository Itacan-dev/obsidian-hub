import './media.css';
import {button,el,report} from '../ui/elements.js';

export function mediaView(record,position) {
  const pdf=record.kind==='pdf';
  const root=el('section','document-pane panel');
  const toolbar=el('header','document-tools media-tools');
  const area=el('div','media-area');
  const title=el('h1','note-name',record.path.split('/').at(-1));
  title.title=record.path;
  const pageInput=el('input','media-page-number');
  pageInput.type='number';pageInput.min='1';pageInput.setAttribute('aria-label','PDF page');
  const pageCount=el('span','muted');
  let page=Math.max(1,Number(position.page)||1),zoom=Math.max(0,Math.min(4,Number(position.zoom)||0));
  let pdfDocument,loading,worker,port,library,renderTask,disposed=false,serial=0,loadId=0,etag;
  let scrollX=position.scrollX||0,scrollY=position.scrollY||0;
  let revision=0;
  const url=new URL('itacan://app/media/'+record.path.split('/').map(encodeURIComponent).join('/'));
  url.searchParams.set('library',record.session);
  const previous=button('Previous page',()=>turn(page-1)),next=button('Next page',()=>turn(page+1));
  function turn(number) {
    if(!pdfDocument || !Number.isFinite(number))return;
    page=Math.max(1,Math.min(pdfDocument.numPages,Math.trunc(number)));
    scrollY=scrollX=0;return render();
  }
  pageInput.onchange=()=>turn(pageInput.valueAsNumber)?.catch(report);
  const fit=button('Fit',()=>magnify(0));
  const smaller=button('−',()=>magnify(Math.max(.25,(zoom||1)/1.25)));
  const larger=button('+',()=>magnify(Math.min(4,(zoom||1)*1.25)));
  smaller.setAttribute('aria-label','Zoom out');larger.setAttribute('aria-label','Zoom in');
  function magnify(value){scrollX=area.scrollLeft;scrollY=area.scrollTop;zoom=value;return render();}
  toolbar.append(title);
  if(pdf)toolbar.append(previous,pageInput,pageCount,next);
  toolbar.append(smaller,fit,larger);root.append(toolbar,area);
  function restore(){area.scrollLeft=scrollX;area.scrollTop=scrollY;}
  async function render() {
    if(disposed)return;
    const ticket=++serial;
    fit.textContent=zoom ? Math.round(zoom*100)+'% · Fit' : 'Fit';
    if (!pdf) {
      const picture=el('img','media-image');picture.alt=title.textContent;
      picture.onload=()=>{
        if(ticket!==serial || disposed)return;
        if(zoom)picture.style.width=picture.naturalWidth*zoom+'px';
        restore();
      };
      picture.onerror=()=>{if(ticket===serial)area.textContent='Image unavailable · '+record.path;};
      if(zoom)picture.classList.add('scaled-image');
      area.replaceChildren(picture);picture.src=url.href+'&v='+revision;return;
    }
    if(!pdfDocument)return;
    const previousRender=renderTask;
    previousRender?.cancel();
    const sheet=await pdfDocument.getPage(page);
    if(ticket!==serial || disposed)return;
    const base=sheet.getViewport({scale:1});
    const scale=zoom || Math.max(.1,Math.min(2,((area.clientWidth || 640)-24)/base.width));
    const viewport=sheet.getViewport({scale});
    const paper=el('div','media-paper'),canvas=el('canvas'),layer=el('div','pdf-text-layer');
    paper.style.width=viewport.width+'px';paper.style.height=viewport.height+'px';
    paper.style.setProperty('--total-scale-factor',String(scale*(sheet.userUnit||1)));
    const ratio=Math.min(devicePixelRatio || 1,2,4096/Math.max(viewport.width,viewport.height));
    canvas.width=Math.max(1,Math.floor(viewport.width*ratio));canvas.height=Math.max(1,Math.floor(viewport.height*ratio));
    canvas.setAttribute('aria-label','PDF page '+page);paper.append(canvas,layer);area.replaceChildren(paper);
    previous.disabled=page<=1;next.disabled=page>=pdfDocument.numPages;pageInput.value=page;pageInput.max=pdfDocument.numPages;
    pageCount.textContent='/ '+pdfDocument.numPages;
    const task=sheet.render({canvas,viewport,transform:[ratio,0,0,ratio,0,0]});
    renderTask=task;
    try {
      await task.promise;
      if(ticket!==serial || disposed)return;
      await new library.TextLayer({textContentSource:sheet.streamTextContent(),container:layer,viewport}).render();
      if(ticket===serial)restore();
    } catch(error){if(ticket===serial && !disposed)throw error;}
  }
  async function release() {
    const task=loading,oldWorker=worker,oldPort=port;
    loading=worker=port=pdfDocument=null;
    try { await task?.destroy(); } finally { oldWorker?.destroy();oldPort?.terminate(); }
  }
  async function load() {
    const ticket=++loadId;revision++;
    if(pdf) {
      ++serial;
      await release();
      const response=await fetch(url,{cache:'no-store'});
      if(!response.ok)throw Error('PDF unavailable · '+record.path);
      etag=response.headers.get('etag');
      const bytes=new Uint8Array(await response.arrayBuffer());
      library=await import('pdfjs-dist/build/pdf.mjs');
      if(ticket!==loadId || disposed)return;
      port=new Worker('/pdf/pdf.worker.min.js',{type:'module'});
      worker=library.PDFWorker.create({port});
      const task=library.getDocument({data:bytes,worker,useWorkerFetch:true,useWasm:false,
        cMapUrl:'itacan://app/pdf/cmaps/',cMapPacked:true,standardFontDataUrl:'itacan://app/pdf/standard_fonts/',
        wasmUrl:'itacan://app/pdf/wasm/',iccUrl:'itacan://app/pdf/iccs/'});
      loading=task;
      const opened=await task.promise;
      if(ticket!==loadId || disposed)return;
      pdfDocument=opened;page=Math.min(page,opened.numPages);
    } else {
      const response=await fetch(url,{method:'HEAD',cache:'no-store'});
      if(!response.ok)throw Error('Image unavailable · '+record.path);
      etag=response.headers.get('etag');
    }
    await render();
  }
  function unavailable(error) {
    if(!disposed)area.replaceChildren(el('p','empty',error.message || String(error)));
  }
  async function check() {
    const response=await fetch(url,{method:'HEAD',cache:'no-store'});
    if(!response.ok){etag=undefined;throw Error('Document unavailable · '+record.path);}
    if(etag===undefined || response.headers.get('etag')!==etag) {
      scrollY=area.scrollTop;scrollX=area.scrollLeft;await load();
    }
  }
  const revalidate=()=>check().catch(unavailable);
  window.addEventListener('focus',revalidate);
  let mounted=false,width;
  const resize=new ResizeObserver(()=>{
    const current=area.clientWidth;
    if(mounted && pdfDocument && !zoom && current && width!==current){
      scrollY=area.scrollTop;scrollX=area.scrollLeft;render().catch(unavailable);
    }
    width=current;
  });
  resize.observe(area);
  return {root,display(){},mounted(){if(!mounted){mounted=true;load().catch(unavailable);}},
    snapshot:()=>({page,zoom,scrollX:area.scrollLeft,scrollY:area.scrollTop}),
    dispose(){disposed=true;serial++;loadId++;resize.disconnect();window.removeEventListener('focus',revalidate);release().catch(report);}
  };
}
