const iotaLib      = require("iota.lib.js");
const apiCommands  = require('../src/apiCommands.js');
const makeRequest2 = require('../src/makeRequest2.js');


const MAX_TIMESTAMP_VALUE = (Math.pow(3,27) - 1) / 2 // from curl.min.js

var iota;//Initialized in initializeIOTA
var _curl;
var _transactionList = [];
var _addressList = [];
var _bundleList = [];
var _ParallelLoad = 5;//Number of parallel requests
var _balance = 0;
var _confirmedBalance = 0;
var _syncing = false;
var _checkingConfirmations = 0;//Reference counter
var _preparingBundles = 0;
var _pow = 0;
var _security;
var _depth;
var _minWeightMagnitude;
var _localProofOfWork;
var _remoteAttachToTangle;



//
function _addBundle(bundle)
{
    bundle[0].confirmationStatus = 'Unknown';
    if (!_bundleIsInBundleList(bundle))
    {
        _bundleList.push(bundle);

        for (var i=0;i < bundle.length;i++)//For each transfer
        {
            var index = _indexInAddressList(bundle[i].addresses);

            if (index >= 0)
            {
                _addressList[index].used = true;
                if (bundle[i].value < 0)
                    _addressList[index].usedAsSent = true;
            }
        }

        _buildTransactionList();
    }
}

//
function _indexOfBundle(bundle)
{
    for (var i = 0; i < _bundleList.length; i++)
    {
        if (bundle[0].bundle === _bundleList[i][0].bundle && bundle.length == _bundleList[i].length)//Bundle hash is the same
        {
            var same = true;

            for (var j = 0; j < _bundleList[i].length; j++)
            {
                if (bundle[j].hash !== _bundleList[i][j].hash || bundle[j].address !== _bundleList[i][j].address)
                {
                    same = false;
                    break;
                }
            }

            if (same)
                return i;
        }
    }

    return -1;
}

//
function _bundleIsInBundleList(bundle)
{
    return _indexOfBundle(bundle) >= 0;
}

//
function _isInputAddress(bundle, address)
{
    var inboundAddresses = [];

    for (var i = 0; i < bundle.length; i++)
    {
        if (bundle[i].value < 0)
            inboundAddresses.push( bundle[i].address );
    }

    return inboundAddresses.includes(address);
}

//
function _findTransactionByBundle(bundle)
{
    for (var i = 0; i < _transactionList.length; i++)
    {
        if (_transactionList[i].bundle === bundle[0].bundle)
            return i;
    }

    return -1;
}

//
function _indexInAddressList(address)
{
    for (var i = 0; i < _addressList.length; i++)
    {
        if (typeof _addressList[i] === 'undefined')
            continue;

        if (_addressList[i].address === address)
            return i;
    }

    return -1;
}

//
function _isInAddressList(address)
{
    return _indexInAddressList(address) >= 0;
}

//
function _checkBalance()
{
    _balance = 0;
    _confirmedBalance = 0;

    //Calculate balances
    for (var i = 0;i < _addressList.length;i++)
    {
        if (typeof _addressList[i] === 'undefined')
            continue;

        _addressList[i].balance = _addressList[i].confirmedBalance;
    }


    //Tally up all pending transactions
    for (var i = 0; i < _transactionList.length; i++)//For each transaction
    {
        if (_transactionList[i].confirmationStatus !== 'Pending')
            continue;

        for (var j = 0; j < _transactionList[i].bundles[0].length; j++)//For each transfer of first bundle
        {
            if (_transactionList[i].bundles[0][j].value == 0)
                continue;

            var index = _indexInAddressList(_transactionList[i].bundles[0][j].address);

            if (index >= 0)
                _addressList[index].balance += _transactionList[i].bundles[0][j].value;
        }//End of transfer list
    }//End of transaction list


    //Ensure that balance is not below zero
    for (var i = 0;i < _addressList.length;i++)
    {
        if (typeof _addressList[i] === 'undefined')
            continue;

        if (_addressList[i].balance < 0)
            _addressList[i].balance = 0
        if (_addressList[i].confirmedBalance < 0)
            _addressList[i].confirmedBalance = 0;

        _balance          += _addressList[i].balance;
        _confirmedBalance += _addressList[i].confirmedBalance;
    }

    if (_balance < 0)
        _balance = 0;
    if (_confirmedBalance < 0)
        _confirmedBalance = 0;
}

