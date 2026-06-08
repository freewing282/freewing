// ==========================================================================
// Initialization & Globals
// ==========================================================================
let activeTab = 'chartsTab';
let activeChartType = 'projection'; // 'projection' or 'cashflow'
let projectionChartInstance = null;
let simulationData = null;

// DOM Elements
const themeToggle = document.getElementById('themeToggle');
const form = document.getElementById('simulatorForm');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

const btnAssetProjection = document.getElementById('btnAssetProjection');
const btnCashFlowBreakdown = document.getElementById('btnCashFlowBreakdown');
const chartDescText = document.getElementById('chartDescText');

// ==========================================================================
// Theme Toggle Logic
// ==========================================================================
themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    // Re-render chart if it exists to update grid colors
    if (simulationData) {
        renderCharts();
    }
});

// ==========================================================================
// Slider and Number Input Synchronization
// ==========================================================================
const syncInputs = [
    { range: 'currentAgeRange', num: 'currentAge' },
    { range: 'retirementAgeRange', num: 'retirementAge' },
    { range: 'targetSpendingRange', num: 'targetSpending' },
    { range: 'expectedSeveranceRange', num: 'expectedSeverance' }
];

syncInputs.forEach(({ range, num }) => {
    const rangeEl = document.getElementById(range);
    const numEl = document.getElementById(num);

    rangeEl.addEventListener('input', (e) => {
        numEl.value = e.target.value;
        // Age Constraint: Retirement age cannot be less than current age
        if (range === 'currentAgeRange') {
            const retAgeEl = document.getElementById('retirementAge');
            const retRangeEl = document.getElementById('retirementAgeRange');
            if (parseInt(retAgeEl.value) < parseInt(e.target.value)) {
                retAgeEl.value = e.target.value;
                retRangeEl.value = e.target.value;
            }
        }
        if (range === 'retirementAgeRange') {
            const curAgeEl = document.getElementById('currentAge');
            const curRangeEl = document.getElementById('currentAgeRange');
            if (parseInt(curAgeEl.value) > parseInt(e.target.value)) {
                curAgeEl.value = e.target.value;
                curRangeEl.value = e.target.value;
            }
        }
        calculateSimulation();
    });

    numEl.addEventListener('input', (e) => {
        rangeEl.value = e.target.value;
        if (num === 'currentAge') {
            const retAgeEl = document.getElementById('retirementAge');
            const retRangeEl = document.getElementById('retirementAgeRange');
            if (parseInt(retAgeEl.value) < parseInt(e.target.value)) {
                retAgeEl.value = e.target.value;
                retRangeEl.value = e.target.value;
            }
        }
        if (num === 'retirementAge') {
            const curAgeEl = document.getElementById('currentAge');
            const curRangeEl = document.getElementById('currentAgeRange');
            if (parseInt(curAgeEl.value) > parseInt(e.target.value)) {
                curAgeEl.value = e.target.value;
                curRangeEl.value = e.target.value;
            }
        }
        calculateSimulation();
    });
});

// Event listeners for other inputs
const standardInputs = [
    'initCash', 'initIsa', 'initPension', 'initIrp', 'initHouse', 'initOther', 
    'useHousePension', 'useOtherAsset', 'savePension', 'saveIrp', 'saveIsa', 'saveCash',
    'returnRate', 'inflationRate', 'nationalPension', 'incomeLevel', 'adjustInflation'
];

standardInputs.forEach(id => {
    document.getElementById(id).addEventListener('change', calculateSimulation);
    if (document.getElementById(id).tagName === 'INPUT') {
        document.getElementById(id).addEventListener('input', calculateSimulation);
    }
});

// ==========================================================================
// Tab Navigation
// ==========================================================================
tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        
        tabButtons.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
        
        activeTab = targetTab;
        if (targetTab === 'chartsTab') {
            setTimeout(renderCharts, 50); // Ensure wrapper is styled first
        }
    });
});

btnAssetProjection.addEventListener('click', () => {
    activeChartType = 'projection';
    btnAssetProjection.classList.add('active');
    btnCashFlowBreakdown.classList.remove('active');
    chartDescText.innerHTML = `* <strong>자산 누적 추이</strong>는 57세 은퇴 시점까지 적립하고, 이후 매년 세후 500만원(물가상승 반영)을 인출하며 남은 자산의 규모를 비교합니다. <strong>절세 전략</strong>은 세무 최적화를 통해 자산 고갈 시점을 늦춥니다.`;
    renderCharts();
});

btnCashFlowBreakdown.addEventListener('click', () => {
    activeChartType = 'cashflow';
    btnCashFlowBreakdown.classList.add('active');
    btnAssetProjection.classList.remove('remove'); // safety
    btnAssetProjection.classList.remove('active');
    chartDescText.innerHTML = `* <strong>연도별 세후 인출 출처</strong>는 은퇴 후 매년 필요한 생활비를 어떤 계좌에서 얼마씩 세무 최적화 규칙에 맞추어 인출하는지 누적으로 보여줍니다. (국민연금, 연금저축/IRP 한도 내, 퇴직금, ISA, 일반 자산 순)`;
    renderCharts();
});


