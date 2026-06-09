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
    { range: 'expectedSeveranceRange', num: 'expectedSeverance' }
];

syncInputs.forEach(({ range, num }) => {
    const rangeEl = document.getElementById(range);
    const numEl = document.getElementById(num);

    if (rangeEl && numEl) {
        rangeEl.addEventListener('input', (e) => {
            numEl.value = e.target.value;
            if (range === 'currentAgeRange') {
                const retAgeEl = document.getElementById('retirementAge');
                if (parseInt(retAgeEl.value) < parseInt(e.target.value)) {
                    retAgeEl.value = e.target.value;
                }
                alignAgeBrackets();
            }
            calculateSimulation();
        });

        numEl.addEventListener('input', (e) => {
            rangeEl.value = e.target.value;
            if (num === 'currentAge') {
                const retAgeEl = document.getElementById('retirementAge');
                if (parseInt(retAgeEl.value) < parseInt(e.target.value)) {
                    retAgeEl.value = e.target.value;
                }
                alignAgeBrackets();
            }
            calculateSimulation();
        });
    }
});

// Event listeners for other inputs
const standardInputs = [
    'retirementAge', 'retirementMonth',
    'targetSpendStart1', 'targetSpendEnd1',
    'targetSpendStart2', 'targetSpendEnd2',
    'targetSpendStart3', 'targetSpendEnd3',
    'targetSpendStart4', 'targetSpendEnd4',
    'targetSpend1', 'targetSpend2', 'targetSpend3', 'targetSpend4',
    'initCash1', 'initCash2', 'initCash3',
    'initIsa', 'initPension', 'initIrp', 'initHouse',
    'initOther1', 'initOther2', 'initOther3',
    'useHousePension', 'useOtherAsset',
    'initDebt', 'debtInterest', 'repayDebtAtRetire',
    'savePension', 'saveIrp', 'saveIsa', 'saveCash',
    'returnRate', 'inflationRate', 'nationalPension', 'incomeLevel', 'adjustInflation'
];

const ageRelatedFields = [
    'retirementAge', 'retirementMonth', 
    'targetSpendStart1', 'targetSpendEnd1', 
    'targetSpendStart2', 'targetSpendEnd2', 
    'targetSpendStart3', 'targetSpendEnd3', 
    'targetSpendStart4', 'targetSpendEnd4'
];

standardInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('change', () => {
            if (id === 'retirementAge' || id === 'retirementMonth') {
                const curAge = parseInt(document.getElementById('currentAge').value) || 45;
                const retAge = parseInt(document.getElementById('retirementAge').value) || 57;
                if (retAge < curAge) {
                    document.getElementById('retirementAge').value = curAge;
                }
            }
            // Align adjacent brackets when age boundaries change (on change/blur only)
            if (ageRelatedFields.includes(id)) {
                alignAgeBrackets();
            }
            calculateSimulation();
        });
        if (el.tagName === 'INPUT') {
            // Do NOT update on input for age related fields to avoid race conditions while typing
            if (!ageRelatedFields.includes(id)) {
                el.addEventListener('input', calculateSimulation);
            }
        }
    }
});

