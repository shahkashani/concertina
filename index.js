require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SpotifyStrategy = require('passport-spotify').Strategy;
const SpotifyWebApi = require('spotify-web-api-node');
const consolidate = require('consolidate');
const GeniusApi = require('lyricist');

const PORT = process.env.PORT || 3000;

const {
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  EXPRESS_SESSION_SECRET,
  GENIUS_CLIENT_ACCESS_TOKEN
} = process.env;

const SCOPE = [
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-read-email',
  'user-read-private'
];

const genius = new GeniusApi(GENIUS_CLIENT_ACCESS_TOKEN);

const getLyrics = async (name, artist) => {
  const results = await genius.search(`${artist} ${name}`);
  if (!Array.isArray(results) || results.length === 0) {
    return;
  }
  const match = results.find(s => s.primary_artist.name === artist);
  const data = await genius.song(match ? match.id : results[0].id, {
    fetchLyrics: true
  });
  return (data || {}).lyrics;
};

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(
  new SpotifyStrategy(
    {
      clientID: SPOTIFY_CLIENT_ID,
      clientSecret: SPOTIFY_CLIENT_SECRET,
      callbackURL: `${SPOTIFY_REDIRECT_URI}/callback`
    },
    (accessToken, refreshToken, expires_in, profile, done) => {
      process.nextTick(() => {
        return done(null, { ...profile, accessToken, refreshToken });
      });
    }
  )
);

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(
  session({
    secret: EXPRESS_SESSION_SECRET,
    resave: true,
    saveUninitialized: true
  })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(__dirname + '/public'));

app.engine('html', consolidate.swig);

app.get('/', ensureAuthenticated, async (req, res) => {
  const { accessToken, refreshToken } = req.user;
  const spotify = new SpotifyWebApi({
    accessToken,
    refreshToken,
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET
  });
  const { body } = await spotify.getMyCurrentPlayingTrack();
  if (body.item) {
    const { artists, name, album } = body.item;
    const artist = artists[0].name;
    const lyrics = await getLyrics(name, artist);
    res.render('index.html', {
      lyrics,
      name,
      artist,
      album,
      user: req.user,
      track: body.item
    });
  } else {
    res.render('index.html');
  }
});

app.get('/login', (req, res) => {
  res.render('login.html', { user: req.user });
});

app.get(
  '/auth/spotify',
  passport.authenticate('spotify', {
    scope: SCOPE,
    showDialog: false
  }),
  (req, res) => {
    // The request will be redirected to spotify for authentication, so this function will not be called.
  }
);

app.get(
  '/callback',
  passport.authenticate('spotify', { failureRedirect: '/login' }),
  (req, res) => {
    res.redirect('/');
  }
);

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/login');
});

app.listen(PORT);

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/spotify');
}
