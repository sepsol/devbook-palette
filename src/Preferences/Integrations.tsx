import React, {
  useEffect,
  useState,
} from 'react';
import styled from 'styled-components';
import axios from 'axios';

import useIPCRenderer from 'hooks/useIPCRenderer';
import {
  getGithubAccessToken,
  connectGitHub,
  removeGitHub,
} from 'mainProcess';

import Button from 'components/Button';

import gitHubImg from 'img/github.png';

const Container = styled.div`
  padding: 15px 0;
  flex: 1;
`;

const Title = styled.div`
  width: 100%;
  padding: 0 15px 15px;

  font-size: 17px;
  font-weight: 500;

  border-bottom: 1px solid #3B3A4A;
`;

const Content = styled.div`
  padding: 15px;
`;

const InfoMessage = styled.div`
  margin: auto;

  color: #5A5A6F;
  font-size: 16px;
  font-weight: 600;
`;

const IntegrationsWrapper = styled.div`
  flex: 1;
`;

const GitHubWrapper = styled.div`
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const GitHubTitleWrapper = styled.div`
  display: flex;
  align-items: center;
`;

const GitHubLogo = styled.img`
  width: auto;
  height: 30px;
  padding: 0 10px 0 0;
`;

const GitHubTitle = styled.div`
  margin: auto 0;
  font-size: 15px;
  font-weight: 500;
`;

const ConnectGitHubButton = styled(Button)``;

const RemoveGitHubButton = styled.div`
  margin: 8px 0;

  color: #FF5865;
  font-weight: 500;
  font-size: 14px;
  user-select: none;

  :hover {
    cursor: pointer;
    color: white;
  }
`;

async function getGitHubLogin(accessToken: string) {
  try {
    const result = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`,
      },
    });
    return result.data.login;
  } catch (error) {
    console.error(error.message);
    // throw new Error('Couldn not retrieve GitHub account informations.');
  }
}

function Integrations() {
  const [gitHubLogin, setGitHubLogin] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkGitHubAccount() {
      try {
        const accessToken = await getGithubAccessToken();
        if (!accessToken) {
          console.log('No GitHub Account connected');
          return;
        }
        const login = await getGitHubLogin(accessToken);
        setGitHubLogin(login);
      } catch (error) {
        // TODO: Show error to user.
        throw error;
      } finally {
        setIsLoading(false);
      }
    }

    checkGitHubAccount();
  }, []);

  useIPCRenderer('github-access-token', async (event, { accessToken }: { accessToken: string | null }) => {
    console.log('access', accessToken);
    try {
      if (accessToken === null) {
        console.log('Github Account removed');
        setGitHubLogin(undefined);
        return;
      }
      setIsLoading(true);
      console.log()
      const login = await getGitHubLogin(accessToken);
      setGitHubLogin(login);
    } catch (error) {
      // TODO: Show error to user.
      throw error;
    } finally {
      setIsLoading(false);
    }
  });

  function handleRemoveGitHub() {
    return removeGitHub();
  }

  function handleConnectGitHub() {
    return connectGitHub();
  }

  return (
    <Container>
      <Title>
        Integrations
      </Title>
      <Content>
        <>
          {isLoading && <InfoMessage>Loading...</InfoMessage>}
          {!isLoading &&
            <IntegrationsWrapper>
              <GitHubWrapper>
                <GitHubTitleWrapper>
                  <GitHubLogo src={gitHubImg}>
                  </GitHubLogo>
                  <GitHubTitle>
                    {gitHubLogin ? gitHubLogin : 'GitHub'}
                  </GitHubTitle>
                </GitHubTitleWrapper>
                {!gitHubLogin && <ConnectGitHubButton onClick={handleConnectGitHub}>Connect</ConnectGitHubButton>}
                {gitHubLogin && <RemoveGitHubButton onClick={handleRemoveGitHub}>Remove</RemoveGitHubButton>}
              </GitHubWrapper>
            </IntegrationsWrapper>
          }
        </>
      </Content>
    </Container>
  );
}

export default Integrations;