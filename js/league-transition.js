let leagues = [];
let leagueRewards = {};
let blockTimes = {};

const cryptoInfo = {
    RLT: { color: '#03E1E4', name: 'RLT', isGameToken: true, order: 1 },
    RST: { color: '#FFDC00', name: 'RST', isGameToken: true, order: 2 },
    BTC: { color: '#F7931A', name: 'BTC', isGameToken: false, order: 3 },
    ETH: { color: '#987EFF', name: 'ETH', isGameToken: false, order: 4 },
    BNB: { color: '#F3BA2F', name: 'BNB', isGameToken: false, order: 5 },
    POL: { color: '#8247E5', name: 'POL', isGameToken: false, order: 6 },
    XRP: { color: '#E5E6E7', name: 'XRP', isGameToken: false, order: 7 },
    DOGE: { color: '#C2A633', name: 'DOGE', isGameToken: false, order: 8 },
    TRX: { color: '#D3392F', name: 'TRX', isGameToken: false, order: 9 },
    SOL: { color: '#21EBAA', name: 'SOL', isGameToken: false, order: 10 },
    LTC: { color: '#345D9D', name: 'LTC', isGameToken: false, order: 11 }
};

let currentLeague = null;
let nextLeague = null;
let currentMode = 'crypto';
let currentNetworkPowers = {};
let nextNetworkPowers = {};
let cryptoPrices = {};
let eurToUsdRate = 1.08;

async function loadConfig() {
    try {
        const [leaguesRes, rewardsRes, blocksRes] = await Promise.all([
            fetch('data/leagues.json'),
            fetch('data/leagueRewards.json'),
            fetch('data/blockTimes.json')
        ]);

        if (!leaguesRes.ok || !rewardsRes.ok || !blocksRes.ok) {
            throw new Error('Error loading JSON');
        }

        leagues = await leaguesRes.json();
        leagueRewards = await rewardsRes.json();
        blockTimes = await blocksRes.json();
    } catch (error) {
        console.error('Error loading configuration files:', error);
    }
}

function getLeagueImagePath(leagueName) {
    const leagueMap = {
        'BRONZE I': 'leagues/bronze_1.png',
        'BRONZE II': 'leagues/bronze_2.png',
        'BRONZE III': 'leagues/bronze_3.png',
        'SILVER I': 'leagues/silver_1.png',
        'SILVER II': 'leagues/silver_2.png',
        'SILVER III': 'leagues/silver_3.png',
        'GOLD I': 'leagues/gold_1.png',
        'GOLD II': 'leagues/gold_2.png',
        'GOLD III': 'leagues/gold_3.png',
        'PLATINUM I': 'leagues/platinum_1.png',
        'PLATINUM II': 'leagues/platinum_2.png',
        'PLATINUM III': 'leagues/platinum_3.png',
        'DIAMOND I': 'leagues/diamond_1.png',
        'DIAMOND II': 'leagues/diamond_2.png',
        'DIAMOND III': 'leagues/diamond_3.png'
    };
    return leagueMap[leagueName] || 'leagues/bronze_1.png';
}

function getNextLeague(currentLeagueName) {
    const currentIndex = leagues.findIndex(league => league.name === currentLeagueName);
    if (currentIndex >= 0 && currentIndex < leagues.length - 1) {
        return leagues[currentIndex + 1];
    }
    return null;
}

function parseNetworkData(data) {
    try {
        const powers = {};
        const lines = data.split('\n');
        let currentCrypto = null;

        for (let raw of lines) {
            let line = raw.trim();
            if (!line) continue;

            const match = Object.keys(cryptoInfo).find(crypto => {
                const alt = crypto === 'POL' ? 'MATIC' : crypto;
                return line.toUpperCase() === crypto || line.toUpperCase() === alt;
            });

            if (match) {
                currentCrypto = match;
            } else if (currentCrypto) {
                const powerMatch = line.match(/([0-9.,]+)\s*([A-Za-z]+)\/s/i);
                if (powerMatch) {
                    const value = parseFloat(powerMatch[1].replace(',', '.'));
                    const unit = powerMatch[2].toUpperCase();
                    if (!isNaN(value) && value > 0) {
                        powers[currentCrypto] = { value, unit };
                        currentCrypto = null;
                    }
                }
            }
        }

        return powers;
    } catch (e) {
        return {};
    }
}