// ==========================================================================
// National Pension Tax Helper
// ==========================================================================
function calcNationalPensionTax(grossNP) {
    if (grossNP <= 0) return 0;
    
    // 1. Pension Income Deduction (연금소득공제)
    let deduction = 0;
    if (grossNP <= 350) {
        deduction = grossNP;
    } else if (grossNP <= 700) {
        deduction = 350 + (grossNP - 350) * 0.4;
    } else if (grossNP <= 1400) {
        deduction = 490 + (grossNP - 700) * 0.2;
    } else {
        deduction = 630 + (grossNP - 1400) * 0.1;
    }
    deduction = Math.min(900, deduction); // Limit max deduction
    
    // 2. Taxable Income (과세표준)
    // Subtract Basic deduction (기본공제): Self (150)
    let taxable = Math.max(0, grossNP - deduction - 150);
    
    // 3. Tax Rates (including 10% local income tax)
    let tax = 0;
    if (taxable <= 1400) {
        tax = taxable * 0.066;
    } else if (taxable <= 5000) {
        tax = 1400 * 0.066 + (taxable - 1400) * 0.165;
    } else {
        tax = 1400 * 0.066 + 3600 * 0.165 + (taxable - 5000) * 0.264;
    }
    
    return Math.round(tax);
}

// ==========================================================================
// Simulation Calculation Engine
// ==========================================================================
function calculateSimulation() {
    // 1. Gather Inputs
    const currentAge = parseInt(document.getElementById('currentAge').value);
    const retirementAge = parseInt(document.getElementById('retirementAge').value);
    const targetSpending = parseFloat(document.getElementById('targetSpending').value); // Monthly (만원)
    
    const initCash = parseFloat(document.getElementById('initCash').value);
    const initIsa = parseFloat(document.getElementById('initIsa').value);
    const initPension = document.getElementById('initPension') ? parseFloat(document.getElementById('initPension').value) : 2000;
    const initIrp = document.getElementById('initIrp') ? parseFloat(document.getElementById('initIrp').value) : 1000;
    const initHouse = parseFloat(document.getElementById('initHouse').value);
    const initOther = parseFloat(document.getElementById('initOther').value);
    const useHousePension = document.getElementById('useHousePension').value;
    const useOtherAsset = document.getElementById('useOtherAsset').value;
    const expectedSeverance = parseFloat(document.getElementById('expectedSeverance').value);
    
    const savePension = parseFloat(document.getElementById('savePension').value);
    const saveIrp = parseFloat(document.getElementById('saveIrp').value);
    const saveIsa = parseFloat(document.getElementById('saveIsa').value);
    const saveCash = parseFloat(document.getElementById('saveCash').value);
    
    const returnRate = parseFloat(document.getElementById('returnRate').value);
    const inflationRate = parseFloat(document.getElementById('inflationRate').value);
    const nationalPension = parseFloat(document.getElementById('nationalPension').value); // Monthly (만원)
    const incomeLevel = document.getElementById('incomeLevel').value;
    const adjustInflation = document.getElementById('adjustInflation').value;
    
    const creditRate = (incomeLevel === 'low') ? 0.165 : 0.132;
    const isaTaxFreeLimit = (incomeLevel === 'low') ? 400 : 200;
    
    // Run both scenarios
    const optimalResult = simulateScenario(true);
    const naiveResult = simulateScenario(false);
    
    // Calculate total tax saved
    let totalTaxOptimal = 0;
    let totalTaxNaive = 0;
    optimalResult.logs.forEach(log => { if (log.age >= retirementAge) totalTaxOptimal += log.taxPaid; });
    naiveResult.logs.forEach(log => { if (log.age >= retirementAge) totalTaxNaive += log.taxPaid; });
    
    // Add tax credits saved during accumulation
    let accumulationTaxRefunds = 0;
    optimalResult.logs.forEach(log => { if (log.age < retirementAge) accumulationTaxRefunds += log.taxRefund; });
    // Naive has less refunds because it doesn't do ISA transfers
    let naiveAccumulationRefunds = 0;
    naiveResult.logs.forEach(log => { if (log.age < retirementAge) naiveAccumulationRefunds += log.taxRefund; });
    
    const totalTaxBenefit = Math.round((totalTaxNaive - totalTaxOptimal) + (accumulationTaxRefunds - naiveAccumulationRefunds));
    
    // Effective tax rate
    let totalGrossWithdrawal = 0;
    let totalTaxPaidDuringDecumulation = 0;
    optimalResult.logs.forEach(log => {
        if (log.age >= retirementAge) {
            totalGrossWithdrawal += log.withdrawals.pension + log.withdrawals.severance + log.withdrawals.isa + log.withdrawals.cash + log.withdrawals.nonTaxedPension + log.withdrawals.housePension + (log.withdrawals.other / 0.95);
            totalTaxPaidDuringDecumulation += log.taxPaid;
        }
    });
    const effectiveTaxRate = totalGrossWithdrawal > 0 ? (totalTaxPaidDuringDecumulation / totalGrossWithdrawal) * 100 : 0;
    
    simulationData = {
        optimal: optimalResult,
        naive: naiveResult,
        kpis: {
            depletionAgeOptimal: optimalResult.depletionAge,
            depletionAgeNaive: naiveResult.depletionAge,
            totalSavedTax: Math.max(0, totalTaxBenefit),
            effectiveTaxRate: effectiveTaxRate
        }
    };
    
    // Update UI elements
    updateUI();
    
    // Inner function for scenario running
    function simulateScenario(isOptimal) {
        let age = currentAge;
        let logs = [];
        
        // Asset balances
        let cash = initCash;
        let isa = initIsa;
        let pension = initPension;
        let irp = initIrp;
        let irpSeverance = 0; // Starts at retirement
        let house = initHouse;
        let other = initOther;
        let houseValueAtStart = 0; // Stores house value when starting pension
        let hpRate = 0; // Housing pension rate
        
        // Tax tracking variables
        let nonTaxDeductedPension = 0; // Tracks excess contributions
        let isaContributionsTotal = initIsa; // ISA cost basis
        let taxRefundFromPreviousYear = 0;
        
        let depletionAge = null;
        let isDepleted = false;
        
        // Loop year-by-year until age 95
        while (age <= 95) {
            let log = {
                age: age,
                totalAssets: 0,
                cash: 0,
                isa: 0,
                pension: 0,
                irp: 0,
                irpSeverance: 0,
                nonTaxDeductedPension: 0,
                house: 0,
                other: 0,
                withdrawals: {
                    pension: 0,
                    nonTaxedPension: 0,
                    severance: 0,
                    isa: 0,
                    cash: 0,
                    housePension: 0,
                    other: 0,
                    nationalPension: 0
                },
                taxPaid: 0,
                taxRefund: 0,
                targetSpend: 0,
                shortfall: 0
            };
            
            // ACCUMULATION PHASE
            if (age < retirementAge) {
                // 1. Calculate Tax Credit Refund from previous year
                // Tax credit applies up to 9M KRW combined (Pension max 6M)
                let creditEligiblePension = Math.min(600, savePension);
                let creditEligibleIrp = Math.min(900 - creditEligiblePension, saveIrp);
                let standardCredit = (creditEligiblePension + creditEligibleIrp) * creditRate;
                
                log.taxRefund = taxRefundFromPreviousYear;
                
                // Add contributions at start of year
                pension += savePension;
                irp += saveIrp;
                
                // Record excess contributions as non-tax-deducted (for tax-free withdrawals later)
                let totalPensionContributed = savePension + saveIrp;
                let eligibleCreditTotal = creditEligiblePension + creditEligibleIrp;
                if (totalPensionContributed > eligibleCreditTotal) {
                    nonTaxDeductedPension += (totalPensionContributed - eligibleCreditTotal);
                }
                
                // ISA contribution (capped at 2,000/year, max 10,000 total)
                let actualSaveIsa = saveIsa;
                if (isaContributionsTotal + saveIsa > 10000) {
                    actualSaveIsa = Math.max(0, 10000 - isaContributionsTotal);
                }
                isa += actualSaveIsa;
                isaContributionsTotal += actualSaveIsa;
                
                // Cash receives standard savings + refund from last year + overflow from ISA cap
                let isaOverflow = saveIsa - actualSaveIsa;
                cash += saveCash + taxRefundFromPreviousYear + isaOverflow;
                
                // Setup next year's refund (accumulation phase)
                taxRefundFromPreviousYear = standardCredit;
                
                // ISA 3-year rollover strategy (OPTIMAL ONLY)
                const yearsElapsed = age - currentAge;
                if (isOptimal && yearsElapsed > 0 && yearsElapsed % 3 === 0 && isa > 0) {
                    // Matures and rolls over!
                    let isaProfit = Math.max(0, isa - isaContributionsTotal);
                    let isaTax = Math.max(0, isaProfit - isaTaxFreeLimit) * 0.099;
                    let maturedIsaNet = isa - isaTax;
                    
                    // Transfer 30 million KRW (3,000) to IRP
                    const transferAmount = Math.min(3000, maturedIsaNet);
                    irp += transferAmount;
                    
                    // Transfer increases tax deduction by 10% (up to 300)
                    let extraDeduction = transferAmount * 0.1;
                    let extraRefund = extraDeduction * creditRate;
                    
                    // The portion that did NOT receive deduction becomes non-tax-deducted
                    nonTaxDeductedPension += (transferAmount - extraDeduction);
                    
                    // Reinvest remaining in a new ISA
                    isa = maturedIsaNet - transferAmount;
                    isaContributionsTotal = isa; // Reset cost basis
                    
                    // Tax refund next year includes the extra refund
                    taxRefundFromPreviousYear += extraRefund;
                    log.taxPaid += isaTax;
                }
                
                // Apply return at the end of the year
                pension *= (1 + returnRate/100);
                irp *= (1 + returnRate/100);
                isa *= (1 + returnRate/100);
                house *= (1 + inflationRate/100);
                other *= (1 + returnRate/100);
                
                // General Cash return (taxed dividends)
                let cashNetReturn = returnRate - (2.0 * 0.154); // Assumes 2% dividend yield taxed at 15.4%
                cash *= (1 + Math.max(0, cashNetReturn)/100);
                
            } 
            // DECUMULATION PHASE (銀退)
            else {
                // Transfer retirement pay at the very start of retirement
                if (age === retirementAge) {
                    irpSeverance = expectedSeverance;
                }
                
                // Calculate target net spending for this year (inflation-adjusted optionally)
                let inflationFactor = (adjustInflation === 'yes') ? Math.pow(1 + inflationRate/100, age - retirementAge) : 1;
                let targetAnnualNet = targetSpending * 12 * inflationFactor;
                log.targetSpend = targetAnnualNet;
                
                let remainingTarget = targetAnnualNet;
                
                // 1. National Pension (국민연금) starts at age 65
                // Note: National pension payout is adjusted for inflation automatically in real life, so we keep inflation factor here.
                let npInflationFactor = Math.pow(1 + inflationRate/100, age - retirementAge);
                if (age >= 65) {
                    let grossNP = nationalPension * 12 * npInflationFactor;
                    let npTax = calcNationalPensionTax(grossNP);
                    let netNP = grossNP - npTax;
                    
                    log.withdrawals.nationalPension = netNP;
                    remainingTarget = Math.max(0, remainingTarget - netNP);
                    log.taxPaid += npTax;
                }
                
                // 1.5. Housing Pension (주택연금) starts at max(55, retirementAge)
                let annualHousePension = 0;
                if (useHousePension === 'yes' && age >= 55 && house > 0) {
                    let startAge = Math.max(55, retirementAge);
                    if (houseValueAtStart === 0) {
                        houseValueAtStart = initHouse * Math.pow(1 + inflationRate/100, startAge - currentAge);
                        hpRate = 0.0017 + (startAge - 55) * 0.00009;
                        hpRate = Math.min(0.004, hpRate);
                    }
                    let maxPensionVal = houseValueAtStart * hpRate * 12;
                    annualHousePension = Math.min(house, maxPensionVal);
                    house = Math.max(0, house - annualHousePension);
                    
                    log.withdrawals.housePension = annualHousePension;
                    remainingTarget = Math.max(0, remainingTarget - annualHousePension);
                }
                
                // 2. Withdraw from private assets to satisfy remaining target
                if (remainingTarget > 0) {
                    if (isOptimal) {
                        // OPTIMAL DECUMULATION STRATEGY
                        
                        // Age based low tax rates for pension
                        let pensionTaxRate = 0.055;
                        if (age >= 70 && age < 80) pensionTaxRate = 0.044;
                        if (age >= 80) pensionTaxRate = 0.033;
                        
                        // Source A: Private Pension (Tax-deducted & earnings) - STRICTLY LIMIT to 1,490M to avoid 16.5% tax
                        let availableTaxedPension = pension + irp;
                        let maxOptimalWithdrawalGross = 1490;
                        let targetGrossFromPension = remainingTarget / (1 - pensionTaxRate);
                        
                        let grossPensionWithdrawal = Math.min(availableTaxedPension, maxOptimalWithdrawalGross, targetGrossFromPension);
                        let netPensionWithdrawal = grossPensionWithdrawal * (1 - pensionTaxRate);
                        
                        // Deduct from pension first, then irp if needed
                        if (pension >= grossPensionWithdrawal) {
                            pension -= grossPensionWithdrawal;
                        } else {
                            let diff = grossPensionWithdrawal - pension;
                            pension = 0;
                            irp = Math.max(0, irp - diff);
                        }
                        
                        remainingTarget = Math.max(0, remainingTarget - netPensionWithdrawal);
                        log.withdrawals.pension = netPensionWithdrawal;
                        log.taxPaid += (grossPensionWithdrawal - netPensionWithdrawal);
                        
                        // Source B: IRP Retirement Pay (퇴직금)
                        // Taxed at 30% discount (years 1-10 of retirement) or 40% discount (year 11+)
                        if (remainingTarget > 0 && irpSeverance > 0) {
                            let severanceElapsedYears = age - retirementAge;
                            let discountRate = (severanceElapsedYears < 10) ? 0.3 : 0.4;
                            let baseSeveranceTaxRate = 0.08; // Assumed average retirement income tax rate
                            let severanceTaxRate = baseSeveranceTaxRate * (1 - discountRate);
                            
                            let targetGrossFromSeverance = remainingTarget / (1 - severanceTaxRate);
                            let grossSeveranceWithdrawal = Math.min(irpSeverance, targetGrossFromSeverance);
                            let netSeveranceWithdrawal = grossSeveranceWithdrawal * (1 - severanceTaxRate);
                            
                            irpSeverance -= grossSeveranceWithdrawal;
                            remainingTarget = Math.max(0, remainingTarget - netSeveranceWithdrawal);
                            log.withdrawals.severance = netSeveranceWithdrawal;
                            log.taxPaid += (grossSeveranceWithdrawal - netSeveranceWithdrawal);
                        }
                        
                        // Source C: Non-tax-deducted Pension Principal (세액공제 받지 않은 원금) - 100% Tax-free!
                        if (remainingTarget > 0 && nonTaxDeductedPension > 0) {
                            let availableTotalPension = pension + irp;
                            let grossNonTaxedWithdrawal = Math.min(availableTotalPension, nonTaxDeductedPension, remainingTarget);
                            
                            nonTaxDeductedPension -= grossNonTaxedWithdrawal;
                            if (pension >= grossNonTaxedWithdrawal) {
                                pension -= grossNonTaxedWithdrawal;
                            } else {
                                let diff = grossNonTaxedWithdrawal - pension;
                                pension = 0;
                                irp = Math.max(0, irp - diff);
                            }
                            
                            remainingTarget = Math.max(0, remainingTarget - grossNonTaxedWithdrawal);
                            log.withdrawals.nonTaxedPension = grossNonTaxedWithdrawal;
                        }
                        
                        // Source D: ISA Account (9.9% separate tax on profits, principal tax-free)
                        if (remainingTarget > 0 && isa > 0) {
                            // Profit ratio
                            let profitRatio = Math.max(0, (isa - isaContributionsTotal) / isa);
                            let isaEffTaxRate = profitRatio * 0.099;
                            
                            let targetGrossFromIsa = remainingTarget / (1 - isaEffTaxRate);
                            let grossIsaWithdrawal = Math.min(isa, targetGrossFromIsa);
                            let netIsaWithdrawal = grossIsaWithdrawal * (1 - isaEffTaxRate);
                            
                            // Adjust cost basis proportionally
                            let reducedPrincipal = grossIsaWithdrawal * (1 - profitRatio);
                            isaContributionsTotal = Math.max(0, isaContributionsTotal - reducedPrincipal);
                            
                            isa -= grossIsaWithdrawal;
                            remainingTarget = Math.max(0, remainingTarget - netIsaWithdrawal);
                            log.withdrawals.isa = netIsaWithdrawal;
                            log.taxPaid += (grossIsaWithdrawal - netIsaWithdrawal);
                        }
                        
                        // Source D2: Other Assets (if enabled for spending)
                        if (useOtherAsset === 'yes' && remainingTarget > 0 && other > 0) {
                            let targetGrossFromOther = remainingTarget / 0.95; // 5% effective tax
                            let grossOtherWithdrawal = Math.min(other, targetGrossFromOther);
                            let netOtherWithdrawal = grossOtherWithdrawal * 0.95;
                            
                            other -= grossOtherWithdrawal;
                            remainingTarget = Math.max(0, remainingTarget - netOtherWithdrawal);
                            log.withdrawals.other = netOtherWithdrawal;
                            log.taxPaid += (grossOtherWithdrawal - netOtherWithdrawal);
                        }
                        
                        // Source E: General Cash/Brokerage Account (Assumes effective 5% capital gains/dividend tax on withdrawals)
                        if (remainingTarget > 0 && cash > 0) {
                            let targetGrossFromCash = remainingTarget / 0.95;
                            let grossCashWithdrawal = Math.min(cash, targetGrossFromCash);
                            let netCashWithdrawal = grossCashWithdrawal * 0.95;
                            
                            cash -= grossCashWithdrawal;
                            remainingTarget = Math.max(0, remainingTarget - netCashWithdrawal);
                            log.withdrawals.cash = netCashWithdrawal;
                            log.taxPaid += (grossCashWithdrawal - netCashWithdrawal);
                        }
                        
                    } else {
                        // NAIVE DECUMULATION STRATEGY (인출 순서: 연금저축/IRP 몰빵 -> 퇴직금 -> ISA -> 현금)
                        // No 1,500M cap. If withdrawal exceeds 1,500M, entire withdrawal taxed at 16.5% flat tax.
                        let availableTaxedPension = pension + irp;
                        
                        if (availableTaxedPension > 0 && remainingTarget > 0) {
                            // Age based pension tax
                            let pensionTaxRate = 0.055;
                            if (age >= 70 && age < 80) pensionTaxRate = 0.044;
                            if (age >= 80) pensionTaxRate = 0.033;
                            
                            // Let's check if target exceeds 1,500M net
                            let targetGross = remainingTarget / (1 - pensionTaxRate);
                            let finalPensionTaxRate = pensionTaxRate;
                            
                            if (targetGross > 1500 || (availableTaxedPension > 1500 && remainingTarget > 1500 * (1 - pensionTaxRate))) {
                                // Exceeds 15M limit! Entire withdrawal subject to 16.5% tax.
                                finalPensionTaxRate = 0.165;
                                targetGross = remainingTarget / (1 - finalPensionTaxRate);
                            }
                            
                            let grossPensionWithdrawal = Math.min(availableTaxedPension, targetGross);
                            let netPensionWithdrawal = grossPensionWithdrawal * (1 - finalPensionTaxRate);
                            
                            if (pension >= grossPensionWithdrawal) {
                                pension -= grossPensionWithdrawal;
                            } else {
                                let diff = grossPensionWithdrawal - pension;
                                pension = 0;
                                irp = Math.max(0, irp - diff);
                            }
                            
                            remainingTarget = Math.max(0, remainingTarget - netPensionWithdrawal);
                            log.withdrawals.pension = netPensionWithdrawal;
                            log.taxPaid += (grossPensionWithdrawal - netPensionWithdrawal);
                        }
                        
                        // Next, retirement pay
                        if (remainingTarget > 0 && irpSeverance > 0) {
                            let severanceTaxRate = 0.08 * 0.7; // Standard discounted tax rate (assuming they don't optimize timing)
                            let targetGrossFromSeverance = remainingTarget / (1 - severanceTaxRate);
                            let grossSeveranceWithdrawal = Math.min(irpSeverance, targetGrossFromSeverance);
                            let netSeveranceWithdrawal = grossSeveranceWithdrawal * (1 - severanceTaxRate);
                            
                            irpSeverance -= grossSeveranceWithdrawal;
                            remainingTarget = Math.max(0, remainingTarget - netSeveranceWithdrawal);
                            log.withdrawals.severance = netSeveranceWithdrawal;
                            log.taxPaid += (grossSeveranceWithdrawal - netSeveranceWithdrawal);
                        }
                        
                        // Next, non-taxed pension
                        if (remainingTarget > 0 && nonTaxDeductedPension > 0) {
                            let availableTotalPension = pension + irp;
                            let grossNonTaxedWithdrawal = Math.min(availableTotalPension, nonTaxDeductedPension, remainingTarget);
                            
                            nonTaxDeductedPension -= grossNonTaxedWithdrawal;
                            if (pension >= grossNonTaxedWithdrawal) {
                                pension -= grossNonTaxedWithdrawal;
                            } else {
                                let diff = grossNonTaxedWithdrawal - pension;
                                pension = 0;
                                irp = Math.max(0, irp - diff);
                            }
                            
                            remainingTarget = Math.max(0, remainingTarget - grossNonTaxedWithdrawal);
                            log.withdrawals.nonTaxedPension = grossNonTaxedWithdrawal;
                        }
                        
                        // Next, ISA
                        if (remainingTarget > 0 && isa > 0) {
                            let profitRatio = Math.max(0, (isa - isaContributionsTotal) / isa);
                            let isaEffTaxRate = profitRatio * 0.099;
                            let targetGrossFromIsa = remainingTarget / (1 - isaEffTaxRate);
                            let grossIsaWithdrawal = Math.min(isa, targetGrossFromIsa);
                            let netIsaWithdrawal = grossIsaWithdrawal * (1 - isaEffTaxRate);
                            
                            let reducedPrincipal = grossIsaWithdrawal * (1 - profitRatio);
                            isaContributionsTotal = Math.max(0, isaContributionsTotal - reducedPrincipal);
                            
                            isa -= grossIsaWithdrawal;
                            remainingTarget = Math.max(0, remainingTarget - netIsaWithdrawal);
                            log.withdrawals.isa = netIsaWithdrawal;
                            log.taxPaid += (grossIsaWithdrawal - netIsaWithdrawal);
                        }
                        
                        // Next, Other Assets
                        if (useOtherAsset === 'yes' && remainingTarget > 0 && other > 0) {
                            let targetGrossFromOther = remainingTarget / 0.95;
                            let grossOtherWithdrawal = Math.min(other, targetGrossFromOther);
                            let netOtherWithdrawal = grossOtherWithdrawal * 0.95;
                            
                            other -= grossOtherWithdrawal;
                            remainingTarget = Math.max(0, remainingTarget - netOtherWithdrawal);
                            log.withdrawals.other = netOtherWithdrawal;
                            log.taxPaid += (grossOtherWithdrawal - netOtherWithdrawal);
                        }
                        
                        // Next, Cash
                        if (remainingTarget > 0 && cash > 0) {
                            let targetGrossFromCash = remainingTarget / 0.95;
                            let grossCashWithdrawal = Math.min(cash, targetGrossFromCash);
                            let netCashWithdrawal = grossCashWithdrawal * 0.95;
                            
                            cash -= grossCashWithdrawal;
                            remainingTarget = Math.max(0, remainingTarget - netCashWithdrawal);
                            log.withdrawals.cash = netCashWithdrawal;
                            log.taxPaid += (grossCashWithdrawal - netCashWithdrawal);
                        }
                    }
                }
                
                log.shortfall = remainingTarget;
                if (remainingTarget > 0.01 && !isDepleted) {
                    isDepleted = true;
                    depletionAge = age;
                }
                
                // Compound remaining assets at end of year
                pension *= (1 + returnRate/100);
                irp *= (1 + returnRate/100);
                irpSeverance *= (1 + returnRate/100);
                isa *= (1 + returnRate/100);
                house *= (1 + inflationRate/100);
                other *= (1 + returnRate/100);
                
                let cashNetReturn = returnRate - (2.0 * 0.154); // Dividends tax
                cash *= (1 + Math.max(0, cashNetReturn)/100);
            }
            
            // Record year-end totals
            log.cash = Math.max(0, Math.round(cash));
            log.isa = Math.max(0, Math.round(isa));
            log.pension = Math.max(0, Math.round(pension));
            log.irp = Math.max(0, Math.round(irp));
            log.irpSeverance = Math.max(0, Math.round(irpSeverance));
            log.nonTaxDeductedPension = Math.max(0, Math.round(nonTaxDeductedPension));
            log.house = Math.max(0, Math.round(house));
            log.other = Math.max(0, Math.round(other));
            
            log.totalAssets = log.cash + log.isa + log.pension + log.irp + log.irpSeverance + log.house + log.other;
            log.taxPaid = Math.round(log.taxPaid);
            
            logs.push(log);
            age++;
        }
        
        return {
            logs: logs,
            depletionAge: depletionAge || 99,
            isDepleted: isDepleted
        };
    }
}

