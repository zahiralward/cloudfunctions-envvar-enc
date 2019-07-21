# cloudfunctions-envvar-enc

This is a step by step guide to setup Google Cloud KMS that invokes environment variables into Google Cloud Functions.

## Create a keyring and a key in KMS.

You can login to Google Cloud console and create the project and from the cloud shell run the following code

```
gcloud kms keyrings create kmskring --location global

gcloud kms keys create demokey \
  --location global \
  --keyring kmskring \
  --purpose encryption
```

Then you need to add an IAM policy binding for the kms key.

```
gcloud kms keys add-iam-policy-binding demokey \
  --location global \
  --keyring kmskring \
  --member "serviceAccount:cloudfunction-kms-decrypter@<projectid>.iam.gserviceaccount.com" \
  --role roles/cloudkms.cryptoKeyDecrypter
```

If you run the following command, you can get the list of the keyrings and keys configured for this project

```
gcloud kms keyrings list --location global
NAME
projects/<project name>/locations/global/keyRings/kmskring
```

## Encrypt the variables

Lets say the we have two variables

- USER_ID : sqlservice
- USER_PASSWORD : dem0pa55w0rd

Encrypt both variables using the commands from the cloud shell

```
echo "sqlservice" | gcloud kms encrypt \
    --location=global \
    --keyring=kmskring \
    --key=demokey \
    --ciphertext-file=- \
    --plaintext-file=- \
    | base64
```

Lets call the encrypted variable **USER_ID_ENC** and save the result in a text file

```
CiQAEHPMVeyOGzi9Mb223cxnHDV5/qUJcl25DASWjia5TRJCWvcSNADvl+leyr2cww9+zsqs02iGcmUDchqDgVz8GWVRBKqxT+wdB36bIEdWRRQqVTQwwn44PKg=
```

Repeat the same process to encrypt the password **dem0pa55w0rd** to get **USER_PASSWORD_ENC**

```
CiQAEHPMVXN3nGDUO/VvHEfZaJFFokhoRCJ6+wJIcCXxrW7ZSASNQDvl+leQcz+VZKCBuMW5g31GfLWm9NY/zRN4Fm9j+rjB28rJOlLDHygm1a7oSzeyAwU4L+Q
```

## Invoking the encrypted variable into Cloud Functions

Now lets assume that we need to create a cloud function called **demoencvar** that will be triggered when a file is uploaded into a storage bucket. The task of invoking the encrypted username and password is traight forward using the following command

```
gcloud functions deploy demoencvar \
    --runtime nodejs8 \
    --service-account cloudfunction-kms-decrypter@<project name>.iam.gserviceaccount.com \
    --set-env-vars USER_ID_ENC=CiQAEHPMVeyOGzi9Mb223cxnHDV5/qUJcl25DASWjia5TRJCWvcSNADvl+leyr2cww9+zsqs02iGcmUDchqDgVz8GWVRBKqxT+wdB36bIEdWRRQqVTQwwn44PKg=,USER_PASSWORD_ENC=CiQAEHPMVXN3nGDUO/VvHEfZaJFFokhoRCJ6+wJIcC0XxrW7ZSASNQDvl+leQcz+VZKCBuMW5g31GfLWm9NY/zRN4Fm9j+rjB28rJOlLDHygm1a7oSzeyAwU4L+Q \
    --trigger-resource gs://<bucketname> \
    --trigger-event google.storage.object.finalize
```

But lets create the function first

## Create a Cloud Function

The following example is a demo created to show the way nodejs used in a Cloud Function to decrypt the invoked variables

First we need to create the skeleton of a nodejs project in an empty directory

```
npm init
```

Then install the nodejs module **@google-cloud/kms**

```
npm install --save @google-cloud/kms
```

Create index.html file and add the following code

```
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
```

You can now dump a file into the storage bucket and check the Cloud Function log for the following message

```
{
 insertId:  "000000-711901d0-8566-476b-b150-15cfcd6be881"
 labels: {…}
 logName:  "projects/prodectid/logs/cloudfunctions.googleapis.com%2Fcloud-functions"
 receiveTimestamp:  "2019-07-19T10:19:35.127120060Z"
 resource: {…}
 severity:  "INFO"
 textPayload:  "sqlservice dem0pa55w0rd"
 timestamp:  "2019-07-19T10:19:28.604Z"
 trace:  "projects/projectid/traces/e7fc66573bc7e4fcab5276170366a033"
}
```
