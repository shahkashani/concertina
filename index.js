require('dotenv').config();

const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');
const session = require('express-session');

const PORT = process.env.PORT || 3000;

const {
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  EXPRESS_SESSION_SECRET
} = process.env;

const SCOPES = ['user-read-currently-playing', 'user-read-recently-played'];
const STATE = 'concertina';

const app = express();

app.use(
  session({
    secret: EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  })
);

const setAuthDataFromResponse = (req, spotifyApi, auth) => {
  const { access_token: accessToken, refresh_token: refreshToken } = auth.body;
  if (accessToken) {
    spotifyApi.setAccessToken(accessToken);
  }
  if (refreshToken) {
    spotifyApi.setRefreshToken(refreshToken);
  }
  const previousSession = getAuthData(req);
  req.session.spotifySession = {
    accessToken: accessToken || previousSession.accessToken,
    refreshToken: refreshToken || previousSession.refreshToken
  };
};

const getAuthData = req => {
  const { spotifySession } = req.session;
  return spotifySession || {};
};

// Just a handy wrapper that also refreshes the auth token
const makeSpotifyCall = async (req, spotifyApi, method) => {
  const result = await spotifyApi[method]();
  const refresh = await spotifyApi.refreshAccessToken();
  setAuthDataFromResponse(req, spotifyApi, refresh);
  return result;
};

app.get('/', async (req, res) => {
  const { code } = req.query;

  const spotifyApi = new SpotifyWebApi({
    redirectUri: SPOTIFY_REDIRECT_URI,
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET
  });

  const { accessToken, refreshToken } = getAuthData(req);

  if (!code && (!accessToken || !refreshToken)) {
    res.redirect(spotifyApi.createAuthorizeURL(SCOPES, STATE, false));
    return;
  }

  try {
    if (accessToken && refreshToken) {
      spotifyApi.setAccessToken(accessToken);
      spotifyApi.setRefreshToken(refreshToken);
    } else {
      const auth = await spotifyApi.authorizationCodeGrant(code);
      setAuthDataFromResponse(req, spotifyApi, auth);
      // Get rid of that ?code in the URL
      res.redirect(req.path);
      return;
    }

    const tracks = await makeSpotifyCall(
      req,
      spotifyApi,
      'getMyRecentlyPlayedTracks'
    );

    res.send(`Do the thing! <pre>${JSON.stringify(tracks, null, 2)}</pre>`);
  } catch (err) {
    res.send(`No! ${err}`);
  }
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}!`));
