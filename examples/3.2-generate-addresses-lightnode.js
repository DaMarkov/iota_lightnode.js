var iota_lightnode = require('../dist/iota_lightnode.js')

iota_lightnode.initializeIOTA();

var total = 10;
var seed  = iota_lightnode.generateSeedInsecurely();

console.log("Seed:", seed);


console.log("Addresses with security=1");
console.log("-------------------------");

iota_lightnode.calculateAddress(seed, 0, total, true, 1, function(error, addresses)
{
    if (addresses.length != total)
        return;
    console.log(addresses);

    console.log("Addresses with security=2");
    console.log("-------------------------");

    iota_lightnode.calculateAddress(seed, 0, total, true, 2, function(error, addresses)
    {
        if (addresses.length != total)
            return;
        console.log(addresses);

        console.log("Addresses with security=3");
        console.log("-------------------------");

        iota_lightnode.calculateAddress(seed, 0, total, true, 3, function(error, addresses)
        {
            if (addresses.length != total)
                return;
            console.log(addresses);
        });
    });
});