function convertToGH(power, unit) {
    try {
        const multipliers = { GH: 1, PH: 1_000_000, EH: 1_000_000_000, ZH: 1_000_000_000_000 };
        const result = power * (multipliers[unit] || 1);
        return isNaN(result) ? 0 : result;
    } catch (e) {
        return 0;
    }
}

function formatNumber(num, decimals = null, isPerBlock = false, mode = 'crypto', crypto = null) {
    try {
        if (isNaN(num) || num == null) return '0';

        if (mode === 'usd' || mode === 'eur') {
            return num.toFixed(2);
        }

        if (isPerBlock) {
            if (num >= 1) {
                return parseFloat(num.toFixed(4)).toString();
            } else if (num >= 0.01) {
                return num.toFixed(4);
            } else if (num >= 0.0001) {
                return num.toFixed(6);
            } else {
                return num.toFixed(8);
            }
        }

        const fourDecimalCoins = ['POL', 'XRP', 'DOGE', 'TRX', 'SOL', 'LTC', 'RST', 'RLT'];

        if (crypto && fourDecimalCoins.includes(crypto)) {
            return num.toFixed(4);
        }

        if (num >= 1) {
            return parseFloat(num.toFixed(8)).toString();
        } else if (num >= 0.01) {
            return num.toFixed(4);
        } else if (num >= 0.0001) {
            return num.toFixed(6);
        } else {
            return num.toFixed(8);
        }
    } catch (e) {
        return '0';
    }
}

function formatPowerDisplay(powerGH) {
    if (powerGH >= 1_000_000_000_000) {
        return `${formatNumber(powerGH / 1_000_000_000_000)} ZH/s`;
    } else if (powerGH >= 1_000_000_000) {
        return `${formatNumber(powerGH / 1_000_000_000)} EH/s`;
    } else if (powerGH >= 1_000_000) {
        return `${formatNumber(powerGH / 1_000_000)} PH/s`;
    } else {
        return `${formatNumber(powerGH)} GH/s`;
    }
}

function formatPowerDisplayLimited(powerGH) {
    if (powerGH >= 1_000_000_000_000) {
        return `${(powerGH / 1_000_000_000_000).toFixed(3)} ZH/s`;
    } else if (powerGH >= 1_000_000_000) {
        return `${(powerGH / 1_000_000_000).toFixed(3)} EH/s`;
    } else if (powerGH >= 1_000_000) {
        return `${(powerGH / 1_000_000).toFixed(3)} PH/s`;
    } else {
        return `${powerGH.toFixed(3)} GH/s`;
    }
}

