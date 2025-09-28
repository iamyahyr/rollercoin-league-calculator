const cryptoInfo = {
    RLT: { color: '#03E1E4', name: 'RLT', order: 1, icon: 'crypto_icons/rlt.png' },
    RST: { color: '#FFDC00', name: 'RST', order: 2, icon: 'crypto_icons/rst.png' },
    BTC: { color: '#F7931A', name: 'BTC', order: 3, icon: 'crypto_icons/btc.png' },
    ETH: { color: '#987EFF', name: 'ETH', order: 4, icon: 'crypto_icons/eth.png' },
    BNB: { color: '#F3BA2F', name: 'BNB', order: 5, icon: 'crypto_icons/bnb.png' },
    POL: { color: '#8247E5', name: 'POL', order: 6, icon: 'crypto_icons/pol.png' },
    MATIC: { color: '#8247E5', name: 'POL', order: 6, icon: 'crypto_icons/pol.png' },
    XRP: { color: '#E5E6E7', name: 'XRP', order: 7, icon: 'crypto_icons/xrp.png' },
    DOGE: { color: '#C2A633', name: 'DOGE', order: 8, icon: 'crypto_icons/doge.png' },
    TRX: { color: '#D3392F', name: 'TRX', order: 9, icon: 'crypto_icons/trx.png' },
    SOL: { color: '#21EBAA', name: 'SOL', order: 10, icon: 'crypto_icons/sol.png' },
    LTC: { color: '#345D9D', name: 'LTC', order: 11, icon: 'crypto_icons/ltc.png' }
};

let networkDataHistory = [];
let chartInstance = null;
let inputCount = 0;
let detectedUnit = 'ZH/s';

function createInputField(dayNumber, savedData = '') {
    const inputCard = document.createElement('div');
    inputCard.className = 'input-card';
    inputCard.setAttribute('data-day', dayNumber);

    if (dayNumber > 3) {
        inputCard.classList.add('removable');
        inputCard.innerHTML = `
            <button class="remove-btn roller-button remove-button" onclick="removeInput(${dayNumber})">
                ✕
            </button>
        `;
    }

    const content = document.createElement('div');
    content.innerHTML = `
        <div class="day-label">Day ${dayNumber}</div>
        <textarea 
            id="networkData${dayNumber}" 
            class="w-full rollercoin-input font-mono resize-none" 
            rows="4"
            placeholder="Paste network data here (e.g., Game Currencies rlt RLT 3.534 Zh/s...)">${savedData}</textarea>
    `;

    inputCard.appendChild(content);

    const textarea = inputCard.querySelector('textarea');
    textarea.addEventListener('input', function () {
        rebuildNetworkDataFromInputs();
        checkInputsAndShowButton();
        saveToLocalStorage();
    });

    return inputCard;
}

function createAddDayButton() {
    const addContainer = document.createElement('div');
    addContainer.className = 'add-day-container';
    addContainer.innerHTML = `
        <button class="roller-button" onclick="addInput()">
            + ADD DAY
        </button>
    `;
    return addContainer;
}

function addInput() {
    inputCount++;
    const container = document.getElementById('inputsContainer');

    const existingAddBtn = container.querySelector('.add-day-container');
    if (existingAddBtn) {
        existingAddBtn.remove();
    }

    const inputField = createInputField(inputCount);
    container.appendChild(inputField);

    const addButton = createAddDayButton();
    container.appendChild(addButton);

    checkInputsAndShowButton();
}

function removeInput(dayNumber) {
    const container = document.getElementById('inputsContainer');
    const inputToRemove = container.querySelector(`[data-day="${dayNumber}"]`);

    if (inputToRemove) {
        container.removeChild(inputToRemove);
    }

    renumberInputs();
    rebuildNetworkDataFromInputs();
    checkInputsAndShowButton();
    saveToLocalStorage();
}

