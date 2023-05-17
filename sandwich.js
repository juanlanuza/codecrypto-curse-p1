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

const config = require("./config/sandwich_config.json");
const { decode } = require("punycode");

const WSS = process.env.WSS;
const wallet = process.env.WALLET_SANDWICH;
const WALLET_PRIVATE_KEY = process.env.PRIVATE_KEY_SANDWICH
const wallet2 = process.env.WALLET;

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

async function executeETHSellSwap(transaction, nonce) {
    var gasPrice = getGasPrice(transaction.gasPrice);
    if(gasPrice <= maxTransactionGas) {
        try {
            var balanceRaw = await contractTokenB.balanceOf(wallet);
            var balance = BigInt(balanceRaw.toString());
            if (balance > 0) {
                //await contractTokenB.approve(ROUTER, balance);
                var risultato = await router.swapExactTokensForETH(balance, 0, getTokenPath('sell'), wallet, getExpiryDate() + 2000, {
                    gasPrice: provider.getGasPrice(),
                    gasLimit: 300000,
                    nonce: nonce + 1
                });

                const receipt = await risultato.wait();
                console.log(`sell: https://bscscan.com/tx/${receipt.transactionHash}`);
            }

            return true;
        } catch (err) {
            console.log(err);
            return true
        }
    }
}

async function executeETHBuySwap(transaction, nonce) {
    var gasPrice = getGasPrice(transaction.gasPrice);

    if(gasPrice <= maxTransactionGas) {
        try {
            var risultato = await router.swapExactETHForTokens("0", getTokenPath("buy"), wallet, getExpiryDate(), {
                gasPrice: gasPrice,
                gasLimit: ethers.utils.formatUnits(transaction.gasLimit.add(100000), 'wei'),
                value: buyAmount, 
                nonce: nonce
            });

            const receipt = await risultato.wait();
            console.log(`buy: https://bscscan.com/tx/${receipt.transactionHash}`);

            return true;
        } catch (err) {
            return true
        }    
    } else {
        console.log("gas price to hight");
        return false;
    }
    
}

async function executeETHSellSwapWithFee(transaction, nonce) {
    var gasPrice = getGasPrice(transaction.gasPrice);
    if(gasPrice <= maxTransactionGas) {
        try {
            var balanceRaw = await contractTokenB.balanceOf(wallet);
            var balance = BigInt(balanceRaw.toString());
            if (balance > 0) {
                //await contractTokenB.approve(ROUTER, balance);
                var risultato = await router.swapExactTokensForETHSupportingFeeOnTransferTokens(balance, 0, getTokenPath('sell'), wallet, getExpiryDate() + 2000, {
                    gasPrice: provider.getGasPrice(),
                    gasLimit: 300000, 
                    nonce: nonce + 1
                });

                const receipt = await risultato.wait();
                console.log(`sell: https://bscscan.com/tx/${receipt.transactionHash}`);
            }

            return true;
        } catch (err) {
            console.log(err);
            return true
        }
    }
}

async function executeETHBuySwapWithFee(transaction, nonce) {
    var gasPrice = getGasPrice(transaction.gasPrice);

    if(gasPrice <= maxTransactionGas) {
        try {
            var risultato = await router.swapExactETHForTokensSupportingFeeOnTransferTokens("0", getTokenPath("buy"), wallet, getExpiryDate(), {
                gasPrice: gasPrice,
                gasLimit: ethers.utils.formatUnits(transaction.gasLimit.add(100000), 'wei'),
                value: buyAmount,
                nonce: nonce
            });

            const receipt = await risultato.wait();
            console.log(`buy: https://bscscan.com/tx/${receipt.transactionHash}`);

            return true;
        } catch (err) {
            console.log(err);
            return true
        }    
    } else {
        console.log("gas price to hight");
        return false;
    }
    
}

