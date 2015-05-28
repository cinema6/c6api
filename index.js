/*
 *
 * Sample code (in Node.js) for authenticating to the Cinema6 API and creating a minireel
 *
 * */

/* 
 * Globals 
 * */
var server = 'https://staging.cinema6.com', // or 'https://portal.cinema6.com' for production
    appKey = 'apidemo', // for grouping collateral (uploaded splash images)
    username = process.argv[2],
    password = process.argv[3],
    splashImg = 'breaking.jpg', // path to splash image
    uploadUrl = server + '/api/collateral/files/' + appKey, // for uploading splash images
    authUrl   = server + '/api/auth/login',
    expUrl    = server + '/api/content/experience',
    expPublicUrl  = server + '/api/public/content/experience/',
    expPreviewUrl = server + '/preview?id=',
    authCookie = null; // will be set by authenticate method

/* 
 * Helper NPM Modules 
 * */
var crypto  = require('crypto'),
    fs      = require('fs'),
    request = require('request'),
    q       = require('q');

/* 
 * Helper Functions 
 * */
var uuid = function(){
        var  result = '', digit, hash = crypto.createHash('sha1');
        for (var i =0; i < 40; i++){
            digit = Math.floor(Math.random() * 999999999) % 36;
            if (digit < 26){
                result += String.fromCharCode(digit + 97);
            } else {
                result += (digit - 26).toString();
            }
        }
        hash.update(result);
        return hash.digest('hex');
    },
    createSplashId = function() { return 'sp-' + uuid().substr(0,14); };
    createCardId = function() { return 'rc-' + uuid().substr(0,14); };

/*
 *  MiniReel document (new MiniReel)
 * */
var newMiniReel = {
    type    : 'minireel',
    appUri  : 'mini-reel-player',
    categories : [ 'comedy' ],
    data : {
        title : 'Top stories from around the web',
        mode  : 'lightbox', // light, lightbox-playlist
        autoplay : true, // can be overridden on a card
        autoadvance: true, // can be overridden on a card
        splash : {
            source : 'specified',
            ratio : '16-9',
            theme : 'vertical-stack'
        },
        collateral : {
            splash : null // will be set in createMiniReel function below
        },
        campaign : {}, // needs to be an empty object
        params  : {},  // needs to be an empty object
        links   : {},  // needs to be an empty object
        deck : [
            {
                id : createCardId(), // At some point we'll move the id create to the back-end
                type : 'youtube',
                title : 'Overhead costs exploding, study finds',
                note : 'Five years after the passage of ObamaCare, there is one expense that’s still causing sticker shock across the healthcare industry: overhead costs.',
                source : 'YouTube', // caption used for video source
                modules: [], // needs an empty array
                collateral : {}, // needs an empty object
                params : {}, // needs an empty object
                links : {}, // needs an empty object
                data : {
                    videoid: 'YraqQabax8A', // native video id (can get from url on video site)
                    href : 'https://www.youtube.com/watch?v=YraqQabax8A', // for link to page
                    thumbs : {
                        small : '//img.youtube.com/vi/YraqQabax8A/2.jpg', // we use video apis for these
                        large : '//img.youtube.com/vi/YraqQabax8A/0.jpg'
                    },
                    skip : true,
                    controls : true, 
                    start: 42.5, //optional
                    end: 58.96 //optional
                }
            },
            {
                id : createCardId(),
                type : 'youtube',
                title : 'Putin Blasts US Over FIFA Arrests',
                note : 'Invoking the fates of Edward J. Snowden and the WikiLeaks founder Julian Assange, President Vladimir V. Putin on Thursday denounced the arrests of top FIFA officials in Zurich as “another blatant attempt by the United States to extend its jurisdiction to other states.”',
                source : 'YouTube',
                modules: [],
                collateral : {},
                params : {},
                links : {},
                data : {
                    videoid: 'uA_ZJ3E3XTM',
                    href: 'https://www.youtube.com/watch?v=uA_ZJ3E3XTM',
                    thumbs: {
                        small: '//img.youtube.com/vi/uA_ZJ3E3XTM/2.jpg',
                        large: '//img.youtube.com/vi/uA_ZJ3E3XTM/0.jpg'
                    },
                    skip : true,
                    controls : false,
                    start : 5.73,
                    end : 11.8
                }
            },
            {
                id : createCardId(),
                type : 'vimeo',
                title : 'The UK Children\'s Word of the Year Isn\'t Really a Word',
                note : 'The children\'s word of the year in the UK isn\'t exactly a word. It\'s hashtag, or the symbol #. After analyzing over 120,000 short story submissions ..',
                source : 'Vimeo',
                modules: [],
                collateral : {},
                params : {},
                links : {},
                data : {
                    videoid: '116763290',
                    href: 'http://vimeo.com/116763290',
                    thumbs: {
                        small: 'https://i.vimeocdn.com/video/503228230_100x75.jpg',
                        large: 'https://i.vimeocdn.com/video/503228230_640.jpg'
                    },
                    skip : true,
                    controls : true,
                    end : 5.73
                }
            },
            {
                id : createCardId(),
                type : 'dailymotion',
                title : 'Khloe Kardashian slammed after she poses with tiger cub during Dubai trip',
                note : 'Khloe Kardashian has upset another group of people with her Dubai selfies. This time it\'s animal rights campaigners who reacted angrily when she posted a picture with a tiger cub.',
                source : 'DailyMotion',
                modules: [],
                collateral : {},
                params : {},
                links : {},
                data : {
                    videoid: 'x11xzwd',
                    href: 'http://www.dailymotion.com/video/x11xzwd',
                    thumbs: {
                        small: 'https://s1-ssl.dmcdn.net/CEWm0/x120-lk0.jpg',
                        large: 'https://s1-ssl.dmcdn.net/CEWm0.jpg'
                    },
                    skip : true,
                    controls : true
                }
            }
        ]
    },
    status : 'pending', // Note: could be 'active' if ready at the time of the create.
    access : 'public'
};

