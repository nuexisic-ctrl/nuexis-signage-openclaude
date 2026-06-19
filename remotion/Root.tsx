import React from 'react';
import {Composition} from 'remotion';
import {ScreenPairingOnboarding} from './ScreenPairingOnboarding';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="ScreenPairingOnboarding"
    component={ScreenPairingOnboarding}
    durationInFrames={600}
    fps={30}
    width={1920}
    height={1080}
  />
);