// ==========================================================================
// UI Rendering Logic
// ==========================================================================
function updateUI() {
    if (!simulationData) return;
    
    const kpis = simulationData.kpis;
    
    // 1. Update KPI Section
    const kpiDepletionAge = document.getElementById('kpiDepletionAge');
    const kpiDepletionStatus = document.getElementById('kpiDepletionStatus');
    const kpiSavedTax = document.getElementById('kpiSavedTax');
    const kpiEffectiveTaxRate = document.getElementById('kpiEffectiveTaxRate');
    const kpiTaxRateDiff = document.getElementById('kpiTaxRateDiff');
    
    // Depletion Age formatting
    if (kpis.depletionAgeOptimal >= 99) {
        kpiDepletionAge.innerText = "100세 이상";
        kpiDepletionStatus.innerText = "안정적인 노후 설계입니다. 👍";
        kpiDepletionAge.style.color = "var(--success)";
    } else {
        kpiDepletionAge.innerText = `${kpis.depletionAgeOptimal}세`;
        kpiDepletionStatus.innerText = `일반 인출 대비 ${kpis.depletionAgeOptimal - kpis.depletionAgeNaive}년 더 버팀 (일반: ${kpis.depletionAgeNaive}세)`;
        kpiDepletionAge.style.color = "var(--warning)";
    }
    
    // Tax benefit formatting
    kpiSavedTax.innerText = `${formatKoreanCurrency(kpis.totalSavedTax)}`;
    
    // Effective tax rate
    kpiEffectiveTaxRate.innerText = `${kpis.effectiveTaxRate.toFixed(1)}%`;
    let rateDiffPct = Math.round((1 - (kpis.effectiveTaxRate / 15.4)) * 100);
    kpiTaxRateDiff.innerText = `일반 배당소득세(15.4%) 대비 ${rateDiffPct}% 감면`;
    
    // 2. Render active chart
    renderCharts();
    
    // 3. Render Roadmap Timeline
    renderRoadmap();
    
    // 4. Render Data Table
    renderTable();
    
    // Refresh icons so new dynamic roadmap icons are rendered
    if (window.lucide) {
        lucide.createIcons();
    }
}