function renumberInputs() {
    const container = document.getElementById('inputsContainer');
    const inputCards = Array.from(container.querySelectorAll('.input-card'));

    inputCards.forEach((card, index) => {
        const newDayNumber = index + 1;
        const dayLabel = card.querySelector('.day-label');
        const textarea = card.querySelector('textarea');
        const removeBtn = card.querySelector('.remove-btn');

        dayLabel.textContent = `Day ${newDayNumber}`;
        textarea.id = `networkData${newDayNumber}`;
        card.setAttribute('data-day', newDayNumber);

        if (removeBtn) {
            removeBtn.setAttribute('onclick', `removeInput(${newDayNumber})`);
        }

        if (newDayNumber > 3) {
            if (!card.classList.contains('removable')) {
                card.classList.add('removable');
                if (!removeBtn) {
                    const newRemoveBtn = document.createElement('button');
                    newRemoveBtn.className = 'remove-btn roller-button remove-button';
                    newRemoveBtn.setAttribute('onclick', `removeInput(${newDayNumber})`);
                    newRemoveBtn.innerHTML = '✕';
                    card.insertBefore(newRemoveBtn, card.firstChild);
                }
            }
        } else {
            card.classList.remove('removable');
            if (removeBtn) {
                removeBtn.remove();
            }
        }
    });

    inputCount = inputCards.length;
}

function rebuildNetworkDataFromInputs() {
    networkDataHistory = [];
    detectedUnit = 'ZH/s';

    const container = document.getElementById('inputsContainer');
    const textareas = container.querySelectorAll('textarea');

    textareas.forEach((textarea, index) => {
        if (textarea.value.trim()) {
            const dayNumber = index + 1;
            parseAndStoreNetworkData(dayNumber, textarea.value);
        }
    });
}

function checkInputsAndShowButton() {
    const container = document.getElementById('inputsContainer');
    const textareas = container.querySelectorAll('textarea');
    const filledInputs = Array.from(textareas).filter(textarea => textarea.value.trim()).length;

    const generateButton = document.getElementById('generateChart');
    if (filledInputs >= 3) {
        generateButton.classList.remove('hidden');
    } else {
        generateButton.classList.add('hidden');
    }
}

function parseNetworkData(data) {
    const powers = {};
    const lines = data.split('\n');
    let currentCrypto = null;
    let detectedUnits = new Set();

    for (let raw of lines) {
        let line = raw.trim();
        if (!line) continue;

        const words = line.split(/\s+/);
        for (let word of words) {
            const upperWord = word.toUpperCase();
            if (cryptoInfo[upperWord]) {
                currentCrypto = upperWord === 'MATIC' ? 'POL' : upperWord;
                break;
            }
        }

        if (currentCrypto) {
            const powerMatch = line.match(/([0-9.,]+)\s*(zh|eh|ph|th|gh|mh|kh)\/s/i);
            if (powerMatch) {
                const value = parseFloat(powerMatch[1].replace(',', '.'));
                const unit = powerMatch[2].toUpperCase();
                if (!isNaN(value) && value > 0) {
                    detectedUnits.add(unit);
                    powers[currentCrypto] = {
                        value: value,
                        unit: unit,
                        normalizedValue: normalizeToSmallestUnit(value, unit)
                    };
                    currentCrypto = null;
                }
            }
        }
    }

    if (detectedUnits.size > 0) {
        const unitsArray = Array.from(detectedUnits);
        const unitPriority = ['ZH', 'EH', 'PH', 'TH', 'GH', 'MH', 'KH'];
        detectedUnit = unitsArray.sort((a, b) =>
            unitPriority.indexOf(a) - unitPriority.indexOf(b)
        )[0] + '/s';
    }

    return powers;
}

function normalizeToSmallestUnit(value, unit) {
    const multipliers = {
        'KH': 1,
        'MH': 1000,
        'GH': 1000000,
        'TH': 1000000000,
        'PH': 1000000000000,
        'EH': 1000000000000000,
        'ZH': 1000000000000000000
    };
    return value * (multipliers[unit] || 1);
}

