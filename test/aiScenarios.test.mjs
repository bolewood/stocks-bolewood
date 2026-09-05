import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { calculate, loadPublicDataset, readJson } from '../reference/calculate.mjs';
import { createScenarioExport } from '../reference/engine.mjs';
import { unitPrice, unitExposurePer100, CAPITALIZATION } from '../reference/unitExposure.mjs';
import { WRAPPERS, parseScenarioSearch, serializeScenarioSearch } from '../lib/aiWrappers.mjs';
import { fundRowMetrics, resolveFund } from '../lib/aiFundBasis.mjs';
import { validateCapitalization, validateWrapper } from '../data/schema/validate.mjs';

const filed = readJson('reference/fixtures.json');
const estimated = readJson('reference/estimated-fixtures.json');
const dataset = loadPublicDataset();
function near(a,b,label) { assert.ok(Math.abs(a-b) <= Math.max(1,Math.abs(b))*1e-11, `${label}: ${a} vs ${b}`); }
function app(w, p) { return fundRowMetrics(w, p.prices[w.yahooSymbol], { ...p, resolved: resolveFund(w, { basis:p.holdingsBasis, deploy:p.deploy, dxyzBridge:p.dxyzBridge }) }); }

for (const holdingsBasis of ['filed','estimated']) for (const deploy of ['cash','prorata','range']) {
  test(`Every quantified leg responds independently to valuation and dilution: ${holdingsBasis}/${deploy}`, () => {
    const p = { ...estimated, holdingsBasis, deploy };
    for (const w of WRAPPERS) {
      const before=app(w,p);
      for (const [side,key,val] of [['anthropic','anth','anthVal'],['openai','oai','oaiVal']]) {
        const other=key === 'anth' ? 'oai' : 'anth';
        const after=app(w,{...p,[val]:p[val]*1.7});
        const quantified=w[side] && w[side].kind !== 'commitment';
        for(const suffix of ['Per100','Per100High']) {
          near(after[key+suffix],before[key+suffix]*1.7,`${w.ticker} ${key} slope`);
          near(after[other+suffix],before[other+suffix],`${w.ticker} unrelated leg`);
          if(quantified) assert.ok(after[key+suffix] > before[key+suffix]);
          else assert.equal(after[key+suffix],0);
          near(app(w,{...p,dilution:.1})[key+suffix],before[key+suffix]*.9,`${w.ticker} dilution once`);
        }
      }
    }
  });
  test(`Offline/browser parity including both endpoints: ${holdingsBasis}/${deploy}`, () => {
    for(const changes of [{},{anthVal:1500e9,oaiVal:2000e9,dilution:.1},{anthFdShares:1930165000,oaiFdShares:1500e6,dxyzOaiEntryPrice:900},{prices:{...estimated.prices,ARKVX:20}}]) {
      const p={...estimated,holdingsBasis,deploy,...changes};
      for(const expected of calculate(dataset,p).rows) {
        const actual=app(WRAPPERS.find(w=>w.ticker===expected.ticker),p);
        for(const key of ['shares','wrapperValue','anthPct','oaiPct','anthPer100','oaiPer100','anthPer100High','oaiPer100High','combinedPer100','combinedPer100High']) near(actual[key],expected[key],`${expected.ticker} ${key}`);
        assert.equal(actual.sharesAsOf,expected.sharesAsOf);
        for (const key of ['nav','premium','scenarioNetAssets']) {
          if (expected[key] == null) assert.equal(actual[key], null, key);
          else near(actual[key], expected[key], `${expected.ticker} ${key}`);
        }
        for(const key of ['anth','oai']) if(actual[key+'Detail'].lots.length) {
          near(actual[key+'Detail'].lots.reduce((s,l)=>s+l.scenarioValue,0)*100/actual.wrapperValue,actual[key+'Detail'].per100,`${expected.ticker} detail equation`);
          assert.deepEqual(actual[key+'Detail'].lots,expected[key+'Lots']);
          near(actual[key+'Detail'].sensitivity.low, expected[key+'Sensitivity'].low, 'FD sensitivity low');
          near(actual[key+'Detail'].sensitivity.high, expected[key+'Sensitivity'].high, 'FD sensitivity high');
        }
      }
    }
  });
}

test('Hand-computed synthetic quantities detect wrong denominator or double dilution', () => {
  assert.equal(unitPrice({valuation:1000,fdShares:100,dilution:.1}),9);
  assert.equal(unitExposurePer100({units:2,valuation:1000,fdShares:100,wrapperValue:200,dilution:.1}),9);
  for(const n of [0,-1,NaN,Infinity]) assert.throws(()=>unitPrice({valuation:1000,fdShares:n}));
});

