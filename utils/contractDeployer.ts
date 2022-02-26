import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {InitializableAdminUpgradeabilityProxy, KimberToken, MockDoubleTransfer, MockKimberTokenV2} from '../typechain';
import {Address, ContractId, ContractType} from '../types';
import {getContractAt} from './contractGetter';
import registerContractInJsonDb from './registerContractInJsonDb';

export const deployKimberToken = async (hre: HardhatRuntimeEnvironment): Promise<KimberToken> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.KimberToken;
  const result = await deploy(contract, {
    from: deployer,
    contract,
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.KimberToken, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

export const deployInitializableAdminUpgradeabilityProxy = async (
  hre: HardhatRuntimeEnvironment
): Promise<InitializableAdminUpgradeabilityProxy> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.InitializableAdminUpgradeabilityProxy;
  const result = await deploy(contract, {
    from: deployer,
    contract,
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.KimberToken, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

export const deployMockKimberTokenV2 = async (hre: HardhatRuntimeEnvironment): Promise<MockKimberTokenV2> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.MockKimberTokenV2;
  const result = await deploy(contract, {
    from: deployer,
    contract,
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.KimberToken, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};

export const deployMockDoubleTransfer = async (
  hre: HardhatRuntimeEnvironment,
  token: Address
): Promise<MockDoubleTransfer> => {
  const {
    deployments: {deploy},
    getNamedAccounts,
    network,
  } = hre;
  const {deployer} = await getNamedAccounts();
  const contract = ContractId.MockDoubleTransfer;
  const result = await deploy(contract, {
    from: deployer,
    contract,
    args: [token],
  });
  console.log(`${contract}:\t ${result.address}`);
  await registerContractInJsonDb(ContractType.KimberToken, contract, network.name, result);

  return await getContractAt(hre, contract, result.address);
};
