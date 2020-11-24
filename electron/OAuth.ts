import express from 'express';
import crypto from 'crypto';
import { shell } from 'electron';
import { EventEmitter } from 'events';
import axios from 'axios';
import querystring from 'querystring';

const htmlRedirectPage = `
<!DOCTYPE html>
<html lang="en">

<head>
  <title>Devbook</title>
</head>

<body>
  <script>
    window.open('', '_parent', '');
    window.close();
  </script>
</body>

</html>`;

function getRandomToken() {
  return crypto.randomBytes(48).toString('hex');
}

function openLink(url: string) {
  return shell.openExternal(url);
}

class OAuth {
  private static PORT = 8020;
  private static GITHUB_CONFIG = {
    client_id: 'e9d91ad9a34c68cf2f7c',
    // TODO: Change the flow so we don't expose CLIENT_SECRET in the app
    client_secret: '74ed7cf4a8d7a69034ce7cda2e7e0b3dfac9ae8b',
    redirect_uri: `http://localhost:${OAuth.PORT}`,
    login: '',
    scope: '',
    allow_signup: 'true',
  };

  private stateTokens: { [state: string]: boolean } = {};
  private app = express();

  public emitter = new EventEmitter();

  public constructor(private showApp: any, private hideApp: any) {
    this.app.all('/', async (req, res) => {
      const code = req.query['code'] as string;
      const state = req.query['state'] as string;
      if (this.stateTokens[state]) {
        try {
          const accessToken = await OAuth.getAccessToken(code, state);
          this.emitter.emit('access-token', { accessToken });
          res.send(htmlRedirectPage);
        } catch (error) {
          console.error(error.message);
          this.emitter.emit('error', {});
          res.status(500).send();
        } finally {
          delete this.stateTokens[state];
          this.showApp();
        }
      }
    });
    this.app.listen(OAuth.PORT);
  }

  private static async getAccessToken(code: string, state: string) {
    const result = await axios.post('https://github.com/login/oauth/access_token', null, {
      headers: {
        'Accept': 'application/json',
      },
      params: {
        ...OAuth.GITHUB_CONFIG,
        state,
        code,
      },
    });
    return result.data.access_token;
  }

  public async requestOAuth() {
    const state = getRandomToken();
    this.stateTokens[state] = true;

    const queryParams = querystring.stringify({
      ...OAuth.GITHUB_CONFIG,
      state,
    });
    const url = `https://github.com/login/oauth/authorize?${queryParams}`;

    openLink(url);
    this.hideApp();
  }
}

export default OAuth;
