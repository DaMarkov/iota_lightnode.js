var lightnode = require('../dist/iota_lightnode.js');

//var doProofOfWork = false;//TODO



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



lightnode.initializeIOTA();
console.log("IOTA lightnode initialized");

lightnode.setCurlLibrary(curl);
console.log("curl library connected to iota_lightnode");



const providers = [
    "http://173.249.18.180:14265",
    "http://iotanode.party:14265",
    "http://node03.iotatoken.nl:14265",
    "http://node.iota.bar:14265",
    "http://eugene.iotasupport.com:14999",
    "http://iri1.iota.fm:80",
    "http://iri3.iota.fm:80",
    "http://iota-tangle.io:14265",
    "http://node.lukaseder.de:14265",
    "http://node01.iotatoken.nl:14265",
    "http://node05.iotatoken.nl:16265",
    "http://cryptoiota.win:14265",
    "http://137.74.198.100:14265",
    "http://astra2261.startdedicated.net:14265",
    "http://88.198.230.98:14265",
    "http://176.9.3.149:14265",
    "http://5.9.149.169:14265",
    "http://5.9.118.112:14265",
    "http://node02.iotatoken.nl:14265",
    "http://node04.iotatoken.nl:14265",
    "http://iota.love:16000",
    "http://iota.glass:14265",
    "http://35.189.126.122:14265",
    "http://rmnode.de:14265",
    "http://35.198.122.103:14265",
    "http://173.249.19.121:14265",
    "http://india.is.pure.iota.sex:14265",
    "http://iota.bereliable.nl:14265",
    "http://45.77.232.81:14265",
    "http://iota01.nodes.no:14265",
    "http://45.76.246.130:14265",
    "http://173.249.16.113:14265",
    "http://node.hans0r.de:14265",
    "http://iota.kun.com:14265",
    "http://37.221.197.91:14265",
    "http://my.iotaserver.de:14265",
    "http://node.iota.com.tw:5000",
    "http://iota.teamveno.eu:14265",
    "http://35.197.197.126:14265",
    "http://emslaender.spdns.eu:14265",
    "http://37.205.12.49:14265",
    "http://iota.3n.no:14265",
    "http://iota2.3n.no:14265",
    "http://173.249.22.101:14265",
    "http://173.249.18.125:14265",
    "http://pubtest.iotaboost.com:14625",
    "http://213.136.88.82:14265",
    "http://heimelaga.vodka:14265",
    "http://iotausa.mooo.com:14265",
    "http://iota.band:14265",
    "http://iotanode.prizziota.com:80",
    'http://iota-node-nelson.prizziota.com:80',
    "http://node.davidsiota.com:14265",
]

var currentProviderIndex = 0;


const NodeCache = require( "node-cache" );
const myCache = new NodeCache();//const myCache = new NodeCache( { stdTTL: 100, checkperiod: 120 } );

const cacheTrytes = new NodeCache();


var http = require('http');



function switchNode()
{
    currentProviderIndex++;
    if (currentProviderIndex >= providers.length)
        currentProviderIndex = 0;
    console.log("Switching to:", providers[currentProviderIndex]);

    handleRequest({command: "getNodeInfo"}, function(success) {
        console.log(success)
    });
}



function xmlHttpRequest()
{
    if (typeof XMLHttpRequest !== 'undefined')
        return new XMLHttpRequest();

    var module = 'xmlhttprequest';
    var request = require(module).XMLHttpRequest;
    return new request();
}



function sendRequest(command, callback)
{
    var request = xmlHttpRequest();
    request.open('POST', providers[currentProviderIndex], true);
    request.setRequestHeader('Content-Type','application/json');
    request.setRequestHeader('X-IOTA-API-Version', '1');

    request.timeout = 2000;//timeout in milliseconds


    request.onreadystatechange = function()
    {
        if (request.readyState === 4)
        {

            var result = request.responseText;
            // Prepare the result
            //return self.prepareResult(result, command.command, callback);
            callback(undefined, result);
        }
    }

    request.ontimeout = function(error)
    {
        //XMLHttpRequest timed out. Do something here.
        console.log(error);
        console.log("Connection to ", providers[currentProviderIndex], "timed out!");

        switchNode();

        sendRequest(command, callback);
    }

    try
    {
        request.send(JSON.stringify(command));
    } catch(error)
    {
        return callback(error);
    }
}



function handleRequest(obj, callback, body)
{
    if (typeof obj.command !== 'undefined')
    {
        sendRequest(obj, function(error, success)
        {
            //console.log(success);

            try
            {
                var success_obj = JSON.parse(success);//Try to parse, sometimes nodes send error messages in plain html!
            } catch (error)
            {
                console.log("Error, could not parse answer from node! Here is what we received: ", success);
                switchNode();
                handleRequest(obj, callback, body);//Re-request
                return;
            }

            if (error)
                console.log("Error: ", error);
            else if (success)
            {
                if (obj.command === 'getNodeInfo')
                {
                    if (typeof success_obj.appName === 'undefined')
                    {
                        switchNode();
                        handleRequest(obj, callback, body);
                        return;
                    }

                    /*if (success_obj.appName !== 'IRI')
                    {
                        switchNode();
                        handleRequest(obj, callback);
                    }*/

                    success_obj.appName = 'iota_lightnode.js proxy server';
                    success_obj.transactionsToRequest = 10;
                    success = JSON.stringify(success_obj);
                }


                else if (obj.command === 'findTransactions')
                {
                    if (typeof success_obj.hashes === 'undefined')
                    {
                        switchNode();
                        handleRequest(obj, callback, body);
                        return;
                    }
                }

                //console.log("Success: ", success);

                //res.end(success);
                //res.end(JSON.stringify(success));


                if (obj.command === 'getTrytes')
                {
                    //console.log("PUT TO CACHE", body);
                    myCache.set(body, success);
                }

                callback(success);
            }
        });
    }
}



var server = http.createServer(function(req, res)
{
    res.setHeader('Content-Type', 'application/json');

    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-IOTA-API-Version');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Allow', 'GET,HEAD,POST,PUT,DELETE,TRACE,OPTIONS,CONNECT,PATCH');


    if (req.method == 'POST')
    {
        res.writeHead(200);

        var body = '';
        req.on('data', function(data)
        {
            body += data;
        });
        req.on('end', function()
        {
            //Check cache
            myCache.get(body, function( err, value )
            {
                if ( !err )
                {
                    if (value != undefined)
                    {
                        //console.log( "FOUND IN CACHE" );
                        res.end(value);
                        return;
                    }
                }

                //Not found in cache

                try
                {
                    var obj = JSON.parse(body);
                } catch (error)
                {
                    return;//TODO
                }

                console.log(obj.command);

                handleRequest(obj, function(success) {
                    res.end(success);
                }, body);
            });
        });
    }

    else
    {
        res.writeHead(200, {'Content-Type': 'text/html'});

        if (req.method == 'GET')
        {
            var html = '<html><body>iota_lightnode proxy server</body></html>';
            res.end(html);
        }
        else
            res.end();
    }
});



server.listen(14265);

console.log("Server started!");

handleRequest({command: "getNodeInfo"}, function(success)
{
    console.log(success);
});