function formatKoreanCurrency(amountTenThousand) {
    if (amountTenThousand <= 0) return "0원";
    let eok = Math.floor(amountTenThousand / 10000);
    let man = Math.round(amountTenThousand % 10000);
    
    let result = [];
    if (eok > 0) result.push(`${eok}억원`);
    if (man > 0) result.push(`${man}만원`);
    
    return result.join(' ');
}

// ==========================================================================
// Chart Rendering Logic
// ==========================================================================
function renderCharts() {
    const ctx = document.getElementById('projectionChart').getContext('2d');
    const isDark = !document.body.classList.contains('light-theme');
    
    const textColor = isDark ? '#9ca3af' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)';
    
    if (projectionChartInstance) {
        projectionChartInstance.destroy();
    }
    
    const logsOptimal = simulationData.optimal.logs;
    const logsNaive = simulationData.naive.logs;
    const labels = logsOptimal.map(l => `${l.age}세`);
    
    if (activeChartType === 'projection') {
        // Line Chart: Total Assets comparison
        const optimalAssets = logsOptimal.map(l => l.totalAssets / 10000); // Convert to Eok
        const naiveAssets = logsNaive.map(l => l.totalAssets / 10000);
        
        projectionChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '절세 전략 적용',
                        data: optimalAssets,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.05)',
                        borderWidth: 3,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        fill: true,
                        tension: 0.1
                    },
                    {
                        label: '일반 인출 방식 (Naive)',
                        data: naiveAssets,
                        borderColor: '#94a3b8',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: textColor,
                            font: { family: 'Inter, sans-serif', size: 12, weight: '600' }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${context.raw.toFixed(2)} 억원`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: textColor }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: { color: textColor },
                        title: {
                            display: true,
                            text: '총 자산 규모 (억원)',
                            color: textColor,
                            font: { weight: 'bold' }
                        }
                    }
                }
            }
        });
    } else {
        // Stacked Bar Chart: Payout sources over time (retirement age onwards)
        const retirementAge = parseInt(document.getElementById('retirementAge').value);
        const decumulationLogs = logsOptimal.filter(l => l.age >= retirementAge);
        const decumLabels = decumulationLogs.map(l => `${l.age}세`);
        
        const npData = decumulationLogs.map(l => l.withdrawals.nationalPension);
        const pensionData = decumulationLogs.map(l => l.withdrawals.pension);
        const nonTaxedPensionData = decumulationLogs.map(l => l.withdrawals.nonTaxedPension);
        const severanceData = decumulationLogs.map(l => l.withdrawals.severance);
        const isaData = decumulationLogs.map(l => l.withdrawals.isa);
        const housePensionData = decumulationLogs.map(l => l.withdrawals.housePension);
        const otherData = decumulationLogs.map(l => l.withdrawals.other);
        const cashData = decumulationLogs.map(l => l.withdrawals.cash);
        
        projectionChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: decumLabels,
                datasets: [
                    { label: '국민연금', data: npData, backgroundColor: '#ea580c' },
                    { label: '연금저축/IRP (한도 내)', data: pensionData, backgroundColor: '#6366f1' },
                    { label: '연금저축/IRP (비과세 원금)', data: nonTaxedPensionData, backgroundColor: '#a5b4fc' },
                    { label: '퇴직금 (IRP)', data: severanceData, backgroundColor: '#06b6d4' },
                    { label: 'ISA 자산', data: isaData, backgroundColor: '#10b981' },
                    { label: '주택연금', data: housePensionData, backgroundColor: '#ec4899' },
                    { label: '기타 자산', data: otherData, backgroundColor: '#8b5cf6' },
                    { label: '일반 자산', data: cashData, backgroundColor: '#64748b' }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: textColor,
                            font: { family: 'Inter, sans-serif', size: 11 }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                if (context.raw <= 0) return null;
                                return `${context.dataset.label}: ${context.raw.toLocaleString()} 만원`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { color: 'transparent' },
                        ticks: { color: textColor }
                    },
                    y: {
                        stacked: true,
                        grid: { color: gridColor },
                        ticks: { color: textColor },
                        title: {
                            display: true,
                            text: '연간 세후 수령액 (만원)',
                            color: textColor,
                            font: { weight: 'bold' }
                        }
                    }
                }
            }
        });
    }
}

// ==========================================================================
// Roadmap Timeline Generation
// ==========================================================================
function renderRoadmap() {
    const timelineContainer = document.getElementById('roadmapTimeline');
    timelineContainer.innerHTML = '';
    
    const retirementAge = parseInt(document.getElementById('retirementAge').value);
    const logs = simulationData.optimal.logs;
    
    // Group timeline into phases
    // Phase 1: Bridge Period (Retirement Age to 64)
    // Phase 2: National Pension Start & Mid-Retirement (65 to 79)
    // Phase 3: Late Retirement (80+)
    
    const phase1Logs = logs.filter(l => l.age >= retirementAge && l.age < 65);
    const phase2Logs = logs.filter(l => l.age >= 65 && l.age < 80);
    const phase3Logs = logs.filter(l => l.age >= 80);
    
    const phases = [
        {
            title: `소득 공백기 (브릿지 기간)`,
            ageSpan: `${retirementAge}세 ~ 64세`,
            desc: `국민연금을 아직 받지 못해 사적연금, 퇴직금, ISA 위주로 생활비를 마련해야 하는 가장 중요한 시기입니다. 1,500만원 저율과세 한도를 엄격하게 통제합니다.`,
            logs: phase1Logs,
            icon: 'navigation'
        },
        {
            title: `국민연금 개시 및 중기 은퇴기`,
            ageSpan: `65세 ~ 79세`,
            desc: `국민연금 수령이 개시되면서 사적 자산의 인출 압박이 대폭 줄어듭니다. 연금소득세가 4.4%로 추가 인하되는 시기입니다.`,
            logs: phase2Logs,
            icon: 'sunset'
        },
        {
            title: `후기 안정 은퇴기`,
            ageSpan: `80세 이후`,
            desc: `연금소득세율이 3.3% 최저세율로 진입합니다. 안전자산 중심의 자산 보호 및 최종 상속/의료비 관리에 집중해야 합니다.`,
            logs: phase3Logs,
            icon: 'anchor'
        }
    ];
    
    phases.forEach(phase => {
        if (phase.logs.length === 0) return;
        
        // Calculate average withdrawals in this phase
        let avgTarget = 0, avgNP = 0, avgPen = 0, avgNonTax = 0, avgSev = 0, avgIsa = 0, avgHousePension = 0, avgOther = 0, avgCash = 0, avgTax = 0;
        phase.logs.forEach(l => {
            avgTarget += l.targetSpend;
            avgNP += l.withdrawals.nationalPension;
            avgPen += l.withdrawals.pension;
            avgNonTax += l.withdrawals.nonTaxedPension;
            avgSev += l.withdrawals.severance;
            avgIsa += l.withdrawals.isa;
            avgHousePension += l.withdrawals.housePension;
            avgOther += l.withdrawals.other;
            avgCash += l.withdrawals.cash;
            avgTax += l.taxPaid;
        });
        
        const count = phase.logs.length;
        avgTarget = Math.round(avgTarget / count);
        avgNP = Math.round(avgNP / count);
        avgPen = Math.round(avgPen / count);
        avgNonTax = Math.round(avgNonTax / count);
        avgSev = Math.round(avgSev / count);
        avgIsa = Math.round(avgIsa / count);
        avgHousePension = Math.round(avgHousePension / count);
        avgOther = Math.round(avgOther / count);
        avgCash = Math.round(avgCash / count);
        avgTax = Math.round(avgTax / count);
        
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';
        
        let actionsHtml = '';
        if (avgNP > 0) actionsHtml += `<li><span>국민연금 수령 (종합소득세 반영)</span> <span class="action-val">연 +${avgNP.toLocaleString()} 만원 (월 ${(avgNP/12).toFixed(0)}만원)</span></li>`;
        if (avgPen > 0) actionsHtml += `<li><span>연금저축/IRP 저율과세 인출 (5.5%~3.3%)</span> <span class="action-val">연 +${avgPen.toLocaleString()} 만원 (한도 최적화)</span></li>`;
        if (avgSev > 0) actionsHtml += `<li><span>퇴직소득세 30~40% 할인분 인출</span> <span class="action-val">연 +${avgSev.toLocaleString()} 만원</span></li>`;
        if (avgNonTax > 0) actionsHtml += `<li><span>연금계좌 내 비과세 원금 인출 (세금 0%)</span> <span class="action-val">연 +${avgNonTax.toLocaleString()} 만원</span></li>`;
        if (avgIsa > 0) actionsHtml += `<li><span>ISA 비과세/분리과세 자산 인출 (9.9%)</span> <span class="action-val">연 +${avgIsa.toLocaleString()} 만원</span></li>`;
        if (avgHousePension > 0) actionsHtml += `<li><span>주택연금 수령 (비과세)</span> <span class="action-val">연 +${avgHousePension.toLocaleString()} 만원 (월 ${(avgHousePension/12).toFixed(0)}만원)</span></li>`;
        if (avgOther > 0) actionsHtml += `<li><span>기타 자산 인출 (5% 세액 반영)</span> <span class="action-val">연 +${avgOther.toLocaleString()} 만원</span></li>`;
        if (avgCash > 0) actionsHtml += `<li><span>일반 주식/현금 계좌 인출</span> <span class="action-val">연 +${avgCash.toLocaleString()} 만원</span></li>`;
        
        timelineItem.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <span class="timeline-age">${phase.ageSpan}</span>
                    <h4 class="timeline-title" style="display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="${phase.icon}" style="width: 18px; height: 18px;"></i>
                        ${phase.title}
                    </h4>
                </div>
                <p class="timeline-desc">${phase.desc}</p>
                <ul class="timeline-actions-list">
                    <li><strong>연평균 권장 세후 인출 포트폴리오 (목표 세후 연 ${avgTarget.toLocaleString()}만원):</strong></li>
                    ${actionsHtml}
                    <li style="margin-top:8px; border-top:1px dashed var(--border-color); padding-top:6px;">
                        <span>평균 납부 세금액:</span>
                        <span class="text-danger-val">연 ${avgTax.toLocaleString()} 만원 (실효 세율 ${((avgTax / (avgTarget + avgTax)) * 100).toFixed(1)}%)</span>
                    </li>
                </ul>
            </div>
        `;
        
        timelineContainer.appendChild(timelineItem);
    });
}

