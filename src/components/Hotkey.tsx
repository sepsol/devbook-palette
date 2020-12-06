import React from 'react';
import styled from 'styled-components';

import { ReactComponent as shiftKeyImg } from 'img/shift-key.svg';
import { ReactComponent as altKeyImg } from 'img/alt-key.svg';
import { ReactComponent as cmdKeyImg } from 'img/cmd-key.svg';

const Container = styled.div`
  padding: 6px 8px;
  display: flex;
  align-items: center;
  justify-content: flex-start;

  color: white;
  border-radius: 5px;
  background: #262736;
`;

const CmdKeyImg = styled(cmdKeyImg)`
  width: auto;
  height: 11px;
  :not(:last-child) {
    margin-right: 7px;
  }
`;

const ShiftKeyImg = styled(shiftKeyImg)`
  width: auto;
  height: 11px;
  :not(:last-child) {
    margin-right: 7px;
  }

  path {
    fill: white;
  }
`;

const AltKeyImg = styled(altKeyImg)`
  // position: relative;
  // top: 1px;
  width: auto;
  height: 11px;
  :not(:last-child) {
    margin-right: 7px;
  }

  path {
    fill: white;
  }
`;

const Key = styled.div`
  :not(:last-child) {
    margin-right: 7px;
  }

  font-weight: 600;
  font-size: 13px;
  line-height: 9px;
`;

export enum ModifierKey {
  Alt = 'Alt',
  Shift = 'Shift',
  Cmd = 'Cmd',
}

interface HotkeyProps {
  hotkey: (string | ModifierKey)[];
}

function renderModifier(modifier: ModifierKey) {
  return (
    <>
      {modifier === ModifierKey.Alt && <AltKeyImg />}
      {modifier === ModifierKey.Shift && <ShiftKeyImg />}
      {modifier === ModifierKey.Cmd && <CmdKeyImg />}
    </>
  );
}

function Hotkey({ hotkey }: HotkeyProps) {
  return (
    <Container>
      {hotkey.map(el => (
        <React.Fragment key={el}>
          {Object.keys(ModifierKey).includes(el)
            ? renderModifier(el as ModifierKey)
            : <Key>{el as string}</Key>
          }
        </React.Fragment>
      ))}
    </Container>
  );
}

export default Hotkey;
