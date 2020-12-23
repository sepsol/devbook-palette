import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useReducer,
  useMemo,
} from 'react';
import styled from 'styled-components';
import { useHotkeys } from 'react-hotkeys-hook';

import electron, {
  isDev,
  hideMainWindow,
  connectGitHub,
  openLink,
  createTmpFile,
  trackModalOpened,
  trackSearch,
  trackShortcut,
  saveQuery,
  getSavedQuery,
} from 'mainProcess';
import useDebounce from 'hooks/useDebounce';
import {
  search as searchStackOverflow,
  StackOverflowResult,
} from 'search/stackOverflow';
import {
  searchCode as searchGitHubCode,
  CodeResult,
  init as initGitHub,
  disconnect as disconnectGitHub,
  FilePreview,
} from 'search/gitHub';

import SearchInput, { ResultsFilter } from './SearchInput';
import HotkeysPanel from './HotkeysPanel';
import { Key } from './HotkeysPanel/Hotkey';
import FocusState from './SearchItemFocusState';
import StackOverflowModal from './StackOverflow/StackOverflowModal';
import StackOverflowItem from './StackOverflow/StackOverflowItem';
import CodeItem from './GitHub/CodeItem';
import CodeModal from './GitHub/CodeModal';
import useIPCRenderer from 'hooks/useIPCRenderer';
import Button from 'components/Button';

const Container = styled.div`
  height: 100%;
  display: flex;
  flex-direction: column;
`;

const SearchResultsWrapper = styled.div`
  flex: 1;
  padding: 10px 15px 10px;

  overflow: hidden;
  overflow-y: overlay;
`;

const InfoMessage = styled.div`
  margin: 100px auto 0;

  color: #5A5A6F;
  font-size: 16px;
  font-weight: 600;
`;

const GitHubConnect = styled.div`
  margin: 100px auto 0;
  display: flex;
  align-items: center;
  flex-direction: column;
`;

const ConnectGitHubButton = styled(Button)`
  margin-bottom: 15px;
  padding: 10px 20px;

  font-size: 15px;
  font-weight: 500;

  border-radius: 5px;
`;

const GitHubConnectTitle = styled(InfoMessage)`
  margin: 0 0 30px;
`;

// const GitHubPrivacyLink = styled.div`
//   color: #535BD7;
//   font-size: 14px;
//   font-weight: 500;

//   text-decoration: underline;

//   :hover {
//     cursor: pointer;
//   }
// `;


type SearchResultItem = StackOverflowResult | CodeResult;
type SearchResultItems = StackOverflowResult[] | CodeResult[];
type SearchResults = {
  [key in ResultsFilter]: {
    items: SearchResultItems;
    isLoading: boolean;
    scrollTopPosition: number;
    focusedIdx: {
      idx: number;
      focusState: FocusState;
    };
  }
}

enum ReducerActionType {
  SetSearchQuery,
  SetSearchFilter,

  CacheScrollTopPosition,
  CacheSearchQuery,
  ClearResults,

  StartSearching,
  SearchingSuccess,
  SearchingFail,

  FocusResultItem,

  OpenModal,
  CloseModal,

  StartConnectingGitHub,
  ConnectingGitHubSuccess,
  ConnectingGitHubFail,
  DisconnectGitHubAccount,
}

interface SetSearchQuery {
  type: ReducerActionType.SetSearchQuery;
  payload: {
    query: string;
  };
}

interface SetSearchFilter {
  type: ReducerActionType.SetSearchFilter;
  payload: {
    filter: ResultsFilter;
  };
}

interface CacheScrollTopPosition {
  type: ReducerActionType.CacheScrollTopPosition;
  payload: {
    filter: ResultsFilter;
    scrollTopPosition: number;
  };
}

interface CacheSearchQuery {
  type: ReducerActionType.CacheSearchQuery;
  payload: {
    query: string;
  };
}

