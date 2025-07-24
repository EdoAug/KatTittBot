const { Mwn } = require('mwn');
const auth = require('./auth.json');
const sandbox = 'User:KatTittBot/sandkasse';
const language = "no"

const bot = new Mwn({
    apiUrl: 'https://no.wikipedia.org/w/api.php',
	
	// Can be skipped if the bot doesn't need to sign in
    username: auth.name,
    password: auth.pw,
	
    OAuth2AccessToken: auth.access,
	
   /* // Or use OAuth 1.0a (also only applicable for wikis with Extension:OAuth)
    OAuthCredentials: {
        consumerToken: auth.public,
        consumerSecret: auth.secret,
        accessToken: '16_DIGIT_ALPHANUMERIC_KEY',
        accessSecret: '20_DIGIT_ALPHANUMERIC_KEY'
    },*/

    // Set your user agent (required for WMF wikis, see https://meta.wikimedia.org/wiki/User-Agent_policy):
    userAgent: 'KatTittBot 1.0 ([[w:no:User:KatTittBot]])',

    // Set default parameters to be sent to be included in every API request
    defaultParams: {
        assert: 'user' // ensure we're logged in
    },
	maxRetries: 5
});

bot.login().then(() => {
	console.log("Logged in!");
	//TestEdit();
	MostPopular(20, sandbox ).then((res) => {
		for (let i = 0; i < res.length; i++) {
			res[i] = "{{Bruker:EdoAug/FFTT/Mal:Artikkellenke|artikkel="+res[i]+"}}";
		}
		bot.save(sandbox, res.join(" "), 'Legger inn liste over mest leste sider');
	});
});

function TestEdit() {
	console.log("Initiating TestEdit...");
	let date1 = new bot.Date();
	let newContent = "Dette er en testredigering fra KatTittBot! " + date1.toString();
	let title = new bot.Page(sandbox);
	title.exists().then((res) => {
		if (!res) {
			bot.create(sandbox,newContent);
		} else {
			bot.edit(sandbox, (rev) => {
				// rev.content gives the revision text
				// rev.timestamp gives the revision timestamp

				return {
					// return parameters needed for [[mw:API:Edit]]
					text: newContent,
					summary: 'test fra en nervøs robot!',
					minor: true
				};
			});
		}
	});
}

async function MostPopular(amount = 4, page = sandbox, days = 2) {
	return new Promise((resolve) => {
		console.log("Fetching the", amount,"most-visited pages from",days,"days ago for",page,"!");
		let ignoredPages = [
			"Forside",
			"wiki.phtml" ];
		let d = new bot.Date();
		d.setDate(d.getDate()-days);
		let infoUrl = "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/"+language+".wikipedia.org/all-access/"+d.toISOString().substr(0,10).replaceAll('-', '/')
		bot.rawRequest({url:infoUrl})
			.then((result) => {
				console.log("Fetched list of most poppy pageviews of",language+"wiki!");
				result = result.data.items[0].articles;
				let topArticles = [];
				for (let i = 0; topArticles.length < amount; i++) {
					let add = true;
					for (let t = 0; t < ignoredPages.length; t++) {
						if (result[i].article === ignoredPages[t] || result[i].article.match(/[SWKP]\w+:/)) {
							// filtering out nonos and non-mainspace pages.............
							//console.log("NOT:",result[i].article);
							add = false;
							break;
						}
					}
					if (add) {
						//console.log("ADD:",result[i].article);
						topArticles.push(result[i].article);
					}
				}
				resolve(topArticles);
			});
	});
}