//
function _buildTransactionList()
{
    console.log("Building Transaction list out of " + _bundleList.length + " bundles", _bundleList);
    _transactionList = [];

    for (var i = 0; i < _bundleList.length; i++)//For each bundle
    {
        var transaction = {};
        var sumOnOurPart = 0;
        var sumTotal     = 0;

        transaction.inbound  = false;
        transaction.outbound = false;

        var hasForeignAddress = false;

        var index = _findTransactionByBundle(_bundleList[i]);

        if (index >= 0)//bundle is already in transaction list
        {
            _transactionList[index].bundles.push( _bundleList[i] );   
            continue;
        }

        for (var j = 0; j < _bundleList[i].length; j++)//For each transfer
        {
            if (_bundleList[i][j].value == 0)
                continue;

            transaction.timestamp           = _bundleList[i][j].timestamp;
            transaction.attachmentTimestamp = _bundleList[i][j].attachmentTimestamp;
            transaction.tag                 = _bundleList[i][j].tag;

            if (_isInAddressList(_bundleList[i][j].address))
            {
                if (_bundleList[i][j].value < 0)
                    transaction.outbound = true;

                sumOnOurPart += _bundleList[i][j].value;
            }
            else
                hasForeignAddress = true;

            if (_bundleList[i][j].value > 0)
                sumTotal += _bundleList[i][j].value;
        }//End of transfer list

        if (!hasForeignAddress)
            transaction.inbound = true;
        else
        {
            if (transaction.outbound)
            {
                transaction.inbound = true;
                    
                for (var j = 0; j < _bundleList[i].length; j++)//For each transfer
                {
                    if (_bundleList[i][j].value == 0)
                        continue;

                    if (!_isInAddressList(_bundleList[i][j].address))
                    {
                        if (_bundleList[i][j].value > 0)
                            transaction.inbound = false;
                    }
                }//End of transfer list
            }

            else
            {
                for (var j = 0; j < _bundleList[i].length; j++)//For each transfer
                {
                    if (_bundleList[i][j].value == 0)
                        continue;

                    if (_isInAddressList(_bundleList[i][j].address))
                    {
                        if (_bundleList[i][j].value > 0)
                            transaction.inbound = true;
                    }
                }//End of transfer list
            }
        }

        if (sumTotal == 0)
            continue;

        transaction.totalValueTransfered = sumTotal;
        transaction.value  = sumOnOurPart;
        transaction.bundle = _bundleList[i][0].bundle;

        transaction.hashes = [];
        transaction.hashes.push( _bundleList[i][0].hash );

        transaction.bundles = [];
        transaction.bundles.push( _bundleList[i] );

        transaction.confirmationStatus = 'Unknown';

        _transactionList.push( transaction );
    }//End of bundle list


    //Calculate confirmation status of every transaction
    for (var i = 0; i < _transactionList.length; i++)//For each transaction
    {
        var foundConfirmed = false;
        var foundPending   = false;
        var foundUnknown   = false;

        for (var j = 0; j < _transactionList[i].bundles.length; j++)//For each bundle
        {
            if (_transactionList[i].bundles[j][0].confirmationStatus === 'Confirmed')
                foundConfirmed = true;
            else if (_transactionList[i].bundles[j][0].confirmationStatus === 'Pending')
                foundPending = true;
            else if (_transactionList[i].bundles[j][0].confirmationStatus === 'Unknown')
                foundUnknown = true;
        }

        if (foundConfirmed)//If one bundle is confirmed, the transaction is confirmed
            _transactionList[i].confirmationStatus = 'Confirmed';
        else if (foundUnknown)
            _transactionList[i].confirmationStatus = 'Unknown';
        else if (foundPending)
            _transactionList[i].confirmationStatus = 'Pending';
        else
            _transactionList[i].confirmationStatus = 'Rejected';

        if (foundConfirmed)//Mark unknown / pending bundles as 'Reattachment Confirmed'
        {
            for (var j = 0; j < _transactionList[i].bundles.length; j++)//For each bundle
            {
                if (_transactionList[i].bundles[j][0].confirmationStatus === 'Pending' || _transactionList[i].bundles[j][0].confirmationStatus === 'Unknown')
                    _transactionList[i].bundles[j][0].confirmationStatus = 'Reattachment Confirmed';
            }
        }
    }


    _transactionList.sort(function(a, b) {
            var x = parseInt(a['attachmentTimestamp']); var y = parseInt(b['attachmentTimestamp']);
            return ((x < y) ? -1 : ((x > y) ? 1 : 0));
    });

    _checkBalance();

    console.log(_transactionList.length + " transactions found", _transactionList);

    return _transactionList;
}

