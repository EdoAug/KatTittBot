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

/*{
	"action": "query",
	"format": "json",
	"prop": "revisions",
	"titles": page,
	"redirects": 1,
	"formatversion": "2",
	"rvlimit": "1",
	"rvdir": "newer"
}*/

bot.login().then(() => {
	console.log("Logged in!");
	//TestEdit();
	
	MostPopular(20, sandbox, 1).then((res) => {
		for (let i = 0; i < res.length; i++) {
			res[i] = "{{Bruker:EdoAug/FFTT/Mal:Artikkellenke|artikkel="+res[i]+"}}";
		}
		bot.save(sandbox, res.join(" "), 'Legger inn eksempelsformatert liste over mest leste sider basert på nyeste tilgjengelig statistikkdump.');
	});
	const cattygory = "Kategori:Brett- og kortspill";
	RedLinksTestTwo(cattygory, "0").then((res) => {
		let page = new bot.Page("User:KatTittBot/test");
		console.log(res);
		/*const gaggoo = res;
		gaggoo = Object.entries(...gaggoo);
		res = gaggoo.filter(x => x[1] > 1);*/
		let prepend = '{| class="wikitable sortable" \n|+ Gjentatte røde lenker under [[:'+cattygory+'|'+cattygory.replace("Kategori:","")+']]\n! Lenke !! Antall\n|-\n|';
		let append = '\n|}';
		res = Object.entries(res).map(x => "[["+x[0]+"]]||"+x[1] ).join("\n|-\n|").toString();
		page.save(prepend+res+append).catch((err) => console.log("Could not create page:",err));
	});
	
	/*RedLinksInCategoryTree("Brett- og kortspill", "0").then((res) => {
		//console.log(res.sort());
		TitleCounter(res).then((res) => {
			console.table(res);
		})
	}).catch((err) => {console.log(err)});*/
	
});

async function RedLinksTestTwo(category="Kategori:Skeive emner", namespace) {
	return new Promise((resolve) => {
		GetCategoryTree(category).then((res) => {
			return res;
		}).then((res) => {
			const arr = [];
			const arr2 = [];
			bot.batchOperation(
			res,
			(page, idx) => {
				return new Promise((resolbe) => {
					bot.query({
					"action": "query",
					"format": "json",
					"list": "categorymembers",
					"formatversion": "2",
					"cmtitle": page,
					"cmlimit": "max"
					}).then((res) => {
						arr.push(res);
						resolbe(res);
					}).catch((err) => console.log(err));
				}).then((res) => {
					return res;
				});
			},
			/* concurrency */ 10,
			/* retries */ 2
			).then(() => {
				const pagelist = arr.flatMap(obj => obj.query.categorymembers);
				const pagelistunique = [...new Set(pagelist.map(obj => obj.title))];
				bot.batchOperation(
				pagelistunique,
				(page) => {
					return new Promise((resolbe) => {
						bot.request({
							"action": "parse",
							"format": "json",
							"page": page,
							"prop": "links",
							"formatversion": "2"
						}).then((res) => {
							let linkies = res.parse.links.filter((x) => !x.exists);
							if (namespace) {
								linkies = linkies.filter((x) => x.ns == namespace);
							}
							return linkies;
						}).then((res) => resolbe(res)).catch((err) => console.log(err));
					}).then((res) => arr2.push(res));
				},
				/* concurrency */ 10,
				/* retries */ 2).then(() => {
					let redLinks = Array.from(arr2.flat(), obj => obj.title);
					TitleCounter(redLinks).then((res) => {
						resolve(res);
					})
				});
			});
		}).catch((err) => console.log(err));
	});
}


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
			}).catch((err) => console.log(err));
	});
}

async function TitleCounter(arr) {
	return new Promise((resolve) => {
		const sorts = {};
		
		for (let i = 0; i < arr.length; i++) {
			let label = i.toString().replace("_", " ");
			if (!(arr[label] in sorts)) {
				sorts[arr[label]] = 1;
			}
			else {
				sorts[arr[label]]++;
			}
			if (i == arr.length-1) {
				const sorted = Object.fromEntries(
					Object.entries(sorts).sort(([, a], [, b]) => b - a)
				);
				resolve(sorted);
			}
		}
	});
}