// ==========================================================================
// Raw Data Table Rendering
// ==========================================================================
function renderTable() {
    const tbody = document.querySelector('#yearDataTable tbody');
    tbody.innerHTML = '';
    
    const logs = simulationData.optimal.logs;
    
    logs.forEach(log => {
        const tr = document.createElement('tr');
        
        let drawSum = log.withdrawals.pension + log.withdrawals.nonTaxedPension + log.withdrawals.severance + 
                      log.withdrawals.isa + log.withdrawals.cash + log.withdrawals.housePension + 
                      log.withdrawals.other + log.withdrawals.nationalPension;
        
        let ageLabel = `${log.age}세`;
        if (log.age === parseInt(document.getElementById('retirementAge').value)) {
            ageLabel = `<strong>${log.age}세 (은퇴)</strong>`;
        }
        
        tr.innerHTML = `
            <td>${ageLabel}</td>
            <td><strong>${log.totalAssets.toLocaleString()}</strong></td>
            <td>${(log.pension + log.irp).toLocaleString()}</td>
            <td>${log.irpSeverance.toLocaleString()}</td>
            <td>${log.isa.toLocaleString()}</td>
            <td>${log.cash.toLocaleString()}</td>
            <td>${log.house.toLocaleString()}</td>
            <td>${log.other.toLocaleString()}</td>
            <td class="text-success-val">${drawSum > 0 ? Math.round(drawSum).toLocaleString() : '-'}</td>
            <td class="${log.shortfall > 0.1 ? 'text-danger-val' : ''}">${log.shortfall > 0.1 ? Math.round(log.shortfall).toLocaleString() : '-'}</td>
            <td class="text-danger-val">${log.taxPaid > 0 ? log.taxPaid.toLocaleString() : '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ==========================================================================
// Window Load
// ==========================================================================
window.addEventListener('load', () => {
    // Initialize icons
    if (window.lucide) {
        lucide.createIcons();
    }
    
    // Run initial calculation
    calculateSimulation();
});
