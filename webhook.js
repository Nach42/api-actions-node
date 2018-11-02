const crypto = require('crypto');
const request = require('request');
const Promise = require('promise');

function verifyMessageFromBot(signature, msgBody, secretKey) {
    if (!signature) {
        console.log('Missing signature');
        return false;
    }
    const body = Buffer.from(JSON.stringify(msgBody), 'utf8');
    const calculatedSig = buildSignatureHeader(body, secretKey);
    if (signature !== calculatedSig) {
        console.log('Invalid signature:', signature);
        console.log('Body: \n"%s"', body);
        console.log('Calculated sig: %s', calculatedSig);
        return false;
    }
    return true;
}

function buildSignatureHeader(buf, secret) {
    var msg_signature = buildSignature(buf, secret);
    console.log(msg_signature);
    return msg_signature;
}
function buildSignature(buf, secret) {
    const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'utf8'));
    hmac.update(buf);
    var msg_hmac_digest = "sha256=" + hmac.digest('hex');
    return msg_hmac_digest;
}

function messageToBot(channelUrl, channelSecretKey, userId, input, callback) {
    var outMsg = {userId:userId, text:input};
    
    const body = Buffer.from(JSON.stringify(outMsg), 'utf8');
    const headers = {};
    headers['Content-Type'] = 'application/json; charset=utf-8';
    headers['X-Hub-Signature'] = buildSignatureHeader(body, channelSecretKey);
    request.post({
        uri: channelUrl,
        headers: headers,
        body: body,
        timeout: 60000,
        followAllRedirects: true,
        followOriginalHttpMethod: true,
        callback: function(err, res, body) {
            if (err) {                   
                console.log('err: '+err);
                callback(null);
            } else {
                console.log('Mensaje enviado: ' + JSON.stringify(res));
                console.log('Mensaje enviado 2: ' + JSON.stringify(body));
                callback({"msg": "OK"});
            }
        }
    });
}

module.exports = {
	messageToBot: messageToBot,
	verifyMessageFromBot: verifyMessageFromBot
}