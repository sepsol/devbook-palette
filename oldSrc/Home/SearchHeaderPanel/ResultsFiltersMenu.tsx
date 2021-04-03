import React from 'react';
import styled from 'styled-components';

import electron from 'mainCommunication';
import Hotkey, { Key } from '../HotkeysPanel/Hotkey';

const Container = styled.div`
  display: flex;
  align-items: center;
`;

const Filter = styled.div`
  margin-right: 10px;
  display: flex;
  align-items: center;
`;

const FilterButton = styled.button<{ selected?: boolean }>`
  color: ${props => props.selected ? 'white' : '#5A5A6F'};
  font-family: 'Poppins';
  font-size: 15px;
  font-weight: 500;

  background: none;
  border: none;

  :hover {
    transition: background 170ms ease-in;
    cursor: pointer;
    color: white;
  }
`;

export enum ResultsFilter {
  StackOverflow = 'StackOverflow',
  Docs = 'Docs',
}

interface ResultsFiltersMenuProps {
  activeFilter: ResultsFilter;
  onFilterSelect: (f: ResultsFilter) => void;
}

function ResultsFiltersMenu({
  activeFilter,
  onFilterSelect,
}: ResultsFiltersMenuProps) {

  function getResultsFilterDisplayName(resultsFilter: ResultsFilter) {
    return resultsFilter;
  }

  return (
    <Container>
      {Object.values(ResultsFilter).map((f, idx) => (
        <Filter
          key={f}
        >
          <FilterButton
            selected={activeFilter === f}
            onClick={() => onFilterSelect(f)}
          >{getResultsFilterDisplayName(f)}
          </FilterButton>
          {electron.remote.process.platform === 'darwin' &&
            <Hotkey
              hotkey={[Key.Command, `${idx + 1}`]}
            />
          }
          {electron.remote.process.platform !== 'darwin' &&
            <Hotkey
              hotkey={['Alt + ', `${idx + 1}`]}
            />
          }
        </Filter>
      ))}
    </Container>
  );
}

export default ResultsFiltersMenu;