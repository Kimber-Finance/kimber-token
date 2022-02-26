import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {InitializableAdminUpgradeabilityProxy, KimberToken} from '../typechain';

export enum ContractId {
  KimberToken = 'KimberToken',
  InitializableAdminUpgradeabilityProxy = 'InitializableAdminUpgradeabilityProxy',
  MockKimberTokenV2 = 'MockKimberTokenV2',
  MockDoubleTransfer = 'MockDoubleTransfer',
}

export enum ContractType {
  KimberToken = 'KimberToken',
}

export enum Network {
  hardhat = 'hardhat',
  localhost = 'localhost',
  kovan = 'kovan',
  mainnet = 'mainnet',
  ropsten = 'ropsten',
  tenderlyMain = 'tenderlyMain',
  bsctestnet = 'bsctestnet',
  bscmainnet = 'bscmainnet',
}

export type Address = string;

export type BaseNetworkConfig<T> = Record<Network, T>;

export type NetworkConfig<T> = BaseNetworkConfig<T>;

export interface BaseConfiguration {
  kimberAdmin: NetworkConfig<Address>;
  distributer: NetworkConfig<Address>;
}

export type Configuration = BaseConfiguration;

export enum ChainId {
  // MAINNET = 1,
  // ROPSTEN = 3,
  // RINKEBY = 4,
  // GÖRLI = 5,
  // KOVAN = 42,
  // BSC_MAINNET = 56,
  bscTestnet = 97,
  hardhat = 31337,
  localhost = 31337,
}

export enum DelegationType {
  VOTING_POWER,
  PROPOSITION_POWER,
}

export type ContractRecord = {
  kimberToken: KimberToken;
  kimberTokenImpl: KimberToken;
  kimberTokenProxy: InitializableAdminUpgradeabilityProxy;
};

export type User = {
  address: string;
  name: string;
  signer: SignerWithAddress;
} & ContractRecord;

export type Fixture = {
  deployer: User;
  admin: User;
  distributer: User;
  user1: User;
  user2: User;
  user3: User;
  user4: User;
  user5: User;
  chainId: number;
} & ContractRecord;

export type DbSchema = Record<ContractId, ContractDeployResult>;

export interface ContractDeployResult {
  network: string;
  address: string;
  deployer: string;
}
