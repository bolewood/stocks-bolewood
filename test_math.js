const fs = require('fs');
const content = fs.readFileSync('components/VCXNAVFinder.jsx', 'utf8');

// evaluate the constants
const script = content.match(/(const SHARE_DENOMINATED = \[[\s\S]*?\];)/)[1] + '\n' +
               content.match(/(const DOLLAR_DENOMINATED = \[[\s\S]*?\];)/)[1] + '\n' +
               content.match(/(const OTHER_HOLDINGS = \[[\s\S]*?\];)/)[1];

eval(script);

const shareTotal = SHARE_DENOMINATED.reduce((acc, p) => acc + (p.mark_pps_0331 * p.shares_k * 1000), 0);
const dollarTotal = DOLLAR_DENOMINATED.reduce((acc, p) => acc + (p.value_k * 1000), 0);
const otherTotal = OTHER_HOLDINGS.reduce((acc, p) => acc + (p.value_k * 1000), 0);
const totalNAV = shareTotal + dollarTotal + otherTotal;
const shares = 35.797138;

console.log("Share Total: ", Math.round(shareTotal / 1000) + "K");
console.log("Dollar Total: ", Math.round(dollarTotal / 1000) + "K");
console.log("Other Total: ", Math.round(otherTotal / 1000) + "K");
console.log("Investments Total: ", Math.round((shareTotal + dollarTotal + otherTotal - 64732000) / 1000) + "K");
console.log("Net Other: 64732K");
console.log("Total NAV: ", Math.round(totalNAV / 1000) + "K");
console.log("NAV/Share: ", (totalNAV / (shares * 1000000)).toFixed(2));
