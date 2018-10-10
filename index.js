'use strict'

const express = require('express');
const bodyParser = require('body-parser');
const webhook = require('./webhook.js');
const Promise = require('promise');
const {
    actionssdk,
    MediaObject,
    SimpleResponse,
    Suggestions,
    List,
    Image
} = require('actions-on-google');
var app = actionssdk();
var express_app = express();
express_app.use(bodyParser.urlencoded({extended: true}));
express_app.use(bodyParser.json());

var metadata = {
    waitForMoreResponsesMs: 500,
    channelSecretKey: '0pfWWal6QabPCFjdXweAgkHeH7KPs970',
    channelUrl: 'https://amce2bmxp-univcreditsavt.mobile.ocp.oraclecloud.com:443/connectors/v1/tenants/idcs-188833f670f149a3ac2892ac9359b66e/listeners/webhook/channels/E7A528F6-660F-425A-87B6-DA39B768FA69'
};
var message = [];

app.intent('actions.intent.MAIN', conv => {
    console.log('entra en main');
    conv.ask(new SimpleResponse({
        text: 'Hi, How is it going?',
        speech: 'Hi, How is it going?'
    }));
});

app.intent('actions.intent.OPTION', (conv, params, option) => {
    const hasMediaPlayback = conv.surface.capabilities.has('actions.capability.MEDIA_RESPONSE_AUDIO');
    var userId = conv.body.user.userId;
    console.log('entra en options');
    return talkToChat(option, userId).then(function (value){
        if(message){
            conv.ask(buildResponse(false));
        }else if(hasMediaPlayback){
            conv.ask("Media Response from Option intent");
            conv.ask(buildResponse(true));
            conv.ask(new Suggestions(['hi']));
        }else{
            conv.ask(new SimpleResponse({
                text: "Mala suerte",
                speech: "Mala suerte"
            }));   
        }
    }).catch(function(error){
        console.log(error);
        conv.ask(new SimpleResponse({
            text: error.error,
            speech: error.error
        }));
    });
});

app.intent('actions.intent.MEDIA_STATUS', conv => {
    console.log('entra en media status');
    const mediaStatus = conv.arguments.get('MEDIA_STATUS');
    const listResponse = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
    if (mediaStatus && mediaStatus.status === 'FINISHED') {
        var response = null;
        if(!message){
            response = buildResponse(true);
            conv.ask(" ");
            conv.ask(response);
            conv.ask(new Suggestions(['hi']));
        }else{
            response = buildResponse(false);
            if(response.list && listResponse){
                conv.ask(response.ask);
                conv.ask(response.suggestions);
                conv.ask(response.list);    
            }else{
                conv.ask(response);
            }
        }
    } else {
        conv.close(`No hay respuestas`);
    }
});

app.intent('actions.intent.TEXT', (conv, input) => {
    console.log('entra en text');
    const hasMediaPlayback = conv.surface.capabilities.has('actions.capability.MEDIA_RESPONSE_AUDIO');
    var userId = conv.body.user.userId;
    return talkToChat(input, userId).then(function (value){
        if(message.length > 0){
            conv.ask(buildResponse(false));
        }else if(hasMediaPlayback){

            conv.ask(" ");
            conv.ask(buildResponse(true));
            conv.ask(new Suggestions(['hi']));
        }else{
            conv.ask(new SimpleResponse({
                text: "Mala suerte",
                speech: "Mala suerte"
            }));   
        }
        
    }).catch(function(error){
        console.log(error);
        conv.ask(new SimpleResponse({
            text: error.error,
            speech: error.error
        }));
    });
});

var talkToChat = function(input, userId){
    return new Promise(function (resolve, reject){
        if(userId && input){
            webhook.messageToBot(metadata.channelUrl, metadata.channelSecretKey, userId, input, function(value){
                if(value){
                    resolve(value.msg);
                }else{
                    console.log("error");
                    reject({"error": "Error por cosas"});   
                }
            });
        }else{
            reject({"error": "userId or input is wrong."});
        }
        
    });
};

var buildResponse = function(media){
    var response = {};
    if(media){
        response = new MediaObject({
            name: 'Processing',
            url: 'http://img.rsantrod.es/sonido/1second.mp3'
        });
    }
    else if(!media){
        var msg = message[0];
        if(msg.choices){
            var title = msg.text;
            var choices = msg.choices;
            var items = {};
            for (var i = 0; i < choices.length; i++) {
                items[choices[i]] = {
                    title: `User ${choices[i]}` 
                };
            };
            response.ask = 'Choose an user from the list';
            response.suggestions = new Suggestions(['hi']);
            response.list = new List({
                title: title,
                items: items
            });
        }else{
            for (var i = 0; i < message.length; i++) {
                var msg = message[i];
                response = new SimpleResponse({
                    text: msg.text,
                    speech: msg.text
                });
            }
        }    
        message = [];
    }
    return response;
};
    
express_app.post('/webhook', bodyParser.json(), (req, res)=>{
    message.push(req.body);
	const userId = req.body.userId;

	if (!userId) {
        return res.status(400).send('Missing User ID');
    }
    if (webhook.verifyMessageFromBot(req.get('X-Hub-Signature'), req.body, metadata.channelSecretKey)) {
        console.log("todo bien");
        res.sendStatus(200);
    } else {
        console.log("Todo mal");
        res.sendStatus(403);
    }
});

express_app.post('/text', app);

express_app.listen(process.env.PORT || 8080, ()=>{
    console.log('Corriendo en puerto 8080');
});
