import React from 'react';
import styled from 'styled-components';

import { AuthInfo, signOut, AuthState } from 'Auth';
import {
  openSignInModal,
  trackSignOutButtonClicked,
} from 'mainProcess';

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

interface AccountProps {
  authInfo: AuthInfo;
}

function Account({ authInfo }: AccountProps) {
  const isLoading = authInfo.state === AuthState.LoadingUser
    || authInfo.state === AuthState.LoadingUserMetadata
    || authInfo.state === AuthState.SigningOutUser;

  function handleSignOutButtonClicked() {
    trackSignOutButtonClicked();
    signOut();
  }

  return (
    <Base title="Account">
      <Container>
        {isLoading &&
          < StyledLoader />
        }

        {!isLoading && authInfo.state === AuthState.UserAndMetadataLoaded &&
          <>
            <Email>
              {authInfo.metadata.email}
            </Email>
            <SignOutButton onClick={handleSignOutButtonClicked}>
              Sign Out
            </SignOutButton>
          </>
        }

        {!isLoading && authInfo.state === AuthState.NoUser &&
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
