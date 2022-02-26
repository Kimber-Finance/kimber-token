import { waffleChai } from '@ethereum-waffle/chai';
import { TypedDataDomain } from '@ethersproject/abstract-signer';
import { _TypedDataEncoder } from '@ethersproject/hash';
import { expect, use } from 'chai';
import hre, { ethers } from 'hardhat';
import { Fixture } from '../types';
import { deployMockKimberTokenV2 } from '../utils/contractDeployer';
import setupFixture from '../utils/setupFixture';

const {Zero, MaxUint256, AddressZero} = ethers.constants;
const {utils, BigNumber} = ethers;

use(waffleChai);

describe('KIMBER Token', () => {
  const fixture = {} as Fixture;
  let domain: TypedDataDomain;
  const permitTypes = {
    Permit: [
      {name: 'owner', type: 'address'},
      {name: 'spender', type: 'address'},
      {name: 'value', type: 'uint256'},
      {name: 'nonce', type: 'uint256'},
      {name: 'deadline', type: 'uint256'},
    ],
  };

  before(async () => {
    Object.assign(fixture, await setupFixture());
    const {chainId, kimberToken} = fixture;
    domain = {
      name: 'Kimber Token',
      version: '1',
      chainId: chainId,
      verifyingContract: kimberToken.address,
    };
  });

  it('checks initial configurations', async () => {
    const {kimberToken} = fixture;

    expect(await kimberToken.name()).to.be.equal('Kimber Token', 'Invalid token name');
    expect(await kimberToken.symbol()).to.be.equal('KIMBER', 'Invalid token symbol');
    expect(await kimberToken.decimals()).to.be.equal(18, 'Invalid token decimals');
  });

  it('checks the domain separator', async () => {
    const {kimberToken, chainId} = fixture;
    const EIP712_DOMAIN = utils.keccak256(
      utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
    );
    const NAME = utils.keccak256(utils.toUtf8Bytes('Kimber Token'));
    const EIP712_REVISION = utils.keccak256(utils.toUtf8Bytes('1'));

    //need to pad address https://ethereum.stackexchange.com/questions/96697/soliditys-keccak256-hash-doesnt-match-web3-keccak-hash
    const DOMAIN_SEPARATOR_ENCODED = utils.solidityKeccak256(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'bytes32'],
      [EIP712_DOMAIN, NAME, EIP712_REVISION, chainId, utils.hexZeroPad(kimberToken.address, 32)]
    );

    expect(await kimberToken.DOMAIN_SEPARATOR()).to.be.equal(DOMAIN_SEPARATOR_ENCODED, 'Invalid domain separator');

    const domainSeparator = _TypedDataEncoder.hashDomain(domain);
    expect(await kimberToken.DOMAIN_SEPARATOR()).to.be.equal(domainSeparator, 'Invalid domain separator');
  });

  it('checks the revision', async () => {
    const {kimberToken} = fixture;

    expect((await kimberToken.REVISION()).toString()).to.be.equal('1', 'Invalid revision');
  });

  it('reverted: submitting a permit with 0 expiration', async () => {
    const {kimberToken, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const deadline = Zero;
    const nonce = await kimberToken._nonces(owner);
    const permitAmount = utils.parseEther('2');
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await kimberToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.kimberToken.permit(owner, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_EXPIRATION'
    );
    expect(await kimberToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_AFTER_PERMIT');
  });

  it('submits a permit with maximum expiration length', async () => {
    const {kimberToken, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const expiration = MaxUint256;
    const nonce = await kimberToken._nonces(owner);
    const permitAmount = utils.parseEther('2').toString();
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline: expiration,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await kimberToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.kimberToken.permit(owner, spender, permitAmount, expiration, v, r, s)).not.to.be.reverted;
    expect(await kimberToken.allowance(owner, spender)).to.be.equal(permitAmount, 'INVALID_ALLOWANCE_AFTER_PERMIT');
    expect(await kimberToken._nonces(owner)).to.be.equal(BigNumber.from(1));
  });

  it('cancels the previous permit', async () => {
    const {kimberToken, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const expiration = MaxUint256;
    const nonce = await kimberToken._nonces(owner);
    const permitAmount = Zero;
    const prevPermitAmount = utils.parseEther('2');
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline: expiration,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await kimberToken.allowance(owner, spender)).to.be.equal(prevPermitAmount, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.kimberToken.permit(owner, spender, permitAmount, expiration, v, r, s)).not.to.be.reverted;
    expect(await kimberToken.allowance(owner, spender)).to.be.equal(permitAmount, 'INVALID_ALLOWANCE_AFTER_PERMIT');
    expect(await kimberToken._nonces(owner)).to.be.equal(BigNumber.from(2));
  });

  it('reverted: submit a permit with invalid nonce', async () => {
    const {kimberToken, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const deadline = MaxUint256;
    const nonce = BigNumber.from(1000);
    const permitAmount = utils.parseEther('2');
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await kimberToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.kimberToken.permit(owner, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
  });

  it('reverted: submit a permit with invalid expiration (previous to the current block)', async () => {
    const {kimberToken, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const deadline = BigNumber.from(1);
    const nonce = await kimberToken._nonces(owner);
    const permitAmount = utils.parseEther('2');
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await kimberToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.kimberToken.permit(owner, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_EXPIRATION'
    );
  });

  it('reverted: submit a permit with invalid signature', async () => {
    const {kimberToken, deployer, user1, user2} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const deadline = MaxUint256;
    const nonce = await kimberToken._nonces(owner);
    const permitAmount = utils.parseEther('2');
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await kimberToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.kimberToken.permit(owner, AddressZero, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
    await expect(user1.kimberToken.permit(owner, user2.address, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
    await expect(user1.kimberToken.permit(user2.address, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_SIGNATURE'
    );
  });

  it('reverted: submit a permit with invalid owner', async () => {
    const {kimberToken, deployer, user1} = fixture;
    const owner = deployer.address;
    const spender = user1.address;
    const deadline = MaxUint256;
    const nonce = await kimberToken._nonces(owner);
    const permitAmount = utils.parseEther('2');
    const value = {
      owner,
      spender,
      nonce,
      value: permitAmount,
      deadline,
    };
    const sig = await deployer.signer._signTypedData(domain, permitTypes, value);
    const {r, s, v} = utils.splitSignature(sig);

    expect(await kimberToken.allowance(owner, spender)).to.be.equal(Zero, 'INVALID_ALLOWANCE_BEFORE_PERMIT');
    await expect(user1.kimberToken.permit(AddressZero, spender, permitAmount, deadline, v, r, s)).to.be.revertedWith(
      'INVALID_OWNER'
    );
  });

  it('checks the total supply', async () => {
    const {kimberToken} = fixture;
    const totalSupply = await kimberToken.totalSupplyAt('0');
    expect(totalSupply).equal(utils.parseEther('10000000'));
  });

  it('updates the implementation of the Kimber token to V2', async () => {
    const {admin, kimberToken} = fixture;

    const totalSupply = await kimberToken.totalSupply();

    const mockTokenV2 = await deployMockKimberTokenV2(hre);

    const encodedIntialize = mockTokenV2.interface.encodeFunctionData('initialize');

    await admin.kimberTokenProxy.upgradeToAndCall(mockTokenV2.address, encodedIntialize);

    expect((await kimberToken.REVISION()).toString()).to.be.equal('2', 'Invalid revision');
    expect(await kimberToken.name()).to.be.equal('Kimber Token', 'Invalid token name');
    expect(await kimberToken.symbol()).to.be.equal('KIMBER', 'Invalid token symbol');
    expect((await kimberToken.decimals()).toString()).to.be.equal('18', 'Invalid token decimals');
    expect(await kimberToken.totalSupply()).to.be.equal(totalSupply, 'New version should not mint new token');
  });
});
