let leagues = [];
let leagueRewards = {};
let blockTimes = {};
let withdrawalMinimums = {};


async function loadConfig() {
    const [leaguesRes, rewardsRes, blocksRes, minRes] = await Promise.all([
        fetch('data/leagues.json'),
        fetch('data/leagueRewards.json'),
        fetch('data/blockTimes.json'),
        fetch('data/withdrawalMinimums.json')
    ]);

    if (!leaguesRes.ok || !rewardsRes.ok || !blocksRes.ok || !minRes.ok) {
        throw new Error('Error cargando archivos de configuración JSON');
    }

    leagues = await leaguesRes.json();
    leagueRewards = await rewardsRes.json();
    blockTimes = await blocksRes.json();
    withdrawalMinimums = await minRes.json();
    }

    const cryptoInfo = {
    RLT: { color: '[#03E1E4]', bgColor: 'cyan-500', name: 'RLT', isGameToken: true, order: 1 },
    RST: { color: '[#FFDC00]', bgColor: 'yellow-500', name: 'RST', isGameToken: true, order: 2 },
    BTC: { color: '[#F7931A]', bgColor: 'orange-500', name: 'BTC', isGameToken: false, order: 3 },
    ETH: { color: '[#987EFF]', bgColor: 'purple-500', name: 'ETH', isGameToken: false, order: 4 },
    BNB: { color: '[#F3BA2F]', bgColor: 'yellow-600', name: 'BNB', isGameToken: false, order: 5 },
    POL: { color: '[#8247E5]', bgColor: 'purple-500', name: 'POL', isGameToken: false, order: 6 },
    XRP: { color: '[#E5E6E7]', bgColor: 'gray-300', name: 'XRP', isGameToken: false, order: 7 },
    DOGE: { color: '[#C2A633]', bgColor: 'yellow-600', name: 'DOGE', isGameToken: false, order: 8 },
    TRX: { color: '[#D3392F]', bgColor: 'red-500', name: 'TRX', isGameToken: false, order: 9 },
    SOL: { color: '[#21EBAA]', bgColor: 'green-400', name: 'SOL', isGameToken: false, order: 10 },
    LTC: { color: '[#345D9D]', bgColor: 'blue-600', name: 'LTC', isGameToken: false, order: 11 }
    };

    let cryptoPrices = { BTC:0, ETH:0, LTC:0, BNB:0, POL:0, XRP:0, DOGE:0, TRX:0, SOL:0 };
    let eurToUsdRate = 1.08;
    let currentMode = 'crypto';
    let networkPowers = {};
    let currentLeague = null;
    let userPowerGH = 0;
    let pricesLastUpdated = 0;

    function parseLocaleNumber(str) {
    if (typeof str !== 'string') return NaN;
    return parseFloat(str.replace(/\s+/g, '').replace(',', '.'));
    }

    function convertToGH(power, unit) {
    try {
        const multipliers = { GH:1, PH:1_000_000, EH:1_000_000_000, ZH:1_000_000_000_000 };
        const result = power * (multipliers[unit] || 1);
        return isNaN(result) ? 0 : result;
    } catch (e) {
        console.error('Error converting power to GH:', e);
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
        console.error('Error determining league:', e);
        return leagues[0];
    }
    }

    function updateLeagueFromPower() {
    try {
        const powerInput = document.getElementById('miningPower');
        const unitSelect = document.getElementById('powerUnit');

        const power = parseFloat(powerInput.value);
        const unit = unitSelect.value;

        if (power && power > 0) {
        const powerGH = convertToGH(power, unit);
        const league = getLeagueForPower(powerGH);
        updateLeagueBadge(league.name, league.class);
        } else {
        updateLeagueBadge('BRONZE I', 'bronze');
        }
    } catch (e) {
        console.error('Error updating league from power:', e);
        updateLeagueBadge('BRONZE I', 'bronze');
    }
    }

    async function fetchCryptoPrices() {
    try {
        const cryptoIds = {
        BTC:'bitcoin', ETH:'ethereum', LTC:'litecoin', BNB:'binancecoin',
        POL:'polygon-ecosystem-token', XRP:'ripple', DOGE:'dogecoin',
        TRX:'tron', SOL:'solana'
        };

        const ids = Object.values(cryptoIds).join(',');
        const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd,eur`);
        if (!res.ok) throw new Error('Failed to fetch prices');

        const data = await res.json();

        for (const [sym, id] of Object.entries(cryptoIds)) {
        if (data[id]?.usd && !isNaN(data[id].usd)) cryptoPrices[sym] = data[id].usd;
        }

        if (data.bitcoin?.usd && data.bitcoin?.eur && data.bitcoin.eur > 0) {
        eurToUsdRate = data.bitcoin.usd / data.bitcoin.eur;
        }

        pricesLastUpdated = Date.now();

        if (currentLeague && Object.keys(networkPowers).length > 0) {
        displayEarnings();
        }
    } catch (e) {
        console.error('Error fetching crypto prices:', e);
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
        console.error('Error parsing network data:', e);
        return {};
    }
    }

     function formatNumber(num, decimals = null, isPerBlock = false, mode = 'crypto') {
        try {
            if (isNaN(num) || num == null) return '0';
            
            if (mode === 'usd' || mode === 'eur') {
                return num.toFixed(2);
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
            console.error('Error formatting number:', e);
            return '0';
        }
    }

    function calculateWithdrawalTime(dailyEarning, minWithdrawal) {
    try {
        if (!dailyEarning || !minWithdrawal || dailyEarning <= 0 || minWithdrawal <= 0) {
        return 'N/A';
        }
        const daysNeeded = Math.ceil(minWithdrawal / dailyEarning);
        if (daysNeeded <= 7) return { text: `${daysNeeded}d`, class: 'short' };
        if (daysNeeded <= 30) return { text: `${daysNeeded}d`, class: 'medium' };
        if (daysNeeded <= 365) return { text: `${daysNeeded}d`, class: 'long' };
        const years = Math.ceil(daysNeeded / 365);
        return { text: `${years}y`, class: 'long' };
    } catch (e) {
        console.error('Error calculating withdrawal time:', e);
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
        updateLeagueBadge('BRONZE I', 'bronze');
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

        currentLeague = getLeagueForPower(userPowerGH);
        updateLeagueBadge(currentLeague.name, currentLeague.class);

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
        console.error('Error calculating earnings:', e);
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
        console.error('Error updating league badge:', e);
    }
    }

    function displayEarnings() {
    try {
        if (!currentLeague) return;

        const rewards = leagueRewards[currentLeague.name];
        const tableBody = document.getElementById('earningsTableBody');
        const noDataMessage = document.getElementById('noDataMessage');

        if (!rewards || !tableBody || !noDataMessage) {
        console.error('Required DOM elements not found');
        return;
        }

        tableBody.innerHTML = '';
        noDataMessage.style.display = 'none';

        const availableCryptos = Object.keys(rewards)
        .filter(crypto => networkPowers[crypto] && cryptoInfo[crypto])
        .sort((a, b) => cryptoInfo[a].order - cryptoInfo[b].order);

        for (const crypto of availableCryptos) {
        const rewardPerBlock = rewards[crypto];
        const info = cryptoInfo[crypto];
        const networkPower = networkPowers[crypto];
        const networkPowerGH = convertToGH(networkPower.value, networkPower.unit.replace('/S', ''));

        if (networkPowerGH <= 0) continue;

        if ((currentMode === 'usd' || currentMode === 'eur') && info.isGameToken) continue;

        const userPercentage = userPowerGH / networkPowerGH;

        const earningsPerBlock = rewardPerBlock * userPercentage;
        const blocksPerDay = (24 * 60) / (blockTimes[crypto] || 10);
        const earningsPerDay = earningsPerBlock * blocksPerDay;
        const earningsPerWeek = earningsPerDay * 7;
        const earningsPerMonth = earningsPerDay * 30;

        let perBlockDisplay, dailyDisplay, weeklyDisplay, monthlyDisplay, withdrawalDisplay;

        if (currentMode === 'crypto' || info.isGameToken) {
            perBlockDisplay = `${formatNumber(earningsPerBlock)} ${info.name}`;
            dailyDisplay = `${formatNumber(earningsPerDay)} ${info.name}`;
            weeklyDisplay = `${formatNumber(earningsPerWeek)} ${info.name}`;
            monthlyDisplay = `${formatNumber(earningsPerMonth)} ${info.name}`;
        } else if (currentMode === 'usd') {
            if (cryptoPrices[crypto] && cryptoPrices[crypto] > 0) {
            perBlockDisplay = `$${formatNumber(earningsPerBlock * cryptoPrices[crypto], null, false, 'usd')}`;
            dailyDisplay = `$${formatNumber(earningsPerDay * cryptoPrices[crypto], null, false, 'usd')}`;
            weeklyDisplay = `$${formatNumber(earningsPerWeek * cryptoPrices[crypto], null, false, 'usd')}`;
            monthlyDisplay = `$${formatNumber(earningsPerMonth * cryptoPrices[crypto], null, false, 'usd')}`;
            } else {
            perBlockDisplay = dailyDisplay = weeklyDisplay = monthlyDisplay = 'N/A';
            }
        } else {
            if (cryptoPrices[crypto] && cryptoPrices[crypto] > 0 && eurToUsdRate > 0) {
            const priceEUR = cryptoPrices[crypto] / eurToUsdRate;
            perBlockDisplay = `€${formatNumber(earningsPerBlock * priceEUR, null, false, 'eur')}`;
            dailyDisplay = `€${formatNumber(earningsPerDay * priceEUR, null, false, 'eur')}`;
            weeklyDisplay = `€${formatNumber(earningsPerWeek * priceEUR, null, false, 'eur')}`;
            monthlyDisplay = `€${formatNumber(earningsPerMonth * priceEUR, null, false, 'eur')}`;
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
        row.innerHTML = `
            <td class="p-4">
            <div class="crypto-cell">
                <img src="crypto_icons/${crypto.toLowerCase()}.png" alt="${info.name}" class="crypto-icon" onerror="this.style.display='none';">
                <span class="font-bold" style="color: ${info.color.replace('[','').replace(']','')};">${info.name}</span>
            </div>
            </td>
            <td class="p-4"><div class="earnings-number">${perBlockDisplay}</div></td>
            <td class="p-4"><div class="earnings-number">${dailyDisplay}</div></td>
            <td class="p-4"><div class="earnings-number">${weeklyDisplay}</div></td>
            <td class="p-4"><div class="earnings-number">${monthlyDisplay}</div></td>
            <td class="p-4">${withdrawalDisplay}</td>
        `;
        tableBody.appendChild(row);
        }

        if (tableBody.children.length === 0) {
        noDataMessage.style.display = 'block';
        noDataMessage.textContent = 'No data available for current league or network data';
        }
    } catch (e) {
        console.error('Error displaying earnings:', e);
        const nd = document.getElementById('noDataMessage');
        if (nd) {
        nd.style.display = 'block';
        nd.textContent = 'Error displaying earnings';
        }
    }
    }

    document.addEventListener('DOMContentLoaded', function () {
        const tooltipContainers = document.querySelectorAll('.tooltip-container');
        
        tooltipContainers.forEach(container => {
            const tooltip = container.querySelector('.tooltip');
            const helpIcon = container.querySelector('.help-icon');
            
            helpIcon.addEventListener('click', function(e) {
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
                }
            });
            
            document.addEventListener('click', function(e) {
                if (!container.contains(e.target)) {
                    container.classList.remove('show');
                }
            });
        });
    });

    document.addEventListener('DOMContentLoaded', async function () {
    try {
        await loadConfig();

        const miningPowerInput = document.getElementById('miningPower');
        if (miningPowerInput) {
        miningPowerInput.addEventListener('input', function () {
            updateLeagueFromPower();
            calculateEarnings();
        });
        }

        const powerUnitSelect = document.getElementById('powerUnit');
        if (powerUnitSelect) {
        powerUnitSelect.addEventListener('change', function () {
            updateLeagueFromPower();
            calculateEarnings();
        });
        }

        const networkDataTextarea = document.getElementById('networkData');
        if (networkDataTextarea) {
        networkDataTextarea.addEventListener('input', calculateEarnings);
        }

        const btnCrypto = document.getElementById('btnCrypto');
        if (btnCrypto) {
        btnCrypto.addEventListener('click', function () {
            currentMode = 'crypto';
            document.querySelectorAll('.roller-button').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            displayEarnings();
        });
        }

        const btnUSD = document.getElementById('btnUSD');
        if (btnUSD) {
        btnUSD.addEventListener('click', function () {
            currentMode = 'usd';
            document.querySelectorAll('.roller-button').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            displayEarnings();
        });
        }

        const btnEUR = document.getElementById('btnEUR');
        if (btnEUR) {
        btnEUR.addEventListener('click', function () {
            currentMode = 'eur';
            document.querySelectorAll('.roller-button').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            displayEarnings();
        });
        }

        updateLeagueFromPower();
        initializePriceUpdates();
        calculateEarnings();
    } catch (e) {
        console.error('Error iniciando la app:', e);
        const noData = document.getElementById('noDataMessage');
        if (noData) {
        noData.style.display = 'block';
        noData.textContent = 'No se pudo cargar la configuración (JSON).';
        }
    }
});
