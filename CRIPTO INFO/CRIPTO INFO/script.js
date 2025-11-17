async function fetchPrices() {
    try {
        // Fetch crypto prices in USD
        const btc = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
        const eth = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT");
        const doge = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=DOGEUSDT");

        // Convert to JSON
        const btcData = await btc.json();
        const ethData = await eth.json();
        const dogeData = await doge.json();

        // Fetch USD → INR conversion rate
        const fx = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
        const fxData = await fx.json();
        const usdToInr = fxData.rates.INR;

        // Calculate INR values
        const btcInr = (btcData.price * usdToInr).toFixed(2);
        const ethInr = (ethData.price * usdToInr).toFixed(2);
        const dogeInr = (dogeData.price * usdToInr).toFixed(4);

        // Update HTML for USD & INR
        document.getElementById("bitcoin-price").innerHTML =
            `$${parseFloat(btcData.price).toFixed(2)}<br><span style="font-size:14px;color:#ffd700;">₹${btcInr}</span>`;

        document.getElementById("ethereum-price").innerHTML =
            `$${parseFloat(ethData.price).toFixed(2)}<br><span style="font-size:14px;color:#ffd700;">₹${ethInr}</span>`;

        document.getElementById("dogecoin-price").innerHTML =
            `$${parseFloat(dogeData.price).toFixed(4)}<br><span style="font-size:14px;color:#ffd700;">₹${dogeInr}</span>`;

    } catch (err) {
        console.error("Error fetching data:", err);
    }
}

// Update every second
setInterval(fetchPrices, 500);
fetchPrices();
