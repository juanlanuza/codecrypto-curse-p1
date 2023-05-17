const ethers = require("ethers");
const ROUTER_ABI = require('./ROUTER_ABI.json');
const ERC20_ABI = require('./ERC20_ABI.json');
const path = require('path')
const dotenv = require('dotenv');
dotenv.config({
    path: path.resolve(__dirname, './.env')
})
const InputDataDecoder = require('ethereum-input-data-decoder');
const decoder = new InputDataDecoder("./ROUTER_ABI.json");

const config = require("./config/front_run_config.json");

const WSS = process.env.WSS;
const wallet = process.env.WALLET;
const WALLET_PRIVATE_KEY = process.env.PRIVATE_KEY
const wallet2 = process.env.WALLET_SANDWICH;

const provider = new ethers.providers.WebSocketProvider(WSS);

const signer = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);

const ETH_CONTRACT = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" // MAIN NET
const ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E"; //MAIN NET BSC

const router = new ethers.Contract(ROUTER, ROUTER_ABI, signer);
const contractTokenA = new ethers.Contract(config.tokenA, ERC20_ABI, signer);
const contractTokenB = new ethers.Contract(config.tokenB, ERC20_ABI, signer);

const buyAmount = ethers.utils.parseUnits(config.swapValue, 18)
const transactionValueMin = ethers.utils.parseUnits(config.targetValue, 18)
const maxTransactionGas = config.maxTransactionGas * 1000000000;

function getTokenPath(type) {
    if (type == "buy")
        return [config.tokenA, config.tokenB];
    else if (type == "sell")
        return [config.tokenB, config.tokenA];
}

function getExpiryDate() {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return nowInSeconds + 900;
}

function getGasPrice(amount) {
    return data = ethers.utils.formatUnits(amount.add(config.gas * 1000000000), 'wei');
}

async function executeETHSellSwap(transaction) {
    var gasPrice = getGasPrice(transaction.gasPrice);

    if(gasPrice <= maxTransactionGas) {
        try {
            var balanceRaw = await contractTokenB.balanceOf(wallet);
            var balance = BigInt(balanceRaw.toString());

            if (balance > 0) {
                await contractTokenB.approve(ROUTER, balance);
                var risultato = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(balance, 0, getTokenPath('sell'), wallet, getExpiryDate(), {
                    gasPrice: gasPrice,
                    gasLimit: 300000
                });

                const receipt = await risultato.wait();
                console.log(`sell: https://bscscan.com/tx/${receipt.transactionHash}`);
            }

            return true;
        } catch (err) {
            return true
        }
    }
}

async function executeETHBuySwap(transaction) {
    var gasPrice = getGasPrice(transaction.gasPrice);

    if(gasPrice <= maxTransactionGas) {
        try {
            var risultato = await router.swapExactETHForTokensSupportingFeeOnTransferTokens("0", getTokenPath("buy"), wallet, getExpiryDate(), {
                gasPrice: gasPrice,
                gasLimit: ethers.utils.formatUnits(transaction.gasLimit.add(100000), 'wei'),
                value: buyAmount
            });

            const receipt = await risultato.wait();
            console.log(`buy: https://bscscan.com/tx/${receipt.transactionHash}`);

            return true;
        } catch (err) {
            return true
        }    
    } else {
        console.log("gas price to higth");
        return false;
    }
    
}

async function executeSellSwap(transaction) {
    var gasPrice = getGasPrice(transaction.gasPrice);

    if(gasPrice <= maxTransactionGas) {
        try {
            var balanceRaw = await contractTokenB.balanceOf(wallet);
            var balance = BigInt(balanceRaw.toString());

            if (balance > 0) {
                await contractTokenB.approve(ROUTER, balance);
                var risultato = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(balance, 0, getTokenPath('sell'), wallet, getExpiryDate(), {
                    gasPrice: provider.getGasPrice(),
                    gasLimit: gasPrice
                });

                const receipt = await risultato.wait();
                console.log(`sell: https://bscscan.com/tx/${receipt.transactionHash}`);
            }

            return true;
        } catch (err) {
            console.log(err);
            return false
        }
    }
}

async function executeBuySwap(transaction) {
    var gasPrice = getGasPrice(transaction.gasPrice);

    if(gasPrice <= maxTransactionGas) {

        try {
            await contractTokenA.approve(ROUTER, balance);
            var risultato = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(buyAmount, "0", getTokenPath("buy"), wallet, getExpiryDate(), {
                gasPrice: gasPrice,
                gasLimit: ethers.utils.formatUnits(transaction.gasLimit.add(100000), 'wei'),
            });

            const receipt = await risultato.wait();
            console.log(`buy: https://bscscan.com/tx/${receipt.transactionHash}`);

            return true;
        } catch (err) {
            return true
        }
    } else {
        console.log("gas price to higth");
        return false;
    }
}

async function startArbitrage(transaction) {
    if(await executeBuySwap(transaction))
        if(!await executeSellSwap(transaction))
            console.log("fallito")
   
}

async function startETHArbitrage(transaction) {
    if(await executeETHBuySwap(transaction))
        if(!await executeETHSellSwap(transaction))
            console.log("fallito")
}

provider.on('pending', async (tx) => {
    provider.getTransaction(tx).then(async function (transaction) {
        if (transaction && transaction.to === ROUTER && transaction.from != wallet && transaction.from != wallet2 && transaction.value > BigInt(transactionValueMin)) {
            const data = decoder.decodeData(transaction.data);
            var swapPath = data.inputs[1];
            switch (data.method) {
                case ("swapExactETHForTokens"):
                case ("swapExactETHForTokensSupportingFeeOnTransferTokens"):
                case ("swapETHForExactTokens"):
                    if ("0x" + swapPath[swapPath.length - 1].toLowerCase() == config.tokenB.toLowerCase() && 
                        "0x" + swapPath[0].toLowerCase() == ETH_CONTRACT.toLowerCase()) {
                        console.log(`vittima: https://bscscan.com/tx/${tx}`);
                        await startETHArbitrage(transaction);
                    }
                    break;
                case ("swapExactTokensForTokens"):
                case ("swapExactTokensForTokensSupportingFeeOnTransferTokens"):
                case ("swapTokensForExactTokens"):
                    if ("0x" + swapPath[swapPath.length - 1].toLowerCase() == config.tokenB.toLowerCase() && 
                        "0x" + swapPath[0].toLowerCase() == config.tokenA.toLowerCase()) {
                            console.log(`vittima: https://bscscan.com/tx/${tx}`)
                            await startArbitrage(transaction);
                        };
                    break;
            }
        }
    });
});
