
async function fetchPrices() {
    try {
        const btc = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT");
        const eth = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT");
        const doge = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=DOGEUSDT");

        const btcData = await btc.json();
        const ethData = await eth.json();
        const dogeData = await doge.json();

        document.getElementById("bitcoin-price").innerText = "$" + parseFloat(btcData.price).toFixed(2);
        document.getElementById("ethereum-price").innerText = "$" + parseFloat(ethData.price).toFixed(2);
        document.getElementById("dogecoin-price").innerText = "$" + parseFloat(dogeData.price).toFixed(4);
    } catch (err) {
        console.error("Error fetching data:", err);
    }
}

// Update every second
setInterval(fetchPrices, 500);
fetchPrices();
