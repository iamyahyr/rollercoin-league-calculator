let leagues = [];
let leagueRewards = {};
let blockTimes = {};
let withdrawalMinimums = {};
let leagueMode = 'auto';
let manualLeagueName = null;

async function loadConfig() {
    const [leaguesRes, rewardsRes, blocksRes, minRes] = await Promise.all([
        fetch('data/leagues.json'),
        fetch('data/leagueRewards.json'),
        fetch('data/blockTimes.json'),
        fetch('data/withdrawalMinimums.json')
    ]);

    if (!leaguesRes.ok || !rewardsRes.ok || !blocksRes.ok || !minRes.ok) {
        throw new Error('Error loading JSON');
    }

    leagues = await leaguesRes.json();
    leagueRewards = await rewardsRes.json();
    blockTimes = await blocksRes.json();
    withdrawalMinimums = await minRes.json();
}

const cryptoInfo = {
    RLT: { color: '[#03E1E4]', bgColor: 'cyan-500', name: 'RLT', isGameToken: true, order: 1 },
    RST: { color: '[#FFDC00]', bgColor: 'yellow-500', name: 'RST', isGameToken: true, order: 2 },
    HMT: { color: '[#C954FF]', bgColor: 'purple-500', name: 'HMT', isGameToken: true, order: 3 },
    BTC: { color: '[#F7931A]', bgColor: 'orange-500', name: 'BTC', isGameToken: false, order: 4 },
    ETH: { color: '[#987EFF]', bgColor: 'purple-500', name: 'ETH', isGameToken: false, order: 5 },
    BNB: { color: '[#F3BA2F]', bgColor: 'yellow-600', name: 'BNB', isGameToken: false, order: 6 },
    POL: { color: '[#8247E5]', bgColor: 'purple-500', name: 'POL', isGameToken: false, order: 7 },
    XRP: { color: '[#E5E6E7]', bgColor: 'gray-300', name: 'XRP', isGameToken: false, order: 8 },
    DOGE: { color: '[#C2A633]', bgColor: 'yellow-600', name: 'DOGE', isGameToken: false, order: 9 },
    TRX: { color: '[#D3392F]', bgColor: 'red-500', name: 'TRX', isGameToken: false, order: 10 },
    SOL: { color: '[#21EBAA]', bgColor: 'green-400', name: 'SOL', isGameToken: false, order: 11 },
    LTC: { color: '[#345D9D]', bgColor: 'blue-600', name: 'LTC', isGameToken: false, order: 12 },
    ALGO: { color: '[#FF3E9A]', bgColor: 'pink-500', name: 'ALGO', isGameToken: false, order: 13 }
};

let cryptoPrices = {};
let eurToUsdRate = 1.08;
let currentMode = 'crypto';
let networkPowers = {};
let currentLeague = null;
let userPowerGH = 0;
let pricesLastUpdated = 0;

function loadLeaguePreferences() {
    try {
        const savedMode = localStorage.getItem('leagueMode');
        const savedLeague = localStorage.getItem('manualLeagueName');

        if (savedMode === 'manual' && savedLeague) {
            leagueMode = 'manual';
            manualLeagueName = savedLeague;
        } else {
            leagueMode = 'auto';
            manualLeagueName = null;
        }
    } catch (e) {
        leagueMode = 'auto';
        manualLeagueName = null;
    }
}

function saveLeaguePreferences() {
    try {
        localStorage.setItem('leagueMode', leagueMode);
        if (manualLeagueName) {
            localStorage.setItem('manualLeagueName', manualLeagueName);
        } else {
            localStorage.removeItem('manualLeagueName');
        }
    } catch (e) {

    }
}

function updateLeagueModeButton() {
    const modeText = document.getElementById('leagueModeText');
    if (!modeText) return;

    if (leagueMode === 'manual' && manualLeagueName) {
        modeText.textContent = 'MANUAL';
    } else {
        modeText.textContent = 'AUTO LEAGUE';
    }
}

function saveUserData() {
    try {
        const userData = {
            miningPower: document.getElementById('miningPower').value,
            powerUnit: document.getElementById('powerUnit').value,
            networkData: document.getElementById('networkData').value
        };
        localStorage.setItem('rollercoinUserData', JSON.stringify(userData));
    } catch (e) {

    }
}

function loadUserData() {
    try {
        const savedData = localStorage.getItem('rollercoinUserData');
        if (savedData) {
            const userData = JSON.parse(savedData);

            const miningPowerInput = document.getElementById('miningPower');
            const powerUnitSelect = document.getElementById('powerUnit');
            const networkDataTextarea = document.getElementById('networkData');

            if (userData.miningPower && miningPowerInput) {
                miningPowerInput.value = userData.miningPower;
            }

            if (userData.powerUnit && powerUnitSelect) {
                powerUnitSelect.value = userData.powerUnit;
            }

            if (userData.networkData && networkDataTextarea) {
                networkDataTextarea.value = userData.networkData;
            }
        }
    } catch (e) {

    }
}