/* 
 * Logins in, returns cookie used for authenticated methods 
 * */
function authenticate() {

    if ((!username) || (!password)) {
        console.log('\nUsage:\n  node index.js [username] [password]\n');
        process.exit(1);
    }

    var loginOpts = {
        url: authUrl,
        json: {
            email       : username,
            password    : password
        }
    }, deferred = q.defer();
   
    console.log('Authenticate with the api server.');
    request.post(loginOpts, function(error, response, body) {
        if (error) {
            console.log('Login error: ', error);
            return deferred.reject(error);
        }
        else if (response.statusCode !== 200) { // 200 on success; 400 on bad request; 401 on wrong email/pass
            console.log('Login failure: ', response.statusCode);
            console.log(body);
            return deferred.reject(body);
        }
        
        console.log('Successful login');
        
        // Successful login sets cookie named "c6Auth", which must be included on subsequent requests
        authCookie = response.headers['set-cookie'][0].match(/c6Auth=[^\s]+/)[0];
        return deferred.resolve(authCookie);
    });

    return deferred.promise;
}

/* 
 * Uploads splashImg to server using collateral api and request form post.
 * Returns relative path to the splash image - used by createMiniReel. 
 * */
function createSplashImage() {
    var postOpts = {
        url: uploadUrl,
        headers: {
            'Cookie': authCookie
        }
    }, deferred = q.defer();
  
    if (!fs.existsSync(splashImg)){
        return q.reject('Cannot find splashImg file: ' + splashImg);
    }

    console.log('Upload splash image (', splashImg,')..');
    var req = request.post(postOpts, function(error, response, body) {
        if (error) {
            console.log(' Error: ', error);
            return deferred.reject(error);
        }
        else if (response.statusCode !== 201) { // 201 on success; 400 on bad request; 401 on unauthorized
            console.log(' Failed: ', response.statusCode);
            console.log(body);
            return deferred.reject(body);
        }
        
        console.log(body);
        return deferred.resolve(JSON.parse(body)[0].path);
    });

    // request will figure out meta-data from the file stream
    req.form().append( 'file', fs.createReadStream(splashImg), { filename : createSplashId() });
    
    return deferred.promise;
}

/* 
 * Creates a MiniReel.  Receives the created splash image relative path.
 * Returns the created MiniReel document.  
 * */
function createMiniReel(splashPath) {

    // Set the splash image using path obtained via createSplashImage
    newMiniReel.data.collateral.splash = '/' + splashPath;

    var postOpts = {
        url: expUrl,
        json: newMiniReel,
        headers: {
            'Cookie': authCookie
        }
    }, deferred = q.defer();
   
    console.log('Create the MiniReel...');
    request.post(postOpts, function(error, response, body) {
        if (error) {
            console.log(' Error: ', error);
            return deferred.reject(error);
        }
        else if (response.statusCode !== 201) { // 201 on success; 400 on bad request; 401 on unauthorized
            console.log(' Failed: ', response.statusCode);
            console.log(body);
            return deferred.reject(body);
        }
        
        console.log(' Success!');
        return deferred.resolve(body);
    });
    
    return deferred.promise;
}

/*
 * Will set the state of the MiniReel to active.  PUT can be used to change other attrs.
 * or add / remove cards.
 * */
function updateMiniReel(reel) {
    
    var expId = reel.id;
    
    // Updates should not have an id or created
    delete reel.id;
    delete reel.created;

    reel.status = 'active';

    var putOpts = {
        url: expUrl + '/' + expId,
        json: reel,
        headers: {
            'Cookie': authCookie
        }
    }, deferred = q.defer();
   
    console.log('Update the MiniReel...');
    request.put(putOpts, function(error, response, body) {
        if (error) {
            console.log(' Error: ', error);
            return deferred.reject(error);
        }
        else if (response.statusCode !== 200) { // 200 on success; 400 on bad request; 401 on unauthorized
            console.log(' Failed: ', response.statusCode);
            console.log(body);
            return deferred.reject(body);
        }
        
        console.log(' Success!');
        return deferred.resolve(body);
    });
    
    return deferred.promise;
}

authenticate()
.then(createSplashImage)
.then(createMiniReel)
.then(updateMiniReel)
.then(function(exp){
    console.log('Full MiniReel Document:');
    console.log(JSON.stringify(exp,null,3));
    console.log('');
    console.log('Public Api Endpoint:');
    console.log(' ',expPublicUrl + exp.id);
    console.log('');
    console.log('Preview link:');
    console.log(' ',expPreviewUrl + exp.id);
    console.log('');
    process.exit(0);
})
.catch(function(err){
    console.log('Failed with: ' + err);
    process.exit(1);
});