interface ClearResults {
  type: ReducerActionType.ClearResults;
}

interface StartSearching {
  type: ReducerActionType.StartSearching;
  payload: {
    filter: ResultsFilter;
  };
}

interface SearchingSuccess {
  type: ReducerActionType.SearchingSuccess;
  payload: {
    filter: ResultsFilter;
    items: SearchResultItems;
  };
}

interface SearchingFail {
  type: ReducerActionType.SearchingFail;
  payload: {
    filter: ResultsFilter;
    errorMessage: string;
  };
}

interface FocusResultItem {
  type: ReducerActionType.FocusResultItem;
  payload: {
    filter: ResultsFilter;
    idx: number;
    focusState: FocusState;
  };
}

interface OpenModal {
  type: ReducerActionType.OpenModal;
  payload: {
    item: SearchResultItem;
  };
}

interface CloseModal {
  type: ReducerActionType.CloseModal;
}

interface StartConnectingGitHub {
  type: ReducerActionType.StartConnectingGitHub;
}

interface ConnectingGitHubSuccess {
  type: ReducerActionType.ConnectingGitHubSuccess;
}

interface ConnectingGitHubFail {
  type: ReducerActionType.ConnectingGitHubFail;
  payload: {
    errorMessage: string;
  };
}

interface DisconnectGitHubAccount {
  type: ReducerActionType.DisconnectGitHubAccount;
}

type ReducerAction = SetSearchQuery
  | SetSearchFilter
  | CacheScrollTopPosition
  | CacheSearchQuery
  | ClearResults
  | StartSearching
  | SearchingSuccess
  | SearchingFail
  | FocusResultItem
  | OpenModal
  | CloseModal
  | StartConnectingGitHub
  | ConnectingGitHubSuccess
  | ConnectingGitHubFail
  | DisconnectGitHubAccount;

interface State {
  search: {
    query: string;
    lastSearchedQuery: string;
    filter: ResultsFilter;
  };
  results: SearchResults;
  modalItem: SearchResultItem | undefined;
  gitHubAccount: {
    isLoading: boolean;
    isConnected: boolean;
  },
  errorMessage: string;
}

const initialState: State = {
  search: {
    query: '',
    lastSearchedQuery: '',
    // TODO: Since we load the last saved search query we should also load
    // the last saved results filter.
    filter: ResultsFilter.StackOverflow,
  },
  results: {
    [ResultsFilter.StackOverflow]: {
      items: [],
      isLoading: false,
      scrollTopPosition: 0,
      focusedIdx: {
        idx: 0,
        focusState: FocusState.NoScroll,
      },
    },
    [ResultsFilter.GitHubCode]: {
      items: [],
      isLoading: false,
      scrollTopPosition: 0,
      focusedIdx: {
        idx: 0,
        focusState: FocusState.NoScroll,
      },
    },
  },
  modalItem: undefined,
  gitHubAccount: {
    isLoading: false,
    isConnected: false,
  },
  errorMessage: '',
}

