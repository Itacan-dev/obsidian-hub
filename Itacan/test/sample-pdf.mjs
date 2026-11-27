export function samplePdf() {
  const stream='BT /F1 16 Tf 24 170 Td (Sampling methods) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>',
    ...Array(2).fill('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 210] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>'),
    '<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let pdf='%PDF-1.4\n';const offsets=[];
  for(const [index,object] of objects.entries()){offsets.push(pdf.length);pdf+=(index+1)+' 0 obj\n'+object+'\nendobj\n';}
  const xref=pdf.length;
  return pdf+'xref\n0 7\n0000000000 65535 f \n'+offsets.map(x=>String(x).padStart(10,'0')+' 00000 n \n').join('')+
    'trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';
}