//
function _obtainConfirmations()
{
    var index = 0;
    var hashes = [];

    for (var i = 0; i < _bundleList.length; i++)//For each bundle
    {
        if (_bundleList[i][0].confirmationStatus === 'Confirmed')
            continue;
        if (_bundleList[i][0].confirmationStatus === 'Reattachment Confirmed')
            continue;
        if (_bundleList[i][0].confirmationStatus === 'Rejected')
            continue;

        var sumTotal = 0;

        //Calculate Total sum of transactions
        for (var j = 0;j < _bundleList[i].length; j++)
        {
            if (_bundleList[i][j].value > 0)
                sumTotal += _bundleList[i][j].value;
        }

        if (sumTotal == 0)//Either just a message or an attachment to tangle of an address
            continue;

        setTimeout(_obtainConfirmationOfHash, 500*index, [_bundleList[i][0].hash]);
        _checkingConfirmations++;
        index++;

        if (_bundleList[i][0].confirmationStatus !== 'Unknown')
        {
            setTimeout(_obtainConsistencyOfHash, 500*index, [_bundleList[i][0].hash]);
            _checkingConfirmations++;
            index++;
        }
    }
}

//
function _obtainConfirmationOfHash(hashes)
{
    iota.api.getLatestInclusion(hashes, function(error, states)
    {
        _checkingConfirmations--;

        if (error)
            console.error(error);
        else if (states)
        {
            var bundlesGotConfirmed = [];

            //Mark bundles as confirmed / pending
            for (var i = 0; i < _bundleList.length; i++)//For each bundle
            {
                for  (var k=0;k < hashes.length;k++)
                {
                    if (_bundleList[i][0].hash === hashes[k])
                    {
                        if (states[k])
                        {
                            _bundleList[i][0].confirmationStatus = 'Confirmed';
                            bundlesGotConfirmed.push(_bundleList[i][0].bundle);
                        }
                        else if (_bundleList[i][0].confirmationStatus === 'Unknown')
                            _bundleList[i][0].confirmationStatus = 'Pending';
                    }
                }
            }


            //Mark bundles as Reattachment Confirmed
            for (var i = 0; i < _bundleList.length; i++)//For each bundle
            {
                if (_bundleList[i][0].confirmationStatus !== 'Confirmed')
                {
                    if (bundlesGotConfirmed.includes( _bundleList[i][0].bundle ))
                        _bundleList[i][0].confirmationStatus = 'Reattachment Confirmed';
                }
            }

            _buildTransactionList();
            _checkBalance();
        }
    });
}

//
function _obtainConsistencyOfHash(hashes)
{
    iota.api.isPromotable2(hashes, function(error, isPromotable)
    {
        _checkingConfirmations--;

        if (!error)
        {
            if (!isPromotable)
            {
                console.log("Found rejected");

                for (var i = 0; i < _bundleList.length; i++)//For each bundle
                {
                    if (_bundleList[i][0].hash === hashes[0])
                        _bundleList[i][0].confirmationStatus = 'Rejected';
                }
            }
        }
    });
}

//
function _isArray (value) {
    return value && typeof value === 'object' && value.constructor === Array;
}

//
function _preparePreBundle(recipientAddresses, amounts, tagsTrytes, messagesTrytes)
{
    var inputs    = [];
    var outputs   = [];
    var remainder;
    var totalAmount = 0;

    var preBundle = {
        'inputs':      inputs,
        'outputs':     outputs,
        'remainder':   remainder,
        'totalAmount': totalAmount
    };

    //Either every parameter is an array or none is
    if (_isArray(recipientAddresses) != _isArray(amounts))
        return false;

    if (!_isArray(recipientAddresses))
    {
        var transfer = {
            'address': recipientAddresses,
            'value': parseInt(amounts),
            'message': messagesTrytes,
            'tag': tagsTrytes
        };

        preBundle.outputs.push(transfer);
        preBundle.totalAmount = amounts;
    }
    else
    {
        var totalAmount = 0;

        for (var i=0;i < recipientAddresses.length;i++)
        {
            var transfer = {
                'address': recipientAddresses[i],
                'value': parseInt(amounts[i]),
                'message': messageesTrytes[i],
                'tag': tagsTrytes[i]
            };

            preBundle.outputs.push(transfer);
            preBundle.totalAmount += amounts[i];
        }
    }

    
    //Raise funds
    var fundsRaised = 0;

    for (var i=0;i < _addressList.length;i++)
    {
        if (fundsRaised >= preBundle.totalAmount)
            break;

        if (typeof _addressList[i] === 'undefined')
            continue;

        if (_addressList[i].confirmedBalance > 0)
        {
            fundsRaised += _addressList[i].confirmedBalance;

            var transfer = {
                'address': _addressList[i].address,
                'value': parseInt(_addressList[i].confirmedBalance),
                'addressIndex': i,
                'security': _security
            };

            preBundle.inputs.push(transfer);
        }
    }

    if (fundsRaised > preBundle.totalAmount)//We have to transfer something back
    {
        for (var i=0;i < _addressList.length;i++)
        {
            if (typeof _addressList[i] === 'undefined')
                continue;

            //Has this address already been used as a send address?
            var isSend = false;

            for (var j=0;j < preBundle.inputs.length;j++)
            {
                if (preBundle.inputs[j].address === _addressList[i].address)
                {
                    isSend = true;
                    break;
                }
            }

            if (isSend)//Don't use this address
                continue;

            if (!_addressList[i].usedAsSent)
            {
                var transfer = {
                    'address': _addressList[i].address,
                    'value': parseInt(fundsRaised-preBundle.totalAmount)
                };

                preBundle.remainder = transfer;
                break;
            }
        }
    }

    else if (fundsRaised < preBundle.totalAmount)//Could not raise enough funds!
        return false;

    return preBundle;
}

