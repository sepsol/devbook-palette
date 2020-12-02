import React, {
  useEffect,
  useRef,
  memo,
} from 'react';
import styled from 'styled-components';
import Highlight, { defaultProps } from 'prism-react-renderer';
import theme from 'prism-react-renderer/themes/vsDark';

import { CodeResult } from 'search/gitHub';

theme.plain.backgroundColor = '#2B2D2F';

const Container = styled.div<{ isFocused?: boolean }>`
  width: 100%;
  max-width: 100%;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  border-radius: 5px;
  border: 1px solid ${props => props.isFocused ? '#5d9bd4' : '#404244'};
`;

const Header = styled.div`
  width: 100%;
  max-width: 100%;
  padding: 10px;
  display: flex;
  flex-direction: column;
  background: #212122;
  border-top-left-radius: 5px;
  border-top-right-radius: 5px;
`;

const RepoName = styled.div`
  margin-bottom: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #676767;
  font-weight: 500;
  font-size: 13px;
`;

const FilePath = styled.div`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: rtl; // This so we can see the name of the file.
  text-align: left;
  color: #B0B1B2;
  font-weight: 500;
  font-size: 13px;
`;

const CodeWrapper = styled.div`
  width: 100%;
  height: 100%;
  background: #2B2D2F;
  border-bottom-left-radius: 5px;
  border-bottom-right-radius: 5px;
`;

const CodeSnippet = styled.div`
  :not(:last-child) {
    border-bottom: 1px solid #404244;
  }
`;

const Pre = styled.pre`
  height: 100%;
  margin: 0;
  padding: 10px;
  overflow: hidden;

  font-family: 'Roboto Mono';
  font-weight: 600;
  font-size: 13px;
  line-height: 17px;
  text-align: left;

  :last-child {
    border-bottom-left-radius: 5px;
    border-bottom-right-radius: 5px;
  }
`;

const LinesWrapper = styled.div`
  display: flex;
`;

const Line = styled.div`
  display: table-row;
`;

const LineNo = styled.span`
  padding-right: 1em;
  display: table-cell;
  user-select: none;

  color: #959697;
  text-align: right;
`;

const LineContent = styled.span`
  display: table-cell;
`;

const LinesNoWrapper = styled.div`
  display: table-column;
`;

const LinesContentWrapper = styled.div`
  display: table-column;
  overflow: auto;
`;

const Delimiter = styled.div`
  width: 100%;
  height: 1px;
  background: #404244;
`;

const MarkedSpan = styled.span`
  font-weight: 600;
  background: #534741;
`;

function isInRange(ranges: number[][], offset: number) {
  return ranges.some(([start, end]) => start < offset && end >= offset);
}

function getMarkedContent(ranges: number[][], content: string, startingOffset: number) {
  let markedAccumulator = '';
  let plainAccumulator = '';

  return Object.values(content)
    // Transform all chars from content and mark those that are in any ranges
    .map((char, i) => {
      const offset = startingOffset + i + 1;
      return {
        key: offset,
        content: char,
        marked: isInRange(ranges, offset),
      };
    })
    // Join continuos marked and unmarked sequences of chars and transform them to rendeable elements
    .reduce((newContent, curr, i, markedChars) => {
      if (curr.marked) {

        if (plainAccumulator.length > 0) {
          newContent.push(plainAccumulator);
          plainAccumulator = '';
        }

        markedAccumulator = markedAccumulator.concat(curr.content);
      } else {
        if (markedAccumulator.length > 0) {
          newContent.push(<MarkedSpan key={curr.key}>{markedAccumulator}</MarkedSpan>);
          markedAccumulator = '';
        }

        plainAccumulator = plainAccumulator.concat(curr.content);
      }

      if (i === markedChars.length - 1) {
        if (plainAccumulator.length > 0) {
          newContent.push(plainAccumulator);
        }
        if (markedAccumulator.length > 0) {
          newContent.push(<MarkedSpan key={curr.key}>{markedAccumulator}</MarkedSpan>);
        }
      }

      return newContent;
    }, [] as (string | JSX.Element)[]);
}

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

      <CodeWrapper>
        <CodeSnippet>
          {codeResult.filePreviews.map((el, idx) => (
            <React.Fragment key={idx}>
              <>
                <Highlight
                  {...defaultProps}
                  code={el.fragment}
                  theme={theme}
                  language="typescript" // TODO: Detect the fragment's language.
                >
                  {({
                    className,
                    style,
                    tokens,
                    getLineProps,
                    getTokenProps,
                  }) => (
                      <Pre className={className} style={style}>
                        {(() => {
                          const linesNos: JSX.Element[] = [];
                          const lines: JSX.Element[] = [];
                          let currentOffset = 0;

                          for (const [i, line] of tokens.entries()) {
                            const lineNoElement = (
                              <Line {...getLineProps({ line, key: i })}>
                                <LineNo>
                                  {el.startLine + i}
                                </LineNo>
                              </Line>
                            );

                            const lineElement = (
                              <Line {...getLineProps({ line, key: i })}>
                                <LineContent>
                                  {(() => {
                                    const tokens: JSX.Element[] = [];

                                    for (const [key, token] of line.entries()) {
                                      const tokenStartOffset = currentOffset;
                                      const tokenEndOffset = currentOffset + token.content.length;
                                      currentOffset = tokenEndOffset;

                                      const tokenProps = { ...getTokenProps({ token, key }) };
                                      const children = getMarkedContent(el.indices, tokenProps.children, tokenStartOffset + i);

                                      const markedTokenProps = {
                                        ...tokenProps,
                                        children,
                                      };

                                      const element = <span {...markedTokenProps} />;
                                      tokens.push(element);
                                    }

                                    return tokens;
                                  })()}
                                </LineContent>
                              </Line>
                            );
                            lines.push(lineElement);
                            linesNos.push(lineNoElement);
                          }

                          return (
                            <LinesWrapper>
                              <LinesNoWrapper>{linesNos}</LinesNoWrapper>
                              <LinesContentWrapper>{lines}</LinesContentWrapper>
                            </LinesWrapper>
                          );

                        })()}
                      </Pre>
                    )}
                </Highlight>
                {idx + 1 !== codeResult.filePreviews.length && <Delimiter />}
              </>
            </React.Fragment>
          ))}
        </CodeSnippet>
      </CodeWrapper>
    </Container>
  );
});

export default GitHubCodeItem;
