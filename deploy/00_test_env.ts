import {DeployFunction} from 'hardhat-deploy/types';
import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {parseNetwork} from '../utils';
import {deployInitializableAdminUpgradeabilityProxy, deployKimberToken} from '../utils/contractDeployer';
import {waitForTx} from '../utils/hhNetwork';

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const {network} = parseNetwork(hre.network.name);
  console.log(`***** using network ${network}  *****`);

  const {getNamedAccounts} = hre;
  const {admin, distributer} = await getNamedAccounts();

  const kimberTokenImpl = await deployKimberToken(hre);
  const kimberTokenProxy = await deployInitializableAdminUpgradeabilityProxy(hre);
  const encodedIntialize = kimberTokenImpl.interface.encodeFunctionData('initialize', [distributer]);

  await waitForTx(
    await kimberTokenProxy['initialize(address,address,bytes)'](kimberTokenImpl.address, admin, encodedIntialize)
  );
};

export default func;
func.tags = ['testEnv'];