function denormalizeFromSmallestUnit(normalizedValue, targetUnit) {
    const multipliers = {
        'KH': 1,
        'MH': 1000,
        'GH': 1000000,
        'TH': 1000000000,
        'PH': 1000000000000,
        'EH': 1000000000000000,
        'ZH': 1000000000000000000
    };
    return normalizedValue / (multipliers[targetUnit] || 1);
}

function parseAndStoreNetworkData(day, data) {
    try {
        const powers = parseNetworkData(data);
        networkDataHistory.push({ day, powers, originalDay: day, rawData: data });
        networkDataHistory.sort((a, b) => a.day - b.day);
    } catch (e) {
        
    }
}

function saveToLocalStorage() {
    const dataToSave = {
        inputData: {}
    };

    const container = document.getElementById('inputsContainer');
    const textareas = container.querySelectorAll('textarea');
    textareas.forEach(textarea => {
        if (textarea.value.trim()) {
            dataToSave.inputData[textarea.id] = textarea.value;
        }
    });

    try {
        localStorage.setItem('rollerCoinAnalyzer', JSON.stringify(dataToSave));
    } catch (e) {
        
    }
}

function loadFromLocalStorage() {
    try {
        const savedData = localStorage.getItem('rollerCoinAnalyzer');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            if (parsed.inputData && Object.keys(parsed.inputData).length > 0) {
                return parsed.inputData;
            }
        }
    } catch (e) {
        
    }
    return null;
}

function generateChart() {
    const errorDiv = document.getElementById('inputError');

    errorDiv.classList.add('hidden');

    rebuildNetworkDataFromInputs();

    if (networkDataHistory.length < 3) {
        errorDiv.textContent = 'Please provide at least 3 network data samples';
        errorDiv.classList.remove('hidden');
        return;
    }

    collapseInputSection();

    const allCryptos = new Set();
    networkDataHistory.forEach(dayData => {
        Object.keys(dayData.powers).forEach(crypto => allCryptos.add(crypto));
    });

    const sortedCryptos = Array.from(allCryptos).sort((a, b) =>
        (cryptoInfo[a]?.order || 999) - (cryptoInfo[b]?.order || 999)
    );

    const datasets = sortedCryptos.map(crypto => {
        const data = networkDataHistory.map(dayData => {
            const cryptoData = dayData.powers[crypto];
            if (cryptoData) {
                const displayUnit = detectedUnit.replace('/s', '');
                return denormalizeFromSmallestUnit(cryptoData.normalizedValue, displayUnit);
            }
            return null;
        });

        return {
            label: cryptoInfo[crypto]?.name || crypto,
            data: data,
            borderColor: cryptoInfo[crypto]?.color || '#ffffff',
            backgroundColor: cryptoInfo[crypto]?.color + '20' || '#ffffff20',
            borderWidth: 3,
            fill: false,
            tension: 0.4,
            pointBackgroundColor: cryptoInfo[crypto]?.color || '#ffffff',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8,
            spanGaps: false
        };
    });

    const labels = networkDataHistory.map((_, index) => `Day ${index + 1}`);

    if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
    }

    document.getElementById('chartSection').classList.remove('hidden');
    document.getElementById('analysisSection').classList.add('hidden');

    document.documentElement.style.setProperty('--days-count', networkDataHistory.length);

    const ctx = document.getElementById('networkChart').getContext('2d');
    chartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const label = context.dataset.label || '';
                            const value = context.parsed.y;
                            if (value === null) return null;
                            return `${label}: ${value.toFixed(3)} ${detectedUnit}`;
                        },
                        labelTextColor: function (context) {
                            const label = context.dataset.label || '';
                            const crypto = sortedCryptos.find(c => (cryptoInfo[c]?.name || c) === label);
                            return cryptoInfo[crypto]?.color || '#ffffff';
                        }
                    },
                    displayColors: false,
                    titleColor: '#a0a3bd',
                    bodyColor: '#ffffff',
                    backgroundColor: 'rgba(31, 33, 53, 0.95)',
                    borderColor: '#3d4162',
                    borderWidth: 1,
                    filter: function (tooltipItem) {
                        return tooltipItem.parsed.y !== null;
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: '#a0a3bd',
                        font: {
                            weight: '600'
                        }
                    },
                    grid: {
                        color: '#3d4162'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Network Power',
                        color: '#03e1e4',
                        font: {
                            weight: '700'
                        }
                    },
                    ticks: {
                        color: '#a0a3bd',
                        font: {
                            weight: '600'
                        },
                        callback: function (value) {
                            return value.toFixed(2) + ' ' + detectedUnit;
                        }
                    },
                    grid: {
                        color: '#3d4162'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    generateCustomLegend(sortedCryptos);
    generateAnalysisTable(sortedCryptos);

    setTimeout(() => {
        scrollToChart();
    }, 600);
}

