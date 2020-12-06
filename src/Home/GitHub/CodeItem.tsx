import React, {
  useEffect,
  useRef,
  memo,
  useMemo,
} from 'react';
import styled from 'styled-components';

import { CodeResult } from 'search/gitHub';
import Code from './Code';

const Container = styled.div<{ isFocused?: boolean }>`
  width: 100%;
  max-width: 100%;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border-radius: 5px;
  border: 1px solid ${props => props.isFocused ? '#3A41AF' : '#2F2E3C'};
`;

const Header = styled.div`
  width: 100%;
  max-width: 100%;
  padding: 10px;
  display: flex;
  flex-direction: column;
  border-top-left-radius: 5px;
  border-top-right-radius: 5px;
`;

const RepoName = styled.div`
  margin-bottom: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #5A5A6F;
  font-weight: 500;
  font-size: 13px;
`;

const FilePath = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: rtl; // This so we can see the name of the file.
  text-align: left;
  color: #9CACC5;
  font-weight: 500;
  font-size: 13px;
`;

export interface GitHubCodeItemProps {
  codeResult: CodeResult;
  isFocused?: boolean;
}

const GitHubCodeItem = memo(({
  codeResult,
  isFocused,
}: GitHubCodeItemProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused) containerRef?.current?.scrollIntoView(false);
  }, [isFocused]);

  const MemoizedCode = useMemo(() => Code({ filePreviews: codeResult.filePreviews }), [codeResult]);

  return (
    <Container
      ref={containerRef}
      isFocused={isFocused}
    >

      <Header>
        <RepoName>
          {codeResult.repoFullName}
        </RepoName>
        <FilePath>
          {codeResult.filePath}
        </FilePath>
      </Header>

      {MemoizedCode}

    </Container>
  );
});

export default GitHubCodeItem;