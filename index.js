'use strict'

const express = require('express');
const _ = require('underscore');
const bodyParser = require('body-parser');
const webhook = require('./webhook.js');
const PubSub = require('pubsub-js');
const Joi = require('joi');
const MessageModel = require('./MessageModel.js')(Joi);
const messageModelUtil = require('./messageModelUtil.js');
const Promise = require('promise');
const i18n = require('i18n');
const {
    actionssdk,
    SignIn
} = require('actions-on-google');

PubSub.immediateExceptions = true;

var app = actionssdk({clientId: '538506846675-koeib2bosg44cjmraqbfbaq638q5mqnb.apps.googleusercontent.com'});
var express_app = express();
// express_app.use(bodyParser.urlencoded({extended: true}));
express_app.use(bodyParser.json());
i18n.configure({
    locales: ['en-US', 'es-ES'],
    directory: __dirname + '/locales',
    defaultLocale: 'en-US'
  });

var metadata = {
    allowConfigUpdate: true,
    waitForMoreResponsesMs: 200,
    channelSecretKey: 'fU2HpV5pIgxQ4RBYAwwkVfYTP4Dtoowu',
    channelUrl: 'https://botv2frk1I0052HE46E6Fbots-mpaasocimt.botmxp.ocp.oraclecloud.com:443/connectors/v1/tenants/idcs-6d466372210e4300bb31f4db15e8e96c/listeners/webhook/channels/16cad076-c46d-44f4-80f2-08f98e9aea79'
};

// var randomIntInc = function (low, high) {
//     return Math.floor(Math.random() * (high - low + 1) + low);
// };
  
var setConfig = function (config) {
    metadata = _.extend(metadata, _.pick(config, _.keys(metadata)));
}
  
var sendWebhookMessageToBot = function (channelUrl, channelSecretKey, userId, messagePayload, additionalProperties, callback) {
    webhook.messageToBot(channelUrl, channelSecretKey, userId, messagePayload, additionalProperties, callback);
};

if (metadata.allowConfigUpdate) {
    express_app.put('/config', bodyParser.json(), function (req, res) {
      let config = req.body;
      if (config) {
        setConfig(config);
      }
      res.sendStatus(200).send();
    });
}

var user = null;
///////////////////////////////////////////////////////////////////////////////////////////////////////
app.intent('actions.intent.MAIN', conv => {
    i18n.setLocale(conv.user.locale);
    conv.ask(new SignIn());
});

app.intent('actions.intent.SIGN_IN', (conv, input, signin) => {
    if (signin.status === 'OK') {
        const profile = conv.user.profile.payload;
        user = {
            "firstName": profile.given_name,
            "lastName": profile.family_name,
            "email": profile.email,
            "clientType": 'googleHome'
        };
        conv.ask(i18n.__("welcome", user.firstName));
    } else {
        conv.ask(i18n.__("NotWelcome"))
        conv.ask(new SignIn())
    }
});

app.intent('actions.intent.TEXT', (conv, input) => {
    var userId = user.email;
    if (metadata.channelUrl && metadata.channelSecretKey && userId) {
        const userIdTopic = userId;
        var respondedToGoogle = false;
        var additionalProperties = {
            "profile": user
        };
        var sendToGoogle = function (resolve, reject) {
            if (!respondedToGoogle) {
                respondedToGoogle = true;
                console.log('Prepare to send to Google');
                resolve();
                PubSub.unsubscribe(userIdTopic);
            } else {
                console.log("Already sent response");
            }
        };
        var navigableResponseToGoogle = function (resp) {
            var flag = true;
            var respModel;
            if (resp.messagePayload) {
                respModel = new MessageModel(resp.messagePayload);
            } else {
                // handle 1.0 webhook format as well
                respModel = new MessageModel(resp);
            }
            if(respModel._messagePayload.type == 'text'){
                console.log("text");
                if(respModel._messagePayload.text.toUpperCase().includes("SEE YOU") || respModel._messagePayload.text.toUpperCase().includes("HASTA LUEGO")){
                    flag = false;
                    conv.close(i18n.__("Cancel"));
                }else if(respModel._messagePayload.text.toUpperCase().includes("OOPS")){
                    conv.close(i18n.__("Error"));
                }
            }
            if(flag){
                let messageToGoogle = messageModelUtil.convertRespToText(respModel.messagePayload());
                console.log("Message to Google (navigable):", messageToGoogle)
                conv.ask(messageToGoogle);
            }
        };
        var sendMessageToBot = function (messagePayload) {
            console.log('Creating new promise for', messagePayload);
            return new Promise(function (resolve, reject) {
                var commandResponse = function (msg, data) {
                    console.log('Received callback message from webhook channel');
                    var resp = data;
                    console.log('Parsed Message Body:', resp);
                    if (!respondedToGoogle) {
                        navigableResponseToGoogle(resp);
                    } else {
                        console.log("Already processed response");
                        return;
                    }
                    if (metadata.waitForMoreResponsesMs) {
                        _.delay(function () {
                            sendToGoogle(resolve, reject);
                        }, metadata.waitForMoreResponsesMs);
                    } else {
                        sendToGoogle(resolve, reject);
                    }
                };
                var token = PubSub.subscribe(userIdTopic, commandResponse);
                sendWebhookMessageToBot(metadata.channelUrl, metadata.channelSecretKey, userId, messagePayload, additionalProperties, function (err) {
                    if (err) {
                        console.log("Failed sending message to Bot");
                        conv.say("Failed sending message to Bot.  Please review your bot configuration.");
                        reject();
                        PubSub.unsubscribe(userIdTopic);
                    }
                });
            });
        };
        var handleInput = function (input) {
            var commandMsg = MessageModel.textConversationMessage(input);
            return sendMessageToBot(commandMsg);
        };
        return handleInput(input);
    } else {
        console.log('fuera del if');
        _.defer(function () {
            conv.ask("I don't understand. Could you please repeat what you want?");
        });
    }
});
    
express_app.post('/webhook', bodyParser.json(), (req, res)=>{
    if (webhook.verifyMessageFromBot(req.get('X-Hub-Signature'), req.body, metadata.channelSecretKey)) {
        var message = req.body;
        const userId = req.body.userId;
        if (!userId) {
            return res.status(400).send('Missing User ID');
        }
        res.sendStatus(200);
        PubSub.publish(userId, message);
    } else {
        console.log("Todo mal");
        res.sendStatus(403);
    }
});

express_app.post('/text', app);

express_app.listen(process.env.PORT || 8080, ()=>{
    console.log('Corriendo en puerto 8080');
});