function collapseInputSection() {
    const inputSection = document.getElementById('inputSection');
    const collapseNotice = document.getElementById('collapseNotice');

    inputSection.classList.add('collapsed');
    collapseNotice.classList.remove('hidden');
}

function expandInputSection() {
    const inputSection = document.getElementById('inputSection');
    const collapseNotice = document.getElementById('collapseNotice');

    inputSection.classList.remove('collapsed');
    collapseNotice.classList.add('hidden');
}

function scrollToChart() {
    const chartSection = document.getElementById('chartSection');
    if (chartSection) {
        requestAnimationFrame(() => {
            const rect = chartSection.getBoundingClientRect();
            const targetPosition = window.pageYOffset + rect.top - 20;

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });
        });
    }
}

function generateCustomLegend(cryptos) {
    const legendContainer = document.getElementById('customLegend');
    legendContainer.innerHTML = '';

    cryptos.forEach((crypto, index) => {
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.setAttribute('data-crypto', crypto);
        legendItem.setAttribute('data-dataset-index', index);

        legendItem.innerHTML = `
            <img src="${cryptoInfo[crypto]?.icon || ''}" 
                 alt="${cryptoInfo[crypto]?.name || crypto}" 
                 class="legend-icon"
                 onerror="this.style.display='none'">
            <span class="legend-text" style="color: ${cryptoInfo[crypto]?.color || '#ffffff'};">
                ${cryptoInfo[crypto]?.name || crypto}
            </span>
        `;

        legendItem.addEventListener('click', function () {
            const datasetIndex = parseInt(this.getAttribute('data-dataset-index'));
            toggleDataset(datasetIndex, this);
        });

        legendContainer.appendChild(legendItem);
    });
}

function toggleDataset(datasetIndex, legendItem) {
    if (chartInstance && chartInstance.data.datasets[datasetIndex]) {
        const dataset = chartInstance.data.datasets[datasetIndex];
        dataset.hidden = !dataset.hidden;

        if (dataset.hidden) {
            legendItem.classList.add('hidden-dataset');
        } else {
            legendItem.classList.remove('hidden-dataset');
        }

        chartInstance.update();
    }
}

