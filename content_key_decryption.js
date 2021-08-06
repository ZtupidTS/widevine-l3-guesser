/*
This is where the magic happens
*/


var WidevineCrypto = {};


// Convert a hex string to a byte array
function hexToBytes(hex) {
    for (var bytes = [], c = 0; c < hex.length; c += 2)
    bytes.push(parseInt(hex.substr(c, 2), 16));
    return bytes;
}

// Convert a byte array to a hex string
function bytesToHex(bytes) {
    for (var hex = [], i = 0; i < bytes.length; i++) {
        var current = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
        hex.push((current >>> 4).toString(16));
        hex.push((current & 0xF).toString(16));
    }
    return hex.join("");
}
var _evid=10;
function sendMessagePromise( item) {
    return new Promise((resolve, reject) => {
        var id=_evid;
        _evid+=1;
        var event = new CustomEvent("PassToBackground", {detail: {item:item,id:id}});
        window.dispatchEvent(event);
        window.addEventListener("BackgroundReply_"+id, function(evt) {
  
            if(evt.detail) {
                resolve(evt.detail);
            } else {
                reject('Something wrong');
            }
        },{once:true});
    });
}


(async function() {

WidevineCrypto.cryptoJS=CryptoJS;
// The public 2048-bit RSA key Widevine uses for Chrome devices in L3, on Windows
WidevineCrypto.initLog=function()
{
    try
    {
        if(document.body)
        {
          var i = document.createElement('iframe'); i.style.display = 'none'; document.body.appendChild(i);
          window.sconsole = i.contentWindow.console;  
          if (window.sconsole)
          this._log=window.sconsole.log;
        }

    }
    catch
    {
        console.info("Init log failed");
    }
}
WidevineCrypto._log=null;
WidevineCrypto.log=function() {
    if(this._log)
    {
        this._log.apply(null,arguments);
        return;
    }
    if (window.sconsole)
        this._log=window.sconsole.log;
    else
        this.initLog()
     if(this._log)
    {
        this._log.apply(null,arguments);
    }
    else
    {
        //fallback
        console.log.apply(null,arguments);
    }
}

//WidevineCrypto.Module= await WasmDsp();
//await WidevineCrypto.Module.ready;
//_freeStr=WidevineCrypto.Module._freeStr;
//stringToUTF8=WidevineCrypto.Module.stringToUTF8;
//writeArrayToMemory=WidevineCrypto.Module.writeArrayToMemory;
//UTF8ToString=WidevineCrypto.Module.UTF8ToString;
//stackSave=WidevineCrypto.Module.stackSave;
//stackRestore=WidevineCrypto.Module.stackRestore;
//stackAlloc=WidevineCrypto.Module.stackAlloc;


//WidevineCrypto.tryUsingDecoder = WidevineCrypto.swrap('tryUsingDecoder', 'string', ['string']); 

WidevineCrypto.tryUsingDecoder = async function (data)
{
    var res=await sendMessagePromise({name:"dec",value:data});
    return res;
}
WidevineCrypto.chromeRSAPublicKey = 
`-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvKg9eT9JPEnfVYYS50x3
MZirSQHyA2m/rxWY1x42LvE6ub47TU1zxjN4VC0jvrpWrU1YnB5/FR4lz296OPj/
H/SR1dLfyXFhe22VWUBuOlEnsq693qll4N/PTFCuJByvnoe/4zsNthm1w5XjmG4x
CjJ4+ZC0E5pCGvdLPk4VSCUN7I8XVbA45hBp4lR5g+2Th4VJtKn1+qG+9yp1qZKf
pyQPseRrlYcXDvmTwpw18fFF5Vv+wN6F0rlAnWWZscNIv3bdRBq9UwM0deMmf5Fk
fCWE2XTTrXuMDDNxFVbWws8jv3kFsXpoxiKgWApiPBr59EYpTV8t5Qch2F619Jtw
EwIDAQAB
-----END PUBLIC KEY-----`;

// The private 2048-bit RSA key Widevine uses for authenticating Chrome devices in L3, on Windows
// Could not extract it completely, so resorted to clumsy code lifting


WidevineCrypto.initializeKeys = async function()
{
    // load the device RSA keys for various purposes
    this.publicKeyEncrypt =  await crypto.subtle.importKey('spki', PEM2Binary(this.chromeRSAPublicKey),   {name: 'RSA-OAEP', hash: { name: 'SHA-1' },}, true, ['encrypt']);
    this.publicKeyVerify =   await crypto.subtle.importKey('spki', PEM2Binary(this.chromeRSAPublicKey),   {name: 'RSA-PSS',  hash: { name: 'SHA-1' },}, true, ['verify']);

    this.keysInitialized = true;
}
WidevineCrypto.tryDecodingKey=async function(encKey)
{

    let hex=bytesToHex(encKey);
    let res=await this.tryUsingDecoder(hex);
    this.log(hex);
   
    this.log("Output");
    this.log(res);
    if(res.length<10)
    {
        throw "Could not remove padding, probably invalid key or decoding failure"
    }
    return new Uint8Array(hexToBytes(res));
}

WidevineCrypto.decryptContentKey = async function(sesid,sdat)
{
    await this.initLog();
    licenseRequest = SignedMessage.read(new Pbf(sdat.licenseRequest));
    licenseResponse = SignedMessage.read(new Pbf(sdat.licenseResponse));
    //console.log("Decrypting?")
    //console.log("Request (from us)")
    this.log(licenseRequest)
    //console.log("Response")
    this.log(licenseResponse)
    if (licenseRequest.type != SignedMessage.MessageType.LICENSE_REQUEST.value) return;

    license = License.read(new Pbf(licenseResponse.msg));
    
    if (!this.keysInitialized) await this.initializeKeys();
    
    // make sure the signature in the license request validates under the private key
    var signatureVerified = await window.crypto.subtle.verify({name: "RSA-PSS", saltLength: 20,}, this.publicKeyVerify, 
                                                              licenseRequest.signature, licenseRequest.msg)
    if (!signatureVerified)
    {
        this.log("Can't verify license request signature; either the platform is wrong or the key has changed!");
        return null;
    }
    var sessionKey=await this.tryDecodingKey(licenseResponse.session_key);
    // decrypt the session key
    // = await crypto.subtle.decrypt({name: "RSA-OAEP"}, this.privateKeyDecrypt, licenseResponse.session_key);

    // calculate context_enc
    var encoder = new TextEncoder();
    var keySize = 128;
    var context_enc = concatBuffers([[0x01], encoder.encode("ENCRYPTION"), [0x00], licenseRequest.msg, intToBuffer(keySize)]);

    // calculate encrypt_key using CMAC
    var encryptKey = wordToByteArray(
                    this.cryptoJS.CMAC(arrayToWordArray(new Uint8Array(sessionKey)), 
                                  arrayToWordArray(new Uint8Array(context_enc))).words);

    // iterate the keys we got to find those we want to decrypt (the content key(s))
    var contentKeys = []
    for (currentKey of license.key)
    {
        if (currentKey.type != License.KeyContainer.KeyType.CONTENT.value) continue;

        var keyId = currentKey.id;
        var keyData = currentKey.key.slice(0, 16); 
        var keyIv = currentKey.iv.slice(0, 16);

        // finally decrypt the content key
        var decryptedKey = wordToByteArray(
            this.cryptoJS.AES.decrypt({ ciphertext: arrayToWordArray(keyData) }, arrayToWordArray(encryptKey), { iv: arrayToWordArray(keyIv) }).words);
        sdat.keys.set(toHexString(keyId),toHexString(decryptedKey));
        contentKeys.push(decryptedKey);
        this.log("WidevineDecryptor: Session: "+sesid+ " KID= " + toHexString(keyId)+" Key: "+toHexString(decryptedKey) );
        try {
                // if (!window.__wvcounter)
                //     window.__wvcounter = 0;
                let _kid = toHexString(keyId);
                let _hex = toHexString(decryptedKey);
                let _data = { kid: _kid, base64_key: btoa(String.fromCharCode.apply(null, new Uint8Array(decryptedKey))), hex_key: _hex };
                window.postMessage({ action: "pushKey", data: _data }, '*');
                // if (!window.top.document.getElementById(escape(JSON.stringify(_data)))) {
                //     window.postMessage({ action: "pushKey", data: _data });
                //     window.postMessage({ action: "noticeKey", count: (++__wvcounter).toString() }); //处理逻辑在content_script
                // }
        } catch (e) {
           console.log(e)
        }
    }

    return contentKeys[0];
}

//
// Helper functions
//

async function isRSAConsistent(publicKey, privateKey)
{
    // See if the data is correctly decrypted after encryption
    var testData = new Uint8Array([0x41, 0x42, 0x43, 0x44]);
    var encryptedData = await crypto.subtle.encrypt({name: "RSA-OAEP"}, publicKey, testData);
    var testDecryptedData = await crypto.subtle.decrypt({name: "RSA-OAEP"}, privateKey, encryptedData);

    return areBuffersEqual(testData, testDecryptedData);
}

function areBuffersEqual(buf1, buf2)
{
    if (buf1.byteLength != buf2.byteLength) return false;
    var dv1 = new Int8Array(buf1);
    var dv2 = new Int8Array(buf2);
    for (var i = 0 ; i != buf1.byteLength ; i++)
    {
        if (dv1[i] != dv2[i]) return false;
    }
    return true;
}

function concatBuffers(arrays) 
{
    // Get the total length of all arrays.
    let length = 0;
    arrays.forEach(item => {
      length += item.length;
    });
    
    // Create a new array with total length and merge all source arrays.
    let mergedArray = new Uint8Array(length);
    let offset = 0;
    arrays.forEach(item => {
      mergedArray.set(new Uint8Array(item), offset);
      offset += item.length;
    }); 
    
    return mergedArray;
}

// CryptoJS format to byte array
function wordToByteArray(wordArray) 
{
    var byteArray = [], word, i, j;
    for (i = 0; i < wordArray.length; ++i) {
        word = wordArray[i];
        for (j = 3; j >= 0; --j) {
            byteArray.push((word >> 8 * j) & 0xFF);
        }
    }
    return byteArray;
}

// byte array to CryptoJS format
function arrayToWordArray(u8Array) 
{
    var words = [], i = 0, len = u8Array.length;

    while (i < len) {
        words.push(
            (u8Array[i++] << 24) |
            (u8Array[i++] << 16) |
            (u8Array[i++] << 8)  |
            (u8Array[i++])
        );
    }

    return {
        sigBytes: len,
        words: words
    };
}

const toHexString = bytes => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

const intToBuffer = num => 
{
    let b = new ArrayBuffer(4);
    new DataView(b).setUint32(0, num);
    return Array.from(new Uint8Array(b));
}

function PEM2Binary(pem) 
{
    var encoded = '';
    var lines = pem.split('\n');
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('-----') < 0) {
            encoded += lines[i];
        }
    }
    var byteStr = atob(encoded);
    var bytes = new Uint8Array(byteStr.length);
    for (var i = 0; i < byteStr.length; i++) {
        bytes[i] = byteStr.charCodeAt(i);
    }
    return bytes.buffer;
}

}());