function formatBlockTime(timeInMinutes) {
    if (!timeInMinutes || timeInMinutes <= 0) return '<img src="icons/clock.png" alt="clock" class="clock-icon">10m 0s';

    const totalSeconds = Math.round(timeInMinutes * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `<img src="icons/clock.png" alt="clock" class="clock-icon">${minutes}m ${seconds}s`;
}

function formatRewardAmount(amount) {
    if (isNaN(amount) || amount == null) return '0';

    if (amount % 1 === 0) {
        return amount.toString();
    }

    let formatted;
    if (amount >= 1) {
        formatted = amount.toFixed(6);
    } else if (amount >= 0.01) {
        formatted = amount.toFixed(6);
    } else if (amount >= 0.0001) {
        formatted = amount.toFixed(8);
    } else {
        formatted = amount.toFixed(8);
    }

    return parseFloat(formatted).toString();
}

function calculateEarnings(league, networkPowers, userPowerGH) {
    const rewards = leagueRewards[league.name];
    if (!rewards) return {};

    const earnings = {};

    Object.keys(rewards).forEach(crypto => {
        if (!networkPowers[crypto] || !cryptoInfo[crypto]) return;

        const rewardPerBlock = rewards[crypto];
        const networkPower = networkPowers[crypto];

        const unitRaw = (networkPower.unit || '').toUpperCase();
        const cleanUnit = unitRaw.replace('/S', '');
        const networkTotalGH = convertToGH(networkPower.value, cleanUnit);

        if (!isFinite(networkTotalGH) || networkTotalGH <= 0) return;

        const userShare = networkTotalGH > 0 ? userPowerGH / networkTotalGH : 0;
        const earningsPerBlock = rewardPerBlock * Math.max(0, Math.min(1, userShare));
        const blockTimeMin = blockTimes[crypto] || 10;
        const blocksPerDay = (24 * 60) / blockTimeMin;
        const earningsPerDay = earningsPerBlock * blocksPerDay;

        earnings[crypto] = {
            perBlock: earningsPerBlock,
            daily: earningsPerDay
        };
    });

    return earnings;
}

function selectLeague(leagueName) {
    const league = leagues.find(l => l.name === leagueName);
    if (!league) return;

    document.querySelectorAll('.league-option').forEach(option => {
        option.classList.remove('selected');
    });

    const selectedOption = document.querySelector(`[data-league="${leagueName}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }

    currentLeague = league;
    nextLeague = getNextLeague(leagueName);

    if (!nextLeague) {
        document.getElementById('calculatorSection').classList.add('hidden');
        return;
    }

    updateLeagueDisplays();
    document.getElementById('calculatorSection').classList.remove('hidden');
    document.getElementById('leagueSelection').style.display = 'none';
}

function updateLeagueDisplays() {
    if (!currentLeague || !nextLeague) return;

    document.getElementById('currentLeagueIcon').src = getLeagueImagePath(currentLeague.name);
    document.getElementById('currentLeagueName').textContent = currentLeague.name;

    document.getElementById('nextLeagueIcon').src = getLeagueImagePath(nextLeague.name);
    document.getElementById('nextLeagueName').textContent = nextLeague.name;

    const currentMaxPower = formatPowerDisplay(currentLeague.maxGH);
    const nextMinPower = formatPowerDisplay(nextLeague.minGH);

    document.getElementById('currentMaxDesc').innerHTML = `(Daily earnings at ${currentMaxPower})`;
    document.getElementById('nextMinDesc').innerHTML = `(Daily earnings at ${nextMinPower})`;
}

function calculateTransition() {
    if (!currentLeague || !nextLeague || Object.keys(currentNetworkPowers).length === 0 || Object.keys(nextNetworkPowers).length === 0) {
        document.getElementById('noTransitionData').style.display = 'block';
        document.getElementById('transitionTableBody').innerHTML = '';
        document.getElementById('transitionTableFoot').classList.add('hidden');
        document.getElementById('blockRewardsSection').classList.add('hidden');
        return;
    }

    const currentMaxPower = currentLeague.maxGH;
    const nextMinPower = nextLeague.minGH;

    const currentMaxEarnings = calculateEarnings(currentLeague, currentNetworkPowers, currentMaxPower);
    const nextMinEarnings = calculateEarnings(nextLeague, nextNetworkPowers, nextMinPower);

    displayTransitionResults(currentMaxEarnings, nextMinEarnings, currentMaxPower, nextMinPower);
    displayBlockRewards();
}

function displayTransitionResults(currentMaxEarnings, nextMinEarnings, currentMaxPower, nextMinPower) {
    const tableBody = document.getElementById('transitionTableBody');
    const tableFoot = document.getElementById('transitionTableFoot');
    const noDataMessage = document.getElementById('noTransitionData');

    tableBody.innerHTML = '';
    noDataMessage.style.display = 'none';

    const commonCryptos = Object.keys(currentMaxEarnings).filter(crypto => nextMinEarnings[crypto]);

    if (commonCryptos.length === 0) {
        noDataMessage.style.display = 'block';
        noDataMessage.textContent = 'No common cryptocurrencies found between leagues';
        tableFoot.classList.add('hidden');
        document.getElementById('blockRewardsSection').classList.add('hidden');
        return;
    }

    let totalCurrentValue = 0;
    let totalNextValue = 0;
    const breakEvenPowers = [];

    commonCryptos.forEach(crypto => {
        const current = currentMaxEarnings[crypto];
        const next = nextMinEarnings[crypto];
        const info = cryptoInfo[crypto];

        if (!current || !next) return;

        let currentDisplay, nextDisplay, differenceDisplay;
        let currentValue = current.daily;
        let nextValue = next.daily;
        let shouldIncludeInAverage = true;

        if ((currentMode === 'usd' || currentMode === 'eur') && info.isGameToken) {
            shouldIncludeInAverage = false;
        }

        if (currentMode === 'crypto' || info.isGameToken) {
            currentDisplay = `${formatNumber(currentValue, null, false, 'crypto', crypto)} ${info.name}`;
            nextDisplay = `${formatNumber(nextValue, null, false, 'crypto', crypto)} ${info.name}`;
            differenceDisplay = `${formatNumber(nextValue - currentValue, null, false, 'crypto', crypto)} ${info.name}`;
        } else if (currentMode === 'usd' && cryptoPrices[crypto]?.usd && !info.isGameToken) {
            const usdPrice = cryptoPrices[crypto].usd;
            currentValue = current.daily * usdPrice;
            nextValue = next.daily * usdPrice;
            currentDisplay = `$${formatNumber(currentValue, null, false, 'usd')}`;
            nextDisplay = `$${formatNumber(nextValue, null, false, 'usd')}`;
            differenceDisplay = `$${formatNumber(nextValue - currentValue, null, false, 'usd')}`;
        } else if (currentMode === 'eur' && cryptoPrices[crypto]?.eur && !info.isGameToken) {
            const eurPrice = cryptoPrices[crypto].eur;
            currentValue = current.daily * eurPrice;
            nextValue = next.daily * eurPrice;
            currentDisplay = `€${formatNumber(currentValue, null, false, 'eur')}`;
            nextDisplay = `€${formatNumber(nextValue, null, false, 'eur')}`;
            differenceDisplay = `€${formatNumber(nextValue - currentValue, null, false, 'eur')}`;
        } else if ((currentMode === 'usd' || currentMode === 'eur') && info.isGameToken) {
            return;
        } else {
            return;
        }

        if (shouldIncludeInAverage) {
            totalCurrentValue += currentValue;
            totalNextValue += nextValue;
        }

        const lossPercentage = currentValue > 0 ? ((currentValue - nextValue) / currentValue) * 100 : 0;

        let lossClass;
        if (lossPercentage <= 0) {
            lossClass = 'loss-gain';
        } else if (lossPercentage < 3) {
            lossClass = 'loss-low'; 
        } else {
            lossClass = 'loss-high';
        }

        const differenceClass = nextValue > currentValue ? 'earnings-positive' : 'earnings-negative';

        let breakEvenDisplay;
        if (nextValue >= currentValue) {
            breakEvenDisplay = '<span class="text-gray-500">N/A</span>';
        } else {
            const breakEvenMultiplier = currentValue > 0 && nextValue > 0 ? currentValue / nextValue : 1;
            const breakEvenPower = nextMinPower * breakEvenMultiplier;
            breakEvenPowers.push(breakEvenPower);
            
            const exceedsMax = breakEvenPower > nextLeague.maxGH;
            
            breakEvenDisplay = `
                <div class="power-recommendation">
                    ${formatPowerDisplayLimited(breakEvenPower)}
                    ${exceedsMax ? '<div class="break-even-warning">⚠️ Must advance more leagues</div>' : ''}
                </div>
            `;
        }


        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="p-4">
                <div class="crypto-cell">
                    <img src="crypto_icons/${crypto.toLowerCase()}.png" alt="${info.name}" class="crypto-icon" onerror="this.style.display='none';">
                    <span style="color: ${info.color}; font-weight: 600;">${info.name}</span>
                </div>
            </td>
            <td class="p-4"><div class="earnings-number">${currentDisplay}</div></td>
            <td class="p-4"><div class="earnings-number">${nextDisplay}</div></td>
            <td class="p-4"><div class="earnings-number ${differenceClass}">${differenceDisplay}</div></td>
            <td class="p-4"><div class="loss-percentage ${lossClass}">${lossPercentage > 0 ? '-' : '+'}${Math.abs(lossPercentage).toFixed(1)}%</div></td>
            <td class="p-4">${breakEvenDisplay}</td>
        `;
        tableBody.appendChild(row);
    });

    updateTransitionSummary(breakEvenPowers);
    tableFoot.classList.remove('hidden');
}