//
function _getDataOfAddress(seed, security, index)
{
    if (typeof _addressList[index] !== 'undefined')
        return;

    if (index > 0)
    {
        if (typeof _addressList[index-1] === 'undefined')
        {
            setTimeout(_getDataOfAddress, 2000, seed, security, index);
            return _getDataOfAddress(seed, security, index-1);
        }

        if (!_addressList[index-1].used)
            return;
    }

    var addressOptions = {
        index: index,
        total: 1,
        returnAll: true,
        security: security,
        checksum: false
    }

    //Get a list of all addresses associated with the users seed
    iota.api.getNewAddress(seed, addressOptions, function(error, addresses)
    {
        if (error)
            return;

        console.log("got address", addresses[0]);

        var new_address = {};
        new_address.address           = addresses[0];
        new_address.used              = 'Unknown';
        new_address.balance           = 0;
        new_address.confirmedBalance  = 0;
        new_address.updating          = true;
        new_address.usedAsSent        = 'Unknown';

        _addressList[index]  = new_address;

        iota.api.getBalances(addresses, 100, function(error, balances)
        {
            if (error)
                return;

            _addressList[index].confirmedBalance = parseInt(balances.balances[0]);
        })

        //get all bundles from a list of addresses
        iota.api._bundlesFromAddresses(addresses, false, function(error, bundles)
        {
            _addressList[index].updating = false;

            if (error)
                return;

            if (bundles.length == 0)
            {
                _addressList[index].used = false;
                console.log("address " + index + " is unused so far");
            }
            else
            {
                _addressList[index].used = true;

                console.log("address list ", _addressList);

                for (var i=0;i < bundles.length;i++)
                {
                    _addBundle(bundles[i]);

                    for (var j=0;j < bundles[i].length;j++)
                    {
                        if (bundles[i][j].address === addresses[0] && bundles[i][j].value < 0)
                            _addressList[index].usedAsSent = true;
                    }
                }

                _buildTransactionList();

                _getDataOfAddress(seed, security, index+_ParallelLoad);

                console.log("got bundles", bundles);
                console.log("All data of address " + index + " received, querying address " + (index+_ParallelLoad));
            }

            if (_addressList[index].usedAsSent === 'Unknown')
            {
                iota.api.wereAddressesSpentFrom(addresses, function(error, spent)
                {
                    if (spent[0])
                    {
                        _addressList[index].used = true;
                        _addressList[index].usedAsSent = true;
                    }
                    else
                        _addressList[index].usedAsSent = false;
                })
            }
        })
    })
}

