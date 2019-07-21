"use strict";

const projectId = "<enter your project id>"; // Your GCP projectId
const locationId = "global"; // Lists keys in the "global" location.
const keyRing = "kmskring"; // the keyring name
const key = "demokey";

// Imports the @google-cloud/kms client library
const kms = require("@google-cloud/kms");

// Instantiates an authorized client
const kmsClient = new kms.KeyManagementServiceClient();
const kmsPath = kmsClient.cryptoKeyPath(projectId, locationId, keyRing, key);

// The function is used to decrypt any BASE64 encrypted string into an ASCII string
async function decryptSetVAR(encText) {
  let decryptedText;
  try {
    const encryptedObj = {
      name: kmsPath,
      ciphertext: encText
    };
    let [decryptedText] = await kmsClient.decrypt(encryptedObj);
    return decryptedText.plaintext.toString("ascii").trim();
  } catch (e) {
    console.log("Error", e);
  } finally {
  }
}

exports.demoencvar = (req, res) => {
  decryptSetVAR(process.env.USER_ID_ENC).then(dbUser => {
    decryptSetVAR(process.env.USER_PASSWORD_ENC).then(dbPassword => {
      console.log(dbUser, dbPassword);
    });
  });
};
