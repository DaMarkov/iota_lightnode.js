# IOTA Lightnode: a wrapper for the IOTA Javascript Library

## Installation

git clone https://github.com/DaMarkov/iota_lightnode.js.git
cd iota_lightnode.js
npm install

# Documentation

## Getting Started



```js
<script type="text/javascript" src="../dist/iota_lightnode.browser.js"></script>
<script type="text/javascript" src="../deb/curl.min.js"></script>

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