//
function _updateDataOfAddress(address, callback, updateNext)
{
    var index = _indexInAddressList(address);

    if (index < 0)
    {
        callback(updateNext);
        return;
    }

    _addressList[index].updating = true;

    //Update balance
    iota.api.getBalances(address, 100, function(error, balances)
    {
        if (error)
            return;

        _addressList[index].confirmedBalance = parseInt(balances.balances[0]);
        _checkBalance();
    })


    //Check if we spent from this address
    if (_addressList[index].usedAsSent === 'Unknown')
    {
        iota.api.wereAddressesSpentFrom(addresses, function(error, spent)
        {
            if (spent[0])
            {
                _addressList[index].used = true;
                _addressList[index].usedAsSent = true;
            }
            else
                _addressList[index].usedAsSent = false;
        })
    }
        
    //get all bundles from a list of addresses
    iota.api._bundlesFromAddresses([address], false, function(error, bundles)
    {
        _addressList[index].updating = false;

        if (error)
        {
            callback(false);
            return;
        }

        if (bundles.length == 0)
        {
            _addressList[index].confirmedBalance = 0;
            _addressList[index].balance          = 0;
            _addressList[index].used       = false;
            _addressList[index].usedAsSent = false;
        }
        else
        {
            _addressList[index].used = true;

            for (var i=0;i < bundles.length;i++)
            {
                _addBundle(bundles[i]);

                for (var j=0;j < bundles[i].length;j++)
                {
                    if (bundles[i][j].address === address && bundles[i][j].value < 0)
                        _addressList[index].usedAsSent = true;
                }
            }

            _buildTransactionList();

            if (updateNext && index+1 < _addressList.length)
                _updateDataOfAddress(_addressList[index+1].address, callback, updateNext)
            else
                callback(true);
        }
    });
}

    //
    function _buildBundleListOfAddress(address)
    {
        var bundleList = [];

        for (var i = 0; i < _bundleList.length; i++)//For each bundle
        {
            var includeBundle = false;

            for (var j = 0; j < _bundleList[i].length; j++)//For each transfer of bundle
            {
                if (_bundleList[i][j].address === address)//Our address is involved
                {
                    includeBundle = true;
                    break;
                }
            }//End of transfer list

            if (includeBundle)
                bundleList.push( _bundleList[i] );
        }//End of transaction list

        return bundleList;
    }

    //
    function _buildTransactionListOfAddress(address)
    {
        var transactionList = [];

        //Tally up all transactions
        for (var i = 0; i < _transactionList.length; i++)//For each transaction
        {
            var includeTransaction = false;

            for (var j = 0; j < _transactionList[i].bundles[0].length; j++)//For each transfer of first bundle
            {
                if (_transactionList[i].bundles[0][j].address === address)//Our address is involved
                {
                    includeTransaction = true;
                    break;
                }
            }//End of transfer list

            if (includeTransaction)
                transactionList.push( _transactionList[i] );
        }//End of transaction list

        return transactionList;
    }

    //
    function _CheckIsSyncing()
    {
        if (_addressList.length == 0 || typeof _addressList[_addressList.length-1] === 'undefined')
        {
            _syncing = true;
            return true;
        }

        for (var i=0;i < _addressList.length;i++)
        {
            if (typeof _addressList[i] === 'undefined')
            {
                _syncing = true;
                return true;

            }

            if (_addressList[i].updating)
            {
                _syncing = true;
                return true;
            }
        }

        _syncing = false;
        return false;
    }

    //
    function _getAccountData(seed)
    {
        // inputValidator: Check if correct seed
        if (!iota.valid.isTrytes(seed))
            return;

        _syncing = true;

        for (var index = 0 ; index < _ParallelLoad; index++)
            setTimeout( _getDataOfAddress, index*2000, seed, _security, index )
    }


