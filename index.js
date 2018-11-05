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
    SignIn,
    NewSurface,
    Image
} = require('actions-on-google');
var app = actionssdk({clientId: '538506846675-koeib2bosg44cjmraqbfbaq638q5mqnb.apps.googleusercontent.com'});
var express_app = express();
express_app.use(bodyParser.urlencoded({extended: true}));
express_app.use(bodyParser.json());

var metadata = {
    waitForMoreResponsesMs: 500,
    channelSecretKey: '2ngdurGTGYRMW6dc5zfPwQlMmNtFhiE4',
    channelUrl: 'https://amce2bmxp-univcreditsavt.mobile.ocp.oraclecloud.com:443/connectors/v1/tenants/idcs-188833f670f149a3ac2892ac9359b66e/listeners/webhook/channels/FF688C19-69D0-47A2-979B-B92D9C0C8878'
};
var message = null;
var queue = null;

app.intent('actions.intent.MAIN', conv => {
    console.log("Main");
    conv.ask(new SignIn());
});

app.intent('actions.intent.SIGN_IN', (conv, input, signin) => {
    if (signin.status === 'OK') {
        const payload = conv.user.profile.payload;
        conv.ask(`Hi ${payload.name}. What do you want to do next?`)
    } else {
        conv.ask(`I won't be able to save your data, but what do you want to do next?`)
    }
});

app.intent('actions.intent.OPTION', (conv, params, option) => {
    const hasMediaPlayback = conv.surface.capabilities.has('actions.capability.MEDIA_RESPONSE_AUDIO');
    const screen = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
    const availableScreen = conv.available.surfaces.capabilities.has('actions.capability.SCREEN_OUTPUT');
    var userId = conv.user.profile.payload.email;
    return talkToChat(option, userId).then(function (value){
        if(message){
            var response = buildResponse(false);
            if(response.list){
                if(screen){
                    conv.ask(response.ask);
                    conv.ask(response.list);
                }else if(availableScreen){
                    queue = response;
                    var context = "I have some choices for you";
                    var notification = 'Choices';
                    var capabilities = ['actions.capability.SCREEN_OUTPUT'];
                    conv.ask(new NewSurface({context, notification, capabilities}));
                }else{
                    conv.ask(response.ask);
                }
            }else{
                conv.ask(response);
            }
        }else if(hasMediaPlayback){
            var response = buildResponse(true);
            conv.ask(" ");
            conv.ask(response);
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
    const mediaStatus = conv.arguments.get('MEDIA_STATUS');
    const screen = conv.surface.capabilities.has('actions.capability.SCREEN_OUTPUT');
    const availableScreen = conv.available.surfaces.capabilities.has('actions.capability.SCREEN_OUTPUT');
    if (mediaStatus && mediaStatus.status === 'FINISHED') {
        var response = null;
        if(!message){
            response = buildResponse(true);
            conv.ask(" ");
            conv.ask(response);
            conv.ask(new Suggestions(['hi']));
        }else{
            response = buildResponse(false);
            if(response.list){
                if(screen){
                    conv.ask(response.ask);
                    conv.ask(response.list);
                }else if(availableScreen){
                    queue = response;
                    var context = "I have some choices for you";
                    var notification = 'Choices';
                    var capabilities = ['actions.capability.SCREEN_OUTPUT'];
                    conv.ask(new NewSurface({context, notification, capabilities}));
                }else{
                    conv.ask(response.ask);
                }
            }
            else{
                conv.ask(response);
            }
        }
    } else {
        conv.close(`No hay respuestas`);
    }
});

app.intent('actions.intent.TEXT', (conv, input) => {
    const hasMediaPlayback = conv.surface.capabilities.has('actions.capability.MEDIA_RESPONSE_AUDIO');
    var userId = conv.user.profile.payload.email;
    return talkToChat(input, userId).then(function (value){
        if(message){
            conv.ask(buildResponse(false));
        }else if(hasMediaPlayback){
            var response = buildResponse(true);
            conv.ask(" ");
            conv.ask(response);
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

app.intent('actions.intent.NEW_SURFACE', (conv, input, newSurface) => {
    if (newSurface.status === 'OK') {
        if(queue.list){
            conv.ask(queue.ask);
            conv.ask(queue.list);
        }
    } else {
        var list = queue.list.inputValueData.listSelect.items;
        var choices = "";
        for (var i = 0; i < list.length; i++) {
            choices += list[i].optionInfo.key+", ";
        }
        console.log(choices);
        conv.ask(`Ok, I can't show you the choices`);
        conv.ask(queue.ask);
    }
    queue = null;
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
        if(message.choices){
            var title = message.text;
            var choices = message.choices;
            if(choices.length > 1){
                var items = {};
                for (var i = 0; i < choices.length; i++) {
                    items[choices[i]] = {
                        title: choices[i] 
                    };
                };
                response.ask = title;
                response.list = new List({
                    title: title,
                    items: items
                });
            }else{
                response = new SimpleResponse({
                    text: choices[0],
                    speech: choices[0]
                });
            }            
        }else{
            response = new SimpleResponse({
                text: message.text,
                speech: message.text
            }); 
        }    
        message = null;
    }
    return response;
};
    
express_app.post('/webhook', bodyParser.json(), (req, res)=>{
    if (webhook.verifyMessageFromBot(req.get('X-Hub-Signature'), req.body, metadata.channelSecretKey)) {
        console.log("todo bien");
        message = req.body;
        const userId = req.body.userId;
        if (!userId) {
            return res.status(400).send('Missing User ID');
        }
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