function stateReducer(state: State, reducerAction: ReducerAction): State {
  if (isDev) {
    console.log(ReducerActionType[reducerAction.type], (reducerAction as any).payload || {}, state);
  }

  switch (reducerAction.type) {
    case ReducerActionType.SetSearchQuery: {
      const { query } = reducerAction.payload;
      return {
        ...state,
        search: {
          ...state.search,
          query,
        },
      };
    }
    case ReducerActionType.ClearResults: {
      return {
        ...state,
        search: {
          ...state.search,
          query: '',
          lastSearchedQuery: '',
        },
        results: {
          ...initialState.results,
        },
      };
    }
    case ReducerActionType.CacheScrollTopPosition: {
      const { filter, scrollTopPosition } = reducerAction.payload;
      return {
        ...state,
        results: {
          ...state.results,
          [filter]: {
            ...state.results[filter],
            scrollTopPosition,
          },
        },
      };
    }
    case ReducerActionType.CacheSearchQuery: {
      // TODO: Should this be a reducer action?
      const { query } = reducerAction.payload;
      saveQuery(query);
      return { ...state };
    }
    case ReducerActionType.SetSearchFilter: {
      const { filter } = reducerAction.payload;
      return {
        ...state,
        search: {
          ...state.search,
          filter,
        },
        results: {
          ...state.results,
          [filter]: {
            ...state.results[filter],
            focusedIdx: {
              ...state.results[filter].focusedIdx,
              // We want to disable automatic scrolling to the focused
              // element. When a user is changing filters we should
              // respect the cached scroll position instead. This position
              // might be different then the position of a focused element.
              state: FocusState.NoScroll,
            },
          },
        },
      };
    }
    case ReducerActionType.StartSearching: {
      const { filter } = reducerAction.payload;
      return {
        ...state,
        results: {
          ...state.results,
          [filter]: {
            ...state.results[filter],
            items: [],
            isLoading: true,
          },
        },
      };
    }
    case ReducerActionType.SearchingSuccess: {
      const { filter, items } = reducerAction.payload;
      return {
        ...state,
        search: {
          ...state.search,
          lastSearchedQuery: state.search.query,
        },
        results: {
          ...state.results,
          [filter]: {
            ...state.results[filter],
            isLoading: false,
            items,
            focusedIdx: {
              ...state.results[filter].focusedIdx,
              idx: 0,
              state: FocusState.NoScroll,
            },
          },
        },
      };
    }
    case ReducerActionType.SearchingFail: {
      const { filter, errorMessage } = reducerAction.payload;
      return {
        ...state,
        errorMessage,
        results: {
          ...state.results,
          [filter]: {
            ...state.results[filter],
            isLoading: false,
            items: [],
          },
        },
      };
    }
    case ReducerActionType.FocusResultItem: {
      const { filter, idx, focusState } = reducerAction.payload;
      return {
        ...state,
        results: {
          ...state.results,
          [filter]: {
            ...state.results[filter],
            focusedIdx: {
              ...state.results[filter].focusedIdx,
              idx,
              focusState,
            },
          },
        },
      };
    }
    case ReducerActionType.OpenModal: {
      const { item } = reducerAction.payload;
      return {
        ...state,
        modalItem: item,
      };
    }
    case ReducerActionType.CloseModal: {
      return {
        ...state,
        modalItem: undefined,
      };
    }
    case ReducerActionType.StartConnectingGitHub: {
      return {
        ...state,
        gitHubAccount: {
          ...state.gitHubAccount,
          isLoading: true,
          isConnected: false,
        },
      };
    }
    case ReducerActionType.ConnectingGitHubSuccess: {
      return {
        ...state,
        gitHubAccount: {
          ...state.gitHubAccount,
          isLoading: false,
          isConnected: true,
        },
      };
    }
    case ReducerActionType.ConnectingGitHubFail: {
      const { errorMessage } = reducerAction.payload;
      return {
        ...state,
        errorMessage,
        gitHubAccount: {
          ...state.gitHubAccount,
          isLoading: false,
          isConnected: false,
        },
      };
    }
    case ReducerActionType.DisconnectGitHubAccount: {
      return {
        ...state,
        gitHubAccount: {
          ...state.gitHubAccount,
          isLoading: false,
          isConnected: false,
        },
      };
    }
    default:
      return state;
  }
}