// adapted from https://github.com/iotaledger/wallet/blob/master/ui/js/iota.lightwallet.js
const localAttachToTangle = function(trunkTransaction, branchTransaction, minWeightMagnitude, trytes, callback)
{
        console.log("localAttachToTangle() called!");
        if (_preparingBundles > 0)
            _preparingBundles--;
        _pow++;

        const ccurlHashing = function(trunkTransaction, branchTransaction, minWeightMagnitude, trytes, callback)
        {
            const iotaObj = iota;

            // inputValidator: Check if correct hash
            if (!iotaObj.valid.isHash(trunkTransaction)) {
                return callback(new Error("Invalid trunkTransaction"));
            }

            // inputValidator: Check if correct hash
            if (!iotaObj.valid.isHash(branchTransaction)) {
                return callback(new Error("Invalid branchTransaction"));
            }

            // inputValidator: Check if int
            if (!iotaObj.valid.isValue(minWeightMagnitude)) {
                return callback(new Error("Invalid minWeightMagnitude"));
            }

            var finalBundleTrytes = [];
            var previousTxHash;
            var i = 0;

            function loopTrytes() {
                getBundleTrytes(trytes[i], function(error) {
                    if (error)
                        return callback(error);
                    else {
                        i++;
                        if (i < trytes.length)
                            loopTrytes();
                        else {
                            // reverse the order so that it's ascending from currentIndex
                            return callback(null, finalBundleTrytes.reverse());
                        }
                    }
                });
            }

            function getBundleTrytes(thisTrytes, callback) {
                // PROCESS LOGIC:
                // Start with last index transaction
                // Assign it the trunk / branch which the user has supplied
                // IF there is a bundle, chain  the bundle transactions via
                // trunkTransaction together

                var txObject = iotaObj.utils.transactionObject(thisTrytes);
                //txObject.tag = txObject.obsoleteTag;
                txObject.attachmentTimestamp = Date.now();
                txObject.attachmentTimestampLowerBound = 0;
                txObject.attachmentTimestampUpperBound = MAX_TIMESTAMP_VALUE;
                // If this is the first transaction, to be processed
                // Make sure that it's the last in the bundle and then
                // assign it the supplied trunk and branch transactions
                if (!previousTxHash) {
                    // Check if last transaction in the bundle
                    if (txObject.lastIndex !== txObject.currentIndex) {
                        return callback(new Error("Wrong bundle order. The bundle should be ordered in descending order from currentIndex"));
                    }

                    txObject.trunkTransaction  = trunkTransaction;
                    txObject.branchTransaction = branchTransaction;
                } else {
                    // Chain the bundle together via the trunkTransaction (previous tx in the bundle)
                    // Assign the supplied trunkTransaciton as branchTransaction
                    txObject.trunkTransaction  = previousTxHash;
                    txObject.branchTransaction = trunkTransaction;
                }

                var newTrytes = iotaObj.utils.transactionTrytes(txObject);

                if (_curl.hasOwnProperty('pow'))//_curl is properly the WebGL implementation
                {
                    _curl.pow({trytes: newTrytes, minWeight: minWeightMagnitude}).then(function(nonce) {
                        var returnedTrytes = newTrytes.substr(0, 2673-81).concat(nonce);
                        var newTxObject= iotaObj.utils.transactionObject(returnedTrytes);

                        // Assign the previousTxHash to this tx
                        var txHash = newTxObject.hash;
                        previousTxHash = txHash;

                        finalBundleTrytes.push(returnedTrytes);
                        callback(null);
                    }).catch(callback);
                }

                else//Probably CCurl
                {
                    _curl.ccurl_pow.async(newTrytes, minWeightMagnitude, function(error, returnedTrytes)
                    {
                        if (error)
                            return callback(error)
                        else if (returnedTrytes == null)
                            return callback('Interrupted')

                        var newTxObject = iotaObj.utils.transactionObject(returnedTrytes)

                        // Assign the previousTxHash to this tx
                        var txHash = newTxObject.hash
                        previousTxHash = txHash

                        finalBundleTrytes.push(returnedTrytes)
                        callback(null);
                    })
                }
            }

            loopTrytes()
        }


        ccurlHashing(trunkTransaction, branchTransaction, minWeightMagnitude, trytes, function(error, success)
        {
            _pow--;
            if (error)
                console.log(error);
            else
                console.log(success);

            if (callback)
                return callback(error, success);
            else
                return success;
        })
    }

    function _calculateAddresses(seed, index, total, checksum, security, addresses, callback)
    {
        iota.api.getNewAddress(seed, {'index': index, 'checksum': checksum, 'security': security, 'total': 1}, function(error, address)
        {
            if (error)
                callback(error);
            else
            {
                addresses[index] = address[0];
                callback(undefined, addresses);

                index++;
                if (index < total)
                    _calculateAddresses(seed, index, total, checksum, security, addresses, callback);
            }
        });
    }

    function _ensureHashGetsConfirmed(hash, callback, counter)
    {
        var _counter = 0 || counter;

        //Check is a reattachment of our bundle got already confirmed
        for (var i=0;i < _bundleList.length;i++)
        {
            if (_bundleList[i][0].bundle === hash)
            {
                if (_bundleList[i][0].confirmationStatus === 'Confirmed')//OK, we can stop working
                {
                    callback(true);
                    return;
                }
            }
        }

        iota.api.getLatestInclusion([hash], function(error, states)
        {
            if (error)
            {
                console.error(error);
                callback(false);
            }
            else
            {
                if (states[0])
                {
                    //It we know of this transaction, mark as confirmed
                    for (var i=0;i < _bundleList.length;i++)
                    {
                        if (_bundleList[i][0].hash === hash)
                            _bundleList[i][0].confirmationStatus = 'Confirmed';
                    }

                    callback(true);
                }
                else
                {
                    var params = {'interrupt': false, 'delay': 10*1000};

                    setTimeout(function() { params.interrupt = true; }, 60*1000);

                    iota.api.promoteTransaction(hash, _depth, _minWeightMagnitude, [{ 'address': ('9').repeat(81), 'value': parseInt(0) }], params, function(error, attached)
                    {
                        _counter++;
                        console.log("_ENSURE(): COUNTER:", _counter);

                        if (error || _counter >= 10)//Also reattach after about 10 minutes
                        {
                            console.log(error);
                            console.log("_ENSURE(): REATTACHING!!!");

                            //Not promotable, reattach bundle
                            _preparingBundles++;
                            iota.api.replayBundle(hash, _depth, _minWeightMagnitude, function(error, attached_bundle)
                            {
                                if (error)//Reattaching failed
                                {
                                    console.error(error);
                                    setTimeout(_ensureHashGetsConfirmed, 1000, hash, callback, _counter);//Promote original transaction
                                }
                                else
                                {
                                    _addBundle(attached_bundle);
                                    _buildTransactionList();

                                    console.log("Successfully attached your transaction to the tangle with bundle", attached_bundle);
                                    _ensureHashGetsConfirmed(attached_bundle[0].hash, callback, 0);
                                }
                            });
                        }
                        else//Check if confirmed
                            setTimeout(_ensureHashGetsConfirmed, 5000, hash, callback, _counter);
                    });
                }
            }
        })
    }

    //
    function _reattachBundle(bundle, callback)
    {
        _preparingBundles++;
        iota.api.replayBundle(bundle[0].hash, _depth, _minWeightMagnitude, function(error, attached_bundle)
        {
            if (!error)
            {
                _addBundle(attached_bundle);
                _buildTransactionList();
                callback(true);
            }
            else
                callback(false);
        });
    }




