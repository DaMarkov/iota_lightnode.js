var lightnode = require('../dist/iota_lightnode.js')

lightnode.initializeIOTA();



ffi = require('ffi')

if (process.platform === 'win32')
    var libccurlPath = '../bin/ccurl.dll';
else if (process.platform == 'darwin')
    var libccurlPath = '../bin/libccurl.dylib';
else
    var libccurlPath = '../bin/libccurl.so';

try {
    curl = ffi.Library(libccurlPath, {
        ccurl_pow: [ 'string', [ 'string', 'int'] ],
        ccurl_pow_finalize: [ 'void', [] ],
        ccurl_pow_interrupt: [ 'void', [] ]
    })

    if ((!curl.hasOwnProperty('ccurl_pow')) || (!curl.hasOwnProperty('ccurl_pow_finalize')) || (!curl.hasOwnProperty('ccurl_pow_interrupt'))) {
        throw new Error('Could not load hashing library.')
    }
    console.log('curl library loaded')
}
catch (err) {
      console.log(err.message ? err.message : err)
      curl = null
}

lightnode.setCurlLibrary(curl);


var logger  = console.log;


var seed = lightnode.generateSeedInsecurely();

console.log( "Generated seed:", seed );

lightnode.calculateFirstAddress(seed, function(error, new_address)
{
    var address = new_address;
    
    console.log( "First address of above seed is:", address );


    var value   = 0;
    var tag     = "HELLO9WORLD";//Has to be in Trytes. Only A-Z and 9 allowed!
    var message = "Hello World!";

    var transfer = [{
        'address': address,
        'value': parseInt(value),
        'message': lightnode.toTrytes(message),
        'tag': tag
    }];

    console.log( "Preparing a transaction to above address containing 0 IOTA with the tag 'HELLO9WORLD'." );
    console.log( "The transaction contains the message 'Hello World!' encoded in Trytes which looks likes this:", lightnode.toTrytes(JSON.stringify(message)) );

    console.log( "Sending transaction. Please wait..." );
    console.log( "Depending on the node we are connected to and the proof of work we have to submit this might take a few seconds to minutes." );


    console.log = function() {};

    lightnode.sendTransfer(seed, transfer, function(error, attached_bundle)
    {
        console.log = logger;

        if (error)
        {
            console.error(error);
            console.log( "Error! Could not submit transaction! The node you are connecting to might be down." );
        }
        else
        {
            console.log("Successfully attached your transaction to the tangle");

            console.log( "Your transaction has been attached successfully!" );
            console.log( "The transaction hash is: ", attached_bundle[0].hash );

            var transaction_hash = attached_bundle[0].hash;


            console.log( "Promoting / Waiting for the network to confirm your transaction..." );
            console.log = function() {};

            //Check if transaction is confirmed
            lightnode.ensureBundleGetsConfirmed(attached_bundle, function(success)
            {
                console.log = logger;
                if (success)
                    console.log( "Your transaction has been confirmed by the network!" );
                else
                    console.log( "Error! Properly lost connection to the node!" );
            });
        }
    });
});