test('FD changes inversely revalue DXYZ and SKM; August acquisition is independent', () => {
  const w=WRAPPERS.find(w=>w.ticker==='DXYZ');
  const p={...estimated,deploy:'cash'};
  const baseline=app(w,p);
  const changed=app(w,{...p,anthVal:2000e9,oaiVal:3000e9,anthFdShares:2*p.anthFdShares,oaiFdShares:2*p.oaiFdShares});
  const lot=r=>r.oaiDetail.lots.find(l=>l.id==='goanna-2026-08-13');
  near(lot(baseline).units,150e6/(35040868.2/50895),'Acquisition units use full precision');
  assert.equal(lot(changed).units,lot(baseline).units);
  assert.equal(app(w,filed).oaiDetail.lots.length,1);
  near(lot(app(w,{...p,dxyzOaiEntryPrice:2*p.dxyzOaiEntryPrice})).units,lot(baseline).units/2,'entry inverse');
  for(const ticker of ['DXYZ','SKM']) {
    const wrapper=WRAPPERS.find(w=>w.ticker===ticker);
    near(app(wrapper,{...p,anthFdShares:2*p.anthFdShares}).anthPer100,app(wrapper,p).anthPer100/2,'FD inverse');
  }
  near(app(w,{...p,dxyzBridge:null}).scenarioNetAssets,w.raw.filedSnapshot.netAssets,'Cash-to-equity is not new capital');
  const noBridge=app(w,{...p,dxyzBridge:null});
  assert.ok(lot(noBridge)); // Purchase inclusion does not depend on ATM availability.
  assert.equal(noBridge.oaiDetail.lots.some(l=>l.units===11236),false);
  const moreAtm={...p,dxyzBridge:{...p.dxyzBridge,proFormaAssets:w.raw.filedSnapshot.netAssets*1.5,proFormaShares:w.sharesOutstanding*1.2},deploy:'prorata'};
  assert.equal(lot(app(w,moreAtm)).units,lot(baseline).units);
});

test('Scenario query round-trip preserves capitalization and acquisition inputs; legacy basis still works',()=>{
  const parsed=parseScenarioSearch('?basis=filed&anthFd=1930.165&oaiFd=1400&oaiEntry=900');
  assert.equal(parsed.basis,'filed');
  assert.equal(parsed.anthFdShares,1930165000);
  assert.deepEqual(parseScenarioSearch(serializeScenarioSearch(parsed)),parsed);
  for(const raw of ['-1','NaN','Infinity','0','']) {
    const p=parseScenarioSearch(`?anthFd=${raw}&oaiEntry=${raw}`);
    assert.ok(Number.isFinite(p.anthFdShares)&&p.anthFdShares>0);
    assert.ok(Number.isFinite(p.dxyzOaiEntryPrice)&&p.dxyzOaiEntryPrice>0);
  }
});

test('Filed evidence and source assumptions stay distinct',()=>{
  validateCapitalization(CAPITALIZATION);
  const skm=dataset.wrappers.find(w=>w.ticker==='SKM');
  assert.equal(skm.anthropic.filedUnits,skm.anthropic.observations.beginningUnits+skm.anthropic.observations.acquiredUnits);
  assert.equal(skm.shareCount.value,skm.shareCount.issued-skm.shareCount.treasury);
  assert.equal(WRAPPERS.find(w=>w.ticker==='SKM').sharesOutstanding,213057911*9/5);
  assert.equal(skm.anthropic.reportedOwnership.pct,.002);
  assert.equal(skm.pendingTreasuryDisposal.status,'authorized-not-confirmed-completed');
  const sbg=dataset.wrappers.find(w=>w.ticker==='SFTBY');
  assert.equal(sbg.shareCount.value,5699049389);
  assert.equal(sbg.openai.status,'pro-forma-includes-unfunded-tranche');
  assert.equal(sbg.openai.fundingEvents[2].status,'scheduled');
  const bad=structuredClone(skm); delete bad.anthropic.sources[0].url;
  assert.throws(()=>validateWrapper(bad),/source URL/);
  bad.anthropic.sources[0].url=skm.anthropic.sources[0].url;
  bad.anthropic.sources[0].measurementDate='2026-02-30';
  assert.throws(()=>validateWrapper(bad),/measurementDate/);
});

test('Frozen scenario export reproduces offline and rejects tampered results',()=>{
  const dir=mkdtempSync(join(tmpdir(),'ai-scenario-'));
  try {
    const file=join(dir,'scenario.json');
    const snapshot=createScenarioExport(dataset,{...estimated,anthVal:1500e9,oaiVal:2000e9,anthFdShares:1930165000,dxyzOaiEntryPrice:900});
    writeFileSync(file,JSON.stringify(snapshot));
    const valid=spawnSync(process.execPath,['reference/calculate.mjs','--scenario',file],{encoding:'utf8'});
    assert.equal(valid.status,0,valid.stderr);
    snapshot.results.rows[0].anthPer100+=1;
    writeFileSync(file,JSON.stringify(snapshot));
    assert.notEqual(spawnSync(process.execPath,['reference/calculate.mjs','--scenario',file]).status,0);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test('Valuation scenarios cannot mutate filed observations', () => {
  const before = JSON.stringify(dataset);
  calculate(dataset, { ...estimated, anthVal: 5000e9, oaiVal: 5000e9, dilution: .3, dxyzOaiEntryPrice: 2000 });
  assert.equal(JSON.stringify(dataset), before);
  const rawBefore = JSON.stringify(WRAPPERS.map(w => w.raw));
  for (const w of WRAPPERS) app(w, { ...estimated, anthVal: 500e9, oaiVal: 500e9, anthFdShares: 3e9 });
  assert.equal(JSON.stringify(WRAPPERS.map(w => w.raw)), rawBefore);
});