module.exports.initializeIOTA = function(security, depth, minWeightMagnitude)
{
    iota = new iotaLib()

    _security           = security || 2;
    _depth              = depth    || 3;
    _minWeightMagnitude = minWeightMagnitude || 14;

    _remoteAttachToTangle   = iota.api.attachToTangle;//Store old function
    iota.api.attachToTangle = localAttachToTangle;//using this because of bug with using curl.overrideAttachToTangle()
    _localProofOfWork = true;

    //Patch iota.lib.js
    //new isPromotable() function with callback
    iota.api.isPromotable2 = function(tail, callback) {
        var self = this;
        var command = apiCommands.checkConsistency(tail);
        self.sendCommand(command, callback);
    }

    //Patch makeRequest.js
    iota.api._makeRequest = new makeRequest2();

    return this;
}

//
module.exports.setCurlLibrary = function(curl) {
    _curl = curl;
    if (_curl.hasOwnProperty('init'))
        _curl.init();
}

//
module.exports.isRemoteProofOfWorkAvailable = function(callback)
{
    var xhr = new XMLHttpRequest();

    var url = iota.provider;
    xhr.open("POST", url, true);

    xhr.setRequestHeader("Content-type", "application/json");
    xhr.setRequestHeader('X-IOTA-API-Version', '1');

    xhr.onreadystatechange = function()
    {
        if (xhr.statusText === "Bad Request")//OK
        {
            lightnode.enableLocalProofOfWork(false);
            callback(true);
        }
        else
        {
            lightnode.enableLocalProofOfWork(true);
            callback(false);
        }
    };

    var data = JSON.stringify({"command": "attachToTangle"});
    xhr.send(data);
}


//
module.exports.getIOTA = function() {
    return iota.api;
}

//
module.exports.getProvider = function() {
    return iota.api._makeRequest.provider;
}

//
module.exports.setProvider = function(provider) {
    iota.api._makeRequest.provider = provider;
}

//
module.exports.calculateAddress = function(seed, index, total, checksum, security, callback) {
    index    = index    || 0;
    total    = total    || 1;
    checksum = checksum || true;
    security = security || _security;

    var addresses = [];

    _calculateAddresses(seed, index, total, checksum, security, addresses, callback);
}

//
module.exports.calculateFirstAddress = function(seed, callback) {
    iota.api.getNewAddress(seed, {'index': 0, 'checksum': true, 'security': _security, 'total': 1}, function(error, addresses)
    {
        if (error)
            callback(error);
        else
            callback(undefined, addresses[0]);
    })
}

//
module.exports.checkConfirmations = function() {
    if (_checkingConfirmations === 0)
        _obtainConfirmations();
}

//
module.exports.enableLocalProofOfWork = function(enable)
{
    if (enable)
        iota.api.attachToTangle = localAttachToTangle;
    else
        iota.api.attachToTangle = _remoteAttachToTangle ;
    _localProofOfWork = enable;
}

//
module.exports.ensureBundleGetsConfirmed = function(bundle, callback) {
    _ensureHashGetsConfirmed(bundle[0].hash, callback, 0);
}

//
module.exports.findBundle = function(bundleHash) {
    for (var i=0;i < _bundleList.length;i++)
    {
        if (_bundleList[i][0].bundle === bundleHash)
            return _bundleList[i];
    }
    return undefined;
}


//WARNING: Not cryptographically secure. Do not use any seeds generated by this generator to actually store any value.
module.exports.generateSeedInsecurely = function() {
            const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ9'
            return Array.from(new Array(81), (x, i) => validChars[Math.floor(Math.random() * validChars.length)]).join('')
}

//
module.exports.getBalance = function() {
    if (_balance < 0) return 0;
        return _balance;
}

//
module.exports.getConfirmedBalance = function() {
            if (_confirmedBalance < 0) return 0;
            return _confirmedBalance;
}