function displayBlockRewards() {
    if (!currentLeague || !nextLeague) return;

    const blockRewardsSection = document.getElementById('blockRewardsSection');
    if (!blockRewardsSection) return;

    const currentRewards = leagueRewards[currentLeague.name] || {};
    const nextRewards = leagueRewards[nextLeague.name] || {};

    const allCryptos = new Set([...Object.keys(currentRewards), ...Object.keys(nextRewards)]);
    const sortedCryptos = Array.from(allCryptos).sort((a, b) => cryptoInfo[a]?.order - cryptoInfo[b]?.order);

    let rewardsHtml = '';

    sortedCryptos.forEach(crypto => {
        const info = cryptoInfo[crypto];
        if (!info) return;

        const currentReward = currentRewards[crypto] || 0;
        const nextReward = nextRewards[crypto] || 0;
        const blockTime = formatBlockTime(blockTimes[crypto] || 10);

        let changeIcon = '';
        let changeClass = '';

        if (currentReward === 0 && nextReward > 0) {
            changeIcon = '↗';
            changeClass = 'reward-new';
        } else if (currentReward > 0 && nextReward === 0) {
            changeIcon = '↘';
            changeClass = 'reward-lost';
        } else if (nextReward > currentReward) {
            changeIcon = '↗';
            changeClass = 'reward-increase';
        } else if (nextReward < currentReward) {
            changeIcon = '↘';
            changeClass = 'reward-decrease';
        } else {
            changeIcon = '→';
            changeClass = 'reward-same';
        }

        rewardsHtml += `
            <div class="reward-comparison-card">
                <div class="reward-header">
                    <img src="crypto_icons/${crypto.toLowerCase()}.png" alt="${crypto}" class="reward-coin-icon">
                    <span class="reward-coin-name" style="color: ${info.color}">${crypto}</span>
                    <div class="block-time-mini">${blockTime}</div>
                </div>
                <div class="reward-comparison">
                    <div class="reward-current">
                        <span class="reward-label">Current</span>
                        <span class="reward-value">${formatRewardAmount(currentReward)}</span>
                    </div>
                    <div class="reward-arrow ${changeClass}">
                        <span class="arrow-icon">${changeIcon}</span>
                    </div>
                    <div class="reward-next">
                        <span class="reward-label">Next</span>
                        <span class="reward-value">${formatRewardAmount(nextReward)}</span>
                    </div>
                </div>
            </div>
        `;
    });

    document.getElementById('currentLeagueNameRewards').textContent = currentLeague.name;
    document.getElementById('nextLeagueNameRewards').textContent = nextLeague.name;
    document.getElementById('currentLeagueIconRewards').src = getLeagueImagePath(currentLeague.name);
    document.getElementById('nextLeagueIconRewards').src = getLeagueImagePath(nextLeague.name);
    
    // Add power ranges below league names
    const currentRange = `${formatPowerDisplayLimited(currentLeague.minGH)} - ${formatPowerDisplayLimited(currentLeague.maxGH)}`;
    const nextRange = `${formatPowerDisplayLimited(nextLeague.minGH)} - ${formatPowerDisplayLimited(nextLeague.maxGH)}`;
    
    document.getElementById('currentLeaguePowerRange').textContent = currentRange;
    document.getElementById('nextLeaguePowerRange').textContent = nextRange;
    
    document.getElementById('rewardsComparison').innerHTML = rewardsHtml;

    blockRewardsSection.classList.remove('hidden');
}