async function RedLinksInCategoryTree(category, namespace) {
	return new Promise((resolve) => {
		GetCategoryTree(category).then((res) => {
			PagesInCategories(res).then((res) => {
				res = res.flat();
				if (namespace) {
					//console.log(namespace);
					res = res.filter((obj) => obj.ns == namespace);
				}
				else {
					namespace = "*";
				}
				console.log("Initiating red link hunt within",category,"(NS:"+namespace+")");
				res = res.map(obj => obj.title);
				bot.massQuery({
					"action": "query",
					"format": "json",
					"prop": "links",
					"titles": res,
					"formatversion": "2",
					"plnamespace": namespace,
					"pllimit": "max"
				}).then((res) => {
					console.log("Grabbed all links...");
					res = res.flatMap(obj => obj.query.pages).flatMap(obj => obj.links)
					SplitArrayIntoChunks(res).then((res) => {
						console.log("Weeding out blues... (be patient!)");
						let i = 0;
						const checked = [];
						const titles = [];
						let count = 0;
						res.forEach((list) => {
							count++;
							console.log(count);
							let t = 0;
							list.forEach((item) => {
								if (!item) {
									t++;
									return;
								}
								let title = new bot.Page(item.title);
								//console.log(count, title);
								if (titles.includes(title.title)){
									titles.push(title.title);
									t++;
									return;
								}
								else if (checked.includes(title.title)){
									t++;
									return;
								}
								//console.log("Checking",title.title);
								title.exists().then((exists) => {
									console.log(i,"of",res.length-1, "—", t,"of",list.length-1,"–",title.title,"("+exists+")");
									if (!exists) {
										titles.push(title.title);
										//console.log(titles);
									}
									else {
										//console.log("– BLUE:",title.title);
									}
									//console.log(i);
								}).then(() => {
									if ((i >= res.length-1) && (t >= list.length-1)) {
										console.log("Gathered",titles.length,"red links!");
										resolve(titles);
									}
									else if (t >= list.length-1) {
										i++;
										return;
									}
									else {
										t++;
									}
								}).catch((err) => console.log(err));
							});
						});
					}).catch((err) => console.log(err));
					//res = res.flatMap(obj => obj.query.pages).map(obj => obj.links);
					//res = res.query.pages.flatMap(obj => obj.links).map(obj => obj.title)
				}).catch((err) => {
					//bot.save("Bruker:KatTittBot/test",err);
					console.log(err);
				});
			}).catch((err) => console.log(err));
		});
	})
}

async function SplitArrayIntoChunks(arr) {
	return new Promise((resolve) => {
		let results = [];
		let i = Math.ceil(arr.length / 450);
		if (i>16) {
			console.log("Too many links for me at this time! Shortening it!")
			i = 16;
		}
		for (let t = 0; t < i; t++) {
			results.push(arr.slice(0,450));
			arr.splice(0, 450);
			console.log(t, "out of", i-1, "arrays split.");
			if (t == i-1) {
				console.log("All arrays chopped up into bite-size pieces! Yummy!");
				resolve(results);
			}
		}
	});
}

function GetCategoryTree(category, depth=1) {
	const catRegex = /K\w+:[\w\_\d\sÆØÅæøå\-\(\)]+/g;
	return new Promise((resolve) => {
		bot.request({
			"action": "categorytree",
			"format": "json",
			"category": category,
			"options": "{\"depth\":"+depth.toString()+"}",
			"formatversion": "2"
		}).then((res) => {
			let cats = JSON.stringify(res).match(catRegex);
			if (!cats) {
				cats = [category];
			}
			else {
				for (let i = 0; i < cats.length; i++) {
					cats.splice(i, 1);
				}
			}
			cats.push(category);
			resolve(cats);
		});
	});
}

async function MassExists(pages) {
	return new Promise((resolve) => {
		//
	})
}

async function PagesInCategories(catArray) {
	return new Promise((resolve) => {
		const categories = [];
		let t = 0;
		/*for await (const cat of catArray) {
			let category = 
		}*/
		catArray.forEach(cat => {
			new bot.Category(cat).members().then((res) => {
				categories.push(res);
				//console.log(t,catArray.length-1);
				if (t === catArray.length-1) {
					resolve(categories);
				}
				t++;
			});
		});
	});
}
