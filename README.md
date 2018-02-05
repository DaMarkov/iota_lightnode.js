# IOTA Lightnode: a wrapper for the IOTA Javascript Library

## Installation

```
git clone https://github.com/DaMarkov/iota_lightnode.js.git
cd iota_lightnode.js
npm install
```


## Getting Started


```js
<script type="text/javascript" src="dist/iota_lightnode.browser.js"></script>
<script type="text/javascript" src="deb/curl.min.js"></script>

<script>

var lightnode = window.iota_lightnode.initializeIOTA();
lightnode.setCurlLibrary(window.curl);

var seed = lightnode.generateSeedInsecurely();

lightnode.calculateFirstAddress(seed, function(error, new_address)
{
	//Attach address to tangle
    var transfer = [{
        'address': new_address,
        'value': parseInt(0),
    }];

    lightnode.sendTransfer(seed, transfer, function(error, attached_bundle)
    {
        if (error)
        {
            console.error(error);
            console.log( "Error! Could not submit transaction! The node you are connecting to might be down.<br>" );
        }
        else
        {
            console.log( "Successfully attached your transaction to the tangle with bundle", attached_bundle);
            console.log( "The transaction hash is: ", attached_bundle[0].hash );
        }
    });
});

</script>
```



---

## Reference

- **[calculateAddress](#calculateaddress)**
- **[calculateFirstAddress](#calculatefirstaddress)**
- **[checkConfirmations](#checkconfirmations)**
- **[createPreBundle](#createprebundle)**
- **[enableLocalProofOfWork](#enablelocalproofofwork)**
- **[ensureBundleGetsConfirmed](#ensurebundlegetsconfirmed)**
- **[findBundle](#findbundle)**
- **[fromTrytes](#fromtrytes)**
- **[generateSeedInsecurely](#generateseedinsecurely)**
- **[getBalance](#getbalance)**
- **[getConfirmedBalance](#getconfirmedbalance)**
- **[getTransactions](#gettransactions)**
- **[getAddresses](#getaddresses)**
- **[getBundles](#getbundles)**
- **[getBundlesOfAddress](#getbundlesofaddress)**
- **[getBundlesOfAddressIndex](#getbundlesofaddressindex)**
- **[getTransactionsOfAddress](#gettransactionsofaddress)**
- **[getTransactionsOfAddressIndex](#gettransactionsofaddressindex)**
- **[getAccountData](#getaccountdata)**
- **[initializeIOTA](#initializeiota)**
- **[isCheckingConfirmations](#ischeckingconfirmations)**
- **[isRemoteProofOfWorkAvailable](#isremoteproofofworkavailable)**
- **[isSyncing](#issyncing)**
- **[isProofOfWorkLocal](#isproofofworklocal)**
- **[isPerformingTransfers](#isperformingtransfers)**
- **[isPerformingProofOfWork](#isperformingproofofwork)**
- **[isInputAddress](#isinputaddress)**
- **[isOutputAddress](#isoutputaddress)**
- **[isInAddressList](#isinaddresslist)**
- **[getIOTA](#getiota)**
- **[getProvider](#getprovider)**
- **[setProvider](#setprovider)**
- **[reattachBundle](#reattachbundle)**
- **[reattachTransaction](#reattachtransaction)**
- **[sendTransfer](#sendtransfer)**
- **[setCurlLibrary](#setcurllibrary)**
- **[signPreBundle](#signprebundle)**
- **[sendPreBundle](#sendprebundle)**
- **[sendSignedBundle](#sendsignedbundle)**
- **[toTrytes](#totrytes)**
- **[updateAddress](#updateaddress)**
- **[updateAddressesOneByOne](#updateaddressesonebyone)**

---



### `calculateAddress`

Initializes iota_lightnode.js and iota.lib.js. This function has to be called before any other function of iota_lightnode.js can be called.

#### Input
```js
window.iota_lightnode.calculateAddress(seed, index, total, checksum, security, callback(error, addresses))
```

1. **`seed`**: `81-trytes` seed used to generate the address.
2. **`index`**: `integer` index of the (first) address to be generated. Set to 0 to obtain the first address of the seed, 1 to obtain the second, etc. Default: 0.
3. **`total`**: `integer` number of addresses to be generated. Default: 1.
4. **`checksum`**: `bool` Set to `true` to generate address with a checksum (90 `trytes` long). If set to `false`, addresses generated will lack a checksum. Default: `false`.
5. **`security`**: `integer` security parameter that is used for the addresses. Default: The default was set when `initializeIOTA()` was called.
5. **`callback`**: `function` This function will be called `total` number of times. The first parameter contains any error(s), the second an array of the addresses that have (so far) been generated.

#### Return Value

None

#### Example

```js
var seed  = OFMEOSBNBTAXQTGBHLVRRPAMPYUXZAFBAIHMJQHCSVPUELJMHNCNMSTX9DWZH9INOU9OJAUTPOYOTRZKY;
var total = 10;

window.iota_lightnode.calculateAddress(seed, 0, total, true, 3, function(error, addresses) {
	console.log(addresses.length, "have been generated so far:", addresses);
});
```



### `initializeIOTA`

Initializes iota_lightnode.js and iota.lib.js. This function has to be called before any other function of iota_lightnode.js can be called.

#### Input
```js
window.iota_lightnode.initializeIOTA(security, depth, minWeightMagnitude)
```

1. **`security`**: `integer` security parameter that should be used for address generation if no additional security parameter is supplied. Default: 2.
2. **`depth`**: `integer` depth parameter for iota.lib.js. Used in the tip selection algorithm. Default: 3.
2. **`minWeightMagnitude`**: `integer` minimum weight parameter used for the proof of work. The difficult of the proof of work increases with this parameter. Currently, only transactions with weight magnitude >= 14 will be accepted by the network (of main net). Default: 14

#### Return Value

1. **`Object`** - returns the iota_lightnode object.

#### Example

```js
var lightnode = window.iota_lightnode.initializeIOTA();
```




---