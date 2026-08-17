const Mailjet = require('node-mailjet');

const mailjet = new Mailjet({
  apiKey: '6462a9452bfa904a471fcf3acbf98130',
  apiSecret: '420150a6253f161e686fb0741509a0d7'
});

const request = mailjet
  .post("send", {'version': 'v3.1'})
  .request({
    "Messages":[
        {
            "From": {
                "Email": "erp.sclab@mailjet.com",
                "Name": "Mailjet Pilot"
            },
            "To": [
                {
                    "Email": "annjan0077@gmail.com",
                    "Name": "passenger 1"
                }
            ],
            "Subject": "Your email flight plan!",
            "TextPart": "Dear passenger 1, welcome to Mailjet! May the delivery force be with you!",
            "HTMLPart": "<h3>Dear passenger 1, welcome to <a href=\"https://www.mailjet.com/\">Mailjet</a>!</h3><br />May the delivery force be with you!"
        }
    ]
  })
request
  .then((result) => {
    console.log("Success! Status:", result.response.status)
    console.log(result.body)
  })
  .catch((err) => {
    console.log("Error Status:", err.statusCode)
    console.log("Error Message:", err.message)
    console.log("Error Original:", err.originalMessage)
  })
