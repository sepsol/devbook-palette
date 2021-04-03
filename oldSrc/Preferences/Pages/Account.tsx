import React, { useContext } from 'react';
import styled from 'styled-components';

import {
  AuthState,
  AuthContext,
} from 'Auth';
import {
  openSignInModal,
  signOutUser,
  trackSignOutButtonClicked,
} from 'mainCommunication';
import Button from 'components/Button';
import Loader from 'components/Loader';

import Base from './Base';

const Container = styled.div`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const Email = styled.span`
`;

const InfoWrapper = styled.div`
  padding: 5px;
  height: 100%;
  display: flex;
  margin: auto;
  align-items: center;
  justify-content: center;
  flex-direction: column;
`;

const InfoMessage = styled.div`
  color: #5A5A6F;
  font-size: 16px;
  font-weight: 600;
`;

const SignOutButton = styled.div`
  margin: 6px 0;

  color: #FF5865;
  font-weight: 500;
  font-size: 14px;
  user-select: none;

  :hover {
    cursor: pointer;
    color: white;
  }
`;

const SignInWrapper = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const SignInText = styled.div`
  margin-bottom: 15px;
`;

const StyledLoader = styled(Loader)`
  margin: 0 auto;
`;

const SignInButton = styled(Button)``;

function Account() {
  const authInfo = useContext(AuthContext);

  const isLoading =
    authInfo.state === AuthState.LookingForStoredUser ||
    authInfo.state === AuthState.SigningOutUser ||
    authInfo.state === AuthState.SigningInUser;

  function handleSignOutButtonClicked() {
    signOutUser();
    trackSignOutButtonClicked();
  }

  return (
    <Base title="Account">
      <Container>

        {authInfo.isReconnecting
          &&
          <InfoWrapper>
            <InfoMessage>Contacting Devbook servers failed.</InfoMessage>
            <InfoMessage>Reconnecting...</InfoMessage>
          </InfoWrapper>
        }
        
        {isLoading
          && !authInfo.isReconnecting
          &&
          < StyledLoader />
        }

        {!isLoading
          && authInfo.state === AuthState.UserAndMetadataLoaded
          && !authInfo.isReconnecting
          &&
          <>
            <Email>
              {authInfo.user.email}
            </Email>
            <SignOutButton onClick={handleSignOutButtonClicked}>
              Sign Out
            </SignOutButton>
          </>
        }

        {!isLoading
          && authInfo.state === AuthState.NoUser
          && !authInfo.isReconnecting
          &&
          <SignInWrapper>
            <SignInText>
              You are not signed in
            </SignInText>

            <SignInButton onClick={openSignInModal}>
              Sign in to Devbook
            </SignInButton>
          </SignInWrapper>
        }
      </Container>
    </Base>
  );
}

export default Account;