function Home() {
  const searchResultsWrapperEl = useRef<HTMLDivElement>(null);
  const [state, dispatch] = useReducer(stateReducer, initialState);

  const debouncedQuery = useDebounce(state.search.query.trim(), 400);
  const debouncedLastSearchedQuery = useDebounce(state.search.lastSearchedQuery.trim(), 400);

  const activeFilter = useMemo(() => state.search.filter, [state.search.filter]);

  const activeFocusedIdx = useMemo(() => {
    return state.results[activeFilter].focusedIdx;
  }, [state.results, activeFilter]);

  const activeFocusedItem = useMemo(() => {
    return state.results[activeFilter].items[activeFocusedIdx.idx];
  }, [state.results, activeFilter, activeFocusedIdx]);

  const hasActiveFilterEmptyResults = useMemo(() => {
    return state.results[activeFilter].items.length === 0;
  }, [state.results, activeFilter]);

  const isActiveFilterLoading = useMemo(() => {
    return state.results[activeFilter].isLoading;
  }, [state.results, activeFilter]);

  // Dispatch helpers
  const setSearchQuery = useCallback((query: string) => {
    dispatch({
      type: ReducerActionType.SetSearchQuery,
      payload: { query },
    });
  }, []);

  const cacheScrollTopPosition = useCallback((filter: ResultsFilter, scrollTopPosition: number) => {
    dispatch({
      type: ReducerActionType.CacheScrollTopPosition,
      payload: { filter, scrollTopPosition },
    });
  }, []);

  const setSearchFilter = useCallback((filter: ResultsFilter) => {
    if (searchResultsWrapperEl?.current) {
      // Cache the scroll bar position for the current active filter.
      const currentScrollTop = searchResultsWrapperEl.current.scrollTop;
      console.log('CURRENT', currentScrollTop);
      cacheScrollTopPosition(state.search.filter, currentScrollTop);

      // Set the scroll bar position for the filter that a user wants
      // to set as an active.
      const newScrollTop = state.results[filter].scrollTopPosition;
      searchResultsWrapperEl.current.scrollTo(0, newScrollTop);
    }

    dispatch({
      type: ReducerActionType.SetSearchFilter,
      payload: { filter },
    });
  }, [state.search.filter, state.results]);

  const cacheSearchQuery = useCallback((query: string) => {
    dispatch({
      type: ReducerActionType.CacheSearchQuery,
      payload: { query },
    });
  }, []);

  const clearResults = useCallback(() => {
    dispatch({
      type: ReducerActionType.ClearResults,
    });
  }, []);

  const startSearching = useCallback((filter: ResultsFilter) => {
    dispatch({
      type: ReducerActionType.StartSearching,
      payload: { filter },
    });
  }, []);

  const searchingSuccess = useCallback((filter: ResultsFilter, items: SearchResultItems) => {
   dispatch({
     type: ReducerActionType.SearchingSuccess,
     payload: { filter, items },
   });
  }, []);

  const searchingFail = useCallback((filter: ResultsFilter, errorMessage: string) => {
   dispatch({
     type: ReducerActionType.SearchingFail,
     payload: { filter, errorMessage },
   });
  }, []);

  const focusResultItem = useCallback((filter: ResultsFilter, idx: number, focusState: FocusState) => {
   dispatch({
     type: ReducerActionType.FocusResultItem,
     payload: { filter, idx, focusState },
   });
  }, []);

  const openModal = useCallback((item: SearchResultItem) => {
    let url = '';
    // TODO: This isn't a very good differentiation.
    // Can we do it better in a more TypeScript way?
    if ((item as StackOverflowResult).question) {
      // Item is StackOverflowResult.
      url = (item as StackOverflowResult).question.link;
    } else if ((item as CodeResult).fileURL) {
      // Item is CodeResult.
      url = (item as CodeResult).fileURL;
    }
    trackModalOpened({
      activeFilter: activeFilter.toString(),
      url,
    });
    dispatch({
      type: ReducerActionType.OpenModal,
      payload: { item },
    });
  }, [activeFilter]);

  const closeModal = useCallback(() => {
    dispatch({
      type: ReducerActionType.CloseModal,
    });
  }, []);

  const startConnectingGitHub = useCallback(() => {
    dispatch({
      type: ReducerActionType.StartConnectingGitHub,
    });
  }, []);

  const connectingGitHubSuccess = useCallback(() => {
    dispatch({
      type: ReducerActionType.ConnectingGitHubSuccess,
    });
  }, []);

  const connectingGitHubFail = useCallback((errorMessage: string) => {
    dispatch({
      type: ReducerActionType.ConnectingGitHubFail,
      payload: { errorMessage },
    });
  }, []);

  const disconnectGitHubAccount = useCallback(() => {
    dispatch({
      type: ReducerActionType.DisconnectGitHubAccount,
    });
  }, []);
  /////////

  const openFocusedSOItemInBrowser = useCallback(() => {
    const idx = state.results[ResultsFilter.StackOverflow].focusedIdx.idx;
    const item = state.results[ResultsFilter.StackOverflow].items[idx] as StackOverflowResult;
    if (item) openLink(item.question.link);
  }, [state.results]);

  const openFocusedGitHubCodeItemInVSCode = useCallback(() => {
    const idx = state.results[ResultsFilter.GitHubCode].focusedIdx.idx;
    const item = state.results[ResultsFilter.GitHubCode].items[idx] as CodeResult;
    if (!item) return;
    openFileInVSCode(item.filePath, item.fileContent, item.filePreviews);
  }, [state.results]);

  function openFocusedGitHubCodeItemInBrowser() {
    const idx = state.results[ResultsFilter.GitHubCode].focusedIdx.idx
    const item = state.results[ResultsFilter.GitHubCode].items[idx] as CodeResult;
    const firstPreview = item?.filePreviews[0];
    const gitHubFileURL = firstPreview ? `${item.fileURL}#L${firstPreview.startLine + 3}` : item?.fileURL;
    if (gitHubFileURL) openLink(gitHubFileURL);
  }

  // TODO: Create a reducer action.
  async function openFileInVSCode(path: string, content: string, filePreviews: FilePreview[]) {
    const tmpPath = await createTmpFile({
      filePath: path,
      fileContent: content,
    });
    if (tmpPath) {
      const firstPreview = filePreviews[0];
      const vscodeFileURL = firstPreview ? `vscode://file/${tmpPath}:${firstPreview.startLine + 3}` : `vscode://file/${tmpPath}`;
      await openLink(vscodeFileURL);
    } else {
      // TODO: Handle error for user.
      console.error('Cannot create tmp file with the file content.')
    }
  }

  async function searchGHCode(query: string) {
    try {
      startSearching(ResultsFilter.GitHubCode);
      const results = await searchGitHubCode(query);
      searchingSuccess(ResultsFilter.GitHubCode, results);
    } catch (error) {
      searchingFail(ResultsFilter.GitHubCode, error.message);
    }
  }
  async function searchSO(query: string) {
    try {
      startSearching(ResultsFilter.StackOverflow);
      const results = await searchStackOverflow(query);
      searchingSuccess(ResultsFilter.StackOverflow, results);
    } catch (error) {
      searchingFail(ResultsFilter.StackOverflow, error.message);
    }
  }

  async function searchAll(query: string, filter: ResultsFilter, isGitHubConnected: boolean) {
    switch (filter) {
      case ResultsFilter.StackOverflow:
        await searchSO(query);
        if (isGitHubConnected) {
          await searchGHCode(query);
        }
      break;

      case ResultsFilter.GitHubCode:
        if (isGitHubConnected) {
          await searchGHCode(query);
        }
        await searchSO(query);
      break;
    }
  }

  async function tryToLoadGitHubAccount() {
    try {
      startConnectingGitHub();
      await initGitHub();
      connectingGitHubSuccess();
    } catch (error) {
      connectingGitHubFail(`GitHub account either isn't connected or there was an error loading credentials. ${error.message}`);
    }
  }

  function handleSearchInputChange(e: any) {
    // User explicitely deleted the query. We should remove all results.
    if (!e.target.value) {
      clearResults();
      return;
    }
    setSearchQuery(e.target.value);
  }

  function handleSearchResultsWrapperScroll() {
    // User manually s
  }

  /* HOTKEYS */
  // 'cmd+1' hotkey - change search filter to SO questions.
  useHotkeys(electron.remote.process.platform === 'darwin' ? 'Cmd+1' : 'alt+1', () => {
    if (state.modalItem) return;
    setSearchFilter(ResultsFilter.StackOverflow);
    trackShortcut({ action: 'Change filter to SO' });
  }, { filter: () => true }, [state.modalItem, setSearchFilter]);

  // 'cmd+2' hotkey - change search filter to GitHub Code search.
  useHotkeys(electron.remote.process.platform === 'darwin' ? 'Cmd+2' : 'alt+2', () => {
    if (state.modalItem) return;
    setSearchFilter(ResultsFilter.GitHubCode);
    trackShortcut({ action: 'Change filter to Code' });
  }, { filter: () => true }, [state.modalItem, setSearchFilter]);

  // 'up arrow' hotkey - navigation.
  useHotkeys('up', () => {
    if (state.modalItem) return;
    const idx = state.results[activeFilter].focusedIdx.idx;
    if (idx > 0) {
      focusResultItem(activeFilter, idx - 1, FocusState.WithScroll);
    }
  }, { filter: () => true }, [state.results, activeFilter, state.modalItem]);

  // 'down arrow' hotkey - navigation.
  useHotkeys('down', () => {
    if (state.modalItem) return;
    const idx = state.results[activeFilter].focusedIdx.idx;
    if (idx < state.results[activeFilter].items.length - 1) {
      focusResultItem(activeFilter, idx + 1, FocusState.WithScroll);
    }
  }, { filter: () => true }, [state.results, activeFilter, state.modalItem]);

  // 'enter' hotkey - open the focused result in a modal.
  useHotkeys('enter', () => {
    openModal(state.results[activeFilter].items[activeFocusedIdx.idx]);
    trackShortcut({ action: 'Open modal' });
  }, [state.results, activeFilter, activeFocusedIdx]);

  // 'esc' hotkey - close modal or hide main window.
  useHotkeys('esc', () => {
    if (!state.modalItem) {
      hideMainWindow();
      trackShortcut({ action: 'Hide main window' });
    } else {
      closeModal();
      trackShortcut({ action: 'Close modal' });
    }
  }, [state.modalItem]);

  // 'cmd+o' hotkey - open the focused result in a browser.
  useHotkeys(electron.remote.process.platform === 'darwin' ? 'Cmd+o' : 'alt+o', () => {
    switch (activeFilter) {
      case ResultsFilter.StackOverflow:
        openFocusedSOItemInBrowser();
        trackShortcut({ action: 'Open SO item in browser' });
        break;
      case ResultsFilter.GitHubCode:
        openFocusedGitHubCodeItemInBrowser();
        trackShortcut({ action: 'Open Code item in browser' });
        break;
    }
  // TODO: This will stop working now.
  // }, [state.search.filter, soResults, soFocusedIdx, codeResults, codeFocusedIdx]);
  }, [activeFilter]);

  // 'cmd+i' hotkey - open the GitHubCode result in a vscode.
  useHotkeys(electron.remote.process.platform === 'darwin' ? 'Cmd+i' : 'alt+i', () => {
    if (activeFilter === ResultsFilter.GitHubCode) {
      openFocusedGitHubCodeItemInVSCode();
      trackShortcut({ action: 'Open code in VSCode' });
    }
  // TODO: This will stop working now.
  // }, [state.search.filter, codeResults, codeFocusedIdx]);
  }, [activeFilter]);
  /* //////////////////// */

  useIPCRenderer('github-access-token', async (event, { accessToken }: { accessToken: string | null }) => {
    if (accessToken === null) {
      disconnectGitHub();
      disconnectGitHubAccount(); // The state reducer's action.
      return;
    }
    tryToLoadGitHubAccount();
    if (debouncedQuery) searchGHCode(debouncedQuery);
  }, [debouncedQuery]);

  useEffect(() => {
    async function restoreLastQuery() {
      const lastQuery = await getSavedQuery();
      setSearchQuery(lastQuery);
    }
    restoreLastQuery();
    tryToLoadGitHubAccount();
  }, []);

  useEffect(() => {
    if (!state.errorMessage) return;
    console.error(state.errorMessage);
  }, [state.errorMessage]);

  useEffect(() => {
    if (!debouncedQuery) {
      cacheSearchQuery('');
      return;
    }
    if (debouncedQuery === debouncedLastSearchedQuery) return;

    searchAll(debouncedQuery, activeFilter, state.gitHubAccount.isConnected);
    cacheSearchQuery(debouncedQuery);
    trackSearch({
      activeFilter: activeFilter.toString(),
    });
  }, [debouncedQuery, debouncedLastSearchedQuery, activeFilter, state.gitHubAccount.isConnected]);

  return (
    <>
      {state.modalItem && activeFilter === ResultsFilter.StackOverflow &&
        <StackOverflowModal
          soResult={state.modalItem as StackOverflowResult}
          onCloseRequest={closeModal}
        />
      }

      {state.modalItem && activeFilter === ResultsFilter.GitHubCode &&
        <CodeModal
          codeResult={state.modalItem as CodeResult}
          onCloseRequest={closeModal}
        />
      }

      <Container>
        <SearchInput
          placeholder="Search StackOverflow and code on GitHub"
          value={state.search.query}
          onChange={handleSearchInputChange}
          activeFilter={activeFilter}
          onFilterSelect={f => setSearchFilter(f)}
          isLoading={isActiveFilterLoading}
          isModalOpened={!!state.modalItem}
        />

        {!state.search.query
         && (state.gitHubAccount.isConnected || activeFilter === ResultsFilter.StackOverflow)
         && !isActiveFilterLoading
         &&
          <InfoMessage>Type your search query</InfoMessage>
        }

        {state.search.query
         && (state.gitHubAccount.isConnected || activeFilter === ResultsFilter.StackOverflow)
         && hasActiveFilterEmptyResults
         && !isActiveFilterLoading
         &&
          <InfoMessage>Nothing found</InfoMessage>
        }

        {activeFilter === ResultsFilter.GitHubCode && !state.gitHubAccount.isConnected &&
          <GitHubConnect>
            <GitHubConnectTitle>
              Connect your GitHub account to search on GitHub
            </GitHubConnectTitle>
            <ConnectGitHubButton onClick={() => connectGitHub()}>
              Connect my GitHub account
            </ConnectGitHubButton>
            {/* <GitHubPrivacyLink onClick={openPrivacyTerms}>
              Read more about privacy and what access Devbook needs
            </GitHubPrivacyLink> */}
          </GitHubConnect>
        }

        {!hasActiveFilterEmptyResults && !isActiveFilterLoading &&
          <>
            <SearchResultsWrapper
              ref={searchResultsWrapperEl}
              onScroll={handleSearchResultsWrapperScroll}
            >
              {activeFilter === ResultsFilter.StackOverflow
               && (state.results[ResultsFilter.StackOverflow].items as StackOverflowResult[]).map((sor, idx) => (
                <StackOverflowItem
                  key={idx}
                  soResult={sor}
                  focusState={activeFocusedIdx.idx === idx ? activeFocusedIdx.focusState : FocusState.None}
                  onHeaderClick={() => focusResultItem(ResultsFilter.StackOverflow, idx, FocusState.NoScroll)}
                  onTitleClick={() => openModal(sor)}
                />
              ))}

              {activeFilter === ResultsFilter.GitHubCode
               && state.gitHubAccount.isConnected
               && (state.results[ResultsFilter.GitHubCode].items as CodeResult[]).map((cr, idx) => (
                <CodeItem
                  key={idx}
                  codeResult={cr}
                  focusState={activeFocusedIdx.idx === idx ? activeFocusedIdx.focusState : FocusState.None}
                  onHeaderClick={() => focusResultItem(ResultsFilter.GitHubCode, idx, FocusState.NoScroll)}
                  onFilePathClick={() => openModal(cr)}
                />
              ))}
            </SearchResultsWrapper>

            {/* StackOverflow search results + StackOverflow modal hotkeys */}
            {!state.modalItem && activeFilter === ResultsFilter.StackOverflow &&
              <HotkeysPanel
                hotkeysLeft={[
                  { text: 'Navigate', hotkey: [Key.ArrowUp, Key.ArrowDown], isSeparated: true },
                  { text: 'Open', hotkey: [Key.Enter], onClick: () => openModal(activeFocusedItem) },
                ]}
                hotkeysRight={[
                  {
                    text: 'Open in browser',
                    hotkey: electron.remote.process.platform === 'darwin' ? [Key.Command, 'O'] : ['Alt +', 'O'],
                    onClick: openFocusedSOItemInBrowser
                  },
                ]}
              />
            }

            {state.modalItem && activeFilter === ResultsFilter.StackOverflow &&
              <HotkeysPanel
                hotkeysLeft={[
                  {
                    text: 'Navigate',
                    hotkey: [Key.ArrowUp, Key.ArrowDown],
                    isSeparated: true,
                  },
                ]}
                hotkeysRight={[
                  {
                    text: 'Open in browser',
                    hotkey: electron.remote.process.platform === 'darwin' ? [Key.Command, 'O'] : ['Alt +', 'O'],
                    onClick: openFocusedSOItemInBrowser
                  },
                  {
                    text: 'Close',
                    hotkey: ['Esc'],
                    onClick: closeModal
                  },
                ]}
              />
            }
            {/*-------------------------------------------------------------*/}


            {/* GitHub search results + GitHub modal hotkeys */}
            {!state.modalItem && activeFilter === ResultsFilter.GitHubCode &&
              <HotkeysPanel
                hotkeysLeft={[
                  { text: 'Navigate', hotkey: [Key.ArrowUp, Key.ArrowDown], isSeparated: true },
                  { text: 'Open', hotkey: [Key.Enter], onClick: () => openModal(activeFocusedItem) },
                ]}
                hotkeysRight={[
                  {
                    text: 'Open in VSCode',
                    hotkey: electron.remote.process.platform === 'darwin' ? [Key.Command, 'I'] : ['Alt +', 'I'],
                    onClick: openFocusedGitHubCodeItemInVSCode
                  },
                  {
                    text: 'Open in browser',
                    hotkey: electron.remote.process.platform === 'darwin' ? [Key.Command, 'O'] : ['Alt +', 'O'],
                    onClick: openFocusedGitHubCodeItemInBrowser
                  },
                ]}
              />
            }

            {state.modalItem && activeFilter === ResultsFilter.GitHubCode &&
              <HotkeysPanel
                hotkeysLeft={[
                  {
                    text: 'Navigate',
                    hotkey: [Key.ArrowUp, Key.ArrowDown],
                    isSeparated: true
                  },
                ]}
                hotkeysRight={[
                  {
                    text: 'Open in VSCode',
                    hotkey: electron.remote.process.platform === 'darwin' ? [Key.Command, 'I'] : ['Alt +', 'I'],
                    onClick: openFocusedGitHubCodeItemInVSCode
                  },
                  {
                    text: 'Open in browser',
                    hotkey: electron.remote.process.platform === 'darwin' ? [Key.Command, 'O'] : ['Alt +', 'O'],
                    onClick: openFocusedGitHubCodeItemInBrowser
                  },
                  {
                    text: 'Close',
                    hotkey: ['Esc'],
                    onClick: closeModal,
                  },
                ]}
              />
            }
            {/*-------------------------------------------------------------*/}
          </>
        }
      </Container>
    </>
  );
}

export default Home;