function updateTransitionSummary(breakEvenPowers) {
    if (breakEvenPowers.length === 0) {
        document.getElementById('averageBreakEven').textContent = 'N/A';
        return;
    }

    const averagePower = breakEvenPowers.reduce((sum, power) => sum + power, 0) / breakEvenPowers.length;
    document.getElementById('averageBreakEven').textContent = formatPowerDisplayLimited(averagePower);
}

async function fetchCryptoPrices() {
    try {
        const cryptoIds = {
            BTC: 'bitcoin', ETH: 'ethereum', LTC: 'litecoin', BNB: 'binancecoin',
            POL: 'polygon-ecosystem-token', XRP: 'ripple', DOGE: 'dogecoin',
            TRX: 'tron', SOL: 'solana'
        };

        const ids = Object.values(cryptoIds).join(',');
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,eur`);
        if (!res.ok) throw new Error('Failed to fetch prices');

        const data = await res.json();

        for (const [sym, id] of Object.entries(cryptoIds)) {
            if (data[id]?.usd && !isNaN(data[id].usd) && data[id]?.eur && !isNaN(data[id].eur)) {
                cryptoPrices[sym] = {
                    usd: data[id].usd,
                    eur: data[id].eur
                };
            }
        }

        calculateTransition();
    } catch (e) {
        console.error('Error fetching crypto prices:', e);
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    await loadConfig();

    document.querySelectorAll('.league-option').forEach(option => {
        option.addEventListener('click', function () {
            const leagueName = this.dataset.league;
            selectLeague(leagueName);
        });
    });

    const currentNetworkInput = document.getElementById('currentNetworkData');
    const nextNetworkInput = document.getElementById('nextNetworkData');

    currentNetworkInput.addEventListener('input', function () {
        try {
            currentNetworkPowers = parseNetworkData(this.value);
            document.getElementById('currentNetworkError').classList.add('hidden');
        } catch (e) {
            document.getElementById('currentNetworkError').classList.remove('hidden');
        }
        calculateTransition();
    });

    nextNetworkInput.addEventListener('input', function () {
        try {
            nextNetworkPowers = parseNetworkData(this.value);
            document.getElementById('nextNetworkError').classList.add('hidden');
        } catch (e) {
            document.getElementById('nextNetworkError').classList.remove('hidden');
        }
        calculateTransition();
    });

    const btnCrypto = document.getElementById('btnCrypto');
    const btnUSD = document.getElementById('btnUSD');
    const btnEUR = document.getElementById('btnEUR');

    btnCrypto.addEventListener('click', function () {
        currentMode = 'crypto';
        document.querySelectorAll('.currency-toggle-btn').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        calculateTransition();
    });

    btnUSD.addEventListener('click', function () {
        currentMode = 'usd';
        document.querySelectorAll('.currency-toggle-btn').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        calculateTransition();
    });

    btnEUR.addEventListener('click', function () {
        currentMode = 'eur';
        document.querySelectorAll('.currency-toggle-btn').forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        calculateTransition();
    });

    document.getElementById('backToSelection').addEventListener('click', function () {
        document.getElementById('calculatorSection').classList.add('hidden');
        document.getElementById('leagueSelection').style.display = 'block';
        document.querySelectorAll('.league-option').forEach(option => {
            option.classList.remove('selected');
        });
        currentLeague = null;
        nextLeague = null;
        currentNetworkPowers = {};
        nextNetworkPowers = {};
        document.getElementById('currentNetworkData').value = '';
        document.getElementById('nextNetworkData').value = '';
        document.getElementById('currentNetworkError').classList.add('hidden');
        document.getElementById('nextNetworkError').classList.add('hidden');
    });

    fetchCryptoPrices();
    setInterval(fetchCryptoPrices, 60000);
});
