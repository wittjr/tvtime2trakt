const fs = require('fs');
const rp = require('request-promise');


var baseUrl = 'https://api.trakt.tv';
var client_id = '7e22162f9eb4579e79453681c2a03590c1ebee89a79c422574c7f59bc6d462db';
var client_secret = 'b8053e71ffd43fe39bc7c71d81b93d32eb91cdd8cf963e8fd99be13579f56ee3';
var redirect_uri = 'http://localhost';

var token = {
  "access_token": "bfc2a7ead0446c97ec337f71bedb61c7264d9ee8a93304fc39c3468e80dfac02",
  "token_type": "Bearer",
  "expires_in": 7776000,
  "refresh_token": "5eaf8fa16a83ec18a29fa24450432b7d02a8f742e4db3b05ac79d95231b653b4",
  "scope": "public",
  "created_at": 1543864895
};

const show_watchlist = {'shows': []}
global.failed = []

function addToWatchList() {
  var options = {
    method: 'POST',
    uri: baseUrl + '/sync/watchlist',
    headers: {
      'trakt-api-version': '2',
      'Content-Type': 'application/json',
      'trakt-api-key': client_id,
      'Authorization': 'Bearer ' + token['access_token']
    },
    body: show_watchlist,
    json: true,
    followAllRedirects: true
  };

  return rp(options)
  .then(($) => {
    console.log($);
  })
  .catch((err) => {
    console.log(err);
  });
}

function addToHistory(data) {
  var history = {'episodes': data}
  var options = {
    method: 'POST',
    uri: baseUrl + '/sync/history/remove',
    headers: {
      'trakt-api-version': '2',
      'Content-Type': 'application/json',
      'trakt-api-key': client_id,
      'Authorization': 'Bearer ' + token['access_token']
    },
    body: history,
    json: true,
    followAllRedirects: true
  };

  // console.log(options);
  return rp(options)
  .then(($) => {
    console.log($);
  })
  .catch((err) => {
    global.failed = global.failed.concat(data)
    // console.log(err['statusCode']);
  });
}

function getShowSearch(id) {
  var options = {
    method: 'GET',
    uri: baseUrl + '/search/tvdb/' + id + '?type=show',
    headers: {
      'trakt-api-version': '2',
      'Content-Type': 'application/json',
      'trakt-api-key': client_id
    },
    followAllRedirects: true
  };

  return rp(options)
  .then(($) => {
    var data = eval($);
    show_watchlist['shows'].push(data[0]['show']);
    // console.log(show_watchlist);
  })
  .catch((err) => {
      console.log(err);
  });
}


// if (fs.existsSync("tvtime_watchlist_export.json")) {
//   var data = fs.readFileSync("tvtime_watchlist_export.json", 'utf-8');
//   data = eval(data);
//
//   console.log("Found " + data.length + " shows");
//
//   var actions = data.map(getShowSearch);
//   var p = Promise.all(actions);
//   p.then(($) => {
//     addToWatchList();
//   });
// }

var data_file = '';

if (fs.existsSync("tvtime_export_failed.json")) {
  data_file='tvtime_export_failed.json';
} else {
  data_file='tvtime_export.json2';
}

if (fs.existsSync(data_file)) {
  var data = fs.readFileSync(data_file, 'utf-8');
  // console.log(data);
  data = eval(data);

  console.log("Found " + data.length + " episodes");

  data_slices = [];
  var increment = 2;
  for (i=0; i < data.length; i=i+increment) {
    var end = i + increment;
    if (end > data.length) {
      end = data.length;
    }
    data_slices.push(data.slice(i, end));
  }
  console.log("Data split into " + data_slices.length + " slices");

  // for (var i=0; i<data_slices.length; i++) {
  //   addToHistory(data_slices[i]);
  // }


  // data_slices.forEach(addToHistory);
  var actions = data_slices.map(addToHistory);
  var p = Promise.all(actions);
  p.then(($) => {
    fs.unlink("tvtime_export_failed.json", (err) => {
      if (err) throw err;
    });
    if (global.failed.length > 0) {
      console.log("Adding " + global.failed.length + " entries to the failed file");
      fs.writeFileSync("tvtime_export_failed.json", JSON.stringify(global.failed));
    }
    console.log("Done");
  });
}
