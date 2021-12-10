import { oneRay, ZERO_ADDRESS } from '../../helpers/constants';
import { IBendConfiguration, eEthereumNetwork } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyWETH,
  strategyDAI,
  strategyUSDC,
} from './reservesConfigs';
import {
  strategyWPUNKS,
  strategyBAYC,
  strategyNftClassC,
} from './nftsConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const BendConfig: IBendConfiguration = {
  ...CommonsConfig,
  MarketId: 'Bend genesis market',
  ProviderId: 1,
  ReservesConfig: {
    WETH: strategyWETH,
    DAI: strategyDAI,
    USDC: strategyUSDC,
  },
  NftsConfig: {
    WPUNKS: strategyWPUNKS,
    BAYC: strategyBAYC,
  },
  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.localhost]: {
      DAI: '0x51bda59320165617F7209a38D08b11ccefF58F1a',
      USDC: '0x816b2d94590fbcE4C06a70FBb770323166867549',
      WETH: '0x7326573C3689831ADBf8050F1e5a2fB31C8441d8',
    },
    [eEthereumNetwork.rinkeby]: {
      DAI: '0x56C0dab0209Ad53C8de55480167667b4884e3d0F',
      USDC: '0xA535aA6A943706c589616f982d0d05f50710C8A7',
      WETH: '0x585d17A346cb99849a539F553f4d542D7e5B5B28',
    },
    [eEthereumNetwork.main]: {
      DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    },
  },
  NftsAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.localhost]: {
      WPUNKS: '0xD024caf0B8667D0D50e87C35Da1AF295ccd96CeC',
      BAYC: '0xb16101f4b859580B810b683264102c49e12d0732',
    },
    [eEthereumNetwork.rinkeby]: {
      WPUNKS: '0x5b4FaC380a2A79EE0ddA713a31cbA7A74Cba7Cd0',
      BAYC: '0x6b81840bc2E607C1Ea099D7BD93957608CEB3947',
    },
    [eEthereumNetwork.main]: {
      WPUNKS: '0xb7F7F6C52F2e2fdb1963Eab30438024864c313F6',
      BAYC: '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d',
    },
  },
};

export default BendConfig;