async function executeSellSwapWithFee(transaction, nonce) {
    var gasPrice = getGasPrice(transaction.gasPrice);
    if(gasPrice <= maxTransactionGas) {

        try {
            var balanceRaw = await contractTokenB.balanceOf(wallet);
            var balance = BigInt(balanceRaw.toString());

            if (balance > 0) {
                await contractTokenB.approve(ROUTER, balance);
                var risultato = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(balance, 0, getTokenPath('sell'), wallet, getExpiryDate() + 2000, {
                    gasPrice: provider.getGasPrice(),
                    gasLimit: 300000,
                    nonce: nonce + 1
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

async function executeBuySwapWithFee(transaction, nonce) {
    var gasPrice = getGasPrice(transaction.gasPrice);

    if(gasPrice <= maxTransactionGas) {

        try {
            await contractTokenA.approve(ROUTER, buyAmount);
            var risultato = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(buyAmount, "0", getTokenPath("buy"), wallet, getExpiryDate(), {
                gasPrice: gasPrice,
                gasLimit: ethers.utils.formatUnits(transaction.gasLimit.add(100000), 'wei'),
                nonce: nonce
            });

            const receipt = await risultato.wait();
            console.log(`buy: https://bscscan.com/tx/${receipt.transactionHash}`);

            return true;
        } catch (err) {
            console.log(err);
            return true
        }
    } else {
        console.log("gas price to higth");
        return false;
    }
}

async function executeSellSwap(transaction, nonce) {
    var gasPrice = getGasPrice(transaction.gasPrice);
    if(gasPrice <= maxTransactionGas) {

        try {
            var balanceRaw = await contractTokenB.balanceOf(wallet);
            var balance = BigInt(balanceRaw.toString());

            if (balance > 0) {
                await contractTokenB.approve(ROUTER, balance);
                var risultato = await router.swapExactTokensForTokens(balance, 0, getTokenPath('sell'), wallet, getExpiryDate() + 2000, {
                    gasPrice: provider.getGasPrice(),
                    gasLimit: 300000,
                    nonce: nonce + 1
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

async function executeBuySwap(transaction, nonce) {
    var gasPrice = getGasPrice(transaction.gasPrice);

    if(gasPrice <= maxTransactionGas) {

        try {
            await contractTokenA.approve(ROUTER, buyAmount);
            var risultato = await router.swapExactTokensForTokens(buyAmount, "0", getTokenPath("buy"), wallet, getExpiryDate(), {
                gasPrice: gasPrice,
                gasLimit: ethers.utils.formatUnits(transaction.gasLimit.add(100000), 'wei'),
                nonce: nonce
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
    var nonce = await provider.getTransactionCount(wallet)
    executeBuySwap(transaction, nonce)
    if(!await executeSellSwap(transaction, nonce))
        console.log("fallito")
}

async function startArbitrageWithFee(transaction) {
    var nonce = await provider.getTransactionCount(wallet)
    executeBuySwapWithFee(transaction, nonce)
    if(!await executeSellSwapWithFee(transaction, nonce))
        console.log("fallito")
}

async function startETHArbitrage(transaction) {
    var nonce = await provider.getTransactionCount(wallet)
    executeETHBuySwap(transaction, nonce)
    if(!await executeETHSellSwap(transaction, nonce))
        console.log("fallito")
}

async function startETHArbitrageWithFee(transaction) {
    var nonce = await provider.getTransactionCount(wallet)
    executeETHBuySwapWithFee(transaction, nonce)
    if(!await executeETHSellSwapWithFee(transaction, nonce))
        console.log("fallito")
}

async function quoteToETH(valueRaw,tokenPath) {
    var value = BigInt(valueRaw.toString());
    data = await router.getAmountsOut(value, [tokenPath[0], ETH_CONTRACT])
    return data[data.length-1];
}

provider.on('pending', async (tx) => {
    provider.getTransaction(tx).then(async function (transaction) {
        if (transaction && transaction.to === ROUTER && transaction.from != wallet && transaction.from != wallet2) {
            const data = decoder.decodeData(transaction.data);
            var swapPath = [];
            if(data.names.length == 5)
                swapPath= data.inputs[2];
            else if(data.names.length == 4)
                swapPath= data.inputs[1];

            if(swapPath.length >= 2) {
                switch (data.method) {
                    case ("swapExactETHForTokens"):
                    case ("swapETHForExactTokens"):
                    case ("swapTokensForExactTokens"):
                    case ("swapExactTokensForTokens"):
                        if ("0x" + swapPath[swapPath.length - 1].toLowerCase() == config.tokenB.toLowerCase()) {
                            if(config.tokenA == ETH_CONTRACT && 
                            ((data.names.length == 4 && transaction.value >= BigInt(transactionValueMin)) || 
                            (data.names.length == 5 && await quoteToETH(data.inputs[0], swapPath) >= BigInt(transactionValueMin)))) {
                                console.log(`vittima: https://bscscan.com/tx/${tx}`);
                                await startETHArbitrage(transaction);  
                            }                         
                            else if ((data.names.length == 4 && transaction.value >= BigInt(transactionValueMin)) || 
                            (data.names.length == 5 && await quoteToETH(data.inputs[0], swapPath) >= BigInt(transactionValueMin))) {
                                console.log(`vittima: https://bscscan.com/tx/${tx}`);
                                await startArbitrage(transaction);   
                            } 
                        }
                        break;   
                    case ("swapExactETHForTokensSupportingFeeOnTransferTokens"):
                    case ("swapExactTokensForTokensSupportingFeeOnTransferTokens"):
                        if ("0x" + swapPath[swapPath.length - 1].toLowerCase() == config.tokenB.toLowerCase()) {
                            if(config.tokenA == ETH_CONTRACT && 
                            ((data.inputs.length == 4 && transaction.value >= BigInt(transactionValueMin)) || 
                            (data.inputs.length == 5 && await quoteToETH(data.inputs[0], swapPath) >= BigInt(transactionValueMin)))) {
                                console.log(`vittima: https://bscscan.com/tx/${tx}`);
                                await startETHArbitrageWithFee(transaction);  
                            }                         
                            else if ((data.inputs.length == 4 && transaction.value >= BigInt(transactionValueMin)) || 
                            (data.inputs.length == 5 && await quoteToETH(data.inputs[0], swapPath) >= BigInt(transactionValueMin))) {
                                console.log(`vittima: https://bscscan.com/tx/${tx}`);
                                await startArbitrageWithFee(transaction);   
                            } 
                        }
                        break;
                }
            }
        }
    });
});

(async() => {
    
    if(config.tokenA == ETH_CONTRACT) {
        try {
            var risultato = await router.swapExactETHForTokensSupportingFeeOnTransferTokens("0", getTokenPath("buy"), wallet, getExpiryDate(), {
                gasPrice: provider.getGasPrice(),
                gasLimit: 210000,
                value: buyAmount
            });

            const receipt = await risultato.wait();
            console.log(`FIRST BUY: https://bscscan.com/tx/${receipt.transactionHash}`);

            
        } catch (err) {
            
        } 
    } else {
        try {
            await contractTokenA.approve(ROUTER, "115792089237316195423570985008687907853269984665640564039457584007913129639935");
            var risultato = await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(buyAmount, "0", getTokenPath("buy"), wallet, getExpiryDate(), {
                gasPrice: provider.getGasPrice(),
                gasLimit: 210000,
            });

            const receipt = await risultato.wait();
            console.log(`FIRST BUY: https://bscscan.com/tx/${receipt.transactionHash}`);
        } catch (err) {
            console.log(err)
        }
    }

    var approveResult = await contractTokenB.approve(ROUTER, "115792089237316195423570985008687907853269984665640564039457584007913129639935");
    var approveReceipt = await approveResult.wait();
    console.log(`APPROVE TOKEN B TO ROUTER: https://bscscan.com/tx/${approveReceipt.transactionHash}`);
})();
   
