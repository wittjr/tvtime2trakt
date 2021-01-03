const rp = require('request-promise')
const cheerio = require('cheerio')
// const got = require('got')
const fs = require('fs')

global.export_array = [];
global.watchlist_array = [];
global.episode_count = 0;
global.data_dir = './data';

function getEpisodeData(episode) {
  // console.log(episode);
  var options = {
    method: 'GET',
    uri: 'https://www.tvtime.com/en/show/' + episode['show']['id'] + '/episode/' + episode['id'],
    followAllRedirects: true,
    jar: cookieJar,
    transform: function (body) {
      return cheerio.load(body);
    }
  };
  if(episode['seen'] == false || episode['aired'] == false) {
    return;
  }

  var data_file = global.data_dir + "/e" + episode['id'] + ".js";

  if (fs.existsSync(data_file)) {
    var data = fs.readFileSync(data_file, 'utf-8');
    var tvst = {};
    eval(data);
    var episode_details = JSON.parse(tvst.data['episode'].replace(/&quot;/g,'"'));
    var summary = {};
    summary['watched_at'] = new Date(episode_details['seen_date'] + " UTC").toISOString();
    // summary['watched_at'] = episode_details['seen_date'];
    summary['ids'] = {};
    summary['ids']['tvdb'] = episode_details['id'];
    // console.log(summary);
    console.log("Processing episode data for " + episode_details['show']['name'] + " season " + episode_details['season_number'] + " episode " + episode_details['number'] + ", episode name " + episode_details['name']);
    global.export_array.push(summary);
    // console.log(global.export_array);
  } else {
    return rp(options)
    .then(($) => {
      var data = $('div[class=main-block-container] > script').html();
      fs.writeFileSync(data_file, data);
      var tvst = {};
      eval(data);
      var episode_details = JSON.parse(tvst.data['episode'].replace(/&quot;/g,'"'));
      var summary = {};
      // summary['show'] = episode_details['show']['name'];
      // summary['season'] = episode_details['season_number'];
      // summary['episode_name'] = episode_details['name'];
      // summary['episode_number'] = episode_details['number'];
      summary['watched_at'] = new Date(episode_details['seen_date'] + " UTC").toISOString();
      // summary['watched_at'] = episode_details['seen_date'];
      summary['ids'] = {};
      summary['ids']['tvdb'] = episode_details['id'];
      // console.log(summary);
      console.log("Downloading episode data for " + episode_details['show']['name'] + " season " + episode_details['season_number'] + " episode " + episode_details['number'] + ", episode name " + episode_details['name']);
      global.export_array.push(summary);
      // console.log(global.export_array);

      // console.log(summary);
    })
    .catch((err) => {
      console.error('URI: ' + options.uri);
      console.error(err);
    });
  }
}

function getShowData(show) {

  var options = {
    method: 'GET',
    uri: 'https://www.tvtime.com/en/show/' + show['id'],
    followAllRedirects: true,
    jar: cookieJar,
    transform: function (body) {
      return cheerio.load(body);
    }
  };

  var data_file = global.data_dir + "/s" + show['id'] + ".json";
  if (fs.existsSync(data_file)) {
    fs.unlink(data_file, (err) => {
      if (err) throw err;
    });
  }

  return rp(options)
  .then(($) => {
    var data = $('div[class=main-block-container] > script').html();
    fs.writeFileSync(data_file, data);
    var tvst = {};
    eval(data);
    var show_details = JSON.parse(tvst.data['show'].replace(/&quot;/g,'"'));
    var episodes = show_details['episodes'];
    // console.log("Found " + episodes.length + " episodes for " + show['name']);
    global.episode_count += episodes.length;
    global.watchlist_array.push(show['id']);

    var actions = episodes.map(getEpisodeData);
    var p = Promise.all(actions);
    p.then(($) => {
      console.log("Processed " + episodes.length + " episodes for " + show['name']);
    });

    // episodes.forEach(getEpisodeData);
  })
  .catch((err) => {
    console.error('URI: ' + options.uri);
    console.error(err);
  });

}

var cookieJar = rp.jar();

async function main() {
  var options = {
    method: 'POST',
    uri: 'https://www.tvtime.com/signin',
    form: {
      'username': 'wittjr@gmail.com',
      'password': 'opec-coverall-sprocket-worm',
      'redirect_path': 'https://www.tvtime.com/login'
    },
    followAllRedirects: true,
    jar: cookieJar,
    transform: function (body) {
      return cheerio.load(body);
    }
  };

  let profile_url = '';
  let shows = []

  const show_file = global.data_dir + "/shows.json";
  if (fs.existsSync(show_file) && (fs.statSync(show_file).mtime.toDateString() == (new Date()).toDateString())) {
    console.log('File ' + show_file + ' was modified today, not checking again')
    shows = JSON.parse(fs.readFileSync(show_file))
  } else {
    await rp(options)
    .then(($) => {
      profile_url = 'https://www.tvtime.com' + $('a[title="Profile"]').attr('href');
      // console.log(profile_url);
      options = {
        method: 'GET',
        uri: profile_url,
        followAllRedirects: true,
        jar: cookieJar,
        transform: function (body) {
          return cheerio.load(body);
        }
      };

      return rp(options)
      .then(($) => {
        const data = $('div[class=main-block-container] > script').html();
        let tvst = {};
        eval(data);
        const all_shows = JSON.parse(tvst.data['shows'].replace(/&quot;/g,'"'));
        // console.log(all_shows.length)
        for (let i=0; i<all_shows.length; i++) {
          let current_show = all_shows[i];
          // console.log(current_show.name);
          if (current_show.seen_episodes != 0) {
            delete current_show.all_images;
            shows.push(current_show);
          }
        }

        console.log("Found " + shows.length + " shows");
        fs.writeFileSync(show_file, JSON.stringify(shows))
        // console.log(shows);
        // return;

      })
      .catch((err) => {
        console.error('URI: ' + options.uri);
        console.error(err);
      });
    })
    .catch((err) => {
      console.error('URI: ' + options.uri);
      console.error(err);
    });
  }

  await (async () => {
    var actions = shows.map(getShowData);
    var p = Promise.all(actions);
    p.then(($) => {
      console.log("Total episodes " + global.episode_count);
      fs.writeFileSync(global.data_dir + "/tvtime_export.json", JSON.stringify(global.export_array));
      fs.writeFileSync(global.data_dir + "/tvtime_watchlist_export.json", JSON.stringify(global.watchlist_array));
    });

    // for (var i=0; i<shows.length; i++) {
    //   getShowData(shows[i]);
    // }
  })();

}

main()
