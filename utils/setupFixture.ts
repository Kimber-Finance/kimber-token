import { Contract } from 'ethers';
import { deployments, getNamedAccounts } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { InitializableAdminUpgradeabilityProxy, KimberToken } from '../typechain';
import { ContractId, ContractRecord, Fixture, User } from '../types';
import { enumKeys } from '../utils';
import { getContractAt } from './contractGetter';
import getConfig from './getConfig';

async function setupUser<T extends {[contractName: string]: Contract}>(
  hre: HardhatRuntimeEnvironment,
  address: string,
  contract: T,
  name?: string
): Promise<User & T> {
  const signer = await hre.ethers.getSigner(address);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user: any = {address, name: name ? name : address, signer} as User & T;
  for (const key of enumKeys(contract)) {
    user[key] = contract[key].connect(signer);
  }

  return user;
}

export const setupFixture = deployments.createFixture(async (hre: HardhatRuntimeEnvironment) => {
  const config = getConfig();

  await deployments.fixture(['testEnv']);

  const kimberTokenProxy = (await hre.ethers.getContract(
    ContractId.InitializableAdminUpgradeabilityProxy
  )) as InitializableAdminUpgradeabilityProxy;
  const kimberTokenImpl = (await hre.ethers.getContract(ContractId.KimberToken)) as KimberToken;
  const kimberToken = await getContractAt<KimberToken>(hre, ContractId.KimberToken, kimberTokenProxy.address);

  const contract: ContractRecord = {
    kimberToken,
    kimberTokenImpl,
    kimberTokenProxy,
  };

  const {deployer, admin, distributer, user1, user2, user3, user4, user5} = await getNamedAccounts();

  const chainId = parseInt(await hre.getChainId());
  if (!chainId) {
    throw new Error("Current network doesn't have CHAIN ID");
  }

  return {
    ...contract,
    deployer: await setupUser(hre, deployer, contract, 'deployer'),
    admin: await setupUser(hre, admin, contract, 'admin'),
    distributer: await setupUser(hre, distributer, contract, 'distributer'),
    user1: await setupUser(hre, user1, contract, 'user1'),
    user2: await setupUser(hre, user2, contract, 'user2'),
    user3: await setupUser(hre, user3, contract, 'user3'),
    user4: await setupUser(hre, user4, contract, 'user4'),
    user5: await setupUser(hre, user5, contract, 'user5'),
    config: config,
    chainId,
  } as Fixture;
});

export default setupFixture;