function alignAgeBrackets() {
    const retirementAge = parseInt(document.getElementById('retirementAge').value) || 57;
    const start1El = document.getElementById('targetSpendStart1');
    const end1El = document.getElementById('targetSpendEnd1');
    const start2El = document.getElementById('targetSpendStart2');
    const end2El = document.getElementById('targetSpendEnd2');
    const start3El = document.getElementById('targetSpendStart3');
    const end3El = document.getElementById('targetSpendEnd3');
    const start4El = document.getElementById('targetSpendStart4');
    const end4El = document.getElementById('targetSpendEnd4');

    if (start1El && !isNaN(retirementAge)) start1El.value = retirementAge;
    if (end1El) {
        const val = parseInt(end1El.value) || 0;
        if (val < retirementAge) {
            end1El.value = retirementAge + 7;
        }
    }
    if (end1El && start2El && !isNaN(parseInt(end1El.value))) start2El.value = parseInt(end1El.value) + 1;
    if (end2El && start2El) {
        const s2 = parseInt(start2El.value) || 0;
        const e2 = parseInt(end2El.value) || 0;
        if (e2 < s2) {
            end2El.value = s2 + 4;
        }
    }
    if (end2El && start3El && !isNaN(parseInt(end2El.value))) start3El.value = parseInt(end2El.value) + 1;
    if (end3El && start3El) {
        const s3 = parseInt(start3El.value) || 0;
        const e3 = parseInt(end3El.value) || 0;
        if (e3 < s3) {
            end3El.value = s3 + 9;
        }
    }
    if (end3El && start4El && !isNaN(parseInt(end3El.value))) start4El.value = parseInt(end3El.value) + 1;
    if (end4El && start4El) {
        const s4 = parseInt(start4El.value) || 0;
        const e4 = parseInt(end4El.value) || 0;
        if (e4 < s4) {
            end4El.value = Math.max(95, s4 + 1);
        }
    }
}

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
    // 1. Gather Inputs with robust NaN fallbacks
    const currentAge = parseInt(document.getElementById('currentAge').value) || 45;
    const retirementAge = parseInt(document.getElementById('retirementAge').value) || 57;
    const retirementMonth = document.getElementById('retirementMonth') ? (parseInt(document.getElementById('retirementMonth').value) || 0) : 0;
    const retAge = retirementAge + retirementMonth / 12;

    // Automatically align spending bracket age boundaries to prevent overlaps/gaps
    const start1El = document.getElementById('targetSpendStart1');
    const end1El = document.getElementById('targetSpendEnd1');
    const start2El = document.getElementById('targetSpendStart2');
    const end2El = document.getElementById('targetSpendEnd2');
    const start3El = document.getElementById('targetSpendStart3');
    const end3El = document.getElementById('targetSpendEnd3');
    const start4El = document.getElementById('targetSpendStart4');
    const end4El = document.getElementById('targetSpendEnd4');



    const targetSpendStart1 = start1El ? (parseInt(start1El.value) || retirementAge) : retirementAge;
    const targetSpendEnd1 = end1El ? (parseInt(end1El.value) || (targetSpendStart1 + 7)) : (targetSpendStart1 + 7);
    const targetSpendStart2 = start2El ? (parseInt(start2El.value) || (targetSpendEnd1 + 1)) : (targetSpendEnd1 + 1);
    const targetSpendEnd2 = end2El ? (parseInt(end2El.value) || (targetSpendStart2 + 4)) : (targetSpendStart2 + 4);
    const targetSpendStart3 = start3El ? (parseInt(start3El.value) || (targetSpendEnd2 + 1)) : (targetSpendEnd2 + 1);
    const targetSpendEnd3 = end3El ? (parseInt(end3El.value) || (targetSpendStart3 + 9)) : (targetSpendStart3 + 9);
    const targetSpendStart4 = start4El ? (parseInt(start4El.value) || (targetSpendEnd3 + 1)) : (targetSpendEnd3 + 1);
    const targetSpendEnd4 = end4El ? (parseInt(end4El.value) || 95) : 95;

    const targetSpend1 = parseFloat(document.getElementById('targetSpend1').value) || 0;
    const targetSpend2 = parseFloat(document.getElementById('targetSpend2').value) || 0;
    const targetSpend3 = parseFloat(document.getElementById('targetSpend3').value) || 0;
    const targetSpend4 = parseFloat(document.getElementById('targetSpend4').value) || 0;
    
    const initCash1 = parseFloat(document.getElementById('initCash1').value) || 0;
    const initCash2 = parseFloat(document.getElementById('initCash2').value) || 0;
    const initCash3 = parseFloat(document.getElementById('initCash3').value) || 0;
    const initCash = initCash1 + initCash2 + initCash3;

    const initIsa = parseFloat(document.getElementById('initIsa').value) || 0;
    const initPension = document.getElementById('initPension') ? (parseFloat(document.getElementById('initPension').value) || 0) : 2000;
    const initIrp = document.getElementById('initIrp') ? (parseFloat(document.getElementById('initIrp').value) || 0) : 1000;
    const initHouse = parseFloat(document.getElementById('initHouse').value) || 0;
    
    const initOther1 = parseFloat(document.getElementById('initOther1').value) || 0;
    const initOther2 = parseFloat(document.getElementById('initOther2').value) || 0;
    const initOther3 = parseFloat(document.getElementById('initOther3').value) || 0;
    const initOther = initOther1 + initOther2 + initOther3;

    const useHousePension = document.getElementById('useHousePension').value;
    const useOtherAsset = document.getElementById('useOtherAsset').value;
    
    const initDebt = parseFloat(document.getElementById('initDebt').value) || 0;
    const debtInterest = parseFloat(document.getElementById('debtInterest').value) || 0;
    const repayDebtAtRetire = document.getElementById('repayDebtAtRetire').value;

    const expectedSeverance = parseFloat(document.getElementById('expectedSeverance').value) || 0;
    
    const savePension = parseFloat(document.getElementById('savePension').value) || 0;
    const saveIrp = parseFloat(document.getElementById('saveIrp').value) || 0;
    const saveIsa = parseFloat(document.getElementById('saveIsa').value) || 0;
    const saveCash = parseFloat(document.getElementById('saveCash').value) || 0;
    
    const returnRate = parseFloat(document.getElementById('returnRate').value) || 0;
    const inflationRate = parseFloat(document.getElementById('inflationRate').value) || 0;
    const nationalPension = parseFloat(document.getElementById('nationalPension').value) || 0; // Monthly (만원)
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
        let debt = initDebt;
        let houseValueAtStart = 0; // Stores house value when starting pension
        let hpRate = 0; // Housing pension rate
        
        // Tax tracking variables
        let nonTaxDeductedPension = 0; // Tracks excess contributions
        let isaContributionsTotal = initIsa; // ISA cost basis
        let taxRefundFromPreviousYear = 0;
        
        let depletionAge = null;
        let isDepleted = false;
        
        const retAgeFloor = Math.floor(retAge);
        
        // Decumulation helper
        function performDecumulation(isOpt, currentAgeVal, target, log) {
            let rem = target;
            if (isOpt) {
                // OPTIMAL DECUMULATION STRATEGY
                let pensionTaxRate = 0.055;
                if (currentAgeVal >= 70 && currentAgeVal < 80) pensionTaxRate = 0.044;
                if (currentAgeVal >= 80) pensionTaxRate = 0.033;
                
                // A. Private Pension with 15M cap
                let availableTaxedPension = pension + irp;
                let maxOptimalWithdrawalGross = 1490;
                let targetGrossFromPension = rem / (1 - pensionTaxRate);
                
                let grossPensionWithdrawal = Math.min(availableTaxedPension, maxOptimalWithdrawalGross, targetGrossFromPension);
                let netPensionWithdrawal = grossPensionWithdrawal * (1 - pensionTaxRate);
                
                if (pension >= grossPensionWithdrawal) {
                    pension -= grossPensionWithdrawal;
                } else {
                    let diff = grossPensionWithdrawal - pension;
                    pension = 0;
                    irp = Math.max(0, irp - diff);
                }
                
                rem = Math.max(0, rem - netPensionWithdrawal);
                log.withdrawals.pension += netPensionWithdrawal;
                log.taxPaid += (grossPensionWithdrawal - netPensionWithdrawal);
                
                // B. IRP Retirement Pay (퇴직금)
                if (rem > 0 && irpSeverance > 0) {
                    let severanceElapsedYears = currentAgeVal - retirementAge;
                    let discountRate = (severanceElapsedYears < 10) ? 0.3 : 0.4;
                    let baseSeveranceTaxRate = 0.08;
                    let severanceTaxRate = baseSeveranceTaxRate * (1 - discountRate);
                    
                    let targetGrossFromSeverance = rem / (1 - severanceTaxRate);
                    let grossSeveranceWithdrawal = Math.min(irpSeverance, targetGrossFromSeverance);
                    let netSeveranceWithdrawal = grossSeveranceWithdrawal * (1 - severanceTaxRate);
                    
                    irpSeverance -= grossSeveranceWithdrawal;
                    rem = Math.max(0, rem - netSeveranceWithdrawal);
                    log.withdrawals.severance += netSeveranceWithdrawal;
                    log.taxPaid += (grossSeveranceWithdrawal - netSeveranceWithdrawal);
                }
                
                // C. Non-tax-deducted Pension Principal
                if (rem > 0 && nonTaxDeductedPension > 0) {
                    let availableTotalPension = pension + irp;
                    let grossNonTaxedWithdrawal = Math.min(availableTotalPension, nonTaxDeductedPension, rem);
                    
                    nonTaxDeductedPension -= grossNonTaxedWithdrawal;
                    if (pension >= grossNonTaxedWithdrawal) {
                        pension -= grossNonTaxedWithdrawal;
                    } else {
                        let diff = grossNonTaxedWithdrawal - pension;
                        pension = 0;
                        irp = Math.max(0, irp - diff);
                    }
                    
                    rem = Math.max(0, rem - grossNonTaxedWithdrawal);
                    log.withdrawals.nonTaxedPension += grossNonTaxedWithdrawal;
                }
                
                // D. ISA Account
                if (rem > 0 && isa > 0) {
                    let profitRatio = Math.max(0, (isa - isaContributionsTotal) / isa);
                    let isaEffTaxRate = profitRatio * 0.099;
                    
                    let targetGrossFromIsa = rem / (1 - isaEffTaxRate);
                    let grossIsaWithdrawal = Math.min(isa, targetGrossFromIsa);
                    let netIsaWithdrawal = grossIsaWithdrawal * (1 - isaEffTaxRate);
                    
                    let reducedPrincipal = grossIsaWithdrawal * (1 - profitRatio);
                    isaContributionsTotal = Math.max(0, isaContributionsTotal - reducedPrincipal);
                    
                    isa -= grossIsaWithdrawal;
                    rem = Math.max(0, rem - netIsaWithdrawal);
                    log.withdrawals.isa += netIsaWithdrawal;
                    log.taxPaid += (grossIsaWithdrawal - netIsaWithdrawal);
                }
                
                // D2. Other Assets
                if (useOtherAsset === 'yes' && rem > 0 && other > 0) {
                    let targetGrossFromOther = rem / 0.95;
                    let grossOtherWithdrawal = Math.min(other, targetGrossFromOther);
                    let netOtherWithdrawal = grossOtherWithdrawal * 0.95;
                    
                    other -= grossOtherWithdrawal;
                    rem = Math.max(0, rem - netOtherWithdrawal);
                    log.withdrawals.other += netOtherWithdrawal;
                    log.taxPaid += (grossOtherWithdrawal - netOtherWithdrawal);
                }
                
                // E. General Cash/Brokerage
                if (rem > 0 && cash > 0) {
                    let targetGrossFromCash = rem / 0.95;
                    let grossCashWithdrawal = Math.min(cash, targetGrossFromCash);
                    let netCashWithdrawal = grossCashWithdrawal * 0.95;
                    
                    cash -= grossCashWithdrawal;
                    rem = Math.max(0, rem - netCashWithdrawal);
                    log.withdrawals.cash += netCashWithdrawal;
                    log.taxPaid += (grossCashWithdrawal - netCashWithdrawal);
                }
            } else {
                // NAIVE DECUMULATION STRATEGY
                let availableTaxedPension = pension + irp;
                if (availableTaxedPension > 0 && rem > 0) {
                    let pensionTaxRate = 0.055;
                    if (currentAgeVal >= 70 && currentAgeVal < 80) pensionTaxRate = 0.044;
                    if (currentAgeVal >= 80) pensionTaxRate = 0.033;
                    
                    let targetGross = rem / (1 - pensionTaxRate);
                    let finalPensionTaxRate = pensionTaxRate;
                    
                    if (targetGross > 1500 || (availableTaxedPension > 1500 && rem > 1500 * (1 - pensionTaxRate))) {
                        finalPensionTaxRate = 0.165;
                        targetGross = rem / (1 - finalPensionTaxRate);
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
                    
                    rem = Math.max(0, rem - netPensionWithdrawal);
                    log.withdrawals.pension += netPensionWithdrawal;
                    log.taxPaid += (grossPensionWithdrawal - netPensionWithdrawal);
                }
                
                // Retirement pay
                if (rem > 0 && irpSeverance > 0) {
                    let severanceTaxRate = 0.08 * 0.7;
                    let targetGrossFromSeverance = rem / (1 - severanceTaxRate);
                    let grossSeveranceWithdrawal = Math.min(irpSeverance, targetGrossFromSeverance);
                    let netSeveranceWithdrawal = grossSeveranceWithdrawal * (1 - severanceTaxRate);
                    
                    irpSeverance -= grossSeveranceWithdrawal;
                    rem = Math.max(0, rem - netSeveranceWithdrawal);
                    log.withdrawals.severance += netSeveranceWithdrawal;
                    log.taxPaid += (grossSeveranceWithdrawal - netSeveranceWithdrawal);
                }
                
                // Non-taxed pension
                if (rem > 0 && nonTaxDeductedPension > 0) {
                    let availableTotalPension = pension + irp;
                    let grossNonTaxedWithdrawal = Math.min(availableTotalPension, nonTaxDeductedPension, rem);
                    
                    nonTaxDeductedPension -= grossNonTaxedWithdrawal;
                    if (pension >= grossNonTaxedWithdrawal) {
                        pension -= grossNonTaxedWithdrawal;
                    } else {
                        let diff = grossNonTaxedWithdrawal - pension;
                        pension = 0;
                        irp = Math.max(0, irp - diff);
                    }
                    
                    rem = Math.max(0, rem - grossNonTaxedWithdrawal);
                    log.withdrawals.nonTaxedPension += grossNonTaxedWithdrawal;
                }
                
                // ISA
                if (rem > 0 && isa > 0) {
                    let profitRatio = Math.max(0, (isa - isaContributionsTotal) / isa);
                    let isaEffTaxRate = profitRatio * 0.099;
                    let targetGrossFromIsa = rem / (1 - isaEffTaxRate);
                    let grossIsaWithdrawal = Math.min(isa, targetGrossFromIsa);
                    let netIsaWithdrawal = grossIsaWithdrawal * (1 - isaEffTaxRate);
                    
                    let reducedPrincipal = grossIsaWithdrawal * (1 - profitRatio);
                    isaContributionsTotal = Math.max(0, isaContributionsTotal - reducedPrincipal);
                    
                    isa -= grossIsaWithdrawal;
                    rem = Math.max(0, rem - netIsaWithdrawal);
                    log.withdrawals.isa += netIsaWithdrawal;
                    log.taxPaid += (grossIsaWithdrawal - netIsaWithdrawal);
                }
                
                // Other assets
                if (useOtherAsset === 'yes' && rem > 0 && other > 0) {
                    let targetGrossFromOther = rem / 0.95;
                    let grossOtherWithdrawal = Math.min(other, targetGrossFromOther);
                    let netOtherWithdrawal = grossOtherWithdrawal * 0.95;
                    
                    other -= grossOtherWithdrawal;
                    rem = Math.max(0, rem - netOtherWithdrawal);
                    log.withdrawals.other += netOtherWithdrawal;
                    log.taxPaid += (grossOtherWithdrawal - netOtherWithdrawal);
                }
                
                // Cash
                if (rem > 0 && cash > 0) {
                    let targetGrossFromCash = rem / 0.95;
                    let grossCashWithdrawal = Math.min(cash, targetGrossFromCash);
                    let netCashWithdrawal = grossCashWithdrawal * 0.95;
                    
                    cash -= grossCashWithdrawal;
                    rem = Math.max(0, rem - netCashWithdrawal);
                    log.withdrawals.cash += netCashWithdrawal;
                    log.taxPaid += (grossCashWithdrawal - netCashWithdrawal);
                }
            }
            return rem;
        }
        
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
                debt: 0,
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

            // Determine age bracket monthly target spend using range boundaries
            let monthlySpend = 0;
            if (age >= targetSpendStart1 && age <= targetSpendEnd1) monthlySpend = targetSpend1;
            else if (age >= targetSpendStart2 && age <= targetSpendEnd2) monthlySpend = targetSpend2;
            else if (age >= targetSpendStart3 && age <= targetSpendEnd3) monthlySpend = targetSpend3;
            else if (age >= targetSpendStart4 && age <= targetSpendEnd4) monthlySpend = targetSpend4;
            else monthlySpend = targetSpend4;
            
            // ACCUMULATION PHASE
            if (age < retAgeFloor) {
                // 1. Calculate Tax Credit Refund from previous year
                let creditEligiblePension = Math.min(600, savePension);
                let creditEligibleIrp = Math.min(900 - creditEligiblePension, saveIrp);
                let standardCredit = (creditEligiblePension + creditEligibleIrp) * creditRate;
                
                log.taxRefund = taxRefundFromPreviousYear;
                
                // Add contributions at start of year
                pension += savePension;
                irp += saveIrp;
                
                // Record excess contributions as non-tax-deducted
                let totalPensionContributed = savePension + saveIrp;
                let eligibleCreditTotal = creditEligiblePension + creditEligibleIrp;
                if (totalPensionContributed > eligibleCreditTotal) {
                    nonTaxDeductedPension += (totalPensionContributed - eligibleCreditTotal);
                }
                
                // ISA contribution
                let actualSaveIsa = saveIsa;
                if (isaContributionsTotal + saveIsa > 10000) {
                    actualSaveIsa = Math.max(0, 10000 - isaContributionsTotal);
                }
                isa += actualSaveIsa;
                isaContributionsTotal += actualSaveIsa;
                
                // Cash receives standard savings + refund + overflow
                let isaOverflow = saveIsa - actualSaveIsa;
                cash += saveCash + taxRefundFromPreviousYear + isaOverflow;
                
                // Setup next year's refund
                taxRefundFromPreviousYear = standardCredit;
                
                // ISA 3-year rollover strategy (OPTIMAL ONLY)
                const yearsElapsed = age - currentAge;
                if (isOptimal && yearsElapsed > 0 && yearsElapsed % 3 === 0 && isa > 0) {
                    let isaProfit = Math.max(0, isa - isaContributionsTotal);
                    let isaTax = Math.max(0, isaProfit - isaTaxFreeLimit) * 0.099;
                    let maturedIsaNet = isa - isaTax;
                    
                    const transferAmount = Math.min(3000, maturedIsaNet);
                    irp += transferAmount;
                    
                    let extraDeduction = transferAmount * 0.1;
                    let extraRefund = extraDeduction * creditRate;
                    
                    nonTaxDeductedPension += (transferAmount - extraDeduction);
                    
                    isa = maturedIsaNet - transferAmount;
                    isaContributionsTotal = isa;
                    
                    taxRefundFromPreviousYear += extraRefund;
                    log.taxPaid += isaTax;
                }
                
                // Compound debt
                debt *= (1 + debtInterest / 100);
                
                // Apply return at the end of the year
                pension *= (1 + returnRate/100);
                irp *= (1 + returnRate/100);
                isa *= (1 + returnRate/100);
                house *= (1 + inflationRate/100);
                other *= (1 + returnRate/100);
                
                let cashNetReturn = returnRate - (2.0 * 0.154);
                cash *= (1 + Math.max(0, cashNetReturn)/100);
                
            } 
            // TRANSITION YEAR (age === retAgeFloor)
            else if (age === retAgeFloor) {
                const f_acc = retirementMonth / 12;
                const f_dec = 1 - f_acc;

                // 1. Accumulation Fraction
                if (f_acc > 0) {
                    let creditEligiblePension = Math.min(600, savePension * f_acc);
                    let creditEligibleIrp = Math.min(900 * f_acc - creditEligiblePension, saveIrp * f_acc);
                    let standardCredit = (creditEligiblePension + creditEligibleIrp) * creditRate;

                    log.taxRefund = taxRefundFromPreviousYear;

                    pension += savePension * f_acc;
                    irp += saveIrp * f_acc;

                    let totalPensionContributed = (savePension + saveIrp) * f_acc;
                    let eligibleCreditTotal = creditEligiblePension + creditEligibleIrp;
                    if (totalPensionContributed > eligibleCreditTotal) {
                        nonTaxDeductedPension += (totalPensionContributed - eligibleCreditTotal);
                    }

                    let actualSaveIsa = saveIsa * f_acc;
                    if (isaContributionsTotal + actualSaveIsa > 10000) {
                        actualSaveIsa = Math.max(0, 10000 - isaContributionsTotal);
                    }
                    isa += actualSaveIsa;
                    isaContributionsTotal += actualSaveIsa;

                    let isaOverflow = (saveIsa * f_acc) - actualSaveIsa;
                    cash += (saveCash * f_acc) + taxRefundFromPreviousYear + isaOverflow;

                    // Debt compounds for the accumulation portion
                    debt *= (1 + (debtInterest / 100) * f_acc);
                } else {
                    log.taxRefund = taxRefundFromPreviousYear;
                    cash += taxRefundFromPreviousYear;
                }

                // 2. Mid-year Retirement Event
                irpSeverance = expectedSeverance;

                if (repayDebtAtRetire === 'yes' && debt > 0) {
                    if (cash >= debt) {
                        cash -= debt;
                        debt = 0;
                    } else {
                        debt -= cash;
                        cash = 0;
                    }
                }

                // 3. Decumulation Fraction
                let targetAnnualNet = monthlySpend * 12 * f_dec;
                // Add debt interest for retired fraction
                targetAnnualNet += debt * (debtInterest / 100) * f_dec;

                log.targetSpend = targetAnnualNet;
                let remainingTarget = targetAnnualNet;

                // National Pension (scaled)
                let npInflationFactor = 1.0;
                if (age >= 65 && f_dec > 0) {
                    let grossNP = nationalPension * 12 * f_dec * npInflationFactor;
                    let npTax = calcNationalPensionTax(grossNP);
                    let netNP = grossNP - npTax;
                    
                    log.withdrawals.nationalPension = netNP;
                    remainingTarget = Math.max(0, remainingTarget - netNP);
                    log.taxPaid += npTax;
                }

                // Housing Pension (scaled)
                if (useHousePension === 'yes' && age >= 55 && house > 0 && f_dec > 0) {
                    let startAge = Math.max(55, retirementAge);
                    if (houseValueAtStart === 0) {
                        houseValueAtStart = initHouse * Math.pow(1 + inflationRate/100, startAge - currentAge);
                        hpRate = 0.0017 + (startAge - 55) * 0.00009;
                        hpRate = Math.min(0.004, hpRate);
                    }
                    let maxPensionVal = houseValueAtStart * hpRate * 12 * f_dec;
                    let annualHousePension = Math.min(house, maxPensionVal);
                    house = Math.max(0, house - annualHousePension);
                    
                    log.withdrawals.housePension = annualHousePension;
                    remainingTarget = Math.max(0, remainingTarget - annualHousePension);
                }

                // Withdraw from private assets
                if (remainingTarget > 0) {
                    remainingTarget = performDecumulation(isOptimal, age, remainingTarget, log);
                }

                log.shortfall = remainingTarget;
                if (remainingTarget > 0.01 && !isDepleted) {
                    isDepleted = true;
                    depletionAge = age;
                }

                // Compound assets at the end of the year
                pension *= (1 + returnRate/100);
                irp *= (1 + returnRate/100);
                irpSeverance *= (1 + returnRate/100);
                isa *= (1 + returnRate/100);
                house *= (1 + inflationRate/100);
                other *= (1 + returnRate/100);
                
                let cashNetReturn = returnRate - (2.0 * 0.154);
                cash *= (1 + Math.max(0, cashNetReturn)/100);
            }
            // DECUMULATION PHASE (age > retAgeFloor)
            else {
                // Calculate target net spending for this year (inflation-adjusted optionally)
                let inflationFactor = (adjustInflation === 'yes') ? Math.pow(1 + inflationRate/100, age - retAge) : 1;
                let targetAnnualNet = monthlySpend * 12 * inflationFactor;
                // Add debt interest
                targetAnnualNet += debt * (debtInterest / 100);
                
                log.targetSpend = targetAnnualNet;
                let remainingTarget = targetAnnualNet;
                
                // 1. National Pension
                let npInflationFactor = Math.pow(1 + inflationRate/100, age - retAge);
                if (age >= 65) {
                    let grossNP = nationalPension * 12 * npInflationFactor;
                    let npTax = calcNationalPensionTax(grossNP);
                    let netNP = grossNP - npTax;
                    
                    log.withdrawals.nationalPension = netNP;
                    remainingTarget = Math.max(0, remainingTarget - netNP);
                    log.taxPaid += npTax;
                }
                
                // 1.5. Housing Pension
                if (useHousePension === 'yes' && age >= 55 && house > 0) {
                    let startAge = Math.max(55, retirementAge);
                    if (houseValueAtStart === 0) {
                        houseValueAtStart = initHouse * Math.pow(1 + inflationRate/100, startAge - currentAge);
                        hpRate = 0.0017 + (startAge - 55) * 0.00009;
                        hpRate = Math.min(0.004, hpRate);
                    }
                    let maxPensionVal = houseValueAtStart * hpRate * 12;
                    let annualHousePension = Math.min(house, maxPensionVal);
                    house = Math.max(0, house - annualHousePension);
                    
                    log.withdrawals.housePension = annualHousePension;
                    remainingTarget = Math.max(0, remainingTarget - annualHousePension);
                }
                
                // 2. Withdraw from private assets to satisfy remaining target
                if (remainingTarget > 0) {
                    remainingTarget = performDecumulation(isOptimal, age, remainingTarget, log);
                }
                
                log.shortfall = remainingTarget;
                if (remainingTarget > 0.01 && !isDepleted) {
                    isDepleted = true;
                    depletionAge = age;
                }
                
                // Compound assets
                pension *= (1 + returnRate/100);
                irp *= (1 + returnRate/100);
                irpSeverance *= (1 + returnRate/100);
                isa *= (1 + returnRate/100);
                house *= (1 + inflationRate/100);
                other *= (1 + returnRate/100);
                
                let cashNetReturn = returnRate - (2.0 * 0.154);
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
            log.debt = Math.max(0, Math.round(debt));
            
            // totalAssets is net of debt
            log.totalAssets = log.cash + log.isa + log.pension + log.irp + log.irpSeverance + log.house + log.other - log.debt;
            log.taxPaid = Math.round(log.taxPaid);
            
            logs.push(log);
            age++;
        }
        
        return {
            logs: logs,
            depletionAge: depletionAge || 99,
            isDepleted: isDepleted
        };

        // Helper function relocated above
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
    
    // 5. Update print-only summary
    updatePrintSummary();
    
    // Refresh icons so new dynamic roadmap icons are rendered
    if (window.lucide) {
        lucide.createIcons();
    }
}

