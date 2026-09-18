import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/apps-script-captura-v18.json',import.meta.url),'utf8'));
const patch=readFileSync(new URL('./apps-script-origem-ativo.gs',import.meta.url),'utf8');
const helper=readFileSync(new URL('./apps-script-origem-colunas.gs',import.meta.url),'utf8');
const cases=[['NEWSLETTER','handleNewsletter'],['LISTA','handleLista'],['DICIONARIO','handleDicionario'],['BOLSAO','handleBolsao'],['LIVES','handleLives'],['AULAS','handleAulaAoVivo']];
function harness(kind='DICIONARIO',options={}){
 const base=Array.from(vm.runInNewContext(fixture.headers[kind]));
 let labels=[...base,...['SES Sync','CRM Sync'].filter(h=>!base.includes(h)),...(options.extra||[])];
 const initialWidth=options.width||labels.length+2;
 const state={width:initialWidth,headers:labels.map(h=>({userEnteredValue:{stringValue:h},effectiveValue:{stringValue:h}})),rows:[{historical:true}],schemaWrites:0,appends:0,locked:false,releases:0};
 if(options.formula)state.headers[0]={userEnteredValue:{formulaValue:'="Data"'},effectiveValue:{stringValue:'Data'}};
 const sheet={getName:()=>kind,getSheetId:()=>17,getLastColumn:()=>labels.length};
 const ss={getId:()=> 'synthetic-sheet',getSheetByName:n=>n===kind?sheet:null,getSpreadsheetTimeZone:()=> 'America/Sao_Paulo'};
 const context=vm.createContext({Date,SpreadsheetApp:{getActiveSpreadsheet:()=>ss},
 LockService:{getScriptLock:()=>({waitLock(){if(options.lockBusy)throw Error('WORKER_BUSY');assert.equal(state.locked,false);state.locked=true;},releaseLock(){state.locked=false;state.releases++;}})},
 Utilities:{formatDate:date=>date.toISOString().slice(0,-1)},
 ContentService:{MimeType:{TEXT:'text'},createTextOutput:text=>({setMimeType:()=>({text})})},
 Sheets:{Spreadsheets:{
  getByDataFilter(request,id){
   assert.equal(id,'synthetic-sheet');if(options.readFailure)throw Error('SIMULATED_API_FAILURE');
   return {spreadsheetId:options.wrongSheet?'other-sheet':id,sheets:[{properties:{sheetId:17,title:kind,gridProperties:{columnCount:state.width}},data:[{startRow:0,startColumn:0,rowData:[{values:state.headers}]}]}]};
  },
  batchUpdate(body,id){
   assert.equal(id,'synthetic-sheet');
   for(const request of body.requests){
    if(request.appendDimension){assert.equal(state.locked,true);assert.equal(request.appendDimension.dimension,'COLUMNS');state.width+=request.appendDimension.length;}
    else if(request.updateCells){
     assert.equal(state.locked,true);assert.equal(request.updateCells.start.rowIndex,0);assert.equal(request.updateCells.fields,'userEnteredValue');
     request.updateCells.rows[0].values.forEach((cell,i)=>{const col=request.updateCells.start.columnIndex+i;assert.equal(state.headers[col],undefined);state.headers[col]={...structuredClone(cell),effectiveValue:{stringValue:cell.userEnteredValue.stringValue}};});state.schemaWrites++;
    }else if(request.appendCells){
     assert.equal(request.appendCells.sheetId,17);assert.equal(request.appendCells.fields,'userEnteredValue,userEnteredFormat.numberFormat');
     if(options.concurrent&&state.appends===0)state.rows.push({concurrent:true});
     state.rows.push(structuredClone(request.appendCells.rows[0].values));state.appends++;
    }else assert.fail('Unexpected mutation');
   }
  }
 }},
 SHEETS:Object.fromEntries(cases.map(([k])=>[k,k])),FC_CAPTURA_WPP_PENDENTE:'fila-preservada',FC_CAPTURA_REVISAO:'captura-v18',
 normalizePhone:s=>s,jsonResponse:value=>value,aulasCfgPorOrigem_:()=>({campanha:'Aula sintética'}),logError:()=>{},
 dispatchLiveLeadImmediately_:()=>assert.fail('Não disparar integrações síncronas'),
 });
 for(const [k,source] of Object.entries(fixture.headers))context[k+'_HEADERS']=vm.runInNewContext(source);
 vm.runInContext(fixture.functions.leadHeaders_+'\n'+helper+'\n'+patch,context);
 const read=(name,index=state.rows.length-1)=>{const col=state.headers.findIndex(c=>c?.userEnteredValue?.stringValue===name);return state.rows[index][col]?.userEnteredValue;};
 return {context,state,base,read};
}
const input={email:'ensaio@example.invalid',nome:'Ensaio',origem:'aula_sintetica',whatsapp:'telefone-sintetico',utm_source:'meta',utm_medium:'paid',utm_campaign:'campanha-sintetica',src:'meta',utm_content:'criativo-a',utm_term:'120999999999999999'};
for(const [kind,handler]of cases)test(kind+': tracking preservado sem alterar filas ou histórico',()=>{
 const h=harness(kind),before=structuredClone(h.state.headers);
 assert.equal(h.context[handler]({...input}).ok,true);
 assert.deepEqual(h.state.rows[0],{historical:true});assert.deepEqual(h.state.headers.slice(0,before.length),before);
 assert.equal(h.read('UTM Term').stringValue,input.utm_term);assert.equal(h.read('UTM Content').stringValue,'criativo-a');assert.equal(h.read('Src').stringValue,'meta');
 assert.equal(h.read('Data').numberValue>45000,true);assert.equal(h.read('UTM Campaign').stringValue,'campanha-sintetica');
 if(kind!=='NEWSLETTER')assert.equal(h.read('WhatsApp').stringValue,input.whatsapp);
 if(kind==='DICIONARIO')assert.equal(h.read('Mensageiro Sync').stringValue,'fila-preservada');
 if(kind==='LIVES')assert.equal(h.read('CRM Sync').stringValue,'fila-preservada');
 if(kind==='AULAS')assert.equal(h.read('CRM Sync').stringValue,'off');
 assert.equal(h.state.appends,1);assert.equal(h.state.locked,false);assert.equal(h.state.releases,1);
 h.context[handler]({...input});assert.equal(h.state.schemaWrites,1);assert.equal(h.state.appends,2);
});
test('ID numérico impreciso não é convertido em texto',()=>{const h=harness();h.context.handleDicionario({...input,utm_term:120999999999999999});assert.equal(h.read('UTM Term').stringValue,'');});
test('valor com aparência de fórmula permanece string literal',()=>{const h=harness();h.context.handleDicionario({...input,utm_content:'=IMPORTXML("https://example.invalid","//a")'});assert.deepEqual(h.read('UTM Content'),{stringValue:'=IMPORTXML("https://example.invalid","//a")'});});
test('formulário antigo aceita parâmetros ausentes',()=>{const h=harness();h.context.handleDicionario({email:input.email});assert.equal(h.read('UTM Term').stringValue,'');});
test('colunas de tracking já existentes e fora de ordem são reutilizadas',()=>{const h=harness('DICIONARIO',{extra:['UTM Term','Src','UTM Content']});h.context.handleDicionario({...input});assert.equal(h.state.schemaWrites,0);assert.equal(h.read('UTM Term').stringValue,input.utm_term);});
test('aliases de cabeçalho reconhecidos não criam colunas duplicadas',()=>{const h=harness('DICIONARIO',{extra:['utm_term','src','utm_content']});h.context.handleDicionario({...input});assert.equal(h.state.schemaWrites,0);assert.equal(h.read('utm_term').stringValue,input.utm_term);});
for(const [label,options,pattern]of [
 ['cabeçalho ambíguo',{extra:['UTM Term','utm_term']},/AMBIGUO/],
 ['fórmula no cabeçalho',{formula:true},/NAO_LITERAL/],
 ['planilha divergente',{wrongSheet:true},/DIVERGENTE/],
 ['falha de leitura',{readFailure:true},/API_FAILURE/],
 ['grade cheia',{width:200},/FORA_LIMITE/]
])test(label+': recusa antes de gravar o lead e libera lock',()=>{const h=harness('DICIONARIO',options);assert.throws(()=>h.context.handleDicionario({...input}),pattern);assert.equal(h.state.appends,0);assert.equal(h.state.schemaWrites,0);assert.equal(h.state.locked,false);});
test('appendCells preserva uma linha concorrente e não calcula número de linha',()=>{const h=harness('DICIONARIO',{concurrent:true});h.context.handleDicionario({...input});assert.equal(h.state.rows.length,3);assert.deepEqual(h.state.rows[1],{concurrent:true});assert.equal(h.read('UTM Term').stringValue,input.utm_term);});
test('chamada legada ao escritor sem quarto argumento continua válida',()=>{const h=harness('NEWSLETTER');h.context.appendLeadByHeader_('NEWSLETTER',h.context.NEWSLETTER_HEADERS,new Array(h.base.length).fill(''));assert.equal(h.state.appends,1);assert.equal(h.state.schemaWrites,0);});
test('linha incompatível é rejeitada sem criar colunas',()=>{const h=harness();assert.throws(()=>h.context.appendLeadByHeader_('DICIONARIO',h.context.DICIONARIO_HEADERS,[],input),/LINHA_INVALIDA/);assert.equal(h.state.schemaWrites,0);assert.equal(h.state.appends,0);});
test('GET expõe revisão sem criar contato',()=>{const h=harness();assert.match(h.context.doGet({}).text,/origem-v1-20260917/);assert.equal(h.state.appends,0);});
test('captura com colunas prontas não disputa lock dos trabalhadores',()=>{const h=harness('DICIONARIO',{extra:['Src','UTM Content','UTM Term'],lockBusy:true});h.context.handleDicionario({...input});assert.equal(h.state.appends,1);assert.equal(h.state.releases,0);assert.equal(h.read('UTM Term').stringValue,input.utm_term);});
test('schema ausente com lock ocupado falha sem gravar contato ou coluna',()=>{const h=harness('DICIONARIO',{lockBusy:true});assert.throws(()=>h.context.handleDicionario({...input}),/WORKER_BUSY/);assert.equal(h.state.appends,0);assert.equal(h.state.schemaWrites,0);});