function generateAnalysisTable(cryptos) {
    const tableBody = document.getElementById('analysisTableBody');
    tableBody.innerHTML = '';

    const headers = document.querySelectorAll('.rollercoin-table th');
    if (headers.length >= 3) {
        headers[1].innerHTML = `INITIAL (${detectedUnit})`;
        headers[2].innerHTML = `FINAL (${detectedUnit})`;
    }

    const totalDays = networkDataHistory.length;

    cryptos.forEach(crypto => {
        const initialData = networkDataHistory[0].powers[crypto];
        const finalData = networkDataHistory[totalDays - 1].powers[crypto];

        if (!initialData && !finalData) return;

        const displayUnit = detectedUnit.replace('/s', '');
        const initialValue = initialData ? denormalizeFromSmallestUnit(initialData.normalizedValue, displayUnit) : 0;
        const finalValue = finalData ? denormalizeFromSmallestUnit(finalData.normalizedValue, displayUnit) : 0;

        const totalGrowth = finalValue - initialValue;
        const totalGrowthPercent = initialValue > 0 ? ((finalValue - initialValue) / initialValue * 100) : 0;
        const dailyAvgGrowth = totalGrowth / (totalDays - 1);
        const dailyGrowthRate = initialValue > 0 ? (Math.pow(finalValue / initialValue, 1 / (totalDays - 1)) - 1) * 100 : 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div class="crypto-cell">
                    <img src="${cryptoInfo[crypto]?.icon || ''}" 
                         alt="${cryptoInfo[crypto]?.name || crypto}" 
                         class="crypto-icon"
                         onerror="this.style.display='none'">
                    <span class="font-bold" style="color: ${cryptoInfo[crypto]?.color || '#ffffff'};">
                        ${cryptoInfo[crypto]?.name || crypto}
                    </span>
                </div>
            </td>
            <td><span class="font-semibold text-white">${initialValue.toFixed(3)}</span></td>
            <td><span class="font-semibold text-white">${finalValue.toFixed(3)}</span></td>
            <td>
                <span class="font-semibold ${totalGrowth >= 0 ? 'growth-positive' : 'growth-negative'}">
                    ${totalGrowth >= 0 ? '+' : ''}${totalGrowth.toFixed(3)} ${detectedUnit}
                </span>
                <br>
                <span class="text-xs ${totalGrowthPercent >= 0 ? 'growth-positive' : 'growth-negative'}">
                    (${totalGrowthPercent >= 0 ? '+' : ''}${totalGrowthPercent.toFixed(1)}%)
                </span>
            </td>
            <td>
                <span class="font-semibold ${dailyAvgGrowth >= 0 ? 'growth-positive' : 'growth-negative'}">
                    ${dailyAvgGrowth >= 0 ? '+' : ''}${dailyAvgGrowth.toFixed(3)} ${detectedUnit}
                </span>
            </td>
            <td>
                <span class="font-semibold ${dailyGrowthRate >= 0 ? 'growth-positive' : 'growth-negative'}">
                    ${dailyGrowthRate >= 0 ? '+' : ''}${dailyGrowthRate.toFixed(2)}%/day
                </span>
            </td>
        `;
        tableBody.appendChild(row);
    });

    document.getElementById('analysisSection').classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', function () {
    const savedInputData = loadFromLocalStorage();

    const minInputs = 3;
    for (let i = 1; i <= minInputs; i++) {
        const container = document.getElementById('inputsContainer');
        const savedData = savedInputData ? (savedInputData[`networkData${i}`] || '') : '';
        const inputField = createInputField(i, savedData);
        container.appendChild(inputField);
        inputCount = i;
    }

    if (savedInputData) {
        const savedKeys = Object.keys(savedInputData);
        const maxDay = savedKeys.reduce((max, key) => {
            const match = key.match(/networkData(\d+)/);
            return match ? Math.max(max, parseInt(match[1])) : max;
        }, 0);

        for (let i = minInputs + 1; i <= maxDay; i++) {
            const savedData = savedInputData[`networkData${i}`];
            if (savedData) {
                const container = document.getElementById('inputsContainer');
                const addBtn = container.querySelector('.add-day-container');
                if (addBtn) addBtn.remove();

                const inputField = createInputField(i, savedData);
                container.appendChild(inputField);
                inputCount = i;
            }
        }
    }

    const container = document.getElementById('inputsContainer');
    const addButton = createAddDayButton();
    container.appendChild(addButton);

    rebuildNetworkDataFromInputs();
    checkInputsAndShowButton();

    document.getElementById('generateChart').addEventListener('click', generateChart);
    document.getElementById('expandButton').addEventListener('click', expandInputSection);
});