function updatePrintSummary() {
    const grid = document.querySelector('#printInputsSummary .print-inputs-grid');
    if (!grid) return;
    
    const currentAge = document.getElementById('currentAge').value;
    const retirementAge = document.getElementById('retirementAge').value;
    const retirementMonth = document.getElementById('retirementMonth') ? document.getElementById('retirementMonth').value : 0;
    
    const targetSpendStart1 = document.getElementById('targetSpendStart1').value;
    const targetSpendEnd1 = document.getElementById('targetSpendEnd1').value;
    const targetSpendStart2 = document.getElementById('targetSpendStart2').value;
    const targetSpendEnd2 = document.getElementById('targetSpendEnd2').value;
    const targetSpendStart3 = document.getElementById('targetSpendStart3').value;
    const targetSpendEnd3 = document.getElementById('targetSpendEnd3').value;
    const targetSpendStart4 = document.getElementById('targetSpendStart4').value;
    const targetSpendEnd4 = document.getElementById('targetSpendEnd4').value;
    
    const targetSpend1 = document.getElementById('targetSpend1').value;
    const targetSpend2 = document.getElementById('targetSpend2').value;
    const targetSpend3 = document.getElementById('targetSpend3').value;
    const targetSpend4 = document.getElementById('targetSpend4').value;
    
    const initCash1 = document.getElementById('initCash1').value;
    const initCash2 = document.getElementById('initCash2').value;
    const initCash3 = document.getElementById('initCash3').value;
    const initIsa = document.getElementById('initIsa').value;
    const initPension = document.getElementById('initPension') ? document.getElementById('initPension').value : 0;
    const initIrp = document.getElementById('initIrp') ? document.getElementById('initIrp').value : 0;
    const initHouse = document.getElementById('initHouse').value;
    const initOther1 = document.getElementById('initOther1').value;
    const initOther2 = document.getElementById('initOther2').value;
    const initOther3 = document.getElementById('initOther3').value;
    
    const useHousePension = document.getElementById('useHousePension').value === 'yes' ? '신청' : '미신청';
    const useOtherAsset = document.getElementById('useOtherAsset').value === 'yes' ? '사용' : '미사용';
    
    const initDebt = document.getElementById('initDebt').value;
    const debtInterest = document.getElementById('debtInterest').value;
    const repayDebtAtRetire = document.getElementById('repayDebtAtRetire').value === 'yes' ? '즉시 상환' : '이자만 납입';
    const expectedSeverance = document.getElementById('expectedSeverance').value;
    
    const savePension = document.getElementById('savePension').value;
    const saveIrp = document.getElementById('saveIrp').value;
    const saveIsa = document.getElementById('saveIsa').value;
    const saveCash = document.getElementById('saveCash').value;
    
    const returnRate = document.getElementById('returnRate').value;
    const inflationRate = document.getElementById('inflationRate').value;
    const nationalPension = document.getElementById('nationalPension').value;
    const incomeLevel = document.getElementById('incomeLevel').value === 'low' ? '5,500만원 이하 (16.5%)' : '5,500만원 초과 (13.2%)';
    const adjustInflation = document.getElementById('adjustInflation').value === 'yes' ? '물가상승 반영' : '물가상승 미반영';

    grid.innerHTML = `
        <div class="print-input-group"><span class="print-input-label">현재 나이 / 은퇴 나이</span><span class="print-input-value">${currentAge}세 / ${retirementAge}세 ${retirementMonth}개월</span></div>
        <div class="print-input-group"><span class="print-input-label">기대 수익률 / 물가 상승률</span><span class="print-input-value">${returnRate}% / ${inflationRate}%</span></div>
        
        <div class="print-input-group"><span class="print-input-label">월 희망 생활비 (구간 1)</span><span class="print-input-value">${parseFloat(targetSpend1).toLocaleString()}만원 (${targetSpendStart1}세 ~ ${targetSpendEnd1}세)</span></div>
        <div class="print-input-group"><span class="print-input-label">월 희망 생활비 (구간 2)</span><span class="print-input-value">${parseFloat(targetSpend2).toLocaleString()}만원 (${targetSpendStart2}세 ~ ${targetSpendEnd2}세)</span></div>
        <div class="print-input-group"><span class="print-input-label">월 희망 생활비 (구간 3)</span><span class="print-input-value">${parseFloat(targetSpend3).toLocaleString()}만원 (${targetSpendStart3}세 ~ ${targetSpendEnd3}세)</span></div>
        <div class="print-input-group"><span class="print-input-label">월 희망 생활비 (구간 4)</span><span class="print-input-value">${parseFloat(targetSpend4).toLocaleString()}만원 (${targetSpendStart4}세 ~ ${targetSpendEnd4}세)</span></div>
        
        <div class="print-input-group"><span class="print-input-label">예적금/주식 (1 / 2 / 3)</span><span class="print-input-value">${parseFloat(initCash1).toLocaleString()} / ${parseFloat(initCash2).toLocaleString()} / ${parseFloat(initCash3).toLocaleString()} 만원</span></div>
        <div class="print-input-group"><span class="print-input-label">ISA / 연금저축 / IRP</span><span class="print-input-value">${parseFloat(initIsa).toLocaleString()} / ${parseFloat(initPension).toLocaleString()} / ${parseFloat(initIrp).toLocaleString()} 만원</span></div>
        
        <div class="print-input-group"><span class="print-input-label">주택 자산 / 주택연금 활용</span><span class="print-input-value">${parseFloat(initHouse).toLocaleString()} 만원 / ${useHousePension}</span></div>
        <div class="print-input-group"><span class="print-input-label">기타 자산 (1 / 2 / 3)</span><span class="print-input-value">${parseFloat(initOther1).toLocaleString()} / ${parseFloat(initOther2).toLocaleString()} / ${parseFloat(initOther3).toLocaleString()} 만원</span></div>
        
        <div class="print-input-group"><span class="print-input-label">기타자산 생활비 활용 여부</span><span class="print-input-value">${useOtherAsset}</span></div>
        <div class="print-input-group"><span class="print-input-label">국민연금 예상 수령액</span><span class="print-input-value">${parseFloat(nationalPension).toLocaleString()} 만원/월</span></div>
        
        <div class="print-input-group"><span class="print-input-label">현재 부채 / 금리 / 상환 여부</span><span class="print-input-value">${parseFloat(initDebt).toLocaleString()} 만원 / ${debtInterest}% / ${repayDebtAtRetire}</span></div>
        <div class="print-input-group"><span class="print-input-label">예상 퇴직금 (세전)</span><span class="print-input-value">${parseFloat(expectedSeverance).toLocaleString()} 만원</span></div>
        
        <div class="print-input-group"><span class="print-input-label">연간 추가 저축 (연금 / IRP)</span><span class="print-input-value">${parseFloat(savePension).toLocaleString()} / ${parseFloat(saveIrp).toLocaleString()} 만원</span></div>
        <div class="print-input-group"><span class="print-input-label">연간 추가 저축 (ISA / 일반)</span><span class="print-input-value">${parseFloat(saveIsa).toLocaleString()} / ${parseFloat(saveCash).toLocaleString()} 만원</span></div>
        
        <div class="print-input-group"><span class="print-input-label">소득 기준 (세액공제율)</span><span class="print-input-value">${incomeLevel}</span></div>
        <div class="print-input-group"><span class="print-input-label">생활비 물가 반영 여부</span><span class="print-input-value">${adjustInflation}</span></div>
    `;
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
    const targetSpendEnd1 = document.getElementById('targetSpendEnd1') ? parseInt(document.getElementById('targetSpendEnd1').value) : 64;
    const targetSpendStart2 = targetSpendEnd1 + 1;
    const targetSpendEnd3 = document.getElementById('targetSpendEnd3') ? parseInt(document.getElementById('targetSpendEnd3').value) : 79;
    const targetSpendStart4 = targetSpendEnd3 + 1;
    const logs = simulationData.optimal.logs;
    
    // Group timeline into phases based on user-defined age boundaries
    const phase1Logs = logs.filter(l => l.age >= retirementAge && l.age <= targetSpendEnd1);
    const phase2Logs = logs.filter(l => l.age >= targetSpendStart2 && l.age <= targetSpendEnd3);
    const phase3Logs = logs.filter(l => l.age >= targetSpendStart4);
    
    const phases = [
        {
            title: `소득 공백기 (브릿지 기간)`,
            ageSpan: (targetSpendEnd1 > retirementAge) ? `${retirementAge}세 ~ ${targetSpendEnd1}세` : `${retirementAge}세`,
            desc: `국민연금을 아직 받지 못해 사적연금, 퇴직금, ISA 위주로 생활비를 마련해야 하는 가장 중요한 시기입니다. 1,500만원 저율과세 한도를 엄격하게 통제합니다.`,
            logs: phase1Logs,
            icon: 'navigation'
        },
        {
            title: `국민연금 개시 및 중기 은퇴기`,
            ageSpan: (targetSpendEnd3 > targetSpendStart2) ? `${targetSpendStart2}세 ~ ${targetSpendEnd3}세` : `${targetSpendStart2}세`,
            desc: `국민연금 수령이 개시되면서 사적 자산의 인출 압박이 대폭 줄어듭니다. 연금소득세가 저율과세로 추가 인하되는 시기입니다.`,
            logs: phase2Logs,
            icon: 'sunset'
        },
        {
            title: `후기 안정 은퇴기`,
            ageSpan: `${targetSpendStart4}세 이후`,
            desc: `연금소득세율이 최저세율로 진입합니다. 안전자산 중심의 자산 보호 및 최종 상속/의료비 관리에 집중해야 합니다.`,
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
        const retirementMonth = document.getElementById('retirementMonth') ? parseInt(document.getElementById('retirementMonth').value) : 0;
        if (log.age === parseInt(document.getElementById('retirementAge').value)) {
            if (retirementMonth > 0) {
                ageLabel = `<strong>${log.age}세 ${retirementMonth}개월 (은퇴)</strong>`;
            } else {
                ageLabel = `<strong>${log.age}세 (은퇴)</strong>`;
            }
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
// Excel (CSV) Download Functionality
// ==========================================================================
function downloadExcel() {
    if (!simulationData || !simulationData.optimal) return;
    const logs = simulationData.optimal.logs;
    
    // Read input values for Excel report header
    const currentAge = parseInt(document.getElementById('currentAge').value) || 45;
    const retirementAge = parseInt(document.getElementById('retirementAge').value) || 57;
    const retirementMonth = document.getElementById('retirementMonth') ? (parseInt(document.getElementById('retirementMonth').value) || 0) : 0;
    
    const targetSpendStart1 = parseInt(document.getElementById('targetSpendStart1').value) || retirementAge;
    const targetSpendEnd1 = parseInt(document.getElementById('targetSpendEnd1').value) || (targetSpendStart1 + 7);
    const targetSpendStart2 = parseInt(document.getElementById('targetSpendStart2').value) || (targetSpendEnd1 + 1);
    const targetSpendEnd2 = parseInt(document.getElementById('targetSpendEnd2').value) || (targetSpendStart2 + 4);
    const targetSpendStart3 = parseInt(document.getElementById('targetSpendStart3').value) || (targetSpendEnd2 + 1);
    const targetSpendEnd3 = parseInt(document.getElementById('targetSpendEnd3').value) || (targetSpendStart3 + 9);
    const targetSpendStart4 = parseInt(document.getElementById('targetSpendStart4').value) || (targetSpendEnd3 + 1);
    const targetSpendEnd4 = parseInt(document.getElementById('targetSpendEnd4').value) || 95;

    const targetSpend1 = parseFloat(document.getElementById('targetSpend1').value) || 0;
    const targetSpend2 = parseFloat(document.getElementById('targetSpend2').value) || 0;
    const targetSpend3 = parseFloat(document.getElementById('targetSpend3').value) || 0;
    const targetSpend4 = parseFloat(document.getElementById('targetSpend4').value) || 0;
    
    const initCash1 = parseFloat(document.getElementById('initCash1').value) || 0;
    const initCash2 = parseFloat(document.getElementById('initCash2').value) || 0;
    const initCash3 = parseFloat(document.getElementById('initCash3').value) || 0;
    const initIsa = parseFloat(document.getElementById('initIsa').value) || 0;
    const initPension = document.getElementById('initPension') ? (parseFloat(document.getElementById('initPension').value) || 0) : 0;
    const initIrp = document.getElementById('initIrp') ? (parseFloat(document.getElementById('initIrp').value) || 0) : 0;
    const initHouse = parseFloat(document.getElementById('initHouse').value) || 0;
    const initOther1 = parseFloat(document.getElementById('initOther1').value) || 0;
    const initOther2 = parseFloat(document.getElementById('initOther2').value) || 0;
    const initOther3 = parseFloat(document.getElementById('initOther3').value) || 0;
    
    const useHousePension = document.getElementById('useHousePension').value === 'yes' ? '주택연금 신청' : '주택연금 미신청';
    const useOtherAsset = document.getElementById('useOtherAsset').value === 'yes' ? '생활비로 사용' : '생활비로 미사용';
    
    const initDebt = parseFloat(document.getElementById('initDebt').value) || 0;
    const debtInterest = parseFloat(document.getElementById('debtInterest').value) || 0;
    const repayDebtAtRetire = document.getElementById('repayDebtAtRetire').value === 'yes' ? '은퇴 시 즉시 상환' : '은퇴 이후 이자만 납입';
    
    const expectedSeverance = parseFloat(document.getElementById('expectedSeverance').value) || 0;
    
    const savePension = parseFloat(document.getElementById('savePension').value) || 0;
    const saveIrp = parseFloat(document.getElementById('saveIrp').value) || 0;
    const saveIsa = parseFloat(document.getElementById('saveIsa').value) || 0;
    const saveCash = parseFloat(document.getElementById('saveCash').value) || 0;
    
    const returnRate = parseFloat(document.getElementById('returnRate').value) || 0;
    const inflationRate = parseFloat(document.getElementById('inflationRate').value) || 0;
    const nationalPension = parseFloat(document.getElementById('nationalPension').value) || 0;
    const incomeLevel = document.getElementById('incomeLevel').value === 'low' ? '5500만원 이하 (16.5%)' : '5500만원 초과 (13.2%)';
    const adjustInflation = document.getElementById('adjustInflation').value === 'yes' ? '물가상승 반영' : '물가상승 미반영';

    const kpis = simulationData.kpis;
    const depletionOptimalText = kpis.depletionAgeOptimal >= 99 ? '100세 이상' : kpis.depletionAgeOptimal + '세';
    const depletionNaiveText = kpis.depletionAgeNaive >= 99 ? '100세 이상' : kpis.depletionAgeNaive + '세';
    
    let csvContent = "\uFEFF"; // UTF-8 BOM to prevent Korean character corruption in Excel
    
    // 1. Simulation Inputs Header
    csvContent += "=== 시뮬레이션 입력 조건 ===\n";
    csvContent += "구분,항목,입력값,단위\n";
    csvContent += `기본 정보,현재 나이,${currentAge},세\n`;
    csvContent += `기본 정보,은퇴 나이,${retirementAge}세 ${retirementMonth}개월,\n`;
    csvContent += `생활비 설정,구간 1 (${targetSpendStart1}세 ~ ${targetSpendEnd1}세),${targetSpend1},만원/월\n`;
    csvContent += `생활비 설정,구간 2 (${targetSpendStart2}세 ~ ${targetSpendEnd2}세),${targetSpend2},만원/월\n`;
    csvContent += `생활비 설정,구간 3 (${targetSpendStart3}세 ~ ${targetSpendEnd3}세),${targetSpend3},만원/월\n`;
    csvContent += `생활비 설정,구간 4 (${targetSpendStart4}세 ~ ${targetSpendEnd4}세),${targetSpend4},만원/월\n`;
    
    csvContent += `보유 자산,예적금/주식 1,${initCash1},만원\n`;
    csvContent += `보유 자산,예적금/주식 2,${initCash2},만원\n`;
    csvContent += `보유 자산,예적금/주식 3,${initCash3},만원\n`;
    csvContent += `보유 자산,ISA 계좌,${initIsa},만원\n`;
    csvContent += `보유 자산,연금저축,${initPension},만원\n`;
    csvContent += `보유 자산,IRP 계좌,${initIrp},만원\n`;
    csvContent += `보유 자산,주택 자산,${initHouse},만원\n`;
    csvContent += `보유 자산,기타 자산 1,${initOther1},만원\n`;
    csvContent += `보유 자산,기타 자산 2,${initOther2},만원\n`;
    csvContent += `보유 자산,기타 자산 3,${initOther3},만원\n`;
    csvContent += `보유 자산,주택연금 활용 여부,${useHousePension},\n`;
    csvContent += `보유 자산,기타자산 생활비 활용 여부,${useOtherAsset},\n`;
    
    csvContent += `부채 및 퇴직금,현재 부채 총액,${initDebt},만원\n`;
    csvContent += `부채 및 퇴직금,부채 연 이자율,${debtInterest},%\n`;
    csvContent += `부채 및 퇴직금,은퇴 시 부채 상환 여부,${repayDebtAtRetire},\n`;
    csvContent += `부채 및 퇴직금,예상 퇴직금 (세전),${expectedSeverance},만원\n`;
    
    csvContent += `매년 추가 저축액,연금저축 납입액,${savePension},만원/년\n`;
    csvContent += `매년 추가 저축액,IRP 납입액,${saveIrp},만원/년\n`;
    csvContent += `매년 추가 저축액,ISA 납입액,${saveIsa},만원/년\n`;
    csvContent += `매년 추가 저축액,일반 투자 저축액,${saveCash},만원/년\n`;
    
    csvContent += `수익률 및 세무 가정,기대 투자 수익률,${returnRate},% (연)\n`;
    csvContent += `수익률 및 세무 가정,예상 물가 상승률,${inflationRate},% (연)\n`;
    csvContent += `수익률 및 세무 가정,국민연금 예상 수령액,${nationalPension},만원/월\n`;
    csvContent += `수익률 및 세무 가정,소득 기준 세액공제율,${incomeLevel},\n`;
    csvContent += `수익률 및 세무 가정,인플레이션 반영 여부,${adjustInflation},\n`;
    csvContent += "\n";
    
    // 2. Simulation Results (KPIs)
    csvContent += "=== 시뮬레이션 분석 결과 (요약) ===\n";
    csvContent += "지표 항목,최적화 절세 전략 (최적),일반 인출 방식 (Naive),차이 및 효과\n";
    
    let lifeDiff = "";
    if (kpis.depletionAgeOptimal >= 99 && kpis.depletionAgeNaive >= 99) {
        lifeDiff = "둘 다 100세 이상 안정";
    } else {
        lifeDiff = `${kpis.depletionAgeOptimal - kpis.depletionAgeNaive}년 수명 연장`;
    }
    csvContent += `자산 고갈 예상 나이,${depletionOptimalText},${depletionNaiveText},${lifeDiff}\n`;
    csvContent += `예상 절세 혜택 총액,${formatKoreanCurrency(kpis.totalSavedTax)},-,일반 인출 대비 아낀 세금\n`;
    csvContent += `평균 실효 세율 (수령기),${kpis.effectiveTaxRate.toFixed(1)}%,15.40%,일반 대비 약 ${Math.round((1 - (kpis.effectiveTaxRate / 15.4)) * 100)}% 세금 감면 효과\n`;
    csvContent += "\n";
    
    // 3. Simulation Raw Data Table
    csvContent += "=== 연도별 상세 시뮬레이션 데이터 (최적화 절세 전략 적용) ===\n";
    csvContent += "나이,총 자산(만원),연금저축/IRP(만원),퇴직금(IRP)(만원),ISA(만원),일반 계좌(만원),주택 자산(만원),기타 자산(만원),부채 잔액(만원),수령액 합계(만원),부족 금액(만원),세금 납부액(만원)\n";
    
    logs.forEach(log => {
        let drawSum = log.withdrawals.pension + log.withdrawals.nonTaxedPension + log.withdrawals.severance + 
                      log.withdrawals.isa + log.withdrawals.cash + log.withdrawals.housePension + 
                      log.withdrawals.other + log.withdrawals.nationalPension;
        
        let ageText = `${log.age}세`;
        if (log.age === retirementAge) {
            if (retirementMonth > 0) {
                ageText = `${log.age}세 ${retirementMonth}개월(은퇴)`;
            } else {
                ageText = `${log.age}세(은퇴)`;
            }
        }
        
        csvContent += `"${ageText}",` +
                      `${log.totalAssets},` +
                      `${log.pension + log.irp},` +
                      `${log.irpSeverance},` +
                      `${log.isa},` +
                      `${log.cash},` +
                      `${log.house},` +
                      `${log.other},` +
                      `${log.debt},` +
                      `${Math.round(drawSum)},` +
                      `${Math.round(log.shortfall)},` +
                      `${log.taxPaid}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "TaxRetire_시뮬레이션_결과보고서.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ==========================================================================
// Window Load
// ==========================================================================
window.addEventListener('load', () => {
    // Initialize icons
    if (window.lucide) {
        lucide.createIcons();
    }
    
    // Bind download & print buttons
    const btnDownloadExcel = document.getElementById('btnDownloadExcel');
    if (btnDownloadExcel) {
        btnDownloadExcel.addEventListener('click', downloadExcel);
    }
    
    const btnPrint = document.getElementById('btnPrint');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            window.print();
        });
    }
    
    // Run initial calculation
    calculateSimulation();
});