function parseLocaleNumber(str) {
    if (typeof str !== 'string') return NaN;
    return parseFloat(str.replace(/\s+/g, '').replace(',', '.'));
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

function getLeagueForPower(powerGH) {
    try {
        for (let league of leagues) {
            if (powerGH >= league.minGH && powerGH < league.maxGH) return league;
        }
        return leagues[leagues.length - 1];
    } catch (e) {
        return leagues[0];
    }
}

function updateLeagueFromPower() {
    try {
        if (leagueMode === 'manual' && manualLeagueName) {
            const manualLeague = leagues.find(l => l.name === manualLeagueName);
            if (manualLeague) {
                currentLeague = manualLeague;
                updateLeagueBadge(manualLeague.name, manualLeague.class);
                updateUserLeagueRewards();
                return;
            }
        }

        const powerInput = document.getElementById('miningPower');
        const unitSelect = document.getElementById('powerUnit');

        const power = parseFloat(powerInput.value);
        const unit = unitSelect.value;

        if (power && power > 0) {
            const powerGH = convertToGH(power, unit);
            const league = getLeagueForPower(powerGH);
            currentLeague = league;
            updateLeagueBadge(league.name, league.class);
            updateUserLeagueRewards();
        } else {
            currentLeague = { name: 'BRONZE I', class: 'bronze' };
            updateLeagueBadge('BRONZE I', 'bronze');
            updateUserLeagueRewards();
        }
    } catch (e) {
        currentLeague = { name: 'BRONZE I', class: 'bronze' };
        updateLeagueBadge('BRONZE I', 'bronze');
        updateUserLeagueRewards();
    }
}

async function fetchCryptoPrices() {
    try {
        const cryptoIds = {
            BTC: 'bitcoin', ETH: 'ethereum', LTC: 'litecoin', BNB: 'binancecoin',
            POL: 'polygon-ecosystem-token', XRP: 'ripple', DOGE: 'dogecoin',
            TRX: 'tron', SOL: 'solana', ALGO: 'algorand'
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

        if (data.bitcoin?.usd && data.bitcoin?.eur && data.bitcoin.eur > 0) {
            eurToUsdRate = data.bitcoin.usd / data.bitcoin.eur;
        }

        pricesLastUpdated = Date.now();

        if (currentLeague && Object.keys(networkPowers).length > 0) {
            displayEarnings();
        }

        updatePricesTable();
        updateWithdrawalsTable();
    } catch (e) {

    }
}

function initializePriceUpdates() {
    fetchCryptoPrices();
    setInterval(fetchCryptoPrices, 60_000);
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

function formatNumber(num, decimals = null, isPerBlock = false, mode = "crypto", crypto = null, isNetwork = false) {
    if (isNaN(num) || num === null) return "0";

    if (isNetwork) return num.toFixed(3);

    if (mode === "usd" || mode === "eur") return num.toFixed(2);

    const decimalsByCrypto = {
        "RLT": 6,
        "RST": 6,
        "HMT": 6,
        "XRP": 6,
        "ALGO": 6,
        "TRX": 8,
        "DOGE": 4,
        "BTC": 10,
        "ETH": 8,
        "BNB": 8,
        "POL": 8,
        "SOL": 8,
        "LTC": 8
    };

    let maxDecimals = decimalsByCrypto[crypto] ?? 8;
    if (typeof decimals === "number" && decimals > 0) maxDecimals = decimals;

    return num.toFixed(maxDecimals);
}

function formatNetworkPower(totalGH) {
    if (totalGH >= 1_000_000_000_000) {
        return `${parseFloat((totalGH / 1_000_000_000_000).toFixed(3))} Zh/s`;
    } else if (totalGH >= 1_000_000_000) {
        return `${parseFloat((totalGH / 1_000_000_000).toFixed(3))} Eh/s`;
    } else if (totalGH >= 1_000_000) {
        return `${parseFloat((totalGH / 1_000_000).toFixed(3))} Ph/s`;
    } else {
        return `${parseFloat(totalGH.toFixed(3))} Gh/s`;
    }
}

function calculateWithdrawalTime(dailyEarning, minWithdrawal) {
    try {
        if (!dailyEarning || !minWithdrawal || dailyEarning <= 0 || minWithdrawal <= 0) {
            return 'N/A';
        }

        const hoursNeeded = (minWithdrawal / dailyEarning) * 24;

        if (hoursNeeded < 1) {
            const minutesNeeded = Math.ceil(hoursNeeded * 60);
            return { text: `${minutesNeeded}m`, class: 'short' };
        }

        if (hoursNeeded < 24) {
            const hours = Math.ceil(hoursNeeded);
            return { text: `${hours}h`, class: 'short' };
        }

        const totalHours = hoursNeeded;
        const days = Math.floor(totalHours / 24);
        const remainingHours = Math.ceil(totalHours % 24);

        let timeText;
        if (remainingHours === 0) {
            timeText = `${days}d`;
        } else {
            timeText = `${days}d ${remainingHours}h`;
        }

        if (days <= 7) return { text: timeText, class: 'short' };
        if (days <= 30) return { text: timeText, class: 'medium' };
        return { text: timeText, class: 'long' };
    } catch (e) {
        return { text: 'N/A', class: 'medium' };
    }
}

function calculateEarnings() {
    try {
        const powerInput = document.getElementById('miningPower');
        const unitSelect = document.getElementById('powerUnit');
        const networkInput = document.getElementById('networkData');

        document.getElementById('powerError').classList.add('hidden');
        document.getElementById('networkError').classList.add('hidden');

        const power = parseLocaleNumber(powerInput.value);
        const unit = unitSelect.value;
        const networkData = networkInput.value;

        if (!power || power <= 0 || isNaN(power)) {
            document.getElementById('noDataMessage').style.display = 'block';
            document.getElementById('earningsTableBody').innerHTML = '';

            if (leagueMode === 'manual' && manualLeagueName) {
                const manualLeague = leagues.find(l => l.name === manualLeagueName);
                if (manualLeague) {
                    currentLeague = manualLeague;
                    updateLeagueBadge(manualLeague.name, manualLeague.class);
                    updateUserLeagueRewards();
                }
            } else {
                currentLeague = { name: 'BRONZE I', class: 'bronze' };
                updateLeagueBadge('BRONZE I', 'bronze');
                updateUserLeagueRewards();
            }
            return;
        }

        if (!networkData.trim()) {
            document.getElementById('noDataMessage').style.display = 'block';
            document.getElementById('earningsTableBody').innerHTML = '';
            return;
        }

        userPowerGH = convertToGH(power, unit);
        if (userPowerGH <= 0) {
            document.getElementById('powerError').classList.remove('hidden');
            return;
        }

        if (leagueMode === 'manual' && manualLeagueName) {
            const manualLeague = leagues.find(l => l.name === manualLeagueName);
            if (manualLeague) {
                currentLeague = manualLeague;
            } else {
                currentLeague = getLeagueForPower(userPowerGH);
            }
        } else {
            currentLeague = getLeagueForPower(userPowerGH);
        }

        updateLeagueBadge(currentLeague.name, currentLeague.class);
        updateUserLeagueRewards();

        try {
            networkPowers = parseNetworkData(networkData);
        } catch (e) {
            document.getElementById('networkError').classList.remove('hidden');
            return;
        }

        if (Object.keys(networkPowers).length === 0) {
            document.getElementById('networkError').classList.remove('hidden');
            return;
        }

        displayEarnings();
    } catch (e) {
        document.getElementById('powerError').classList.remove('hidden');
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

function updateLeagueBadge(leagueName, leagueClass) {
    try {
        const badge = document.getElementById('leagueBadge');
        const imagePath = getLeagueImagePath(leagueName);
        badge.innerHTML = `
            YOUR LEAGUE: ${leagueName}
            <img src="${imagePath}" alt="${leagueName}" class="inline-block w-6 h-6 ml-2" onerror="this.style.display='none';">
            `;
        badge.className = `league-badge ${leagueClass} inline-block`;
    } catch (e) {

    }
}

function displayEarnings() {
    try {
        if (!currentLeague) return;

        const rewards = leagueRewards[currentLeague.name];
        const tableBody = document.getElementById('earningsTableBody');
        const noDataMessage = document.getElementById('noDataMessage');
        const calcNotice = document.getElementById('calcNotice');

        if (!rewards || !tableBody || !noDataMessage) {
            return;
        }

        tableBody.innerHTML = '';
        noDataMessage.style.display = 'none';

        const networkMode = localStorage.getItem('networkMode') || 'total';
        let hasWhaleWarning = false;

        const availableCryptos = Object.keys(rewards)
            .filter(crypto => networkPowers[crypto] && cryptoInfo[crypto])
            .sort((a, b) => cryptoInfo[a].order - cryptoInfo[b].order);

        for (const crypto of availableCryptos) {
            const rewardPerBlock = rewards[crypto];
            const info = cryptoInfo[crypto];
            const networkPower = networkPowers[crypto];

            const unitRaw = (networkPower.unit || '').toUpperCase();
            const cleanUnit = unitRaw.replace('/S', '');
            const networkTotalGH = convertToGH(networkPower.value, cleanUnit);

            if (!isFinite(networkTotalGH) || networkTotalGH <= 0) continue;

            if ((currentMode === 'usd' || currentMode === 'eur') && info.isGameToken) continue;

            let userShare = 0;
            let isWhale = false;

            if (networkMode === 'total') {
                userShare = networkTotalGH > 0 ? userPowerGH / networkTotalGH : 0;
                isWhale = userPowerGH > networkTotalGH;
                if (isWhale) {
                    userShare = Math.min(userShare, 1);
                    hasWhaleWarning = true;
                }
            } else {
                const networkRestGH = networkTotalGH;
                userShare = (userPowerGH + networkRestGH) > 0 ? userPowerGH / (userPowerGH + networkRestGH) : 0;
            }

            userShare = Math.max(0, Math.min(1, userShare));

            const earningsPerBlock = rewardPerBlock * userShare;
            const blockTimeMin = blockTimes[crypto] || 10;
            const blocksPerDay = (24 * 60) / blockTimeMin;

            const earningsPerDay = earningsPerBlock * blocksPerDay;
            const earningsPerWeek = earningsPerDay * 7;
            const earningsPerMonth = earningsPerDay * 30;

            let perBlockDisplay, dailyDisplay, weeklyDisplay, monthlyDisplay, withdrawalDisplay;
            let coinBadge = '';
            let earningsClass = isWhale && networkMode === 'total' ? 'whale-warning' : 'normal';

            if (networkMode === 'total' && isWhale) {
                coinBadge = ' <span class="text-yellow-400 text-xs font-bold" title="Your power > network (may have pasted rest)">⚠ WHALE</span>';
            }
            else if (networkMode === 'rest') {
                coinBadge = ' <span class="text-blue-400 text-xs px-2 py-1 bg-blue-900 rounded font-bold" title="Rest mode: P/(P+N)">EXCLUDE ME</span>';
            }

            if (currentMode === 'crypto' || info.isGameToken) {
                perBlockDisplay = `${formatCryptoAmount(earningsPerBlock, crypto)} ${info.name}`;
                dailyDisplay = `${formatCryptoAmount(earningsPerDay, crypto)} ${info.name}`;
                weeklyDisplay = `${formatCryptoAmount(earningsPerWeek, crypto)} ${info.name}`;
                monthlyDisplay = `${formatCryptoAmount(earningsPerMonth, crypto)} ${info.name}`;
            } else if (currentMode === 'usd') {
                if (cryptoPrices[crypto]?.usd && cryptoPrices[crypto].usd > 0) {
                    const usdPrice = cryptoPrices[crypto].usd;
                    perBlockDisplay = `$${formatNumber(earningsPerBlock * usdPrice, null, false, 'usd')}`;
                    dailyDisplay = `$${formatNumber(earningsPerDay * usdPrice, null, false, 'usd')}`;
                    weeklyDisplay = `$${formatNumber(earningsPerWeek * usdPrice, null, false, 'usd')}`;
                    monthlyDisplay = `$${formatNumber(earningsPerMonth * usdPrice, null, false, 'usd')}`;
                } else {
                    perBlockDisplay = dailyDisplay = weeklyDisplay = monthlyDisplay = 'N/A';
                }
            } else {
                if (cryptoPrices[crypto]?.eur && cryptoPrices[crypto].eur > 0) {
                    const eurPrice = cryptoPrices[crypto].eur;
                    perBlockDisplay = `€${formatNumber(earningsPerBlock * eurPrice, null, false, 'eur')}`;
                    dailyDisplay = `€${formatNumber(earningsPerDay * eurPrice, null, false, 'eur')}`;
                    weeklyDisplay = `€${formatNumber(earningsPerWeek * eurPrice, null, false, 'eur')}`;
                    monthlyDisplay = `€${formatNumber(earningsPerMonth * eurPrice, null, false, 'eur')}`;
                } else if (cryptoPrices[crypto]?.usd && cryptoPrices[crypto].usd > 0 && eurToUsdRate > 0) {
                    const eurPrice = cryptoPrices[crypto].usd / eurToUsdRate;
                    perBlockDisplay = `€${formatNumber(earningsPerBlock * eurPrice, null, false, 'eur')}`;
                    dailyDisplay = `€${formatNumber(earningsPerDay * eurPrice, null, false, 'eur')}`;
                    weeklyDisplay = `€${formatNumber(earningsPerWeek * eurPrice, null, false, 'eur')}`;
                    monthlyDisplay = `€${formatNumber(earningsPerMonth * eurPrice, null, false, 'eur')}`;
                } else {
                    perBlockDisplay = dailyDisplay = weeklyDisplay = monthlyDisplay = 'N/A';
                }
            }

            if (withdrawalMinimums[crypto] && earningsPerDay > 0) {
                const wt = calculateWithdrawalTime(earningsPerDay, withdrawalMinimums[crypto]);
                withdrawalDisplay = `<span class="withdrawal-time ${wt.class}">${wt.text}</span>`;
            } else {
                withdrawalDisplay = '<span class="text-gray-500">N/A</span>';
            }

            const row = document.createElement('tr');
            row.className = 'hover:bg-opacity-50 transition-all duration-200';

            const networkValue = networkPower.value;
            const networkUnit = networkPower.unit;
            let networkDisplay = `${parseFloat(networkValue.toFixed(3))} ${renderNetworkUnit(networkUnit)}`;

            function renderNetworkUnit(unit) {
                unit = unit.replace(/\/s/i, '');
                return unit.charAt(0).toUpperCase() + "h/s";
            }

            row.innerHTML = `
                <td class="p-4"><div class="earnings-number" style="color: white; text-align: center;">${networkDisplay}</div></td>
                <td class="p-4">
                <div class="crypto-cell">
                    <img src="crypto_icons/${crypto.toLowerCase()}.png" alt="${info.name}" class="crypto-icon" onerror="this.style.display='none';">
                    <span class="font-bold" style="color: ${info.color.replace('[', '').replace(']', '')};">${info.name}</span>${coinBadge}
                </div>
                </td>
                <td class="p-4"><div class="earnings-number" style="color: #03e1e4;">${perBlockDisplay}</div></td>
                <td class="p-4"><div class="earnings-number" style="color: #03e1e4;">${dailyDisplay}</div></td>
                <td class="p-4"><div class="earnings-number" style="color: #03e1e4;">${weeklyDisplay}</div></td>
                <td class="p-4"><div class="earnings-number" style="color: #03e1e4;">${monthlyDisplay}</div></td>
                <td class="p-4">${withdrawalDisplay}</td>
            `;
            tableBody.appendChild(row);
        }

        if (calcNotice) {
            const noticeText = document.getElementById('calcNoticeText');
            if (networkMode === 'total' && hasWhaleWarning) {
                noticeText.innerHTML = "<strong>Whale detected!</strong> Your power exceeds the pasted network. If you pasted the <em>rest of the network</em> (excluding yourself), switch to 'EXCLUDE ME' for accurate calculations.";
                calcNotice.classList.remove('hidden');
            } else if (networkMode === 'rest') {
                noticeText.innerHTML = "<strong>Exclude Me Active:</strong> The pasted network does not include your power. Using P/(P + Network).";
                calcNotice.classList.remove('hidden');
            } else {
                calcNotice.classList.add('hidden');
            }
        }

        let totalNetworkGH = 0;
        availableCryptos.forEach(crypto => {
            const networkPower = networkPowers[crypto];
            if (networkPower) {
                const unitRaw = (networkPower.unit || '').toUpperCase();
                const cleanUnit = unitRaw.replace('/S', '');
                const networkGH = convertToGH(networkPower.value, cleanUnit);
                if (isFinite(networkGH) && networkGH > 0) {
                    totalNetworkGH += networkGH;
                }
            }
        });

        if (totalNetworkGH > 0) {
            const totalRow = document.createElement('tr');
            totalRow.className = 'border-t-2 border-cyan-500 bg-gradient-to-r from-gray-800 to-gray-700';
            totalRow.innerHTML = `
                <td class="p-4 font-bold" colspan="7">
                    <div class="text-center">
                        <span class="earnings-number" style="color: white;">
                            TOTAL: ${formatNetworkPower(totalNetworkGH)}
                        </span>
                    </div>
                </td>
            `;
            tableBody.appendChild(totalRow);
        }

        if (tableBody.children.length === 0) {
            noDataMessage.style.display = 'block';
            noDataMessage.textContent = 'No data available for current league or network data';
        }
    } catch (e) {
        const nd = document.getElementById('noDataMessage');
        if (nd) {
            nd.style.display = 'block';
            nd.textContent = 'Error displaying earnings';
        }
    }
}

function updateUserLeagueRewards() {
    if (!currentLeague || !leagueRewards[currentLeague.name]) return;

    const userLeagueIcon = document.getElementById('userLeagueIcon');
    const userLeagueName = document.getElementById('userLeagueName');
    const userRewardsList = document.getElementById('userRewardsList');

    if (!userLeagueIcon || !userLeagueName || !userRewardsList) return;

    userLeagueIcon.src = getLeagueImagePath(currentLeague.name);
    userLeagueIcon.alt = currentLeague.name;
    userLeagueName.textContent = currentLeague.name;

    const rewards = leagueRewards[currentLeague.name];
    let html = '';

    Object.entries(rewards).forEach(([coin, amount]) => {
        const displayAmount = formatCryptoAmount(amount, coin);
        const blockTime = formatBlockTime(blockTimes[coin] || 10);

        const networkUrl = getCryptoNetworkUrl(coin);
        html += `
            <div class="reward-card">
                <div class="block-time-badge">${blockTime}</div>
                <div class="network-link-badge" onclick="window.open('${networkUrl}', '_blank')" title="View ${coin} network">
                    <img src="icons/link.png" alt="network link" class="link-icon">
                </div>
                <img src="crypto_icons/${coin.toLowerCase()}.png" alt="${coin}" class="reward-coin-large">
                <div class="reward-info">
                    <p class="reward-coin-name">${coin}</p>
                    <p class="reward-amount">${displayAmount}</p>
                </div>
            </div>
        `;
    });

    userRewardsList.innerHTML = html;
}

function formatCryptoAmount(amount, crypto) {
    const decimalsByCrypto = {
        "RLT": 6,
        "RST": 6,
        "HMT": 6,
        "XRP": 6,
        "ALGO": 6,
        "TRX": 8,
        "DOGE": 4,
        "BTC": 10,
        "ETH": 8,
        "BNB": 8,
        "POL": 8,
        "SOL": 8,
        "LTC": 8
    };
    let decimals = decimalsByCrypto[crypto] ?? 8;
    let value = Number(amount).toFixed(decimals);
    value = value.replace(/\.?0+$/, "");
    return value;
}

function formatBlockTime(timeInMinutes) {
    if (!timeInMinutes || timeInMinutes <= 0) return '<img src="icons/clock.png" alt="clock" class="clock-icon">10m 0s';

    const totalSeconds = Math.round(timeInMinutes * 60);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `<img src="icons/clock.png" alt="clock" class="clock-icon">${minutes}m ${seconds}s`;
}

function getCryptoNetworkUrl(crypto) {
    return `https://rollercoin.com/network-power/${crypto.toLowerCase()}`;
}

function initializeSecretButton() {
    const secretButton = document.getElementById('secretButton');
    const secretOverlay = document.getElementById('secretOverlay');
    const countdown = document.getElementById('countdown');

    if (secretButton && secretOverlay && countdown) {
        const audio = new Audio('secret.mp3');
        audio.preload = 'auto';

        let countdownInterval = null;

        secretButton.addEventListener('click', function (e) {
            e.preventDefault();

            secretOverlay.classList.remove('hidden');

            audio.currentTime = 0;
            audio.play().catch(error => {

            });

            let count = 3;
            countdown.textContent = count;

            if (countdownInterval) {
                clearInterval(countdownInterval);
            }

            countdownInterval = setInterval(() => {
                count--;
                if (count > 0) {
                    countdown.textContent = count;
                } else {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                    window.open('https://minaryganar.com/', '_blank');
                    secretOverlay.classList.add('hidden');
                }
            }, 1000);
        });

        secretOverlay.addEventListener('click', function (e) {
            if (e.target === secretOverlay) {
                if (countdownInterval) {
                    clearInterval(countdownInterval);
                    countdownInterval = null;
                }

                secretOverlay.classList.add('hidden');
                audio.pause();
                audio.currentTime = 0;
            }
        });
    }
}

function updatePricesTable() {
    const tableBody = document.getElementById('pricesTableBody');
    const lastUpdateElement = document.getElementById('pricesLastUpdate');

    if (!tableBody) return;

    tableBody.innerHTML = '';

    const tradableCryptos = Object.entries(cryptoInfo)
        .filter(([crypto, info]) => !info.isGameToken && cryptoPrices[crypto])
        .sort(([a], [b]) => cryptoInfo[a].order - cryptoInfo[b].order);

    tradableCryptos.forEach(([crypto, info]) => {
        const prices = cryptoPrices[crypto];
        const usdPrice = prices?.usd || 0;
        const eurPrice = prices?.eur || 0;

        const row = document.createElement('tr');
        row.className = 'hover:bg-opacity-50 transition-all duration-200';

        row.innerHTML = `
            <td class="py-2 px-3">
                <div class="coin-name-mini">
                    <img src="crypto_icons/${crypto.toLowerCase()}.png" alt="${crypto}" class="coin-icon-mini" onerror="this.style.display='none';">
                    <span style="color: ${info.color.replace('[', '').replace(']', '')}; font-weight: 600;">${crypto}</span>
                </div>
            </td>
            <td class="py-2 px-3 text-center">
                <span class="price-value">$${usdPrice ? formatNumber(usdPrice, null, false, 'usd') : 'N/A'}</span>
            </td>
            <td class="py-2 px-3 text-center">
                <span class="price-value">€${eurPrice ? formatNumber(eurPrice, null, false, 'eur') : 'N/A'}</span>
            </td>
        `;

        tableBody.appendChild(row);
    });

    if (lastUpdateElement && pricesLastUpdated > 0) {
        const date = new Date(pricesLastUpdated);
        const timeString = date.toLocaleTimeString();
        lastUpdateElement.innerHTML = `Last updated: ${timeString} | <span class="text-cyan-400">Data from CoinGecko API</span>`;
    }
}

function formatWithdrawalAmount(amount, crypto = null) {
    if (isNaN(amount) || amount === null) return "0";
    const decimalsByCrypto = {
        "RLT": 6,
        "RST": 6,
        "HMT": 6,
        "XRP": 6,
        "ALGO": 6,
        "TRX": 8,
        "DOGE": 4,
        "BTC": 10,
        "ETH": 8,
        "BNB": 8,
        "POL": 8,
        "SOL": 8,
        "LTC": 8
    };
    let maxDecimals = decimalsByCrypto[crypto] ?? 8;
    return amount.toFixed(maxDecimals);
}

function updateWithdrawalsTable() {
    const tableBody = document.getElementById('withdrawalsTableBody');

    if (!tableBody || !withdrawalMinimums) return;

    tableBody.innerHTML = '';

    const cryptosWithWithdrawal = Object.entries(withdrawalMinimums)
    .filter(([crypto]) => cryptoInfo[crypto])
    .sort(([a], [b]) => cryptoInfo[a].order - cryptoInfo[b].order);

    cryptosWithWithdrawal.forEach(([crypto, minAmount]) => {
        const info = cryptoInfo[crypto];
        const prices = cryptoPrices[crypto];
        const usdPrice = prices?.usd || 0;
        const eurPrice = prices?.eur || (usdPrice && eurToUsdRate > 0 ? usdPrice / eurToUsdRate : 0);

        const usdValue = usdPrice > 0 ? minAmount * usdPrice : 0;
        const eurValue = eurPrice > 0 ? minAmount * eurPrice : 0;

        const row = document.createElement('tr');
        row.className = 'hover:bg-opacity-50 transition-all duration-200';

        row.innerHTML = `
            <td class="py-2 px-3">
                <div class="coin-name-mini">
                    <img src="crypto_icons/${crypto.toLowerCase()}.png" alt="${crypto}" class="coin-icon-mini" onerror="this.style.display='none';">
                    <span style="color: ${info.color.replace('[', '').replace(']', '')}; font-weight: 600;">${crypto}</span>
                </div>
            </td>
            <td class="py-2 px-3 text-center">
                <span class="withdrawal-value">${formatCryptoAmount(minAmount, crypto)}</span>
            </td>
            <td class="py-2 px-3 text-center">
                <span class="price-value">$${usdValue > 0 ? formatNumber(usdValue, null, false, 'usd') : 'N/A'}</span>
            </td>
            <td class="py-2 px-3 text-center">
                <span class="price-value">${eurValue > 0 ? '€' + formatNumber(eurValue, null, false, 'eur') : 'N/A'}</span>
            </td>
        `;

        tableBody.appendChild(row);
    });

    if (cryptoInfo['ALGO']) {
        const info = cryptoInfo['ALGO'];
        const row = document.createElement('tr');
        row.className = 'hover:bg-opacity-50 transition-all duration-200';

        row.innerHTML = `
            <td class="py-2 px-3">
                <div class="coin-name-mini">
                    <img src="crypto_icons/algo.png" alt="ALGO" class="coin-icon-mini" onerror="this.style.display='none';">
                    <span style="color: ${info.color.replace('[', '').replace(']', '')}; font-weight: 600;">ALGO</span>
                </div>
            </td>
            <td class="py-2 px-3 text-center coming-soon-withdrawal" colspan="3">
                Withdrawable Soon
            </td>
        `;

        tableBody.appendChild(row);
    }
}

function initializeLeagueModal() {
    const changeLeagueBtn = document.getElementById('changeLeagueBtn');
    const leagueModal = document.getElementById('leagueModal');
    const closeModalBtn = document.getElementById('closeLeagueModal');
    const cancelBtn = document.getElementById('leagueModalCancel');
    const autoOption = document.getElementById('autoLeagueOption');
    const leagueOptions = document.querySelectorAll('.league-option-card');

    if (!changeLeagueBtn || !leagueModal) return;

    changeLeagueBtn.addEventListener('click', function () {
        leagueModal.classList.remove('hidden');

        updateAutoLeagueDisplay();

        if (leagueMode === 'auto') {
            autoOption?.classList.add('selected');
        } else {
            autoOption?.classList.remove('selected');
        }

        leagueOptions.forEach(opt => {
            const leagueName = opt.dataset.league;
            if (leagueMode === 'manual' && leagueName === manualLeagueName) {
                opt.classList.add('selected');
            } else {
                opt.classList.remove('selected');
            }
        });
    });

    function closeModal() {
        leagueModal.classList.add('hidden');
    }

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    leagueModal.addEventListener('click', function (e) {
        if (e.target === leagueModal) closeModal();
    });

    if (autoOption) {
        autoOption.addEventListener('click', function () {
            leagueMode = 'auto';
            manualLeagueName = null;
            saveLeaguePreferences();
            updateLeagueModeButton();
            updateLeagueFromPower();
            calculateEarnings();
            closeModal();
        });
    }

    leagueOptions.forEach(opt => {
        opt.addEventListener('click', function () {
            const selectedLeague = this.dataset.league;
            leagueMode = 'manual';
            manualLeagueName = selectedLeague;
            saveLeaguePreferences();
            updateLeagueModeButton();

            const manualLeagueObj = leagues.find(l => l.name === selectedLeague);
            if (manualLeagueObj) {
                currentLeague = manualLeagueObj;
                updateLeagueBadge(manualLeagueObj.name, manualLeagueObj.class);
                updateUserLeagueRewards();
                calculateEarnings();
            }

            closeModal();
        });
    });
}

function updateAutoLeagueDisplay() {
    const autoLeagueIcon = document.getElementById('autoLeagueIcon');
    const autoLeagueText = document.getElementById('autoLeagueText');

    if (!autoLeagueIcon || !autoLeagueText) return;

    const powerInput = document.getElementById('miningPower');
    const unitSelect = document.getElementById('powerUnit');

    let detectedLeague = { name: 'BRONZE I', class: 'bronze' };

    if (powerInput && unitSelect) {
        const power = parseFloat(powerInput.value);
        const unit = unitSelect.value;

        if (power && power > 0 && !isNaN(power)) {
            const powerGH = convertToGH(power, unit);
            detectedLeague = getLeagueForPower(powerGH);
        }
    }

    const detectedLeagueImage = getLeagueImagePath(detectedLeague.name);
    autoLeagueIcon.src = detectedLeagueImage;
    autoLeagueIcon.alt = detectedLeague.name;

    autoLeagueText.innerHTML = `Currently: <span class="text-cyan-300 font-semibold">${detectedLeague.name}</span> · Auto-detected by power`;
}



document.addEventListener('DOMContentLoaded', function () {
    const tooltipContainers = document.querySelectorAll('.tooltip-container');

    tooltipContainers.forEach(container => {
        const tooltip = container.querySelector('.tooltip');
        const helpIcon = container.querySelector('.help-icon');

        helpIcon.addEventListener('click', function (e) {
            e.preventDefault();
            container.classList.toggle('show');
        });

        container.addEventListener('mouseenter', function () {
            if (window.innerWidth > 768) {
                const rect = container.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                let top = rect.bottom + window.scrollY + 10;
                let left = rect.left + window.scrollX + (rect.width / 2) - (tooltipRect.width / 2);
                if (left + tooltipRect.width > window.innerWidth) left = window.innerWidth - tooltipRect.width - 20;
                if (left < 20) left = 20;
                tooltip.style.top = top + 'px';
                tooltip.style.left = left + 'px';
            } else {
                tooltip.style.top = '';
                tooltip.style.left = '';
            }
        });

        document.addEventListener('click', function (e) {
            if (!container.contains(e.target)) {
                container.classList.remove('show');
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', async function () {
    try {
        await loadConfig();

        loadLeaguePreferences();
        updateLeagueModeButton();

        const miningPowerInput = document.getElementById('miningPower');
        const powerUnitSelect = document.getElementById('powerUnit');
        const networkDataTextarea = document.getElementById('networkData');

        loadUserData();

        if (miningPowerInput) {
            miningPowerInput.addEventListener('input', function () {
                saveUserData();
                updateLeagueFromPower();
                calculateEarnings();
            });
        }

        if (powerUnitSelect) {
            powerUnitSelect.addEventListener('change', function () {
                saveUserData();
                updateLeagueFromPower();
                calculateEarnings();
            });
        }

        if (networkDataTextarea) {
            networkDataTextarea.addEventListener('input', function () {
                saveUserData();
                calculateEarnings();
            });
        }

        if (networkDataTextarea) {
            networkDataTextarea.addEventListener('paste', function () {
                setTimeout(function () {
                    const earningsTableCard = document.querySelector('.rollercoin-card.p-6.mb-6');
                    if (earningsTableCard) {
                        earningsTableCard.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                }, 150);
            });
        }

        const btnCrypto = document.getElementById('btnCrypto');
        const btnUSD = document.getElementById('btnUSD');
        const btnEUR = document.getElementById('btnEUR');

        if (btnCrypto) {
            btnCrypto.addEventListener('click', function () {
                currentMode = 'crypto';
                document.querySelectorAll('.currency-toggle-btn').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                displayEarnings();
            });
        }

        if (btnUSD) {
            btnUSD.addEventListener('click', function () {
                currentMode = 'usd';
                document.querySelectorAll('.currency-toggle-btn').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                displayEarnings();
            });
        }

        if (btnEUR) {
            btnEUR.addEventListener('click', function () {
                currentMode = 'eur';
                document.querySelectorAll('.currency-toggle-btn').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                displayEarnings();
            });
        }

        const btnNetworkTotal = document.getElementById('btnNetworkTotal');
        const btnNetworkRest = document.getElementById('btnNetworkRest');

        if (btnNetworkTotal && btnNetworkRest) {
            const savedMode = localStorage.getItem('networkMode') || 'total';
            if (savedMode === 'rest') {
                btnNetworkTotal.classList.remove('active');
                btnNetworkRest.classList.add('active');
            }

            btnNetworkTotal.addEventListener('click', function () {
                localStorage.setItem('networkMode', 'total');
                document.querySelectorAll('.network-toggle-btn').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                displayEarnings();
            });

            btnNetworkRest.addEventListener('click', function () {
                localStorage.setItem('networkMode', 'rest');
                document.querySelectorAll('.network-toggle-btn').forEach(btn => btn.classList.remove('active'));
                this.classList.add('active');
                displayEarnings();
            });
        }

        initializeLeagueModal();

        initializeSecretButton();
        updateLeagueFromPower();
        initializePriceUpdates();
        calculateEarnings();
        updatePricesTable();
        updateWithdrawalsTable();
    } catch (e) {
        const noData = document.getElementById('noDataMessage');
        if (noData) {
            noData.style.display = 'block';
            noData.textContent = 'Error (JSON).';
        }
    }
});
