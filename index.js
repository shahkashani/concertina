require('dotenv').config();

const SpotifyWebApi = require('spotify-web-api-node');
const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

const {
  SPOTIFY_REDIRECT_URI,
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET
} = process.env;

const SCOPES = ['user-read-currently-playing', 'user-read-recently-played'];
const STATE = 'concertina';

app.get('/', async (req, res) => {
  const { code } = req.query;

  const spotifyApi = new SpotifyWebApi({
    redirectUri: SPOTIFY_REDIRECT_URI,
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET
  });

  if (!code) {
    res.redirect(spotifyApi.createAuthorizeURL(SCOPES, STATE, false));
    return;
  }

  try {
    const auth = await spotifyApi.authorizationCodeGrant(code);

    spotifyApi.setAccessToken(auth.body['access_token']);
    spotifyApi.setRefreshToken(auth.body['refresh_token']);

    const tracks = await spotifyApi.getMyRecentlyPlayedTracks({});

    res.send(
      `Do the thing! <pre>${JSON.stringify(tracks.body, null, 2)}</pre>`
    );
  } catch (err) {
    res.send(`No! ${err}`);
  }
});

app.listen(PORT, () => console.log(`Listening on port ${PORT}!`));