//
module.exports.getTransactions = function() {
    return _transactionList;
}

//
module.exports.getAddresses = function() {
    return _addressList;
}

module.exports.getBundles = function() {
    return _bundleList;
}

//
module.exports.getBundlesOfAddress = function(address) {
    return _buildBundleListOfAddress(address);
}

//
module.exports.getBundlesOfAddressIndex = function(index) {
    return _buildBundleListOfAddress(_addressList[index].address);
}

//
module.exports.getTransactionsOfAddress = function(address) {
    return _buildTransactionListOfAddress(address);
}

//
module.exports.getTransactionsOfAddressIndex = function(index) {
    return _buildTransactionListOfAddress(_addressList[index].address);
}

//
module.exports.getAccountData = function(seed, security) {
    return _getAccountData(seed, security);
}

//
module.exports.isCheckingConfirmations = function() {
    return _checkingConfirmations !== 0;
}

//
module.exports.isSyncing = function() {
    return _CheckIsSyncing();
}

//
module.exports.isProofOfWorkLocal = function() {
    return _localProofOfWork;
}

//
module.exports.createPreBundle = function(recipientAddresses, amounts, tagsTrytes, messagesTrytes) {
    return _preparePreBundle(recipientAddresses, amounts, tagsTrytes, messagesTrytes);
}

//
module.exports.reattachBundle = function(bundle, callback) {
    _reattachBundle(bundle, callback);
}

//
module.exports.reattachTransaction = function(transactions, callback) {
    _reattachBundle(transaction.bundles[0], callback);
}

//
module.exports.sendTransfer = function(seed, transfers, callback)
{
    _preparingBundles++;
    iota.api.sendTransfer(seed, _depth, _minWeightMagnitude, transfers,  function(error, attached)
    {
        if (attached)
            _addBundle(attached);

        callback(error, attached);
    });
}

//
module.exports.signPreBundle = function(seed, preBundle, callback)
{
    for (var i=0;i < preBundle.inputs.length;i++)
    {
        preBundle.inputs[i].balance  = preBundle.inputs[i].value;
        preBundle.inputs[i].keyIndex = preBundle.inputs[i].addressIndex;
        delete preBundle.inputs[i].value;
        delete preBundle.inputs[i].addressIndex;
    }

    var remainderAddress;
    if (typeof preBundle.remainder !== 'undefined')
        remainderAddress = preBundle.remainder.address;

    iota.api.prepareTransfers2(seed, preBundle.outputs, {'inputs': preBundle.inputs, 'address': remainderAddress}, callback);
}

//
module.exports.sendPreBundle = function(seed, preBundle, callback)
{
    _preparingBundles++;
    for (var i=0;i < preBundle.inputs.length;i++)
    {
        preBundle.inputs[i].balance  = preBundle.inputs[i].value;
        preBundle.inputs[i].keyIndex = preBundle.inputs[i].addressIndex;
        delete preBundle.inputs[i].value;
        delete preBundle.inputs[i].addressIndex;
    }

    var remainderAddress;
    if (typeof preBundle.remainder !== 'undefined')
        remainderAddress = preBundle.remainder.address;

    iota.api.sendTransfer(seed, _depth, _minWeightMagnitude, preBundle.outputs, {'inputs': preBundle.inputs, 'address': remainderAddress}, function(error, attached)
    {
        if (attached)
            _addBundle(attached);

        callback(error, attached);
    });
}

//
module.exports.sendSignedBundle = function(signedBundle, callback)
{
    options = {};
    iota.api.sendTrytes(signedBundle, _depth, _minWeightMagnitude, options, callback);
}

//
module.exports.toTrytes = function(input) {
    return iota.utils.toTrytes(input);
}

//
module.exports.fromTrytes = function(input) {
    return iota.utils.fromTrytes(input);
}

//
module.exports.isPerformingTransfers = function() {
    return _preparingBundles;
}

//
module.exports.isPerformingProofOfWork = function() {
    return _pow;
}

//
module.exports.isInputAddress = function(bundle, address) {
    return _isInputAddress(bundle, address);
}


//
module.exports.isOutputAddress = function(bundle, address) {
    return !_isInputAddress(bundle, address);
}

//
module.exports.isInAddressList = function(address) {
    return _indexInAddressList(address) >= 0;
}

//
module.exports.updateAddress = function(address, callback) {
    _updateDataOfAddress(address, callback, false);
}

//
module.exports.updateAddressesOneByOne = function(callback)
{
    if (_CheckIsSyncing())
    {
        callback(false);
        return;
    }

    if (typeof _addressList[0] === 'undefined')
    {
        callback(false);
        return;
    }

    _updateDataOfAddress(_addressList[0].address, callback, true);
}